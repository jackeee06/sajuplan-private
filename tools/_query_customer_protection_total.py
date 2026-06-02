"""고객보호비용(매몰비용) 총액 조회 — 30초 미만 자동 환원 누적 합계.

집계 로직 출처:
  - api/src/admin/dashboard/dashboard.service.ts  (shortCallRefundKpi)
  - api/src/admin/short-call-refunds/short-call-refunds.service.ts
  테이블: consultation / 컬럼: refunded_amount / 조건: refund_status='short_call_refund'

사용법 (사용자 로컬에서, 네트워크 + SSHPASS 필요):
  set -a; source .env.local; set +a
  python3 tools/_query_customer_protection_total.py            # prod (기본)
  TARGET=test python3 tools/_query_customer_protection_total.py # test
"""
import os, sys, paramiko

pw = os.environ.get('SSHPASS')
if not pw:
    print('✗ SSHPASS 미설정. `set -a; source .env.local; set +a` 먼저 실행.', file=sys.stderr)
    sys.exit(2)

TARGET = os.environ.get('TARGET', 'prod')
if TARGET == 'prod':
    HOST, ENV_PATH = '104.64.128.103', '/data/wwwroot/api.sajumoon.co.kr/.env'
else:
    HOST, ENV_PATH = '172.235.211.75', '/data/wwwroot/api.sajumoon.kr/.env'

SQL = """
SELECT
  COUNT(*)::text                                                   AS total_count,
  COALESCE(SUM(refunded_amount), 0)::text                          AS total_amount,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::text
                                                                   AS this_month_count,
  COALESCE(SUM(refunded_amount) FILTER (
    WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0)::text
                                                                   AS this_month_amount
FROM consultation
WHERE refund_status = 'short_call_refund';
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

# 서버 .env 에서 DATABASE_URL 추출
_, env, _ = c.exec_command(f'grep ^DATABASE_URL= {ENV_PATH}')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

tmp = f'/tmp/cust_protect_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, out, err = c.exec_command(f'psql "{db_url}" -A -F "|" -t -f {tmp} && rm -f {tmp}', timeout=30)
res = out.read().decode().strip()
e = err.read().decode().strip()
c.close()

if e:
    print('STDERR:', e, file=sys.stderr)
if res:
    tc, ta, mc, ma = res.split('|')
    print(f'[{TARGET}] 고객보호비용')
    print(f'  누적 총액   : {int(ta):,} 원  ({int(tc):,} 건)')
    print(f'  이번달      : {int(ma):,} 원  ({int(mc):,} 건)')
else:
    print('결과 없음 (데이터 0건이거나 쿼리 실패)')
