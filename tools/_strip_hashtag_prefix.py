"""post_counselor 의 hashtag1/2 컬럼에서 leading '#' 제거 — 카드에 '##' 두 개 표시되는 사고 정리."""
from __future__ import annotations
import os, sys
import paramiko

SQL = """
UPDATE post_counselor
   SET hashtag1 = TRIM(LEADING '#' FROM hashtag1),
       hashtag2 = TRIM(LEADING '#' FROM hashtag2)
 WHERE hashtag1 LIKE '#%' OR hashtag2 LIKE '#%';
"""

pw = os.environ.get('SSHPASS')
if not pw:
    print('SSHPASS env required', file=sys.stderr); sys.exit(2)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)
tmp = f'/tmp/strip_hash_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
_, out, err = c.exec_command(f'psql "{db_url}" -v ON_ERROR_STOP=1 -f {tmp} && rm -f {tmp}', timeout=30)
print(out.read().decode())
e = err.read().decode()
if e: print('STDERR:', e, file=sys.stderr)
c.close()
