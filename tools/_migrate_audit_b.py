"""B 그룹 Critical 마이그레이션.

#3: consultation UNIQUE 제약 (callid+counselor / roomid+member+counselor)
#8: refund_request idempotent_key 컬럼
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

-- [Audit B-#3] consultation 중복 INSERT 차단 — DB 레벨 최후 방어
-- 콜(DISCONNECT): (callid, counselor_id) UNIQUE — callid 가 m2net 의 통화 고유 ID
-- 채팅(END_CHAT/END_CHAT_LOCAL): (roomid, member_id, counselor_id, reason) UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_call_callid
  ON consultation (callid, counselor_id)
  WHERE reason = 'DISCONNECT' AND callid IS NOT NULL AND callid != '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_chat_roomid
  ON consultation (roomid, member_id, counselor_id, reason)
  WHERE reason IN ('END_CHAT', 'END_CHAT_LOCAL')
    AND roomid IS NOT NULL AND roomid != '';

-- [Audit B-#8] refund_request 멱등성 키 — 같은 요청 재전송 방지
ALTER TABLE refund_request ADD COLUMN IF NOT EXISTS idempotent_key TEXT;

-- (consultation_id, idempotent_key) UNIQUE — 같은 상담에 동일 키로 중복 환불 불가
CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_request_idem
  ON refund_request (consultation_id, idempotent_key)
  WHERE idempotent_key IS NOT NULL;

COMMIT;

SELECT '=== consultation UNIQUE ===' AS s;
SELECT indexname FROM pg_indexes
 WHERE tablename='consultation' AND indexname LIKE 'uq_%';

SELECT '=== refund_request 컬럼 ===' AS s;
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='refund_request' AND column_name='idempotent_key';

SELECT '=== refund_request UNIQUE ===' AS s;
SELECT indexname FROM pg_indexes
 WHERE tablename='refund_request' AND indexname='uq_refund_request_idem';
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
