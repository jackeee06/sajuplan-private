"""settlement 알림 + 14일 룰 + carry_over OpsAlert 배포."""
from __future__ import annotations
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()
files = [
    "admin/settlements/settlements.service.js",
    "admin/settlements/settlements.module.js",
    "cron/settlement-cron.service.js",
]
for rel in files:
    local = f"C:/claudeworkspace/sajumoon/api/dist/{rel}"
    remote = f"/data/wwwroot/api.sajumoon.co.kr/dist/{rel}"
    s.put(local, remote)
    print(f"[uploaded] {rel} size={os.path.getsize(local)}")
s.close()

_, o, _ = c.exec_command("pm2 restart sajumoon-api > /tmp/pm2.log 2>&1; echo done", get_pty=False)
print("[restart]", o.read().decode("utf-8", errors="replace").strip())
time.sleep(5)

_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.sajuplan.com/api/health', get_pty=False)
print("[ext health]", o.read().decode("utf-8", errors="replace").strip())

# pm2 로그 startup 에러 확인 (의존성 주입 실패 시)
time.sleep(2)
_, o, _ = c.exec_command("pm2 logs sajumoon-api --lines 30 --nostream --raw 2>&1 | grep -iE 'error|exception|dependency' | tail -10", get_pty=False)
print("=== pm2 error log ===")
print(o.read().decode("utf-8", errors="replace"))

c.close()
