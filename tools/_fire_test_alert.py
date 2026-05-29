"""OpsAlert 테스트 발송 → 사장님 폰 카톡 도착 확인용."""
from __future__ import annotations
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

# 정확한 prod 경로 (api.sajumoon.co.kr)
_, o, _ = c.exec_command("grep '^CRON_TOKEN=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1 | cut -d= -f2-", get_pty=False)
tok = o.read().decode("utf-8", errors="replace").strip().strip("'\"")
print(f"[CRON_TOKEN] len={len(tok)}")

# pm2 reload 로 cooldown 초기화 + setting 새로 읽기
print("=== pm2 reload ===")
_, o, _ = c.exec_command("pm2 reload sajumoon-api 2>&1 | tail -2", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
time.sleep(4)

# test-alert 호출
print("=== test-alert 발사 ===")
_, o, _ = c.exec_command(
    f"curl -s -H 'X-Cron-Token: {tok}' https://api.sajuplan.com/api/cron/test-alert",
    get_pty=False,
)
print("응답:", o.read().decode("utf-8", errors="replace"))

# pm2 로그 확인 (15초 대기 후)
time.sleep(8)
print()
print("=== pm2 로그 (OpsAlert/BIZM) ===")
_, o, _ = c.exec_command(
    "pm2 logs sajumoon-api --lines 50 --nostream --raw 2>&1 | grep -iE 'opsalert|bizm|adminsms|test-alert' | tail -20",
    get_pty=False,
)
print(o.read().decode("utf-8", errors="replace"))

c.close()
