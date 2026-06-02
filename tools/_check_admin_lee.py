"""사장님 admin (lee?) is_super 값 확인."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== admin 테이블 schema (is_super 컬럼 존재 확인) ===")
_, o, _ = c.exec_command("psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c \"\\d admin\" 2>&1 | head -20", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print()
print("=== 모든 admin 목록 ===")
_, o, _ = c.exec_command("psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c \"SELECT * FROM admin ORDER BY id\" 2>&1", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
