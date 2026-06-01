"""post_counselor 의 모든 컬럼 확인 + 월아신녀 모든 데이터 확인."""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"], allow_agent=False, look_for_keys=False, timeout=15)

sql = r"""
\echo === [1] post_counselor 의 모든 컬럼 ===
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name='post_counselor'
 ORDER BY ordinal_position;

\echo
\echo === [2] 월아신녀 (member_id=134) 의 post_counselor 모든 컬럼 값 ===
SELECT * FROM post_counselor WHERE member_id=134;
"""
cmd = f'psql $(grep "^DATABASE_URL" /data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) -x <<\'EOSQL\'\n{sql}\nEOSQL'
_, o, _ = c.exec_command(cmd, get_pty=False)
print(o.read().decode("utf-8", errors="replace"))
c.close()
