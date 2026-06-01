"""월아신녀 traits + extras 값 확인."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)
sql = """
SELECT member_id, mb_id, specialty, hashtag1, hashtag2,
       traits, extras::text AS extras_text
  FROM post_counselor
 WHERE member_id IN (134, 109, 125, 91, 123, 124);
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -x -c "{sql}"'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
