#!/usr/bin/env python3
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)
_, o, _ = c.exec_command(f'psql {DB} -c "SELECT id, mb_id, nickname, role, level, is_super FROM member WHERE role=\'admin\' ORDER BY id"', timeout=10)
print(o.read().decode('utf-8', 'replace').strip())
c.close()
