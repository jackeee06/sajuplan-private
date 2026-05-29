"""settlement_monthly status/paid_at 컬럼 prod 마이그레이션."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

s = c.open_sftp()
local = r"C:\claudeworkspace\sajumoon\api\db\migrations\20260529010000_settlement_monthly_status.sql"
remote = "/tmp/20260529010000_settlement_monthly_status.sql"
s.put(local, remote)
print(f"[1] migration uploaded: {remote}")
s.close()

print("[2] prod DB 적용")
cmd = f"psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -v ON_ERROR_STOP=1 -f {remote} 2>&1"
_, o, e = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
err = e.read().decode("utf-8", errors="replace")
if err: print("STDERR:", err[:500])

print("\n[3] 검증 — 신규 컬럼 확인")
cmd = "psql $(grep '^DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c \"SELECT column_name FROM information_schema.columns WHERE table_name='settlement_monthly' AND column_name IN ('status','paid_at','paid_by_id','voided_at','voided_by_id','void_reason') ORDER BY column_name\""
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
