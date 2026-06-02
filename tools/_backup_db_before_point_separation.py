#!/usr/bin/env python3
"""포인트 분리 작업 전 prod + test DB 다층 백업.

원격에 임시 sh 스크립트 업로드 후 실행 — bash quote escape 지옥 회피.

저장 위치:
  - prod 서버:  /backup/before-point-separation-{ts}-full.sql
                /backup/before-point-separation-{ts}-core.sql
  - test 서버:  동일
  - 로컬:        c:/claudeworkspace/sajumoon/backup/{host}_{ts}_{type}.sql
"""
import os, sys, paramiko
from datetime import datetime
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOCAL_DIR = PROJECT_ROOT / "backup"
LOCAL_DIR.mkdir(exist_ok=True)

TS = datetime.now().strftime("%Y%m%d-%H%M")

SERVERS = [
    ("prod", "104.64.128.103", "/data/wwwroot/api.sajumoon.co.kr"),
    ("test", "172.235.211.75", "/data/wwwroot/api.sajumoon.kr"),
]

pw = os.environ["SSHPASS"]


def backup(label: str, host: str, api_dir: str) -> bool:
    print(f"\n{'='*60}\n[{label}] {host}\n{'='*60}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)

    full_path = f"/backup/before-point-separation-{TS}-full.sql"
    core_path = f"/backup/before-point-separation-{TS}-core.sql"
    script_path = f"/tmp/_backup-{TS}.sh"

    # 원격에 sh 스크립트 작성
    script = f"""#!/bin/bash
set -e
mkdir -p /backup
cd '{api_dir}'
DBURL="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
# 따옴표 제거
DBURL="${{DBURL#\\'}}"
DBURL="${{DBURL%\\'}}"
DBURL="${{DBURL#\\"}}"
DBURL="${{DBURL%\\"}}"
echo "[1/2] 전체 백업: {full_path}"
pg_dump "$DBURL" > {full_path}
ls -lh {full_path}
echo "[2/2] 핵심 테이블 백업: {core_path}"
pg_dump "$DBURL" --table=point --table=point_history --table=member > {core_path}
ls -lh {core_path}
echo "DONE"
"""
    sftp = ssh.open_sftp()
    with sftp.open(script_path, 'w') as f:
        f.write(script)
    sftp.chmod(script_path, 0o755)

    # 실행
    print(f"▶ 백업 실행 (sh 스크립트)")
    stdin, stdout, stderr = ssh.exec_command(f"bash {script_path}", timeout=600)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    print(out, end="")
    if rc != 0:
        print(f"  ✗ rc={rc}: {err}", file=sys.stderr)
        ssh.close()
        return False

    # 로컬 다운로드
    for remote, suffix in [(full_path, "full"), (core_path, "core")]:
        local = LOCAL_DIR / f"{label}_{TS}_{suffix}.sql"
        print(f"▶ 로컬 다운로드: {remote} → {local.name}")
        sftp.get(remote, str(local))
        size = local.stat().st_size
        print(f"  ✓ {size:,} bytes")

    # 임시 스크립트 삭제
    try:
        sftp.remove(script_path)
    except Exception:
        pass
    sftp.close()
    ssh.close()
    print(f"✓ {label} 백업 완료")
    return True


ok = True
for label, host, api_dir in SERVERS:
    if not backup(label, host, api_dir):
        ok = False

print(f"\n{'='*60}")
if ok:
    print(f"✓ 모든 서버 백업 완료. 로컬 보관: {LOCAL_DIR}")
else:
    print(f"✗ 일부 실패. 위 로그 확인")
print(f"\n로컬 파일:")
for f in sorted(LOCAL_DIR.glob(f"*{TS}*")):
    print(f"  - {f.name}  ({f.stat().st_size:,} bytes)")
print(f"{'='*60}")
