"""테스트 알림 1건 발사 → alimtalk_log 에 row 들어왔는지 검증."""
from __future__ import annotations
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

# CRON_TOKEN
_, o, _ = c.exec_command("grep '^CRON_TOKEN=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1 | cut -d= -f2-", get_pty=False)
tok = o.read().decode("utf-8", errors="replace").strip().strip("'\"")

# test-alert 발사
print("=== test-alert 발사 ===")
_, o, _ = c.exec_command(f"curl -s -H 'X-Cron-Token: {tok}' https://api.sajuplan.com/api/cron/test-alert", get_pty=False)
print("응답:", o.read().decode("utf-8", errors="replace"))

time.sleep(4)

# alimtalk_log 최신 row 확인
print()
print("=== alimtalk_log 최신 5건 ===")
sql = "SELECT id, template_code, phone, success, response_code, response_message, error_reason, sent_at::timestamp(0) FROM alimtalk_log ORDER BY id DESC LIMIT 5"
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c "{sql}"'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

# 카운트
print("=== alimtalk_log 총 카운트 ===")
_, o, _ = c.exec_command(f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c "SELECT COUNT(*) FROM alimtalk_log; SELECT success, COUNT(*) FROM alimtalk_log GROUP BY success"', get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
