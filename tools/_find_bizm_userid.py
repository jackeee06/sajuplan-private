"""BIZM_USER_ID 가 어디서 채워지는지 추적."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

print("=== prod /data/wwwroot/api.sajumoon.co.kr 의 env* 파일들 ===")
_, o, _ = c.exec_command("ls -la /data/wwwroot/api.sajumoon.co.kr/.env* 2>&1", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== 각 파일에서 BIZM 관련 키 (값 X) ===")
_, o, _ = c.exec_command("for f in /data/wwwroot/api.sajumoon.co.kr/.env*; do echo \"--- $f ---\"; grep -E '^BIZM_' \"$f\" 2>/dev/null | cut -d= -f1; done", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

print("=== PM2 process env (실제 NestJS 가 보는 환경) — BIZM_USER_ID 있는지 ===")
_, o, _ = c.exec_command("pm2 env 0 2>&1 | grep -i BIZM_USER_ID", get_pty=False)
print(o.read().decode("utf-8", errors="replace"))

c.close()
