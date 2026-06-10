#!/usr/bin/env python3
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

HOST = "104.64.128.103"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def run(cmd, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(cmd, timeout=15)
    print(o.read().decode('utf-8', errors='replace').strip())

# nginx vhost 에서 실제 root 경로 확인
run("grep -r 'server_name\\|root\\|mng' /etc/nginx/sites-enabled/ 2>/dev/null | grep -v '#' | head -40",
    "1. nginx sites-enabled root 경로")

run("grep -r 'server_name\\|root\\|mng' /etc/nginx/conf.d/ 2>/dev/null | grep -v '#' | head -40",
    "2. nginx conf.d root 경로")

# 실제 디렉토리 존재 여부
run("ls /data/wwwroot/ 2>/dev/null", "3. /data/wwwroot 디렉토리 목록")

run("ls /data/wwwroot/sajumoon.co.kr/mng 2>/dev/null | head -5; echo '---'; ls /data/wwwroot/sajuplan.com/mng 2>/dev/null | head -5",
    "4. mng 디렉토리 존재 여부 비교")

# index.html 수정 시각 비교
run("stat /data/wwwroot/sajumoon.co.kr/mng/index.html 2>/dev/null | grep Modify; stat /data/wwwroot/sajuplan.com/mng/index.html 2>/dev/null | grep Modify",
    "5. 각 mng index.html 수정 시각")

c.close()
