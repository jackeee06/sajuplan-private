"""prod 의 jackee 상담사 row dump — 노출 안 되는 원인 추적."""
from __future__ import annotations
import os, sys
import paramiko

pw = os.environ.get('SSHPASS')
if not pw:
    print('SSHPASS env required', file=sys.stderr); sys.exit(2)

SQL = """
SELECT id, mb_id, name, nickname, role, level, state,
       csrid, m2net_membid, dtmfno, telno,
       use_phone, use_chat,
       call_070_unit_cost, call_060_unit_cost, chat_unit_cost,
       left_at,
       (SELECT id FROM post_counselor WHERE member_id = m.id LIMIT 1) AS pc_id,
       (SELECT title FROM post_counselor WHERE member_id = m.id LIMIT 1) AS pc_title
  FROM member m
 WHERE mb_id = 'jackee';
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

tmp = f'/tmp/check_jackee_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()

_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")

# 가로 길이 방지 — \x mode
_, out, err = c.exec_command(
    f'psql "{db_url}" -x -f {tmp} && rm -f {tmp}', timeout=20,
)
print(out.read().decode())
e = err.read().decode()
if e: print('STDERR:', e, file=sys.stderr)
c.close()
