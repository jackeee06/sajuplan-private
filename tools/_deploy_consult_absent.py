"""consult.service.js (counselor_auto_absent 알림) 배포."""
from __future__ import annotations
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()
local = r"C:\claudeworkspace\sajumoon\api\dist\user\consult\consult.service.js"
remote = "/data/wwwroot/api.sajumoon.co.kr/dist/user/consult/consult.service.js"
s.put(local, remote)
print(f"[uploaded] size={s.stat(remote).st_size}")
s.close()
_, o, _ = c.exec_command("pm2 restart sajumoon-api > /tmp/pm2.log 2>&1; echo done", get_pty=False)
print("[restart]", o.read().decode("utf-8", errors="replace").strip())
time.sleep(5)
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.sajuplan.com/api/health', get_pty=False)
print("[ext health]", o.read().decode("utf-8", errors="replace").strip())
c.close()
