"""prod API pm2 로그 tail — 파일로 저장."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)
_, out, _ = c.exec_command('pm2 logs sajumoon-api --lines 100 --nostream 2>&1 | tail -100', timeout=30)
text = out.read().decode('utf-8', errors='replace')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print(text)
c.close()
