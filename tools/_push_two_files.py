#!/usr/bin/env python3
"""points.service.ts + attendance.service.ts 직접 업로드 후 빌드"""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

HOST    = "104.64.128.103"
REMOTE  = "/data/wwwroot/api.sajumoon.co.kr"
PM2_APP = "sajumoon-api"

FILES = [
    ("api/src/user/points/points.service.ts",      f"{REMOTE}/src/user/points/points.service.ts"),
    ("api/src/user/attendance/attendance.service.ts", f"{REMOTE}/src/user/attendance/attendance.service.ts"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)
sftp = c.open_sftp()

for local, remote in FILES:
    sftp.put(local, remote)
    print(f"  ✓ {local} → {remote}")

sftp.close()

def run(cmd, label=""):
    print(f"\n[{label}]")
    _, o, e = c.exec_command(cmd, timeout=120)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if out: print(out[-500:])
    if err: print(f"STDERR: {err[-300:]}")

run(f"cd {REMOTE} && npm run build 2>&1 | tail -5", "빌드")
run(f"pm2 reload {PM2_APP}", "PM2 reload")

# 검증: 컴파일된 JS에 balance_kind 있는지
run(f"grep -n 'balance_kind' {REMOTE}/dist/user/points/points.service.js | head -5",
    "points.service.js balance_kind 확인")
run(f"grep -c 'point_history' {REMOTE}/dist/user/attendance/attendance.service.js",
    "attendance.service.js point_history 확인")

c.close()
print("\n완료")
