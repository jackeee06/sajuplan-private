"""일회성 prod 조회 — SELECT 전용(읽기). 사용(PowerShell):
  $env:SSHPASS=...; python tools/_sql.py "SELECT ..."
"""
import os
import sys

import paramiko

HOST = "104.64.128.103"
ENV_REMOTE = "/data/wwwroot/api.sajumoon.co.kr/.env"

sql = sys.argv[1] if len(sys.argv) > 1 else ""
if not sql.lower().lstrip().startswith("select"):
    print("SELECT 문만 허용", file=sys.stderr)
    sys.exit(2)

pw = os.environ.get("SSHPASS")
if not pw:
    print("NO_SSHPASS")
    sys.exit(2)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)
# SQL 은 stdin 으로 psql 에 흘려보내 셸 따옴표 escaping 회피
cmd = (
    f'export $(grep -E "^DATABASE_URL=" {ENV_REMOTE}|xargs)>/dev/null 2>&1; '
    f'psql "$DATABASE_URL" -At -F "|"'
)
stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
stdin.write(sql + "\n")
stdin.channel.shutdown_write()
print(stdout.read().decode("utf-8", errors="replace"))
e = stderr.read().decode("utf-8", errors="replace")
if e:
    sys.stderr.write(e)
ssh.close()
