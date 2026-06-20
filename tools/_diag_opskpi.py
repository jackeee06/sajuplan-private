import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', 22, 'root', 'saju26moon@!!', timeout=20)

def q(label, sql):
    _, out, err = client.exec_command(f"psql -U sajumoon -d sajumoon -c {sql!r}")
    result = out.read().decode('utf-8', errors='replace')
    error = err.read().decode('utf-8', errors='replace')
    print(f'\n=== {label} ===')
    print(result or '(no rows)')
    if error: print('ERR:', error)

q('서버 now()/CURRENT_DATE', "SELECT now(), CURRENT_DATE, current_setting('TIMEZONE')")

# 종료상담만(KPI 대상) created_at 일자별 분포 최근
q('consultation 일자별 분포 (종료상담, 최근 40일)', """
SELECT created_at::date AS d, COUNT(*) AS n,
       COUNT(*) FILTER (WHERE reason='DISCONNECT') AS call,
       COUNT(*) FILTER (WHERE reason IN ('END_CHAT','END_CHAT_LOCAL')) AS chat,
       COALESCE(SUM(amt),0) AS amt
FROM consultation
WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
  AND created_at >= CURRENT_DATE - 40
GROUP BY 1 ORDER BY 1 DESC
""")

# ops-kpi 쿼리를 기간별로 재현
def kpi(label, frcond):
    q(f'KPI {label}', f"""
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE reason='DISCONNECT') AS call,
       COUNT(*) FILTER (WHERE reason IN ('END_CHAT','END_CHAT_LOCAL')) AS chat,
       COALESCE(SUM(amt),0) AS revenue,
       COALESCE(SUM(refunded_amount),0) AS refunded
FROM consultation
WHERE {frcond}
  AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
""")

kpi('오늘', "created_at >= CURRENT_DATE::timestamptz AND created_at <= (CURRENT_DATE || ' 23:59:59')::timestamptz")
kpi('어제', "created_at >= (CURRENT_DATE-1)::timestamptz AND created_at <= ((CURRENT_DATE-1) || ' 23:59:59')::timestamptz")
kpi('이번달', "created_at >= date_trunc('month',CURRENT_DATE) AND created_at <= (CURRENT_DATE || ' 23:59:59')::timestamptz")
kpi('지난달', "created_at >= date_trunc('month',CURRENT_DATE-INTERVAL '1 month') AND created_at < date_trunc('month',CURRENT_DATE)")

client.close()
