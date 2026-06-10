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
    print(o.read().decode('utf-8', 'replace').strip())

run('cat /usr/local/nginx/conf/vhost/sajuplan.com.conf', 'sajuplan.com.conf 전체')

c.close()
