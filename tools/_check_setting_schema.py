"""prod setting 테이블의 unique key 확인."""
from __future__ import annotations
import os, sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

QUERIES = [
    r"\d setting",
    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='setting'::regclass;",
]

def run(client, sql):
    cmd = f"bash -c 'set -a; . {ENV_FILE}; set +a; psql \"$DATABASE_URL\"'"
    stdin, out, _ = client.exec_command(cmd, get_pty=False)
    stdin.write(sql + "\n\\q\n")
    stdin.channel.shutdown_write()
    print(f"\n=== {sql} ===")
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))

pw = os.environ["SSHPASS"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
for q in QUERIES: run(c, q)
c.close()
