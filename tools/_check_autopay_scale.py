"""자동충전 매출 규모 vs '위조' 차단 규모 측정 (읽기전용).
강원구류 사고가 드문 예외인지, 매출이 새고 있는지 데이터로 판정."""
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
def sh(cmd):
    _, o, e = c.exec_command(cmd)
    return o.read().decode('utf-8','replace') + e.read().decode('utf-8','replace')

print("="*72); print("[A] 자동충전(AUTO_PAY) 성공 결제 — 최근 30일 일별 (살아있는 매출)"); print("="*72)
print(q("SELECT date_trunc('day', created_at)::date AS d, count(*) AS cnt, sum(amount) AS won "
        "FROM payment WHERE pay_method LIKE '%AUTO_PAY%' AND status='completed' "
        "AND created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY 1;"))

print("="*72); print("[A2] 자동충전 성공 — 최근 90일 합계 (전체 결제 대비 비중)"); print("="*72)
print(q("SELECT "
        "count(*) FILTER (WHERE pay_method LIKE '%AUTO_PAY%') AS autopay_cnt, "
        "sum(amount) FILTER (WHERE pay_method LIKE '%AUTO_PAY%') AS autopay_won, "
        "count(*) AS all_cnt, sum(amount) AS all_won "
        "FROM payment WHERE status='completed' AND created_at >= now() - interval '90 days';"))

print("="*72); print("[B] 등록 카드(payment_method) 현황 — auto_enabled 분포 (위험모집단)"); print("="*72)
print(q("SELECT is_active, auto_enabled, count(*) "
        "FROM payment_method GROUP BY 1,2 ORDER BY 1 DESC,2 DESC;"))

print("="*72); print("[C] '위조' 차단 로그 — pm2 (현재 로그파일 범위)"); print("="*72)
L = "/root/.pm2/logs/sajumoon-api-out-0.log"
print("--- '등록 안 한 회원에게 자동충전' 경보 발생 건수 ---")
print(sh(f"grep -c '등록 안 한 회원에게 자동충전' {L}"))
print("--- '자동충전 금액이 등록값과 다름' 경보 건수 ---")
print(sh(f"grep -c '자동충전 금액이 등록값과 다름' {L}"))
print("--- 차단 경보 최근 20건 (날짜/회원) ---")
print(sh(f"grep -n '등록 안 한 회원에게 자동충전\\|자동결제 미등록 회원' {L} | tail -20"))

print("="*72); print("[D] handleAutopayPush 가 막은 흔적 — payment 에 안 남았지만 m2net엔 있는 케이스 추정"); print("="*72)
print("--- 최근 30일 AUTO_PAY 결제 건수(우리DB) — m2net 실제건과 대조용 ---")
print(q("SELECT count(*) AS our_autopay_rows_30d FROM payment "
        "WHERE pay_method LIKE '%AUTO_PAY%' AND created_at >= now() - interval '30 days';"))
c.close()
