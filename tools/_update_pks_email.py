"""일회성: 라온선생(박기태, id=123) 이메일 변경. 전화(01030323004)는 이미 요청값과 동일이라 미변경."""
import os
import sys

import paramiko

pw = os.environ.get("SSHPASS")
if not pw:
    print("NO_SSHPASS")
    sys.exit(2)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)
sql = (
    "UPDATE member SET email='pks3004@naver.com' "
    "WHERE id=123 RETURNING id, nickname, email, phone"
)
cmd = (
    'export $(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env|xargs)>/dev/null 2>&1; '
    f'psql "$DATABASE_URL" -At -F "|" -c "{sql}"'
)
_, out, err = ssh.exec_command(cmd, get_pty=False)
print(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e:
    sys.stderr.write(e)
ssh.close()
