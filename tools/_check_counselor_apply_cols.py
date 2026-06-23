"""counselor_apply 컬럼 + 신규 상담사 집계 가능성 점검 (읽기전용)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\""); break
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
def q(sql):
    _, o, e = c.exec_command(f'/usr/bin/psql "{dburl}" -c "{sql}"')
    return o.read().decode() + (('\n[ERR]'+e.read().decode()) if e.read else '')
print("[counselor_apply 컬럼]")
print(q("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='counselor_apply' ORDER BY ordinal_position;"))
print("[member 에 상담사 승인/전환 시각 컬럼 후보]")
print(q("SELECT column_name FROM information_schema.columns WHERE table_name='member' AND (column_name LIKE '%approv%' OR column_name LIKE '%counselor%' OR column_name LIKE '%role%' OR column_name LIKE '%csr%');"))
print("[role=counselor 최근 created_at 분포 — 최근 7일 일자별]")
print(q("SELECT created_at::date d, count(*) FROM member WHERE role='counselor' AND created_at > CURRENT_DATE-7 GROUP BY d ORDER BY d;"))
c.close()
