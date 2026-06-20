"""단일 파일 PROD 업로드 (바이너리 OK). fast패치가 안 올리는 정적 자산(img 등) 보완용.

사용(PowerShell):
  $env:SSHPASS=...; python tools/_put_prod_file.py root@104.64.128.103 <local> <remote_abs>
"""
import os
import sys
from pathlib import Path

import paramiko


def parse_host(arg: str):
    user, host, port = "root", arg, 22
    if "@" in arg:
        user, host = arg.split("@", 1)
    if ":" in host:
        host, p = host.split(":", 1)
        port = int(p)
    return user, host, port


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: _put_prod_file.py <user@host[:port]> <local> <remote_abs>", file=sys.stderr)
        return 2
    host_arg, local, remote = sys.argv[1], sys.argv[2], sys.argv[3]
    user, host, port = parse_host(host_arg)
    pw = os.environ.get("SSHPASS")
    if not pw:
        print("SSHPASS 필요", file=sys.stderr)
        return 2
    data = Path(local).read_bytes()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, port=port, username=user, password=pw, timeout=20, look_for_keys=False, allow_agent=False)
    try:
        remote_dir = remote.rsplit('/', 1)[0]
        ssh.exec_command(f"mkdir -p '{remote_dir}'")[1].channel.recv_exit_status()
        stdin, stdout, stderr = ssh.exec_command(f"cat > '{remote}'", timeout=60)
        stdin.write(data)
        stdin.channel.shutdown_write()
        rc = stdout.channel.recv_exit_status()
        if rc != 0:
            print(f"put 실패 rc={rc}: {stderr.read().decode('utf-8','replace')}", file=sys.stderr)
            return rc
        # 크기 확인
        out = ssh.exec_command(f"wc -c < '{remote}'")[1].read().decode().strip()
        print(f"OK put {len(data):,} bytes -> {remote} (remote={out})")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    sys.exit(main())
