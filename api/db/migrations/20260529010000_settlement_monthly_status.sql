-- settlement_monthly: 정산 후 통장 송금 완료 마킹 시스템.
-- 2026-05-29 신설 — 운영 시작 전 안전망. 그동안 사장님이 송금 후 마킹할 곳이 없었음.
BEGIN;

ALTER TABLE settlement_monthly
  ADD COLUMN IF NOT EXISTS status        VARCHAR(20) NOT NULL DEFAULT 'calculated',
  ADD COLUMN IF NOT EXISTS paid_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by_id    BIGINT,
  ADD COLUMN IF NOT EXISTS voided_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by_id  BIGINT,
  ADD COLUMN IF NOT EXISTS void_reason   TEXT;

-- status 값 제약 (calculated/paid/voided)
ALTER TABLE settlement_monthly
  DROP CONSTRAINT IF EXISTS settlement_monthly_status_check,
  ADD CONSTRAINT settlement_monthly_status_check
    CHECK (status IN ('calculated', 'paid', 'voided'));

-- 미지급 정산 빠르게 조회 (사장님이 매월 통장 송금 작업 시 first query)
CREATE INDEX IF NOT EXISTS idx_settlement_monthly_status_month
  ON settlement_monthly (status, month DESC);

COMMENT ON COLUMN settlement_monthly.status IS '정산 상태: calculated(자동 계산만)/paid(사장님 송금 완료)/voided(무효화)';
COMMENT ON COLUMN settlement_monthly.paid_at IS '통장 송금 완료 마킹 시각';
COMMENT ON COLUMN settlement_monthly.paid_by_id IS '지급 완료 마킹한 admin id';
COMMENT ON COLUMN settlement_monthly.voided_at IS '무효화 처리 시각 (사고 정정용)';
COMMENT ON COLUMN settlement_monthly.voided_by_id IS '무효화 처리한 admin id';
COMMENT ON COLUMN settlement_monthly.void_reason IS '무효화 사유 (필수)';

COMMIT;
