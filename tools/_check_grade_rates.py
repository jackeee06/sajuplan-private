"""setting 테이블의 등급별 정산률 + royalty 의미 확인."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
psql = '/usr/bin/psql'

print("="*70)
print("[1] setting 테이블의 등급별 분배율 (namespace='grade')")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT namespace, key, value, description '
    'FROM setting '
    "WHERE namespace = 'grade' "
    'ORDER BY key;"'
)
print(o.read().decode())

print("="*70)
print("[2] settlement_monthly 테이블 컬럼 + 최근 정산 1건 (예시)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT column_name FROM information_schema.columns '
    "WHERE table_name='settlement_monthly' ORDER BY ordinal_position;\""
)
print(o.read().decode())

print()
_, o, _ = c.exec_command(
    f'{psql} "{dquerybl}" -x -c '
    '"SELECT * FROM settlement_monthly ORDER BY id DESC LIMIT 1;" 2>/dev/null || echo "(빈 테이블)"'.replace('dquerybl', 'dburl').replace('dburl', dburl)
)
# 위 명령 안 통할 수 있어서 단순화
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -x -c "SELECT * FROM settlement_monthly ORDER BY id DESC LIMIT 1;"'
)
print(o.read().decode()[:2000])

print("="*70)
print("[3] free_royalty_pct / paid_royalty_pct 의미 (legacy) — member 컬럼 확인")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, mb_id, name, grade, '
    'free_royalty_pct, paid_royalty_pct '
    'FROM member '
    "WHERE role = 'counselor' AND left_at IS NULL "
    'ORDER BY id DESC LIMIT 10;"'
)
print(o.read().decode())

print("="*70)
print("[4] 등급별 인원수 + setting 분배율 매칭 (정산 시뮬)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    "\"SELECT m.grade, count(*) AS cnt, s.value AS revenue_rate "
    "FROM member m "
    "LEFT JOIN setting s ON s.namespace='grade' AND s.key=concat('revenue_rate.', m.grade) "
    "WHERE m.role='counselor' AND m.left_at IS NULL "
    "GROUP BY m.grade, s.value ORDER BY m.grade;\""
)
print(o.read().decode())

c.close()
