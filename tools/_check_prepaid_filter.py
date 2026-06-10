#!/usr/bin/env python3
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

HOST = "104.64.128.103"
API  = "/data/wwwroot/api.sajumoon.co.kr"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)

def run(cmd, label=""):
    if label: print(f"[{label}]")
    _, o, e = c.exec_command(cmd, timeout=20)
    out = o.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    else: print("(없음)")

# 1. 컴파일된 JS에 prepaid 필터 있는지
run(f"grep -n 'prepaid' {API}/dist/user/points/points.service.js",
    "1. 컴파일된 JS prepaid 필터")

# 2. 소스 TS에 prepaid 필터 있는지
run(f"grep -n 'prepaid' {API}/src/user/points/points.service.ts",
    "2. 서버 TS 소스 prepaid 필터")

# 3. 파일 수정시각
run(f"ls -la {API}/dist/user/points/points.service.js {API}/src/user/points/points.service.ts",
    "3. 파일 수정시각")

c.close()
