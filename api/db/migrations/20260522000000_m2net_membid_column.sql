-- 2026-05-22 회원/상담사 ID 통합 작업
-- 한 사람 = 한 mb_id 정책으로 전환.
-- m2net 측에는 회원(membid)·상담사(csrid) 가 별개 엔티티로 등록되므로
-- 한 row 에 두 식별자를 모두 저장할 수 있도록 m2net_membid 컬럼을 추가한다.
--   - csrid (기존) : 상담사로서의 m2net ID (회원 → 상담사 승격 시 발급)
--   - m2net_membid (신규) : 일반회원으로서의 m2net ID (회원 가입 시 발급)
BEGIN;

ALTER TABLE member ADD COLUMN IF NOT EXISTS m2net_membid VARCHAR(50);
COMMENT ON COLUMN member.m2net_membid IS '일반회원 m2net 측 ID (membid). 상담사 m2net ID 는 csrid 컬럼.';

COMMIT;
