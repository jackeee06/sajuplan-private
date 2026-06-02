import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

print("[1] admin.module.js 에 ProfitSim 흔적")
_, o, _ = c.exec_command('grep -ci "profit" /data/wwwroot/api.sajumoon.co.kr/dist/admin/admin.module.js')
print(f"  카운트: {o.read().decode().strip()}")

print("\n[2] pm2 부팅 로그 — profit-sim 라우트 매핑")
_, o, _ = c.exec_command('pm2 logs sajumoon-api --nostream --lines 800 --raw 2>/dev/null | grep -i "profit" | tail -10')
print(o.read().decode())

print("\n[3] pm2 status + uptime")
_, o, _ = c.exec_command('pm2 list --no-color 2>/dev/null | head -10')
print(o.read().decode())

print("\n[4] Mapped 라우트 grep")
_, o, _ = c.exec_command('pm2 logs sajumoon-api --nostream --lines 1500 --raw 2>/dev/null | grep "Mapped.*admin" | head -3')
print(o.read().decode())
c.close()
