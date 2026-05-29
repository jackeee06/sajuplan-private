"""daily-summary cron 배포 + crontab 등록 + 즉시 1회 발사 검증."""
from __future__ import annotations
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()

# 1. dist 3개 파일 (cron.controller.js, cron.module.js, daily-summary.service.js)
files = [
    "cron/cron.controller.js",
    "cron/cron.module.js",
    "cron/daily-summary.service.js",
]
for rel in files:
    local = f"C:/claudeworkspace/sajumoon/api/dist/{rel}"
    remote = f"/data/wwwroot/api.sajumoon.co.kr/dist/{rel}"
    s.put(local, remote)
    print(f"[uploaded] {rel} size={os.path.getsize(local)}")
s.close()

# 2. pm2 restart
_, o, _ = c.exec_command("pm2 restart sajumoon-api > /tmp/pm2.log 2>&1; echo done", get_pty=False)
print("[restart]", o.read().decode("utf-8", errors="replace").strip())
time.sleep(5)

# 3. ext health
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.sajuplan.com/api/health', get_pty=False)
print("[ext health]", o.read().decode("utf-8", errors="replace").strip())

# 4. crontab 추가 (매일 09:00 KST)
print()
print("[crontab append]")
_, o, _ = c.exec_command("grep '^CRON_TOKEN=' /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-", get_pty=False)
tok = o.read().decode("utf-8", errors="replace").strip().strip("'\"")

cron_line = f"0 9 * * * curl -s -H 'X-Cron-Token: {tok}' https://api.sajuplan.com/api/cron/daily-summary >> /var/log/sajumoon_daily_summary.log 2>&1"
cmd = f"(crontab -l 2>/dev/null | grep -v 'daily-summary'; echo \"{cron_line}\") | crontab -"
c.exec_command(cmd, get_pty=False)[1].read()
_, o, _ = c.exec_command("crontab -l | grep daily-summary", get_pty=False)
print(f"[new cron] {o.read().decode('utf-8', errors='replace').strip()}")

# 5. 즉시 1회 발사 (검증)
print()
print("[즉시 1회 daily-summary 발사 — 사장님 카톡 도착 검증용]")
_, o, _ = c.exec_command(f"curl -s -H 'X-Cron-Token: {tok}' https://api.sajuplan.com/api/cron/daily-summary", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
