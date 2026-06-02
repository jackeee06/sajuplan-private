"""prod 서버의 sajumoon-api pm2 cwd 확인 — 실제 코드 위치 추적."""
from __future__ import annotations
import os, sys
import paramiko

pw = os.environ.get('SSHPASS')
if not pw:
    print('SSHPASS env var required', file=sys.stderr); sys.exit(2)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)

# pm2 jlist 의 cwd / script / status
cmd = "pm2 jlist | python3 -c \"import json,sys; d=json.load(sys.stdin); [print(x['name'], '|', x.get('pm2_env',{}).get('pm_cwd'), '|', x.get('pm2_env',{}).get('pm_exec_path'), '|', x.get('pm2_env',{}).get('status')) for x in d if x['name']=='sajumoon-api']\""
_, out, err = c.exec_command(cmd, timeout=30)
print('--- pm2 cwd info ---')
print(out.read().decode())
e = err.read().decode()
if e: print('STDERR:', e)

# /data/wwwroot 하위 폴더들
cmd2 = "ls -la /data/wwwroot/ | head -30 && echo '---' && find /data/wwwroot -maxdepth 3 -name 'package.json' 2>/dev/null | head"
_, out2, _ = c.exec_command(cmd2, timeout=30)
print('--- /data/wwwroot ---')
print(out2.read().decode())

c.close()
