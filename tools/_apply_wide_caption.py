"""건우선생 (member_id=55) 와이드 캡션 일회성 적용 — 운영 DB.

prod 서버 SSH → .env 의 DATABASE_URL 추출 → psql 로 UPDATE.
SQL 안의 한글/quote 안전을 위해 base64 인코딩 후 디코딩 파이프 사용.
"""
from __future__ import annotations
import base64
import os
import sys

# Windows 콘솔(cp949) 에서 한글/em-dash 출력 시 UnicodeEncodeError 방지
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

try:
    import paramiko
except ImportError:
    print("paramiko 필요. (pip install paramiko)", file=sys.stderr)
    sys.exit(2)

SSH_HOST = "104.64.128.103"
SSH_USER = "root"
SSH_PORT = 22
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

SQL = (
    "UPDATE post_counselor "
    "SET wide_headline = '오늘 마음이 무거우셨나요', "
    "    wide_subcaption = '유우우 — 속마음 편히 들어드려요', "
    "    updated_at = now() "
    "WHERE member_id = 81 "
    "RETURNING member_id, wide_headline, wide_subcaption;"
)


def main() -> int:
    password = os.environ.get("SSHPASS")
    if not password:
        print("SSHPASS env var 필요", file=sys.stderr)
        return 1

    b64 = base64.b64encode(SQL.encode("utf-8")).decode("ascii")
    inner = (
        f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {ENV_FILE} | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    cmd = f"bash -lc {repr(inner)}"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        SSH_HOST, SSH_PORT, SSH_USER, password,
        allow_agent=False, look_for_keys=False, timeout=20,
    )
    try:
        _, stdout, stderr = client.exec_command(cmd, get_pty=False)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        sys.stdout.write(out)
        if err.strip():
            sys.stderr.write(err)
        return stdout.channel.recv_exit_status()
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
