"""A 그룹 Critical #2 — settlement_monthly UNIQUE 제약 추가.

(member_id, month) UNIQUE + (mb_id, month WHERE mb_id NOT NULL) UNIQUE.
중복 INSERT 시 DB 레벨에서 차단.
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
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajuplan.com/.env"),
]

SQL = """
BEGIN;

-- (member_id, month) UNIQUE — member_id 가 있는 경우 같은 달 중복 차단
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_member_month
  ON settlement_monthly (member_id, month)
  WHERE member_id IS NOT NULL;

-- (mb_id, month) UNIQUE — mb_id 가 있는 경우도 추가 보호
CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_mb_id_month
  ON settlement_monthly (mb_id, month)
  WHERE mb_id IS NOT NULL;

COMMIT;

SELECT '=== UNIQUE 인덱스 ===' AS s;
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename='settlement_monthly' AND indexname LIKE 'uq_%';
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
