"""prod DB 의 post_counselor, refund_request, member 컬럼 확인."""
import os, sys, paramiko
pw = os.environ.get('SSHPASS')
if not pw: sys.exit(2)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20,
          look_for_keys=False, allow_agent=False)

SQL = """
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_name IN ('post_counselor', 'refund_request', 'member', 'member_file')
   AND column_name IN ('event_starts_at','event_ends_at','counselor_id','status',
                       'requested_at','use_phone','use_chat','last_login_at',
                       'updated_at','kind','member_id','hashtag1','hashtag2')
 ORDER BY table_name, column_name;
"""
tmp = f'/tmp/check_cols_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
_, out, _ = c.exec_command(f'psql "{db_url}" -A -F "|" -t -f {tmp} && rm -f {tmp}', timeout=20)
print(out.read().decode())
c.close()
