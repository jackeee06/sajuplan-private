"""강원구 6/21 성공 vs 6/26 실패 — 정확한 원인 규명 (읽기전용)."""
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
    return o.read().decode() + (('\n[ERR]'+e.read().decode()) if e.read else '')

print("="*72); print("[1] 강원구(251) 등록카드 payment_method 전체 상태"); print("="*72)
print(q("SELECT id, member_id, is_active, auto_enabled, auto_package_id, "
        "left(billkey,6)||'…' AS billkey, amount, coin_amount, created_at, updated_at "
        "FROM payment_method WHERE member_id=251 ORDER BY id;", x=True))

print("="*72); print("[2] 강원구(251) payment 전체 — 6/21 성공건 포함"); print("="*72)
print(q("SELECT id, oid, pay_method, amount, coin_amount, status, created_at "
        "FROM payment WHERE member_id=251 ORDER BY id;", x=True))

print("="*72); print("[3] 5/30 성공한 다른 자동충전건 — 누구? auto_enabled 였나?"); print("="*72)
print(q("SELECT p.id, p.member_id, p.oid, p.pay_method, p.amount, p.status, p.created_at, "
        "pm.auto_enabled AS card_auto_now "
        "FROM payment p LEFT JOIN payment_method pm ON pm.member_id=p.member_id AND pm.is_active "
        "WHERE p.pay_method LIKE '%AUTO_PAY%' AND p.status='completed' "
        "AND p.created_at >= now()-interval '40 days' ORDER BY p.created_at;", x=True))

print("="*72); print("[4] 강원구 자동충전 토글(on/off) 이력 흔적 — pm2 로그"); print("="*72)
L="/root/.pm2/logs/sajumoon-api-out-0.log"
_,o,e=c.exec_command(f"grep -n 'autopayflag\\|setAutoPay\\|updateAutoPayConfig\\|자동결제' {L} | grep -i '302137\\|251\\|강원' | tail -20")
print(o.read().decode('utf-8','replace') + e.read().decode('utf-8','replace'))
c.close()
