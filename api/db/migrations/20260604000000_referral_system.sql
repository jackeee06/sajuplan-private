-- 추천인 시스템 v2 (2026-06-04)
-- 1. member.referral_code — 상담사별 고유 추천 코드
-- 2. counselor_referral 테이블 — rate_snapshot / months_snapshot 컬럼 추가
--    (정책 변경 시 기존 추천 관계는 등록 당시 값 유지)
-- 3. setting — promotion.referral_rate / promotion.referral_months 기본값 삽입

-- ① member 테이블에 referral_code 추가
ALTER TABLE member
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- 기존 상담사에게 코드 일괄 발급 (CSR- + 8자리 랜덤 대문자+숫자)
UPDATE member
SET referral_code = 'CSR-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 8))
WHERE role = 'counselor'
  AND referral_code IS NULL;

-- ② counselor_referral 테이블 — 스냅샷 컬럼 추가
--    (테이블이 없으면 새로 생성, 있으면 컬럼만 추가)
CREATE TABLE IF NOT EXISTS counselor_referral (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT NOT NULL REFERENCES member(id),
  referee_id      BIGINT NOT NULL REFERENCES member(id),
  rate_snapshot   NUMERIC(5,4) NOT NULL DEFAULT 0.01,  -- 등록 당시 요율 (0.01 = 1%)
  months_snapshot INT          NOT NULL DEFAULT 3,      -- 등록 당시 기간
  registered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- 상담사 승인일
  expires_at      TIMESTAMPTZ  NOT NULL,                -- registered_at + months_snapshot 개월
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','suspended')),
  memo            TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referee_id)
);

ALTER TABLE counselor_referral
  ADD COLUMN IF NOT EXISTS rate_snapshot   NUMERIC(5,4) NOT NULL DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS months_snapshot INT          NOT NULL DEFAULT 3;

-- ③ counselor_referral_payment 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS counselor_referral_payment (
  id           BIGSERIAL PRIMARY KEY,
  referral_id  BIGINT      NOT NULL REFERENCES counselor_referral(id),
  pay_month    VARCHAR(7)  NOT NULL,   -- 'YYYY-MM'
  paid_amount  NUMERIC     NOT NULL DEFAULT 0,
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referral_id, pay_month)
);

-- ④ setting 테이블 — 추천인 정책 기본값
--    namespace='promotion', key='referral_rate'  → '0.01' (1%)
--    namespace='promotion', key='referral_months' → '3'
INSERT INTO setting (namespace, key, value, label, updated_at)
VALUES
  ('promotion', 'referral_rate',   '0.01', '추천 인센티브 요율 (소수, 0.01=1%)', NOW()),
  ('promotion', 'referral_months', '3',    '추천 인센티브 기간 (개월)',           NOW())
ON CONFLICT (namespace, key) DO NOTHING;
