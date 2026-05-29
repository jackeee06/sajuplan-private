-- 이벤트 상담사: post_counselor 에 이벤트 기간 + 배너 이미지 컬럼 추가
BEGIN;

ALTER TABLE post_counselor
  ADD COLUMN IF NOT EXISTS event_starts_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_ends_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_banner_image_url TEXT;

COMMENT ON COLUMN post_counselor.event_starts_at IS '이벤트 노출 시작일시 (KST 저장 권장). NULL이면 이벤트 아님';
COMMENT ON COLUMN post_counselor.event_ends_at   IS '이벤트 노출 종료일시. NULL이면 무기한';
COMMENT ON COLUMN post_counselor.event_banner_image_url IS '이벤트용 커스텀 배너 이미지 URL. NULL이면 프로필 기반 자동 카드 사용';

CREATE INDEX IF NOT EXISTS idx_post_counselor_event
  ON post_counselor (event_starts_at, event_ends_at)
  WHERE event_starts_at IS NOT NULL;

COMMIT;
