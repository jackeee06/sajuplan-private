#!/usr/bin/env python3
"""prod 라온선생 (counselor_id=123) 의 consultation 상태 조회 + point 잔액 확인."""
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

SELECT '== 라온선생 counselor_id=123 의 모든 consultation ==' AS section;
SELECT id, counselor_id, member_id, csrid, membid,
       reason, usetm, amt, amt_free, amt_pro,
       is_paid, is_settled, skip_charge,
       refund_status, refunded_amount,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM consultation
 WHERE counselor_id = 123
 ORDER BY id DESC LIMIT 10;

SELECT '== 라온선생 단가 (member.call_070_unit_cost 등) ==' AS section;
SELECT id, mb_id, nickname,
       call_070_unit_cost, call_060_unit_cost, chat_unit_cost,
       free_royalty_pct, paid_royalty_pct
  FROM member WHERE id = 123;

SELECT '== 라온선생 현재 point 잔액 ==' AS section;
SELECT member_id, balance, free_balance, total_earned, total_used,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
  FROM point WHERE member_id = 123;

SELECT '== 라온선생 point_history 최근 5건 ==' AS section;
SELECT id, member_id, type, amount,
       rel_table, rel_id, comment,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM point_history WHERE member_id = 123
 ORDER BY id DESC LIMIT 5;

SELECT '== consultation #64 가 라온선생 것 맞는지 확정 ==' AS section;
SELECT id, counselor_id, member_id, reason, usetm, amt,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM consultation WHERE id = 64;
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/_check_cons_64.sql', 'w') as f:
    f.write(sql)
sftp.close()

script = '''
set -e
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\\"]//; s/['\\"]\\$//")
psql "$DBURL" -f /tmp/_check_cons_64.sql
rm -f /tmp/_check_cons_64.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print('STDERR:', err)
ssh.close()
