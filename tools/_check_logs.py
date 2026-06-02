#!/usr/bin/env python
"""에러 로그 타임스탬프 및 health-check 상태 확인"""
import paramiko
import sys
import time

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

def run(cmd, timeout=20):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    return out.read().decode("utf-8", "replace"), err.read().decode("utf-8", "replace")

# 에러 로그 타임스탬프 (마지막 3개 에러)
print("=== 에러 로그 최근 타임스탬프 ===")
out, _ = run("grep 'ExceptionsHandler' /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null | tail -5")
print(out[:400])

# 현재 시간
out, _ = run("date '+%Y-%m-%d %H:%M:%S KST'")
print("서버 현재시간:", out.strip())

# dist 파일 수정 시간
out, _ = run("ls -la /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js")
print("dist mtime:", out[:150])

# STRING_AGG LIMIT 제거됐는지 확인
out, _ = run("grep -c 'STRING_AGG' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js")
print(f"STRING_AGG count in dist: {out.strip()}")
out, _ = run("grep 'LIMIT' /data/wwwroot/api.sajumoon.co.kr/dist/cron/health-check.service.js | grep STRING_AGG | wc -l")
print(f"STRING_AGG...LIMIT count in dist: {out.strip()} (0이어야 함)")

# pm2 프로세스 확인
out, _ = run("pm2 jlist 2>/dev/null")
import json
try:
    procs = json.loads(out)
    for p in procs:
        n = p.get("name", "")
        if "sajumoon" in n:
            s = p["pm2_env"]["status"]
            uptime = p["pm2_env"].get("pm_uptime", 0)
            restarts = p.get("pm2_env", {}).get("restart_time", 0)
            print(f"PM2: {n} status={s} restarts={restarts}")
except Exception as e:
    print("jlist parse error:", e)

# 성공 로그 확인
print("\n=== health-check 완료 로그 ===")
out, _ = run("grep 'health-check' /root/.pm2/logs/sajumoon-api-out-0.log 2>/dev/null | tail -5")
print(out[:400])

ssh.close()
