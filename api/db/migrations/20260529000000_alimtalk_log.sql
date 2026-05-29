-- alimtalk_log: BizM 알림톡 발송 흔적 영구 기록 (감사/분쟁 대응).
-- 2026-05-29 신설 — 운영 시작 전 안전망. 그동안은 logger.log 만 휘발성.
BEGIN;

CREATE TABLE IF NOT EXISTS alimtalk_log (
  id              BIGSERIAL PRIMARY KEY,
  template_code   VARCHAR(100) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  vars            JSONB,
  success         BOOLEAN      NOT NULL DEFAULT FALSE,
  response_code   VARCHAR(20),
  response_message VARCHAR(200),
  error_reason    VARCHAR(50),
  raw_response    TEXT,
  sent_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- caller: 어느 코드에서 발송 호출했는지 추적 (선택)
  caller          VARCHAR(100)
);

-- 회원별 발송 이력 (cs 문의 응대 시 가장 자주 쓰임)
CREATE INDEX IF NOT EXISTS idx_alimtalk_log_phone_time
  ON alimtalk_log (phone, sent_at DESC);

-- 템플릿별 통계 (성공률 / 실패 패턴 분석)
CREATE INDEX IF NOT EXISTS idx_alimtalk_log_template_time
  ON alimtalk_log (template_code, sent_at DESC);

-- 실패만 빠르게 (운영자 모니터링)
CREATE INDEX IF NOT EXISTS idx_alimtalk_log_failures
  ON alimtalk_log (sent_at DESC)
  WHERE success = FALSE;

COMMENT ON TABLE  alimtalk_log IS 'BizM 알림톡 발송 흔적 영구 기록 (감사/분쟁 대응). 2026-05-29 신설.';
COMMENT ON COLUMN alimtalk_log.template_code IS 'BizM 템플릿 코드 (sendAlimtalkByCode 첫 인자)';
COMMENT ON COLUMN alimtalk_log.success IS 'BizM 응답이 K000/success 면 true, 그 외 false';
COMMENT ON COLUMN alimtalk_log.response_code IS 'BizM 응답 code 필드 (success/fail)';
COMMENT ON COLUMN alimtalk_log.response_message IS 'BizM 응답 message (K000/K104/K119/M107 등)';
COMMENT ON COLUMN alimtalk_log.error_reason IS '실패 카테고리 (template_not_found/bizm_rejected/network_error/dev_mode 등)';
COMMENT ON COLUMN alimtalk_log.raw_response IS 'BizM raw 응답 (400자 잘림). 디버깅용';
COMMENT ON COLUMN alimtalk_log.caller IS '호출 위치 (선택, sendAlimtalkByCode 호출처 식별)';

COMMIT;
