"""기존 알림톡 템플릿 목록 확인."""
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

SQL = """
SELECT template_code,
       COALESCE(LEFT(message, 100), '') AS preview,
       primary_btn_name,
       is_active
  FROM alimtalk_template
 ORDER BY template_code
"""


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        return 1
    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("172.235.211.75", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.kr/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, out, _ = c.exec_command(f"bash -lc {repr(inner)}")
    print(out.read().decode("utf-8", errors="replace"))
    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
