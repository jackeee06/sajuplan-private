"""2026-06-26 강원구(member 251) 자동충전 33,000원 환불요청 — 진실 확인 v2 (읽기전용)."""
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

print("="*72); print("[A] payment 컬럼 목록"); print("="*72)
print(q("SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) "
        "FROM information_schema.columns WHERE table_name='payment';"))

print("="*72); print("[B] point_history 컬럼 목록"); print("="*72)
print(q("SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) "
        "FROM information_schema.columns WHERE table_name='point_history';"))

print("="*72); print("[C] payment — 강원구(251) 전체 충전 이력"); print("="*72)
print(q("SELECT id, oid, pay_method, amount, coin_amount, status, created_at, paid_at "
        "FROM payment WHERE member_id=251 ORDER BY created_at DESC LIMIT 30;", x=True))

print("="*72); print("[D] 문제 oid 직접 검색 (202606260037411 / 0037411o3E)"); print("="*72)
print(q("SELECT id, member_id, mb_id, oid, pay_method, amount, coin_amount, status, created_at "
        "FROM payment WHERE oid LIKE '%202606260037411%' OR oid LIKE '%0037411%';", x=True))

print("="*72); print("[E] point_history — 강원구(251) 최근 코인 변동"); print("="*72)
print(q("SELECT * FROM point_history WHERE member_id=251 ORDER BY id DESC LIMIT 12;", x=True))

print("="*72); print("[F] payment 6/26 전체 (하루 — 시간대 무관, 강원구 흔적)"); print("="*72)
print(q("SELECT id, member_id, mb_id, oid, pay_method, amount, status, created_at FROM payment "
        "WHERE created_at >= '2026-06-26 00:00' AND created_at < '2026-06-27 00:00' ORDER BY created_at;", x=True))

print("="*72); print("[G] 자동결제(빌링키) 등록 테이블 탐색 + 강원구 등록 여부"); print("="*72)
print(q("SELECT table_name FROM information_schema.tables "
        "WHERE table_name ILIKE '%autopay%' OR table_name ILIKE '%billing%' OR table_name ILIKE '%auto_pay%' OR table_name ILIKE '%card%';"))

c.close()
