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

run("find /etc/nginx -name '*.conf' | head -20", "1. nginx conf 파일 목록")
run("nginx -T 2>/dev/null | grep -A3 'server_name.*sajuplan\\|server_name.*sajumoon.co' | head -40", "2. sajuplan/sajumoon.co.kr vhost root")
run("nginx -T 2>/dev/null | grep 'root\\|sajuplan\\|sajumoon' | grep -v '#' | head -30", "3. root 경로 전체")

c.close()
