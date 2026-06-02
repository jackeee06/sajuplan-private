#!/usr/bin/env python3
"""prod 최종 검증 — 라온선생 적립 + 코드 반영."""
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

SELECT '== 라온선생 point 잔액 (보전 후) ==' AS section;
SELECT member_id, free_balance, paid_balance, total_earned, total_used,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
  FROM point WHERE member_id = 123;

SELECT '== 라온선생 모든 point_history ==' AS section;
SELECT id, member_id, content, earn_point, use_point, balance_after,
       rel_table, rel_id, rel_action, actor_type,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM point_history WHERE member_id = 123
 ORDER BY id;

SELECT '== consultation #64 settlement-cron이 정산에 포함 가능한지 모의쿼리 ==' AS section;
SELECT c.id, c.counselor_id, c.reason, c.usetm, c.amt, c.amt_free, c.amt_pro,
       c.refund_status,
       EXISTS (
         SELECT 1 FROM point_history ph
          WHERE ph.rel_table = 'consultation'
            AND ph.rel_id = c.id::text
            AND ph.member_id = c.counselor_id
       ) AS has_point_history
  FROM consultation c
 WHERE c.id = 64;
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/_verify_raon.sql', 'w') as f:
    f.write(sql)
sftp.close()

script = '''
set -e
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\\"]//; s/['\\"]\\$//")
psql "$DBURL" -f /tmp/_verify_raon.sql
rm -f /tmp/_verify_raon.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print('STDERR:', err)
ssh.close()
