"""자동충전(AUTO_PAY) 실패 사유 분석 (읽기전용).
왜 사주플랜페이가 대부분 실패하는지 result_message·status·카드사로 판정."""
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

print("="*72); print("[0] payment 테이블 컬럼 확인"); print("="*72)
print(q("SELECT column_name FROM information_schema.columns WHERE table_name='payment' ORDER BY ordinal_position;"))

print("="*72); print("[1] AUTO_PAY 상태 분포 — 최근 90일"); print("="*72)
print(q("SELECT status, count(*), sum(amount) AS won FROM payment "
        "WHERE pay_method LIKE '%AUTO_PAY%' AND created_at >= now() - interval '90 days' "
        "GROUP BY status ORDER BY count(*) DESC;"))

print("="*72); print("[2] AUTO_PAY 실패/미완 건 상세 — 최근 90일 (사유 포함)"); print("="*72)
print(q("SELECT created_at::timestamp(0) AS at, member_id AS mid, status, amount, "
        "left(coalesce(result_message,''),60) AS msg, oid "
        "FROM payment WHERE pay_method LIKE '%AUTO_PAY%' AND status <> 'completed' "
        "AND created_at >= now() - interval '90 days' ORDER BY created_at DESC LIMIT 40;"))

print("="*72); print("[3] result_message 빈도 (사유 패턴)"); print("="*72)
print(q("SELECT left(coalesce(result_message,'(빈값)'),50) AS msg, count(*) "
        "FROM payment WHERE pay_method LIKE '%AUTO_PAY%' AND status <> 'completed' "
        "AND created_at >= now() - interval '90 days' GROUP BY 1 ORDER BY 2 DESC;"))

print("="*72); print("[4] 성공 2건 상세 (어느 회원/카드)"); print("="*72)
print(q("SELECT created_at::timestamp(0) AS at, member_id AS mid, amount, oid, "
        "left(coalesce(result_message,''),40) AS msg "
        "FROM payment WHERE pay_method LIKE '%AUTO_PAY%' AND status='completed' "
        "AND created_at >= now() - interval '120 days' ORDER BY created_at DESC;"))

print("="*72); print("[5] 등록 카드 payment_method 상세"); print("="*72)
print(q("SELECT id, member_id AS mid, is_active, auto_enabled, amount, coin_amount, "
        "left(coalesce(billkey,''),8) AS billkey8, created_at::timestamp(0) AS at "
        "FROM payment_method ORDER BY created_at DESC;"))
c.close()
