#!/usr/bin/env python3
"""라온선생이 자기 마이페이지/어드민에서 어떻게 보이는지 검증."""
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.64.128.103', port=22, username='root',
            password=os.environ['SSHPASS'],
            timeout=15, look_for_keys=False, allow_agent=False)

sql = r"""
\pset border 2
\pset format aligned

SELECT '== 1. 라온선생 현재 포인트 잔액 ==' AS section;
SELECT member_id, free_balance, paid_balance,
       (free_balance + paid_balance) AS 총잔액,
       total_earned, total_used
  FROM point WHERE member_id = 123;

SELECT '== 2. 라온선생 오늘 상담 건수 (정상 통화만 — DISCONNECT/END_CHAT) ==' AS section;
SELECT COUNT(*) AS 오늘_상담건수
  FROM consultation
 WHERE counselor_id = 123
   AND created_at::date = CURRENT_DATE
   AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL');

SELECT '== 3. 라온선생 이번달 정산 예상 (settlement-cron 산식) ==' AS section;
SELECT
  COUNT(*) AS 정산대상_건수,
  COALESCE(SUM(amt_free), 0) AS amt_free_합계,
  COALESCE(SUM(amt_pro), 0) AS amt_pro_합계,
  COALESCE(SUM(amt), 0) AS amt_총합
  FROM consultation c
 WHERE c.counselor_id = 123
   AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
   AND c.refund_status IS DISTINCT FROM 'full'
   AND c.created_at >= date_trunc('month', CURRENT_DATE)
   AND EXISTS (
     SELECT 1 FROM point_history ph
      WHERE ph.rel_table = 'consultation'
        AND ph.rel_id = c.id::text
        AND ph.member_id = c.counselor_id
   );

SELECT '== 4. 정산 산식 모의 계산 (preliminary 등급, 40% 정산률) ==' AS section;
WITH cons AS (
  SELECT COALESCE(SUM(amt_free), 0) AS sf, COALESCE(SUM(amt_pro), 0) AS sp
    FROM consultation c
   WHERE c.counselor_id = 123
     AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
     AND c.refund_status IS DISTINCT FROM 'full'
     AND c.created_at >= date_trunc('month', CURRENT_DATE)
     AND EXISTS (
       SELECT 1 FROM point_history ph
        WHERE ph.rel_table = 'consultation' AND ph.rel_id = c.id::text AND ph.member_id = c.counselor_id
     )
),
rate AS (
  SELECT (value::numeric * 100)::int AS pct
    FROM setting
   WHERE namespace = 'grade' AND key = 'revenue_rate.preliminary'
)
SELECT
  c.sf AS amt_free,
  c.sp AS amt_pro,
  r.pct AS 정산률_pct,
  FLOOR(c.sf * r.pct / 100.0) + FLOOR(c.sp * r.pct / 100.0) AS price_tot,
  FLOOR((FLOOR(c.sf * r.pct / 100.0) + FLOOR(c.sp * r.pct / 100.0)) / 1.1) AS supply,
  FLOOR(FLOOR((FLOOR(c.sf * r.pct / 100.0) + FLOOR(c.sp * r.pct / 100.0)) / 1.1) * 0.033) AS 원천징수,
  FLOOR((FLOOR(c.sf * r.pct / 100.0) + FLOOR(c.sp * r.pct / 100.0)) / 1.1)
    - FLOOR(FLOOR((FLOOR(c.sf * r.pct / 100.0) + FLOOR(c.sp * r.pct / 100.0)) / 1.1) * 0.033)
    AS 실수령_예상
  FROM cons c, rate r;

SELECT '== 5. 라온선생 모든 point_history (보이는 흐름) ==' AS section;
SELECT id, content, earn_point, balance_after, rel_table, rel_id,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM point_history WHERE member_id = 123 ORDER BY id;
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/_check_raon_vis.sql', 'w') as f: f.write(sql)
sftp.close()

script = '''
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\\"]//; s/['\\"]\\$//")
psql "$DBURL" -f /tmp/_check_raon_vis.sql
rm -f /tmp/_check_raon_vis.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print('STDERR:', err)
ssh.close()
