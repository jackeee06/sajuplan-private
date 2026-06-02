"""사장님(id=91) 탭별 정확한 카운트 시뮬레이션 (prod)."""
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
print("사장님(id=91) counselor 시점 — 탭별 total")
print("="*70)

# all 탭 (typeFilter 없음)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT count(*) FROM consultation '
    'WHERE counselor_id = 91 '
    "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');\""
)
print(f"  전체(all) 탭 total = {o.read().decode().strip()}")

# call 탭 (roomid IS NULL OR '')
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT count(*) FROM consultation '
    'WHERE counselor_id = 91 '
    "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL') "
    "AND (roomid IS NULL OR roomid = '');\""
)
print(f"  전화상담(call) 탭 total = {o.read().decode().strip()}")

# chat 탭
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT count(*) FROM consultation '
    'WHERE counselor_id = 91 '
    "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL') "
    "AND roomid IS NOT NULL AND roomid <> '';\""
)
print(f"  채팅상담(chat) 탭 total = {o.read().decode().strip()}")

# member 시점 카운트 (other_role_count 가 되어야 할 값)
print()
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -Atc '
    '"SELECT count(*) FROM consultation '
    'WHERE member_id = 91 '
    "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');\""
)
print(f"  member 시점 (other_role_count, 모든 탭) = {o.read().decode().strip()}")

# 사장님 counselor 시점 1건이 어떤 row 인지
print("\n" + "="*70)
print("counselor 시점 1건의 상세")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, member_id, counselor_id, reason, roomid, callee_phone, amt, usetm, '
    'started_at::timestamp '
    'FROM consultation WHERE counselor_id = 91 '
    "AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');\""
)
print(o.read().decode())

c.close()
