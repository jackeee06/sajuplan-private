"""Audit C 그룹 — #9 + #10 마이그레이션.

#9 settleChatRoomLocal 재설계:
  chat_room 에 settle_status 컬럼 (NULL / 'pending' / 'm2net_failed' / 'completed')
  + retry_count + last_retry_at — 별도 retry cron 으로 추적/재시도

#10 applyCompletion M2NET retry queue:
  payment 에 m2net_retry_count + m2net_last_retry_at 컬럼 추가
  (payment.m2net_status 는 이미 존재 — '코인충전실패' status 활용)
"""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import paramiko

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr/.env"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr/.env"),
]

SQL = """
BEGIN;

-- [Audit C-#9] chat_room 정산 상태 추적
ALTER TABLE chat_room ADD COLUMN IF NOT EXISTS settle_status TEXT;
ALTER TABLE chat_room ADD COLUMN IF NOT EXISTS settle_retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chat_room ADD COLUMN IF NOT EXISTS settle_last_retry_at TIMESTAMPTZ;
ALTER TABLE chat_room ADD COLUMN IF NOT EXISTS settle_failure_reason TEXT;

-- m2net_failed 상태인 row 빠르게 찾기 (retry cron 용)
CREATE INDEX IF NOT EXISTS idx_chat_room_settle_failed
  ON chat_room (settle_last_retry_at NULLS FIRST)
  WHERE settle_status = 'm2net_failed';

-- [Audit C-#10] payment M2NET sync retry 추적
ALTER TABLE payment ADD COLUMN IF NOT EXISTS m2net_retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS m2net_last_retry_at TIMESTAMPTZ;

-- '코인충전실패' status 인 row 빠르게 찾기 (retry cron 용)
CREATE INDEX IF NOT EXISTS idx_payment_m2net_failed
  ON payment (m2net_last_retry_at NULLS FIRST)
  WHERE m2net_status = '코인충전실패';

COMMIT;

SELECT '=== chat_room 컬럼 ===' AS s;
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name='chat_room' AND column_name LIKE 'settle%'
 ORDER BY column_name;

SELECT '=== payment 컬럼 ===' AS s;
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name='payment' AND column_name LIKE 'm2net_retry%' OR column_name = 'm2net_last_retry_at'
 ORDER BY column_name;

SELECT '=== 신규 인덱스 ===' AS s;
SELECT indexname FROM pg_indexes
 WHERE indexname IN ('idx_chat_room_settle_failed', 'idx_payment_m2net_failed');
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    for label, host, env_file in TARGETS:
        b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
        inner = (
            f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {env_file} | cut -d= -f2-) && '
            f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
        )
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        _, stdout, _ = c.exec_command(f"bash -lc {repr(inner)}")
        print(f"\n========== {label} ==========")
        print(stdout.read().decode("utf-8", errors="replace"))
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
