"""실제 history SQL WHERE 절 정확히 시뮬레이션."""
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
print("[1] type='call' 정확한 WHERE 절 시뮬레이션 (member_id=91)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT c.id, c.reason, c.roomid, c.amt, c.usetm, c.refund_status, '
    'c.started_at::timestamp '
    'FROM consultation c '
    'WHERE c.member_id = 91 '
    "AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL') "
    "AND (c.roomid IS NULL OR c.roomid = '') "
    'ORDER BY c.id DESC;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[2] type='all' 시뮬레이션")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT c.id, c.reason, c.roomid, c.amt, c.usetm, c.refund_status '
    'FROM consultation c '
    'WHERE c.member_id = 91 '
    "AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL') "
    'ORDER BY c.id DESC LIMIT 10;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[3] 사장님 mb_id 가 jackee 맞는지 + role 확인")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, mb_id, name, role, phone FROM member WHERE id = 91;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[4] id=92 의 callid 와 일치하는 chat_room 있는지 (의심: LEFT JOIN LATERAL 영향)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    "\"SELECT id, roomid, status FROM chat_room WHERE member_id = 91 AND counselor_id = 123 ORDER BY id DESC LIMIT 5;\""
)
print(o.read().decode())

c.close()
