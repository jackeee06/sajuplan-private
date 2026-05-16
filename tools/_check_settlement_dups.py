"""settlement_monthly 중복 데이터 + UNIQUE 제약 사전 점검."""
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
SELECT '=== 컬럼 ===' AS s;
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='settlement_monthly' AND column_name IN ('member_id','mb_id','month');

SELECT '=== 인덱스 ===' AS s;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename='settlement_monthly';

SELECT '=== (member_id, month) 중복 ===' AS s;
SELECT member_id, month, COUNT(*) AS cnt
  FROM settlement_monthly
 GROUP BY member_id, month
HAVING COUNT(*) > 1
 LIMIT 20;

SELECT '=== (mb_id, month) 중복 ===' AS s;
SELECT mb_id, month, COUNT(*) AS cnt
  FROM settlement_monthly
 WHERE mb_id IS NOT NULL
 GROUP BY mb_id, month
HAVING COUNT(*) > 1
 LIMIT 20;

SELECT '=== 전체 row 수 ===' AS s;
SELECT COUNT(*) FROM settlement_monthly;
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
