-- [2026-05-24] 슈퍼관리자 순이익 시뮬레이터 설정 저장 테이블
-- 슈퍼관리자별로 자기 시뮬 설정(매출/인원/m2net 협상 변수/운영비 등)을 JSONB 로 보존.
-- 등급별 정산률은 별도 setting 테이블의 namespace='grade' 에서 실시간 조회.

BEGIN;

CREATE TABLE IF NOT EXISTS profit_simulator_config (
  id          BIGSERIAL    PRIMARY KEY,
  admin_id    BIGINT       NOT NULL UNIQUE,  -- member.id (슈퍼관리자)
  data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  profit_simulator_config IS '슈퍼관리자 순이익 시뮬레이터 설정 저장';
COMMENT ON COLUMN profit_simulator_config.data IS
  '시뮬 설정 JSON. 키 예시: m2net.monthly_fee, m2net.telecom_rate, scenario.revenue, scenario.counselor_count, grade_dist.{grade}, grade_revenue_share.{grade}, operating_costs[]';

COMMIT;
