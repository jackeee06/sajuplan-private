import os, sys, paramiko
pw = os.environ.get('SSHPASS')
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw, timeout=20, look_for_keys=False, allow_agent=False)
SQL = "SELECT column_name FROM information_schema.columns WHERE table_name='refund_request' ORDER BY ordinal_position;"
tmp = f'/tmp/r_{os.getpid()}.sql'
i, o, _ = c.exec_command(f'cat > {tmp}')
i.write(SQL); i.channel.shutdown_write(); o.channel.recv_exit_status()
_, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
_, out, _ = c.exec_command(f'psql "{db_url}" -A -t -f {tmp} && rm -f {tmp}', timeout=20)
print(out.read().decode())
c.close()
