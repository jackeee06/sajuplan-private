#!/usr/bin/env python3
"""api 변경 파일만 SFTP put + 원격 build + pm2 reload (deploy_sync.py 우회용 외과 패치).

사용:
  python tools/_patch_api.py <host> <api_remote_path> <pm2_name>

ex)
  python tools/_patch_api.py root@172.235.211.75 /data/wwwroot/api.sajumoon.kr sajumoon-api
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Windows 콘솔(cp949) 에서 한글/유니코드 출력 시 에러 방지
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

import paramiko

# 옮길 파일: (로컬 상대경로, 원격 상대경로)
# 2026-05-16: Phase 8 — 어드민 등급 관리 + setting_history INSERT
FILES = [
    ("api/src/admin/grade/grade.module.ts", "src/admin/grade/grade.module.ts"),
    ("api/src/admin/grade/grade.service.ts", "src/admin/grade/grade.service.ts"),
    ("api/src/admin/grade/grade.controller.ts", "src/admin/grade/grade.controller.ts"),
    ("api/src/admin/admin.module.ts", "src/admin/admin.module.ts"),
    ("api/src/admin/settings/settings.service.ts", "src/admin/settings/settings.service.ts"),
    ("api/src/admin/settings/settings.controller.ts", "src/admin/settings/settings.controller.ts"),
]


def parse_host(s: str) -> tuple[str, str, int]:
    user = "root"
    port = 22
    if "@" in s:
        user, s = s.split("@", 1)
    if ":" in s:
        s, p = s.split(":", 1)
        port = int(p)
    return user, s, port


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: _patch_api.py <user@host[:port]> <api_remote> <pm2_name>", file=sys.stderr)
        return 2
    host_arg, api_remote, pm2_name = sys.argv[1], sys.argv[2], sys.argv[3]
    user, host, port = parse_host(host_arg)

    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 2

    root = Path(__file__).resolve().parent.parent
    print(f"▶ connect {user}@{host}:{port}", flush=True)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        host, port=port, username=user, password=pw,
        timeout=20, banner_timeout=20, auth_timeout=20, look_for_keys=False, allow_agent=False,
    )
    transport = ssh.get_transport()
    if transport is not None:
        transport.set_keepalive(15)

    try:
        for local_rel, remote_rel in FILES:
            local_path = root / local_rel
            remote_path = f"{api_remote.rstrip('/')}/{remote_rel}"
            data = local_path.read_bytes()
            print(f"  put {local_rel}  ({len(data):,} bytes) → {remote_path}", flush=True)
            # 신규 폴더 대비 — 부모 디렉토리 보장
            remote_dir = remote_path.rsplit('/', 1)[0]
            ssh.exec_command(f"mkdir -p '{remote_dir}'", timeout=10)[1].channel.recv_exit_status()
            # SFTP 가 chroot/path 이슈로 실패할 수 있어 ssh exec + cat > 으로 우회
            stdin, stdout, stderr = ssh.exec_command(f"cat > '{remote_path}'", timeout=60)
            stdin.write(data)
            stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            err = stderr.read().decode("utf-8", errors="replace")
            if rc != 0:
                print(f"  ✗ put 실패 rc={rc}: {err}", file=sys.stderr)
                return rc

        cmd = (
            f"set -e; cd '{api_remote}' && "
            f"echo '[remote] npm run build' && npm run build 2>&1 | tail -20 && "
            f"echo '[remote] pm2 reload {pm2_name}' && "
            f"(pm2 reload '{pm2_name}' --update-env 2>&1 || PM2_CWD='{api_remote}' pm2 start ecosystem.config.js) && "
            f"pm2 status '{pm2_name}' | tail -3"
        )
        print(f"▶ remote build + reload", flush=True)
        stdin, stdout, stderr = ssh.exec_command(f"bash -lc {repr(cmd)}", timeout=300)
        stdin.close()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        rc = stdout.channel.recv_exit_status()
        if out:
            print(out)
        if err:
            print(err, file=sys.stderr)
        if rc != 0:
            print(f"✗ remote 종료코드={rc}", file=sys.stderr)
            return rc
        print(f"✓ done {host}")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
