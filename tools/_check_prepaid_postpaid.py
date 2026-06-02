"""사주플랜 선불제/후불제 운영 현황 확인."""
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
print("[1] consultation.preflag 분포 (Y=선불, N=후불)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT preflag, count(*) AS cnt, sum(amt) AS total_amt '
    'FROM consultation GROUP BY preflag ORDER BY cnt DESC;"'
)
print(o.read().decode())

print("="*70)
print("[2] is_paid 분포 (후불 후 결제 여부)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT preflag, is_paid, count(*) AS cnt '
    'FROM consultation GROUP BY preflag, is_paid ORDER BY preflag, is_paid;"'
)
print(o.read().decode())

print("="*70)
print("[3] amt_free vs amt_pro 분포 (free=무료적립, pro=유료충전)")
print("="*70)
_, o, _ = c.exec_command(
    f'{psql} "{dburl}" -c '
    '"SELECT '
    'sum(amt_free) AS total_free, '
    'sum(amt_pro) AS total_pro, '
    'sum(amt) AS total_amt, '
    'count(*) AS rows '
    "FROM consultation WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL');\""
)
print(o.read().decode())

print("="*70)
print("[4] phone (전화) 결제 흐름 코드 확인 — phoneTab 사용처")
print("="*70)
_, o, _ = c.exec_command(
    "grep -B1 -A2 \"phoneTab\\|prepaid.*postpaid\" /data/wwwroot/api.sajumoon.co.kr/dist/user/consult/consult.service.js | head -30"
)
print(o.read().decode()[:1500])

print("="*70)
print("[5] 충전 (charge) 흐름 — 사용자 코인 충전 방법")
print("="*70)
_, o, _ = c.exec_command(
    "grep -oE 'paytype.*PAY|VBANK|MOBILE|CARD' /data/wwwroot/api.sajumoon.co.kr/dist/user/charge/charge.service.js | sort -u | head -10"
)
print(o.read().decode())

c.close()
