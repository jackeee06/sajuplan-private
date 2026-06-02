"""prod DB 의 월아신녀 + 다른 회원 phone 컬럼 실제 값 확인."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
sql = """
SELECT id, mb_id, name, nickname, phone, LENGTH(phone) AS phone_len
  FROM member
 WHERE phone IS NOT NULL AND phone != ''
 ORDER BY id LIMIT 20;
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -c "{sql}"'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
