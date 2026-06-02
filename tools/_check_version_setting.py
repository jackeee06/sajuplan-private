"""prod DB 의 setting 테이블에서 앱 버전 관련 row 확인."""
from __future__ import annotations
import os, sys
import paramiko

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SSH_HOST = "104.64.128.103"
ENV_FILE = "/data/wwwroot/api.sajumoon.co.kr/.env"

QUERIES = [
    "SELECT namespace, key, value, value_type, description FROM setting WHERE namespace IN ('app','version','mobile') OR key LIKE '%version%' OR key LIKE 'aos_%' OR key LIKE 'ios_%' OR key = 'update_notice' ORDER BY namespace, key;",
    "SELECT namespace, count(*) FROM setting GROUP BY namespace ORDER BY namespace;",
]


def run(client, sql):
    """Pipe SQL via stdin to psql; sidestep all shell quoting."""
    cmd = f"bash -c 'set -a; . {ENV_FILE}; set +a; psql \"$DATABASE_URL\" -t -A -F \"|\"'"
    stdin, out, err = client.exec_command(cmd, get_pty=False)
    stdin.write(sql + "\n")
    stdin.channel.shutdown_write()
    print(f"\n=== {sql[:90]} ===")
    sys.stdout.write(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e.strip(): sys.stderr.write(e)


def main() -> int:
    pw = os.environ["SSHPASS"]
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
    for q in QUERIES:
        run(client, q)
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
