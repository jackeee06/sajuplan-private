#!/usr/bin/env python
"""health-check.service.ts SFTP 업로드 + 원격 tsc 빌드 + pm2 reload"""
import paramiko
import sys
import os

host = "104.64.128.103"
root_pw = "saju26moon@!!"
remote_base = "/data/wwwroot/api.sajumoon.co.kr"
pm2_name = "sajumoon-api"

LOCAL_FILE = r"c:\claudeworkspace\sajumoon\api\src\cron\health-check.service.ts"
REMOTE_FILE = f"{remote_base}/src/cron/health-check.service.ts"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=120):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    return o, e

# 1. SFTP 업로드
print(f"\n[1] SFTP upload: {LOCAL_FILE} -> {REMOTE_FILE}")
sftp = ssh.open_sftp()
sftp.put(LOCAL_FILE, REMOTE_FILE)
sftp.close()
print("    upload OK")

# 2. tsc 빌드 (해당 파일만)
print("\n[2] tsc 빌드...")
out, err = run(
    f"cd {remote_base} && npx tsc --skipLibCheck 2>&1 | tail -20",
    timeout=120
)
print("tsc out:", out[:500])
if err:
    print("tsc err:", err[:200])

# 3. pm2 reload
print(f"\n[3] pm2 reload {pm2_name}...")
out, err = run(f"pm2 reload {pm2_name} 2>&1")
print("reload:", out[:300])

# 4. 확인 — pm2 status
out, _ = run("pm2 list 2>&1 | grep sajumoon-api")
print("pm2 status:", out[:200])

# 5. 새 에러 로그 확인 (30초 후)
import time
print("\n[5] 로그 확인 (10초 대기)...")
time.sleep(10)
out, _ = run("tail -20 /root/.pm2/logs/sajumoon-api-error-0.log 2>&1")
print("recent errors:", out[:500])

ssh.close()
print("\n배포 완료")
