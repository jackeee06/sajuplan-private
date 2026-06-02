#!/usr/bin/env python3
"""고객 리스트 필터 (members.service.ts + members.controller.ts) 외과 패치.

양 서버에 2파일만 SFTP put + npm build + pm2 reload.
사용:
  set -a; source .env.local; set +a
  python tools/_patch_customer_filter.py
"""
from __future__ import annotations
import os, sys
from pathlib import Path
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

SSHPASS = os.environ.get("SSHPASS")
if not SSHPASS:
    print("✗ SSHPASS 필요 — set -a; source .env.local; set +a", file=sys.stderr)
    sys.exit(2)

FILES = [
    ("api/src/admin/members/members.service.ts",    "src/admin/members/members.service.ts"),
    ("api/src/admin/members/members.controller.ts", "src/admin/members/members.controller.ts"),
]

TARGETS = [
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr",    "sajumoon-api"),
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr", "sajumoon-api"),
]

ROOT = Path(__file__).resolve().parent.parent

def run_target(env, host, remote, pm2):
    print(f"\n▶ [{env}] {host} → {remote}", flush=True)
    ssh = paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username="root", password=SSHPASS,
                look_for_keys=False, allow_agent=False, timeout=30)
    t = ssh.get_transport()
    if t: t.set_keepalive(15)
    try:
        for local_rel, remote_rel in FILES:
            data = (ROOT / local_rel).read_bytes()
            rpath = f"{remote.rstrip('/')}/{remote_rel}"
            print(f"  put {local_rel} ({len(data):,}B) → {rpath}", flush=True)
            ssh.exec_command(f"mkdir -p '{rpath.rsplit('/',1)[0]}'", timeout=10)[1].channel.recv_exit_status()
            stdin, stdout, stderr = ssh.exec_command(f"cat > '{rpath}'", timeout=60)
            stdin.write(data); stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            if rc != 0:
                print(f"  ✗ put 실패 rc={rc}: {stderr.read().decode()}", file=sys.stderr)
                return False
        # build + reload
        cmd = (
            f"set -eo pipefail; cd '{remote}' && "
            f"echo '[remote] npm run build' && npm run build 2>&1 | tail -10 && "
            f"echo '[remote] pm2 reload {pm2}' && pm2 reload {pm2} 2>&1 | tail -5 && "
            f"echo '[remote] done'"
        )
        print("  ▶ remote build + pm2 reload", flush=True)
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
        for line in iter(stdout.readline, ''):
            if not line: break
            print(f"    {line.rstrip()}", flush=True)
        rc = stdout.channel.recv_exit_status()
        e = stderr.read().decode()
        if e.strip(): print("    STDERR:", e, file=sys.stderr)
        if rc != 0:
            print(f"  ✗ build/reload rc={rc}", file=sys.stderr); return False
        print(f"  ✓ {env} 완료")
        return True
    finally:
        ssh.close()

def main():
    ok = True
    for env, host, remote, pm2 in TARGETS:
        if not run_target(env, host, remote, pm2): ok = False
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
