"""단기통화 (consultation id=92) 환불 처리 + 상담 내역 표시 확인."""
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
print("[1] consultation id=92 전체 컬럼")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -x -c '
    '"SELECT id, member_id, counselor_id, reason, amt, amt_free, amt_pro, '
    'calc_total, calc_free, calc_paid, '
    'preflag, is_settled, calc_flag, is_paid, '
    'usetm, started_at::timestamp, ended_at::timestamp, '
    'refunded_amount, refund_status, skip_charge '
    'FROM consultation WHERE id = 92;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[2] point_history — id=92 (단기통화) 관련 환불 row 있는지")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, member_id, content, earn_point, use_point, balance_after, '
    'rel_table, rel_id, rel_action, created_at::timestamp '
    "FROM point_history WHERE rel_table = 'consultation' AND rel_id = '92' "
    'ORDER BY id;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[3] 사장님(id=91) 마이페이지 상담내역 API 호출 결과 (시뮬레이션)")
print("="*70)
# /api/user/consult/history 가 어떤 SQL 인지 확인
_, o, _ = c.exec_command(
    f"grep -A40 'async history' /data/wwwroot/api.sajumoon.co.kr/dist/user/consult/consult.service.js | head -60"
)
print(o.read().decode()[:3000])

print("\n" + "="*70)
print("[4] 사장님 상담내역 시뮬레이션 SQL (member_id=91, 최근 5건)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT id, member_id, counselor_id, reason, '
    'amt, usetm, refunded_amount, refund_status, skip_charge, '
    'started_at::timestamp AS started '
    'FROM consultation '
    'WHERE member_id = 91 AND ended_at IS NOT NULL '
    'ORDER BY id DESC LIMIT 5;"'
)
print(o.read().decode())

print("\n" + "="*70)
print("[5] handleCallPush 단기통화 환불 흔적 더 자세히")
print("="*70)
_, o, _ = c.exec_command(
    "pm2 logs sajumoon-api --nostream --lines 500 --raw 2>/dev/null | "
    "grep -aE 'shortCallRefund|단기통화|short_call|refund' | tail -10"
)
body = o.read().decode().strip()
print(body[:3000] if body else "  (로그 없음)")

c.close()
