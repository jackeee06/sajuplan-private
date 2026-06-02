"""상담내역 history SQL 필터 정확히 추적."""
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
print("[1] consultation id=92 의 roomid + 기타 필터 컬럼")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -x -c '
    '"SELECT id, member_id, counselor_id, reason, '
    'roomid, callid, callee_phone, '
    'amt, usetm, ended_at::timestamp, '
    'refunded_amount, refund_status, skip_charge, is_settled, is_paid, calc_flag, preflag '
    'FROM consultation WHERE id = 92;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[2] consultation 최근 5건 비교 (어떤 게 표시되고 어떤 게 빠지는지)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, reason, roomid, callid, '
    'amt, usetm, refunded_amount, refund_status, skip_charge, '
    'started_at::timestamp '
    'FROM consultation '
    'WHERE member_id = 91 '
    'ORDER BY id DESC LIMIT 6;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[3] history SQL 의 정확한 WHERE 절 — dist 코드 추출")
print("="*70)
_, o, _ = c.exec_command(
    f"grep -B2 -A80 'async history' /data/wwwroot/api.sajumoon.co.kr/dist/user/consult/consult.service.js | "
    f"grep -E 'reason|WHERE|FROM consultation|ended_at|skip_charge|refund|typeFilter' | head -30"
)
print(o.read().decode()[:3000])

print("\n" + "="*70)
print("[4] 시뮬레이션 — 실제 history SQL (type='call' 인 경우) 실행")
print("="*70)
# 직접 흉내내서 어떤 row 가 매칭되는지
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, reason, roomid, callid, amt, usetm, refund_status, started_at::timestamp '
    'FROM consultation c '
    'WHERE c.member_id = 91 '
    "AND (c.roomid IS NULL OR c.roomid = '') "
    'AND c.ended_at IS NOT NULL '
    'ORDER BY c.id DESC LIMIT 5;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[5] 위 SQL 에 reason 필터 추가 (END_CHAT 만? DISCONNECT 도 포함?)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, reason FROM consultation '
    'WHERE member_id = 91 ORDER BY id DESC LIMIT 10;"'
)
print(o.read().decode())

c.close()
