-- 2026-05-22 소비포인트 / 수익포인트 분리
--
-- 문제: ID 단일화(2026-05-22) 이후, 회원→상담사 승급 케이스(라온선생 등)의
--       잔액이 한 컬럼(point.paid_balance)에 섞임.
--         - 회원이 결제로 산 코인(소비포인트)
--         - 상담사가 상담으로 번 코인(수익포인트, 정산 대상)
--       사고 시나리오: 상담사 적립금을 회원 결제 사용분으로 써버림 → 정산 사고.
--
-- 해결: point 테이블에 earning_balance 컬럼 추가하여 분리.
--         - free_balance    : 소비포인트 무료분 (이벤트/혜택)
--         - paid_balance    : 소비포인트 결제분 (회원이 결제로 산 코인)
--         - earning_balance : 수익포인트 (상담사가 상담 제공으로 번 코인, 미정산)
--
-- 분리 근거: point_history.rel_table 마커로 거래 종류 식별 가능
--         - 'consultation'        + earn_point > 0 → 상담사 적립 (수익포인트 +)
--         - 'settlement_monthly'  + use_point  > 0 → 정산 차감 (수익포인트 -)
--         - 'payment'/'payment_autopay'         → 회원 충전 (소비포인트 +)
--         - 'consultation'        + use_point  > 0 → 회원 상담 사용 (소비포인트 -)
--         - 'refund_request'                    → 회원 환불 회수 (소비포인트 -)
--
-- 트랜잭션 안에서 실행. 사고 시 ROLLBACK 으로 즉시 복구.
-- 백업: /backup/before-point-separation-20260522-2109-full.sql (prod 서버)
--      c:/claudeworkspace/sajumoon/backup/prod_20260522-2109_full.sql (로컬)
BEGIN;

-- =========================================================
-- 1) 스키마 변경: earning_balance 컬럼 추가
-- =========================================================
ALTER TABLE point
  ADD COLUMN IF NOT EXISTS earning_balance INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN point.free_balance    IS '소비포인트 무료분 잔액 (이벤트/혜택, 회원 상담 시 우선 차감)';
COMMENT ON COLUMN point.paid_balance    IS '소비포인트 결제분 잔액 (회원이 결제로 산 코인, 환불 가능)';
COMMENT ON COLUMN point.earning_balance IS '수익포인트 잔액 (상담사가 상담 제공으로 번 코인, 매월 1일 정산 대상)';

-- =========================================================
-- 2) 데이터 마이그레이션: 상담사 적립 흔적을 paid_balance → earning_balance 이전
-- =========================================================
-- 식별 기준: member.csrid IS NOT NULL AND csrid <> '' (상담사로 등록된 member)
--           AND point_history 의 consultation/settlement_monthly 합산
--
-- 계산: 상담사로서 적립한 누계 - 정산으로 차감된 누계 = 현재 미정산 수익포인트
-- 안전장치: GREATEST(..., 0) 로 음수 방지. paid_balance 도 음수 안되게 LEAST 가드.

WITH earning_per_member AS (
  SELECT
    ph.member_id,
    COALESCE(SUM(
      CASE WHEN ph.rel_table = 'consultation'        AND ph.earn_point > 0 THEN ph.earn_point ELSE 0 END
    ), 0) AS earned_from_consultation,
    COALESCE(SUM(
      CASE WHEN ph.rel_table = 'settlement_monthly'  AND ph.use_point  > 0 THEN ph.use_point  ELSE 0 END
    ), 0) AS settled_out
  FROM point_history ph
  WHERE ph.member_id IN (
    SELECT id FROM member WHERE csrid IS NOT NULL AND csrid <> ''
  )
  GROUP BY ph.member_id
)
UPDATE point p
   SET earning_balance = LEAST(GREATEST(ce.earned_from_consultation - ce.settled_out, 0), p.paid_balance),
       paid_balance    = p.paid_balance - LEAST(GREATEST(ce.earned_from_consultation - ce.settled_out, 0), p.paid_balance),
       updated_at      = NOW()
  FROM earning_per_member ce
 WHERE p.member_id = ce.member_id;

-- =========================================================
-- 3) 검증 SQL (트랜잭션 안에서 즉시 확인)
-- =========================================================
-- (A) 음수 잔액 없어야 함 (0 row 기대)
DO $$
DECLARE v_neg INT;
BEGIN
  SELECT COUNT(*) INTO v_neg
    FROM point
   WHERE free_balance < 0 OR paid_balance < 0 OR earning_balance < 0;
  IF v_neg > 0 THEN
    RAISE EXCEPTION '음수 잔액 발생: % rows', v_neg;
  END IF;
END $$;

-- (B) member.point = free + paid (소비포인트 합)
--     수익포인트는 별도 잔액이므로 회원 표면 잔액(member.point)에는 포함 안 함
--     라온선생처럼 회원↔상담사 겸직 케이스: 회원 잔액(member.point)은 free+paid 만, earning 은 별도
DO $$
DECLARE v_drift INT;
BEGIN
  SELECT COUNT(*) INTO v_drift
    FROM member m
    JOIN point p ON p.member_id = m.id
   WHERE m.point IS DISTINCT FROM (p.free_balance + p.paid_balance);
  -- 분리 작업 직후 일부 row 가 drift 일 수 있으므로 RAISE NOTICE 만.
  -- (이전부터 누적된 drift 가 있을 수 있고, 분리 자체가 새 drift 를 만들진 않음)
  RAISE NOTICE 'member.point vs (free+paid) drift: % rows', v_drift;
END $$;

-- (C) 라온선생 케이스(상담사) 분리 결과 미리보기
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT m.id, m.mb_id, m.name, m.csrid,
           p.free_balance, p.paid_balance, p.earning_balance,
           p.total_earned, p.total_used
      FROM member m
      JOIN point p ON p.member_id = m.id
     WHERE m.csrid IS NOT NULL AND m.csrid <> ''
       AND p.earning_balance > 0
     ORDER BY p.earning_balance DESC
     LIMIT 10
  LOOP
    RAISE NOTICE '[상담사] id=% mb_id=% name=% csrid=% free=% paid=% earning=% total_earned=% total_used=%',
      r.id, r.mb_id, r.name, r.csrid,
      r.free_balance, r.paid_balance, r.earning_balance,
      r.total_earned, r.total_used;
  END LOOP;
END $$;

-- 트랜잭션 커밋 — 사고 시 여기까지 도달 전이라면 ROLLBACK 으로 복구
COMMIT;
