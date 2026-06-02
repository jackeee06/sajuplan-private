import os, paramiko
pw = os.environ['SSHPASS']
for label, host in [('test','172.235.211.75'),('prod','104.64.128.103')]:
    print(f'=== [{label}] {host} ===')
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
    # created_at 에러 주변 50줄
    _, o, _ = c.exec_command(
        "pm2 logs sajumoon-api --nostream --lines 1500 --err 2>/dev/null | "
        "grep -aB1 -A30 'created_at.*does not exist' | tail -80"
    )
    print(o.read().decode()[:4500])
    print()
    c.close()
