import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
print("[부팅 에러 — pm2 stderr 최근 50라인]")
_, o, _ = c.exec_command('pm2 logs sajumoon-api --nostream --lines 100 --err 2>/dev/null | tail -40')
print(o.read().decode()[:4000])
c.close()
