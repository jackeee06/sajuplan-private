"""alimtalk_event_binding 매핑 확인 — 코드 호출명 ↔ prod template_code 매개."""
from __future__ import annotations
import os, sys
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
import paramiko

HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

SQL = r"""
\echo === [B-1] alimtalk_event_binding schema ===
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='alimtalk_event_binding'
 ORDER BY ordinal_position;

\echo
\echo === [B-2] alimtalk_event_binding 데이터 전체 ===
SELECT * FROM alimtalk_event_binding LIMIT 50;

\echo
\echo === [B-3] coupon_req2 검색 (code 또는 event_code 또는 어디든) ===
SELECT * FROM alimtalk_event_binding
 WHERE CAST(alimtalk_event_binding AS text) LIKE '%coupon_req2%'
    OR CAST(alimtalk_event_binding AS text) LIKE '%order_bankinfo2%'
 LIMIT 10;

\echo
\echo === [B-4] alimtalk_template 전체 template_code 만 ===
SELECT template_code FROM alimtalk_template ORDER BY template_code;
"""

def main():
    pw = os.environ.get("SSHPASS")
    if not pw: print("SSHPASS env not set", file=sys.stderr); return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)
    cmd = (
        f"export $(grep -E '^(DATABASE_URL|DB_)' {ENV_FILE} | xargs -d '\\n') && "
        f"psql \"$DATABASE_URL\" -v ON_ERROR_STOP=0 <<'EOSQL'\n{SQL}\nEOSQL"
    )
    _, out, err = c.exec_command(cmd, get_pty=False)
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e: sys.stderr.write(e)
    c.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
