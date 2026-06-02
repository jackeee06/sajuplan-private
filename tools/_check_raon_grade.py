#!/usr/bin/env python3
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

SELECT '== 라온선생 grade + 단가 ==' AS section;
SELECT id, mb_id, nickname, grade,
       free_royalty_pct, paid_royalty_pct,
       call_070_unit_cost, chat_unit_cost
  FROM member WHERE id = 123;

SELECT '== setting 의 등급별 정산률 (있는 거 모두) ==' AS section;
SELECT key, value FROM setting
 WHERE namespace = 'grade' AND key LIKE 'revenue_rate.%'
 ORDER BY key;

SELECT '== setting 의 신규 상담사 기본 단가 ==' AS section;
SELECT namespace, key, value FROM setting
 WHERE namespace = 'grade' AND key IN ('default_new_unit_cost', 'default_grade');
"""

sftp = ssh.open_sftp()
with sftp.open('/tmp/_check_grade.sql', 'w') as f: f.write(sql)
sftp.close()

script = '''
cd /data/wwwroot/api.sajumoon.co.kr
DBURL=$(grep -E "^DATABASE_URL=" .env | head -1 | sed "s/^DATABASE_URL=//; s/^['\\"]//; s/['\\"]\\$//")
psql "$DBURL" -f /tmp/_check_grade.sql
rm -f /tmp/_check_grade.sql
'''
stdin, stdout, stderr = ssh.exec_command(script, timeout=30)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print('STDERR:', err)
ssh.close()
