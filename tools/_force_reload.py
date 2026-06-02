import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
pw = os.environ['SSHPASS']
for label, host in [('test','172.235.211.75'),('prod','104.64.128.103')]:
    print(f"\n=== [{label}] {host} ===")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
    _, o, e = c.exec_command('pm2 reload sajumoon-api --update-env 2>&1 | tail -10')
    print(o.read().decode())
    # 5초 대기 후 status
    import time
    time.sleep(3)
    _, o, _ = c.exec_command('pm2 list --no-color 2>/dev/null | grep sajumoon-api')
    print(o.read().decode())
    c.close()
