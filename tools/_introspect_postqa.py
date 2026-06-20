"""Introspect post_qa schema on prod (read-only)."""
import os
import re
import pathlib
import paramiko


def load_pw():
    pw = os.environ.get('SSHPASS', '')
    if pw:
        return pw
    envp = pathlib.Path(__file__).resolve().parent.parent / '.env.local'
    if envp.exists():
        for line in envp.read_text(encoding='utf-8', errors='replace').splitlines():
            if line.strip().startswith('SSHPASS'):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return 'saju26moon@!!'


client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=load_pw(), timeout=15)

# DB 비밀번호를 api .env 에서 추출
_, o, _ = client.exec_command(
    "grep -iE 'DATABASE_URL|DB_PASS|PGPASSWORD' /data/wwwroot/api.sajumoon.co.kr/.env",
    timeout=15)
envtext = o.read().decode('utf-8', 'replace')
dbpass = ''
m = re.search(r'postgres(?:ql)?://[^:]+:([^@]+)@', envtext)
if m:
    dbpass = m.group(1)
else:
    m2 = re.search(r'(?:DB_PASS|PGPASSWORD)\s*=\s*["\']?([^"\'\n]+)', envtext)
    if m2:
        dbpass = m2.group(1)
print('dbpass_found=', bool(dbpass))

q = ("SELECT column_name, is_nullable, column_default FROM information_schema.columns "
     "WHERE table_name = 'post_qa' ORDER BY ordinal_position;")
cmd = ("PGPASSWORD='" + dbpass + "' timeout 12 psql -U sajumoon -d sajumoon -P pager=off "
       "-c \"" + q + "\" -c \"SELECT count(*) AS rowcount FROM post_qa;\"")
_, stdout, stderr = client.exec_command(cmd, timeout=20)
print(stdout.read().decode('utf-8', 'replace'))
print('ERR:', stderr.read().decode('utf-8', 'replace'))
client.close()
