#!/usr/bin/env python3
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

HOST = "104.64.128.103"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def run(cmd, lbl):
    print(f"\n[{lbl}]")
    _, o, _ = c.exec_command(cmd, timeout=10)
    print(o.read().decode('utf-8', 'replace').strip() or '(없음)')

run("grep 'FCM_CREDENTIALS' /data/wwwroot/api.sajumoon.co.kr/.env 2>/dev/null", "FCM 환경변수 설정 여부")
run("pm2 logs sajumoon-api --lines 10 --nostream 2>/dev/null | grep -i 'FCM\\|firebase\\|push' | tail -5", "PM2 FCM 초기화 로그")

c.close()
