"""consultation 중복 데이터 점검 + UNIQUE 인덱스 사전 가능성 확인."""
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
SELECT '=== consultation 전체 ===' AS s;
SELECT COUNT(*) FROM consultation;

SELECT '=== reason 별 ===' AS s;
SELECT reason, COUNT(*) FROM consultation GROUP BY reason ORDER BY reason;

SELECT '=== (callid, counselor_id) 중복 — DISCONNECT 만 ===' AS s;
SELECT callid, counselor_id, COUNT(*) AS cnt
  FROM consultation
 WHERE reason = 'DISCONNECT' AND callid IS NOT NULL AND callid != ''
 GROUP BY callid, counselor_id
HAVING COUNT(*) > 1
 LIMIT 20;

SELECT '=== (roomid, member_id, counselor_id) 중복 — END_CHAT ===' AS s;
SELECT roomid, member_id, counselor_id, reason, COUNT(*) AS cnt
  FROM consultation
 WHERE reason IN ('END_CHAT', 'END_CHAT_LOCAL') AND roomid IS NOT NULL AND roomid != ''
 GROUP BY roomid, member_id, counselor_id, reason
HAVING COUNT(*) > 1
 LIMIT 20;
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
