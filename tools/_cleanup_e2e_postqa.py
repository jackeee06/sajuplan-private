"""E2E 테스트로 쌓인 e2e_member 의 post_qa 문의 정리 (테스트 데이터만)."""
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

_, o, _ = client.exec_command(
    "grep -iE 'DATABASE_URL' /data/wwwroot/api.sajumoon.co.kr/.env", timeout=15)
m = re.search(r'postgres(?:ql)?://[^:]+:([^@]+)@', o.read().decode('utf-8', 'replace'))
dbpass = m.group(1) if m else ''

sql = (
    "DELETE FROM post_qa WHERE member_id IN "
    "(SELECT id FROM member WHERE mb_id = 'e2e_member');"
)
cmd = ("PGPASSWORD='" + dbpass + "' timeout 12 psql -U sajumoon -d sajumoon "
       "-c \"" + sql + "\" "
       "-c \"SELECT count(*) AS remaining FROM post_qa p JOIN member m ON m.id=p.member_id "
       "WHERE m.mb_id='e2e_member';\"")
_, stdout, stderr = client.exec_command(cmd, timeout=20)
print(stdout.read().decode('utf-8', 'replace'))
print('ERR:', stderr.read().decode('utf-8', 'replace'))
client.close()
