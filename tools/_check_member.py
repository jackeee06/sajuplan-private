"""오늘 출석 데이터 + 회원 가입일 점검."""
from __future__ import annotations
import base64
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

SQL = """
-- ubuub1234 의 오늘 출석 행 삭제 (검증용) + 적립된 100원 회수
WITH del AS (
  DELETE FROM member_attendance
   WHERE member_id = 79
     AND attended_date = (now() AT TIME ZONE 'Asia/Seoul')::date
   RETURNING base_coin, bonus_coin
)
SELECT COUNT(*) AS deleted, COALESCE(SUM(base_coin + bonus_coin), 0) AS refund_total
  FROM del;

UPDATE member SET point = GREATEST(0, COALESCE(point, 0) - 100), updated_at = now()
 WHERE id = 79
RETURNING id, mb_id, point;
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, stdout, stderr = c.exec_command(f"bash -lc {repr(inner)}", get_pty=False)
    sys.stdout.write(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.write(err)
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
