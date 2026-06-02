#!/usr/bin/env python
"""pm2 상태 및 최근 에러 로그 확인"""
import paramiko
import time
import sys

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

host = "104.64.128.103"
root_pw = "saju26moon@!!"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=20):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# pm2 status
out, _ = run("pm2 jlist 2>/dev/null")
import json
try:
    procs = json.loads(out)
    for p in procs:
        if "sajumoon" in p.get("name", ""):
            print(f"PM2: {p['name']} status={p['pm2_env']['status']} pid={p['pid']} uptime={p['pm2_env'].get('pm_uptime')}")
except Exception as e:
    print("pm2 jlist error:", e)
    print(out[:300])

# dist 파일 수정 시간
out, _ = run("ls -la /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js 2>/dev/null")
print("DIST health-check.service.js:", out[:200])

# 에러 로그 최근 20줄
print("\nRECENT PM2 ERROR LOG (last 20 lines):")
out, _ = run("tail -20 /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null")
print(out[:800])

ssh.close()
