import os, paramiko
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'], look_for_keys=False, allow_agent=False, timeout=20)
def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=40)
    return o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')
db = run("grep '^DATABASE_URL=' /data/wwwroot/api.sajumoon.co.kr/.env | head -1 | cut -d= -f2-").strip().strip("'").strip('"')
q = "SELECT id, member_id, mb_id, title, category FROM notification_log WHERE title LIKE '손가락검증%' ORDER BY id"
print(run('psql "%s" -P pager=off -c "%s"' % (db, q)))
c.close()
