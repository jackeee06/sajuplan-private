"""test 서버의 admin 계정 + 비번 확인."""
import os
import sys
import paramiko

pw = os.environ.get("SSHPASS")
if not pw:
    sys.exit(1)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("172.235.211.75", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

# api .env 의 DB URL 추출
_, out, _ = c.exec_command(
    "grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.kr/.env | head -1 | cut -d= -f2- | tr -d \"'\\\"\"",
    timeout=15,
)
url = out.read().decode().strip()

# psql 설치 안 됐을 수 있음 — 일단 시도
sql = "SELECT id, mb_id, name, role, level FROM member WHERE role = 'admin' LIMIT 5"
_, out, _ = c.exec_command(f"psql '{url}' -At -F'|' -c \"{sql}\" 2>&1", timeout=30)
print("=== test admin 계정 ===")
print(out.read().decode())
c.close()
