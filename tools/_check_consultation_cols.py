import os, paramiko
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=',1)[1].strip("'\"")
_, o, _ = c.exec_command(
    f'/usr/bin/psql "{dburl}" -Atc "SELECT column_name FROM information_schema.columns '
    "WHERE table_name='consultation' ORDER BY ordinal_position;\""
)
print(o.read().decode())
c.close()
