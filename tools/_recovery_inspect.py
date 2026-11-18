"""회수 대상 5명 admin_memo + member_id 확인, settlement_recovery 존재여부 점검 (읽기전용)."""
import os, sys, re, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ.get('SSHPASS')
if not pw:
    envf = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    for line in open(envf, encoding='utf-8'):
        if line.startswith('SSHPASS='):
            pw = line.split('=', 1)[1].strip().strip('"\'')
            break
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
psql = '/usr/bin/psql'

def q(sql, flags='-c'):
    _, o, e = c.exec_command(f'{psql} "{dburl}" {flags} "{sql}"')
    out = o.read().decode(); err = e.read().decode()
    if err.strip(): sys.stderr.write(err)
    return out

print("="*70); print("[1] 회수 대상(admin_memo LIKE '%회수 대상%')")
print(q("SELECT id, mb_id, name, left_at IS NOT NULL AS withdrawn, admin_memo "
        "FROM member WHERE admin_memo LIKE '%회수 대상%' ORDER BY id;"))

print("="*70); print("[2] settlement_recovery 테이블 존재?")
print(q("SELECT to_regclass('public.settlement_recovery') AS exists;"))
c.close()
