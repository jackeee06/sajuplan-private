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

run("ls /data/wwwroot/api.sajumoon.co.kr/secrets/ 2>/dev/null", "secrets 폴더")
run("cat /data/wwwroot/api.sajumoon.co.kr/secrets/fcm-service-account.json 2>/dev/null | python3 -c \"import json,sys; d=json.load(sys.stdin); print('project_id:', d.get('project_id','?'), '/ type:', d.get('type','?'))\" 2>/dev/null", "FCM 서비스 계정 확인")
run("pm2 logs sajumoon-api --lines 50 --nostream 2>/dev/null | grep -i 'Firebase\\|FCM\\|초기화' | tail -5", "Firebase 초기화 로그")

c.close()
