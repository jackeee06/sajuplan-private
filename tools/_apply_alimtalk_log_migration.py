"""prod 에 alimtalk_log 마이그레이션 적용."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

# 1. 마이그레이션 SQL 업로드
s = c.open_sftp()
local = r"C:\claudeworkspace\sajumoon\api\db\migrations\20260529000000_alimtalk_log.sql"
remote = "/tmp/20260529000000_alimtalk_log.sql"
s.put(local, remote)
print(f"[1] migration uploaded: {remote}")
s.close()

# 2. prod DB 적용
print("[2] prod DB 적용")
cmd = f"psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -v ON_ERROR_STOP=1 -f {remote} 2>&1"
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])

# 3. 검증
print("\n[3] 검증 — schema")
cmd = "psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c '\\d alimtalk_log'"
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
