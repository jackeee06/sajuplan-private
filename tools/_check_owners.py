"""일회성: 모집인 초대 버튼 노출 대상(주인 3명) 계정 검증.

주인: 사장님 jackee(91, 찬물선생) / 라온선생 박기수(123) / 선샤인선생 홍루연(112).
is_owner 마이그레이션을 안전하게 세팅하기 위해 id/mb_id/role 을 실측한다.
"""
import os
import sys

import paramiko

HOST = "104.64.128.103"
ENV_REMOTE = "/data/wwwroot/api.sajumoon.co.kr/.env"

pw = os.environ.get("SSHPASS")
if not pw:
    print("NO_SSHPASS")
    sys.exit(2)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=25)

sql = (
    "SELECT id, mb_id, name, nickname, role "
    "FROM member WHERE id IN (91,112,123) OR mb_id='jackee' ORDER BY id"
)
cmd = (
    f'export $(grep -E "^DATABASE_URL=" {ENV_REMOTE}|xargs)>/dev/null 2>&1; '
    f'psql "$DATABASE_URL" -At -F "|" -c "{sql}"'
)
_, out, err = ssh.exec_command(cmd, get_pty=False)
print(out.read().decode("utf-8", errors="replace"))
e = err.read().decode("utf-8", errors="replace")
if e:
    sys.stderr.write(e)
ssh.close()
