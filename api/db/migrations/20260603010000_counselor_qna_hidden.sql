-- counselor_qna 숨김 처리 컬럼
-- 3회 이상 신고 시 자동 숨김 OR 관리자 수동 숨김

ALTER TABLE counselor_qna
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_counselor_qna_hidden
  ON counselor_qna (is_hidden)
  WHERE is_hidden = TRUE;
