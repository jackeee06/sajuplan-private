"""사주플랜 외과 배포 — /api/app/version 엔드포인트 5개 파일만 푸시 + build + reload.

사용:
  python tools/_patch_app_version.py <user@host[:port]> <api_remote> <pm2_name>
"""
from __future__ import annotations
import os
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

import paramiko

FILES = [
    ("api/src/user/app-version/app-version.controller.ts", "src/user/app-version/app-version.controller.ts"),
    ("api/src/user/app-version/app-version.service.ts",    "src/user/app-version/app-version.service.ts"),
    ("api/src/user/app-version/app-version.module.ts",     "src/user/app-version/app-version.module.ts"),
    ("api/src/user/user.module.ts",                        "src/user/user.module.ts"),
]


def parse_host(s):
    user, port = "root", 22
    if "@" in s: user, s = s.split("@", 1)
    if ":" in s: s, p = s.split(":", 1); port = int(p)
    return user, s, port


def main():
    if len(sys.argv) != 4:
        print("usage: _patch_app_version.py <user@host[:port]> <api_remote> <pm2_name>", file=sys.stderr); return 2
    host_arg, api_remote, pm2_name = sys.argv[1], sys.argv[2], sys.argv[3]
    user, host, port = parse_host(host_arg)
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS env required", file=sys.stderr); return 2
    root = Path(__file__).resolve().parent.parent
    print(f"▶ connect {user}@{host}:{port}", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=user, password=pw, timeout=20, look_for_keys=False, allow_agent=False)
    transport = ssh.get_transport()
    if transport is not None: transport.set_keepalive(15)
    try:
        for local_rel, remote_rel in FILES:
            local = root / local_rel
            remote = f"{api_remote.rstrip('/')}/{remote_rel}"
            data = local.read_bytes()
            print(f"  put {local_rel}  ({len(data):,} bytes)", flush=True)
            remote_dir = remote.rsplit('/', 1)[0]
            ssh.exec_command(f"mkdir -p '{remote_dir}'", timeout=10)[1].channel.recv_exit_status()
            stdin, stdout, stderr = ssh.exec_command(f"cat > '{remote}'", timeout=60)
            stdin.write(data); stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            if rc != 0:
                err = stderr.read().decode("utf-8", errors="replace")
                print(f"  ✗ put 실패 rc={rc}: {err}", file=sys.stderr); return rc

        cmd = (
            f"set -e; cd '{api_remote}' && "
            f"echo '[remote] npm run build' && npm run build 2>&1 | tail -10 && "
            f"echo '[remote] pm2 reload {pm2_name}' && "
            f"pm2 reload '{pm2_name}' --update-env 2>&1 && pm2 status '{pm2_name}' | tail -3"
        )
        print("▶ remote build + reload", flush=True)
        stdin, stdout, stderr = ssh.exec_command(f"bash -lc {repr(cmd)}", timeout=300)
        stdin.close()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        rc = stdout.channel.recv_exit_status()
        if out: print(out)
        if err: print(err, file=sys.stderr)
        if rc != 0:
            print(f"✗ remote rc={rc}", file=sys.stderr); return rc
        print(f"✓ done {host}")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
