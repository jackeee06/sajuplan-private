"""PROD DB 마이그레이션 단독 적용 (코드 배포보다 먼저 — reward_type 컬럼 선반영).

사용:
  set -a; source .env.local; set +a   # (bash) SSHPASS 로드
  python tools/_run_prod_migrate.py <user@host[:port]> <api_remote> <migration_rel...>

동작: 지정한 .sql 들을 원격 db/migrations/ 로 업로드 → `npm run db:migrate` → `db:migrate:list` 출력.
"""
import os
import sys
from pathlib import Path

import paramiko


def parse_host(arg: str):
    user = "root"
    host = arg
    port = 22
    if "@" in arg:
        user, host = arg.split("@", 1)
    if ":" in host:
        host, p = host.split(":", 1)
        port = int(p)
    return user, host, port


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: _run_prod_migrate.py <user@host[:port]> <api_remote> <migration_rel...>", file=sys.stderr)
        return 2
    host_arg, api_remote = sys.argv[1], sys.argv[2]
    migrations = sys.argv[3:]
    user, host, port = parse_host(host_arg)

    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 2

    root = Path(__file__).resolve().parent.parent
    print(f"▶ connect {user}@{host}:{port}", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=user, password=pw,
                timeout=20, banner_timeout=20, auth_timeout=20, look_for_keys=False, allow_agent=False)
    transport = ssh.get_transport()
    if transport is not None:
        transport.set_keepalive(15)

    try:
        for rel in migrations:
            local_path = root / "api" / rel if not rel.startswith("api/") else root / rel
            # rel 형태: "db/migrations/xxx.sql" 또는 "api/db/migrations/xxx.sql"
            remote_rel = rel[4:] if rel.startswith("api/") else rel
            local = root / ("api/" + remote_rel)
            remote_path = f"{api_remote.rstrip('/')}/{remote_rel}"
            data = local.read_bytes()
            print(f"  put {remote_rel}  ({len(data):,} bytes) → {remote_path}", flush=True)
            remote_dir = remote_path.rsplit('/', 1)[0]
            ssh.exec_command(f"mkdir -p '{remote_dir}'", timeout=10)[1].channel.recv_exit_status()
            stdin, stdout, stderr = ssh.exec_command(f"cat > '{remote_path}'", timeout=60)
            stdin.write(data)
            stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            if rc != 0:
                print(f"  ✗ put 실패 rc={rc}: {stderr.read().decode('utf-8', 'replace')}", file=sys.stderr)
                return rc

        cmd = (
            f"set -eo pipefail; cd '{api_remote}' && "
            f"echo '[remote] npm run db:migrate' && npm run db:migrate 2>&1 | tail -30 && "
            f"echo '[remote] db:migrate:list' && npm run db:migrate:list 2>&1 | tail -15"
        )
        print("▶ remote db:migrate", flush=True)
        stdin, stdout, stderr = ssh.exec_command(f"bash -lc {repr(cmd)}", timeout=180)
        stdin.close()
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        rc = stdout.channel.recv_exit_status()
        print(out)
        if err.strip():
            print("[stderr]", err)
        if rc != 0:
            print(f"✗ migrate 실패 rc={rc}", file=sys.stderr)
            return rc
        print("✓ migrate done", flush=True)
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
