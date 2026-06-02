"""상담사 분배율(요율) DB 구조 확인."""
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
print("[1] member 테이블에 요율 관련 컬럼")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT column_name FROM information_schema.columns '
    "WHERE table_name='member' AND (column_name LIKE '%rate%' OR column_name LIKE '%commission%' "
    "OR column_name LIKE '%share%' OR column_name LIKE '%grade%' OR column_name LIKE '%level%' "
    "OR column_name LIKE '%percent%' OR column_name LIKE '%settle%' OR column_name LIKE '%calc%') "
    'ORDER BY ordinal_position;"'
)
print(o.read().decode())

print("="*70)
print("[2] 별도 grade/level/commission 테이블 검색")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT table_name FROM information_schema.tables '
    "WHERE table_schema='public' AND (table_name LIKE '%grade%' OR table_name LIKE '%level%' "
    "OR table_name LIKE '%commission%' OR table_name LIKE '%rate%' OR table_name LIKE '%settle%') "
    'ORDER BY table_name;"'
)
print(o.read().decode())

print("="*70)
print("[3] 활성 상담사 (role='counselor') 등급/요율 분포 (상위 30명)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, mb_id, name, level, grade, '
    'chat_unit_cost, chat_unit_seconds '
    'FROM member '
    "WHERE role = 'counselor' AND left_at IS NULL "
    'ORDER BY id DESC LIMIT 30;"'
)
print(o.read().decode())

print("="*70)
print("[4] grade 또는 level 별 인원수 + 평균 단가")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT level, grade, count(*) AS cnt, '
    'avg(chat_unit_cost) AS avg_chat_cost '
    'FROM member '
    "WHERE role = 'counselor' AND left_at IS NULL "
    'GROUP BY level, grade ORDER BY level, grade;"'
)
print(o.read().decode())

print("="*70)
print("[5] settlement_monthly 또는 정산 테이블의 분배율 컬럼")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT column_name FROM information_schema.columns '
    "WHERE table_name LIKE 'settlement%' "
    "AND (column_name LIKE '%rate%' OR column_name LIKE '%percent%' OR column_name LIKE '%share%') "
    'LIMIT 20;"'
)
print(o.read().decode())

c.close()
