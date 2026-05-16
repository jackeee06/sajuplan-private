"""prod DB schema 빠른 조회 — review/report 관련 테이블 구조 확인용."""
from __future__ import annotations
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

SSH_HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

QUERIES = [
    r"\d post_review",
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%report%';",
]


def main() -> int:
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env var required", file=sys.stderr)
        return 1
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    for q in QUERIES:
        inner = (
            f'export DATABASE_URL=$(grep -E "^DATABASE_URL=" {ENV_FILE} | cut -d= -f2-) && '
            f'psql "$DATABASE_URL" -c "{q}"'
        )
        cmd = f"bash -lc {repr(inner)}"
        _, out, err = client.exec_command(cmd, get_pty=False)
        print(f"\n=== {q} ===")
        sys.stdout.write(out.read().decode("utf-8", errors="replace"))
        e = err.read().decode("utf-8", errors="replace")
        if e.strip():
            sys.stderr.write(e)
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
