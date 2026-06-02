"""prod 의 site namespace stat override 값 + 실제 consultation 24h 건수 확인."""
from __future__ import annotations
import os, sys
import paramiko

pw = os.environ.get('SSHPASS')
if not pw: print('SSHPASS env'); sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

SQL = """
SELECT key, value FROM setting
 WHERE namespace='site'
   AND key IN ('stat_recent_consultations_override','stat_online_counselors_override');
SELECT
  (SELECT COUNT(*) FROM consultation
    WHERE created_at > now() - interval '24 hours'
      AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')) AS recent_actual,
  (SELECT COUNT(*) FROM member
    WHERE role='counselor' AND left_at IS NULL
      AND state IN ('IDLE','RDCH','RDVC','CRDY','CONN','CNCH')
      AND (use_phone=true OR use_chat=true)) AS online_actual;
"""

tmp = f'/tmp/check_stat_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
_, out, _ = c.exec_command(f'psql "{db_url}" -x -f {tmp} && rm -f {tmp}', timeout=30)
print(out.read().decode())
c.close()
