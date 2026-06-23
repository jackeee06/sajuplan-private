"""2026-06-21 23:47 선샤인(112) 상담 건의 고객 식별 (읽기전용)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\"")
            break

pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
psql = '/usr/bin/psql'

def q(sql, x=False):
    flag = '-x' if x else ''
    _, o, e = c.exec_command(f'{psql} "{dburl}" {flag} -c "{sql}"')
    out = o.read().decode(); err = e.read().decode()
    return out + (('\n[ERR] ' + err) if err.strip() else '')

print("="*72)
print("[1] 선샤인(112) 상담 건 — 어제 23:4x 전후 (consultation 행)")
print("="*72)
print(q(
  "SELECT id, member_id, mb_id, reason, usetm, amt, caller_phone, callid, "
  "started_at, ended_at "
  "FROM consultation "
  "WHERE counselor_id = 112 "
  "AND created_at >= '2026-06-21 23:40' AND created_at < '2026-06-21 23:55' "
  "ORDER BY created_at;", x=True))

print("="*72)
print("[2] 그 고객(member_id) 신원 — DISCONNECT 행의 member_id 기준")
print("="*72)
print(q(
  "SELECT mm.id, mm.mb_id, mm.name, mm.nickname, mm.phone, mm.role, mm.created_at AS joined "
  "FROM member mm "
  "WHERE mm.id IN ("
  "  SELECT DISTINCT member_id FROM consultation "
  "  WHERE counselor_id = 112 AND created_at >= '2026-06-21 23:40' AND created_at < '2026-06-21 23:55'"
  ");", x=True))

c.close()
