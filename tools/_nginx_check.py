#!/usr/bin/env python3
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'],
          allow_agent=False, look_for_keys=False, timeout=15)

def run(cmd, lbl):
    print(f'\n[{lbl}]')
    _, o, _ = c.exec_command(cmd, timeout=15)
    out = o.read().decode('utf-8', 'replace').strip()
    print(out[:600] if out else '(empty)')

run('find / -name nginx.conf 2>/dev/null | grep -v proc | head -5', 'nginx.conf 위치')
run('ls /usr/local/nginx/conf/vhost/ 2>/dev/null || echo none', 'vhost 목록')
run('grep -rn "sajuplan" /usr/local/nginx/conf/ 2>/dev/null | grep root | head -10', 'sajuplan root 경로')
run('grep -rn "sajumoon.co.kr" /usr/local/nginx/conf/ 2>/dev/null | grep root | head -10', 'sajumoon.co.kr root 경로')
run('grep -rn "sajuplan.com" /usr/local/nginx/conf/ 2>/dev/null | grep -E "root|server_name" | head -20', 'sajuplan.com vhost 설정')

c.close()
