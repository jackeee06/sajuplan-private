#!/usr/bin/env python3
import os, sys, paramiko
for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)
_, o, _ = c.exec_command("grep CRON_TOKEN /data/wwwroot/api.sajumoon.co.kr/.env | head -5", timeout=10)
print(o.read().decode('utf-8', 'replace').strip())
c.close()
