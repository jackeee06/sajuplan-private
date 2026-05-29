-- 와이드 사진 오버레이 캡션 (헤드라인 + 서브카피)
BEGIN;

ALTER TABLE post_counselor
  ADD COLUMN IF NOT EXISTS wide_headline   TEXT,
  ADD COLUMN IF NOT EXISTS wide_subcaption TEXT;

COMMENT ON COLUMN post_counselor.wide_headline   IS '와이드 사진 위 헤드라인(1줄). NULL/공백이면 오버레이 미노출';
COMMENT ON COLUMN post_counselor.wide_subcaption IS '와이드 사진 위 서브카피(1줄). NULL/공백이면 미노출';

COMMIT;
