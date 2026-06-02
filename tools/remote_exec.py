#!/usr/bin/env python3
"""사주플랜 원격 셸 명령 실행 — sshpass/ssh 비밀번호 자동화의 paramiko 대체."""

from __future__ import annotations

import argparse
import os
import sys

# Windows 콘솔(cp949) 에서 유니코드 기호 출력 시 UnicodeEncodeError 가 나지 않도록.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

try:
    import paramiko
except ImportError:
    print("paramiko 가 설치되어 있지 않습니다. (pip install paramiko)", file=sys.stderr)
    sys.exit(2)


def parse_host(host: str) -> tuple[str, str, int]:
    user = "root"
    port = 22
    if "@" in host:
        user, host = host.split("@", 1)
    if ":" in host:
        host, port_s = host.split(":", 1)
        port = int(port_s)
    return user, host, port


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", required=True)
    ap.add_argument("--cmd", required=True)
    args = ap.parse_args()

    password = os.environ.get("SSHPASS")
    if not password:
        print("SSHPASS 환경변수 필요", file=sys.stderr)
        return 1

    user, host, port = parse_host(args.host)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host, port=port, username=user, password=password,
        allow_agent=False, look_for_keys=False, timeout=20,
    )
    try:
        # bash -lc 로 감싸 .bashrc 환경(예: nvm 의 npm) 을 로드
        cmd = f"bash -lc {repr(args.cmd)}"
        stdin, stdout, stderr = client.exec_command(cmd, get_pty=False)
        # stream 실시간 출력
        for line in iter(stdout.readline, ""):
            sys.stdout.write(line)
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            sys.stderr.write(err)
        return stdout.channel.recv_exit_status()
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
