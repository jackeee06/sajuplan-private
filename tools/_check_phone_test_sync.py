"""전화 테스트 후 사주플랜 측 동기화 점검.

m2net 결과 (2026-05-24 09:27:38 ~ 09:28:16):
- 회원 전화: 01075740572
- 상담사ID: 19976 (라온선생)
- 통화 38초, 상담료 1,000원 차감
"""
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
print("[1] consultation 테이블 — 09:27 ~ 09:30 시각 row")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, member_id, mb_id, counselor_id, csrid, callee_phone, '
    'amt, amt_free, amt_pro, usetm, reason, '
    'started_at::timestamp, ended_at::timestamp '
    'FROM consultation '
    "WHERE started_at >= '2026-05-24 09:27:00+09' "
    "AND started_at <= '2026-05-24 09:30:00+09' "
    'ORDER BY id DESC LIMIT 3;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[2] 회원 잔액 변동 (01075740572)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, mb_id, name, phone, point, '
    '(SELECT p.paid_balance FROM point p WHERE p.member_id=m.id) AS paid, '
    '(SELECT p.free_balance FROM point p WHERE p.member_id=m.id) AS free '
    'FROM member m '
    "WHERE phone = '01075740572' OR phone = '010-7574-0572' "
    'LIMIT 1;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[3] point_history 차감 기록 (09:27 ~ 09:30)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT ph.id, ph.member_id, m.name, ph.content, '
    'ph.earn_point, ph.use_point, ph.balance_after, '
    'ph.rel_table, ph.rel_id, ph.rel_action, '
    'ph.created_at::timestamp '
    'FROM point_history ph LEFT JOIN member m ON m.id=ph.member_id '
    "WHERE ph.created_at >= '2026-05-24 09:27:00+09' "
    "AND ph.created_at <= '2026-05-24 09:32:00+09' "
    'ORDER BY ph.id DESC LIMIT 5;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[4] 라온선생 상담사 적립 (csrid=19976)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, name, csrid, role, '
    '(SELECT p.earning_balance FROM point p WHERE p.member_id=m.id) AS earning '
    'FROM member m '
    "WHERE csrid = '19976' OR csrid = '0019976' "
    'LIMIT 1;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[5] pm2 m2net push 로그 (CALL_END 또는 정산 흔적)")
print("="*70)
_, o, _ = c.exec_command(
    "pm2 logs sajumoon-api --nostream --lines 200 --raw 2>/dev/null | "
    "grep -aE 'CALL_END|01075740572|19976|settleCall|deductMember' | tail -15"
)
body = o.read().decode().strip()
print(body[:3000] if body else "  (관련 로그 없음)")

print("\n" + "="*70)
print("[6] 에러 로그 (09:27 ~ 09:35)")
print("="*70)
_, o, _ = c.exec_command(
    "pm2 logs sajumoon-api --nostream --lines 200 --err 2>/dev/null | "
    "grep -aE 'ERROR|callback|CALL|push' | tail -10"
)
body = o.read().decode().strip()
if body:
    print(body[:2000])
else:
    print("  ✅ 에러 없음")

c.close()
