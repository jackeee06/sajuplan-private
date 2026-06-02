#!/usr/bin/env python3
"""consultation #64 의 refund_status='short_call_refund', refunded_amount=1000 소급.

방금 보전된 라온선생 적립과 일관성 — m2net 정산 추적 마커 부착."""
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

BEGIN;

UPDATE consultation
   SET refund_status   = 'short_call_refund',
       refunded_amount = amt
 WHERE id = 64
   AND counselor_id = 123
   AND reason = 'DISCONNECT'
   AND usetm < 30
   AND refund_status IS NULL;

SELECT '== UPDATE 결과 ==' AS section;
SELECT id, counselor_id, reason, usetm, amt,
       refund_status, refunded_amount,
       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM consultation WHERE id = 64;

COMMIT;
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/_backfill_64_rs.sql', 'w') as f: f.write(sql)
sftp.close()

script = '''
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\\"]//; s/['\\"]\\$//")
psql "$DBURL" -f /tmp/_backfill_64_rs.sql
rm -f /tmp/_backfill_64_rs.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print('STDERR:', err)
ssh.close()
