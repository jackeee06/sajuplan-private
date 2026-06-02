"""prod 에서 최근 상담사 신청 (post_apply) ID 찾기.
   SQL 을 sftp 로 원격 임시 파일에 둔 후 psql -f 로 실행 — quote escape 회피."""
from __future__ import annotations
import os, sys
import paramiko

pw = os.environ.get('SSHPASS')
if not pw:
    print('SSHPASS env required', file=sys.stderr); sys.exit(2)

SQL = """
SELECT a.id, a.status,
       LEFT(a.title, 30) AS title,
       m.mb_id, m.name,
       to_char(a.created_at, 'YYYY-MM-DD HH24:MI') AS at
  FROM post_apply a
  LEFT JOIN member m ON m.id = a.member_id
 WHERE a.category IS DISTINCT FROM 'notice'
 ORDER BY a.created_at DESC
 LIMIT 10;
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

# SQL 을 원격 /tmp 에 저장
tmp_sql = f'/tmp/find_apply_{os.getpid()}.sql'
stdin, stdout, _ = c.exec_command(f"cat > {tmp_sql}", timeout=15)
stdin.write(SQL); stdin.channel.shutdown_write()
stdout.channel.recv_exit_status()

# .env 읽기 → DATABASE_URL 추출
_, env_out, _ = c.exec_command(
    'grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env', timeout=10,
)
env_line = env_out.read().decode().strip()
if '=' not in env_line:
    print('DATABASE_URL not found in .env', file=sys.stderr); c.close(); sys.exit(1)
db_url = env_line.split('=', 1)[1].strip().strip('"').strip("'")

# psql 실행
_, out, err = c.exec_command(
    f'psql "{db_url}" -f {tmp_sql} && rm -f {tmp_sql}', timeout=30,
)
print(out.read().decode())
e = err.read().decode()
if e: print('STDERR:', e, file=sys.stderr)
c.close()
