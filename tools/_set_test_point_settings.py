#!/usr/bin/env python3
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)

MODE = sys.argv[1] if len(sys.argv) > 1 else 'test'

if MODE == 'test':
    sqls = [
        "INSERT INTO setting (namespace,key,value) VALUES ('member','register_point','500') ON CONFLICT (namespace,key) DO UPDATE SET value='500'",
        "INSERT INTO setting (namespace,key,value) VALUES ('member','login_point','100') ON CONFLICT (namespace,key) DO UPDATE SET value='100'",
    ]
    print("검증용 설정: register_point=500, login_point=100")
else:
    sqls = [
        "UPDATE setting SET value='0' WHERE namespace='member' AND key IN ('register_point','login_point')",
    ]
    print("설정 초기화: register_point=0, login_point=0")

for sql in sqls:
    _, o, e = c.exec_command(f"psql {DB} -c \"{sql}\"", timeout=15)
    out = o.read().decode('utf-8', errors='replace').strip()
    err = e.read().decode('utf-8', errors='replace').strip()
    if out: print(f"  {out}")
    if err: print(f"  ERR: {err}", file=sys.stderr)

c.close()
print("완료")
