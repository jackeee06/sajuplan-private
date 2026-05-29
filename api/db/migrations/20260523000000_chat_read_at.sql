-- 2026-05-23 안 읽음 표시 ("1") 기능
-- chat_message 에 read_at TIMESTAMPTZ 추가 — NULL = 안 읽음, NOT NULL = 읽음 시각
BEGIN;

ALTER TABLE chat_message
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN chat_message.read_at IS '상대방이 메시지를 본 시각. NULL=안 읽음. 본인 메시지에만 의미 있음';

-- 부분 인덱스 — 안 읽은 메시지만 빠르게 찾기 (UI 의 1 표시 카운트)
CREATE INDEX IF NOT EXISTS idx_chat_message_unread
  ON chat_message (chat_room_id, sender_id)
  WHERE read_at IS NULL;

COMMIT;
