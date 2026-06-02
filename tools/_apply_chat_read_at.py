"""chat_message.read_at 컬럼 추가 마이그레이션 양 서버 적용."""
import os
import sys
import io
import paramiko
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except Exception:
        pass

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr", "/usr/local/pgsql/bin/psql"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr", "/usr/bin/psql"),
]
SQL = Path(__file__).resolve().parent.parent / "api/db/migrations/20260523000000_chat_read_at.sql"
REMOTE = "/tmp/chat_read_at.sql"


def main() -> int:
    pw = os.environ["SSHPASS"]
    data = SQL.read_bytes()
    for label, host, api_remote, psql in TARGETS:
        print(f"\n=== [{label}] {host} ===")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
        try:
            _, out, _ = c.exec_command(
                f"grep '^DATABASE_URL=' {api_remote}/.env | head -1"
            )
            dburl = out.read().decode().strip().split("=", 1)[1].strip("'\"")
            sftp = c.open_sftp()
            sftp.putfo(io.BytesIO(data), REMOTE)
            sftp.close()
            print(f"  SQL 업로드 완료 ({len(data)} bytes)")
            _, out, _ = c.exec_command(
                f'{psql} "{dburl}" -v ON_ERROR_STOP=1 -f {REMOTE} 2>&1'
            )
            print(out.read().decode())
            c.exec_command(f"rm -f {REMOTE}")
        finally:
            c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
