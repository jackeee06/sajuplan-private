import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
pw = os.environ['SSHPASS']
for label, host in [('prod','104.64.128.103')]:
    print(f"=== [{label}] ===")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # pm2 logs 최근 100라인
    print("\n[pm2 logs 최근 출력]")
    _, o, _ = c.exec_command('pm2 logs sajumoon-api --nostream --lines 100 --raw 2>/dev/null | tail -50')
    print(o.read().decode()[:3500])

    # pm2 status 다시
    print("\n[pm2 status]")
    _, o, _ = c.exec_command('pm2 list --no-color 2>/dev/null | grep sajumoon-api')
    print(o.read().decode())

    # localhost 직접 curl (nginx 우회)
    print("\n[localhost 직접 curl]")
    _, o, _ = c.exec_command('curl -s -w "HTTP=%{http_code}" -m 5 http://localhost:3001/api/admin/profit-sim 2>&1 | tail -3')
    print(o.read().decode())

    c.close()
