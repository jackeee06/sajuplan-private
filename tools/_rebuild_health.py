#!/usr/bin/env python
"""health-check.service.ts 수정 후 빌드 + pm2 reload"""
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
remote_base = "/data/wwwroot/api.sajumoon.co.kr"

LOCAL_FILE = r"c:\claudeworkspace\sajumoon\api\src\cron\health-check.service.ts"
REMOTE_FILE = f"{remote_base}/src/cron/health-check.service.ts"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username="root", password=root_pw, timeout=15)
print("SSH connected")

def run(cmd, timeout=180):
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    return o, e

# 1. SFTP 업로드
print(f"\n[1] SFTP upload...")
sftp = ssh.open_sftp()
sftp.put(LOCAL_FILE, REMOTE_FILE)
sftp.close()
print("    upload OK")

# 2. 파일 내용 확인 (STRING_AGG LIMIT 없어졌는지)
out, _ = run(f"grep -c 'STRING_AGG.*LIMIT' {REMOTE_FILE} 2>/dev/null || echo 0")
print(f"    STRING_AGG LIMIT count in remote: {out.strip()} (0이어야 함)")

# 3. tsc 빌드
print("\n[2] tsc build...")
out, err = run(
    f"cd {remote_base} && ./node_modules/.bin/tsc --skipLibCheck 2>&1 | tail -30",
    timeout=180
)
print("    tsc stdout:", out[:400] or "(empty - no errors)")
if err:
    print("    tsc stderr:", err[:200])

# dist 파일 시간 확인
out, _ = run(f"ls -la {remote_base}/dist/cron/health-check.service.js")
print(f"    dist mtime: {out[:150]}")

# 4. pm2 reload
print("\n[3] pm2 reload...")
out, err = run("pm2 reload sajumoon-api --update-env 2>&1 | cat")
print("    reload:", out[:300])

# 5. 새 에러 로그 확인
print("\n[4] waiting 15s for next health-check cycle errors...")
time.sleep(15)
out, _ = run("tail -30 /root/.pm2/logs/sajumoon-api-error-0.log 2>/dev/null")
# STRING_AGG 에러가 없으면 성공
has_stringagg = "STRING_AGG" in out or "syntax error at or near" in out
print("    Has STRING_AGG error:", has_stringagg)
print("    Recent log:", out[-500:])

ssh.close()
print("\n[DONE]")
