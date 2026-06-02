"""cron.controller.js (manual-alert endpoint) 배포 + 검증."""
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=30)
s = c.open_sftp()
local = r"C:\claudeworkspace\sajumoon\api\dist\cron\cron.controller.js"
remote = "/data/wwwroot/api.sajumoon.co.kr/dist/cron/cron.controller.js"
s.put(local, remote)
print(f"[uploaded] size={s.stat(remote).st_size}")
s.close()
_, o, _ = c.exec_command("pm2 restart sajumoon-api > /tmp/pm2.log 2>&1; echo done", get_pty=False)
print("[restart]", o.read().decode("utf-8", errors="replace").strip())
time.sleep(5)

# 검증 — manual-alert endpoint 호출
_, o, _ = c.exec_command("grep '^CRON_TOKEN=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1 | cut -d= -f2-", get_pty=False)
tok = o.read().decode("utf-8", errors="replace").strip().strip("'\"")
print()
print("[manual-alert 테스트 발사]")
cmd = (
    f"curl -s -X POST -H 'X-Cron-Token: {tok}' -H 'Content-Type: application/json' "
    f'-d \'{{"category":"배포 안전망 신설 테스트","detail":"manual-alert endpoint 작동 검증"}}\' '
    f"https://api.sajuplan.com/api/cron/manual-alert"
)
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
