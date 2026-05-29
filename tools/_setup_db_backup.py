"""prod DB 백업 자동화 설치.

1. /data/backup/db 디렉토리 생성
2. /root/sajumoon_db_backup.sh 스크립트 배치
3. crontab 추가 (매일 03:30 백업 + 7일 보관)
4. 즉시 1회 백업 실행 (테스트)

DATABASE_URL 의 비밀번호는 스크립트에서 .env 읽어서 사용. 평문 노출 X.
"""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import paramiko

HOST = "104.64.128.103"

BACKUP_SCRIPT = r"""#!/bin/bash
# 사주플랜 prod DB 자동 백업 — 매일 03:30 실행, 7일 보관.
# 설치일: 2026-05-29 (Claude / 운영 시작 안전망)
set -euo pipefail

BACKUP_DIR="/data/backup/db"
ENV_FILE="/data/wwwroot/api.sajumoon.co.kr/.env"
LOG_FILE="/var/log/sajumoon_db_backup.log"

mkdir -p "$BACKUP_DIR"

# DATABASE_URL parse → host/port/user/db
DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'")

# DATABASE_URL 형식: postgresql://user:pass@host:port/dbname?...
TS=$(date +%Y%m%d_%H%M)
OUT="$BACKUP_DIR/sajumoon_${TS}.sql.gz"

echo "[$(date '+%F %T')] backup start → $OUT" >> "$LOG_FILE"
pg_dump "$DB_URL" --no-owner --no-acl 2>>"$LOG_FILE" | gzip > "$OUT"
SIZE=$(stat -c %s "$OUT")
echo "[$(date '+%F %T')] backup ok size=$SIZE bytes" >> "$LOG_FILE"

# 7일 이상 된 백업 삭제
find "$BACKUP_DIR" -name 'sajumoon_*.sql.gz' -mtime +7 -delete
echo "[$(date '+%F %T')] retention purge done" >> "$LOG_FILE"
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=15)

    # 1. 디렉토리 + 스크립트 배치
    s = c.open_sftp()
    print("[1] mkdir /data/backup/db")
    c.exec_command("mkdir -p /data/backup/db && chmod 750 /data/backup/db")[1].read()

    print("[2] write /root/sajumoon_db_backup.sh")
    with s.file("/root/sajumoon_db_backup.sh", "w") as f:
        f.write(BACKUP_SCRIPT)
    c.exec_command("chmod +x /root/sajumoon_db_backup.sh")[1].read()
    s.close()

    # 3. crontab 추가 (기존 보존 + 백업 라인 1개 추가)
    print("[3] crontab append (3:30 daily backup)")
    _, out, err = c.exec_command(
        "(crontab -l 2>/dev/null | grep -v 'sajumoon_db_backup.sh'; "
        "echo '30 3 * * * /root/sajumoon_db_backup.sh') | crontab -",
        get_pty=False,
    )
    out.read(); err.read()

    # 4. 검증 — crontab 의 새 라인 확인
    _, out, _ = c.exec_command("crontab -l | grep db_backup", get_pty=False)
    print("[4] new cron line:", out.read().decode("utf-8", errors="replace").strip())

    # 5. 즉시 1회 백업 실행 (테스트)
    print("[5] 즉시 1회 백업 실행 (테스트)...")
    _, out, err = c.exec_command("/root/sajumoon_db_backup.sh && ls -la /data/backup/db", get_pty=False, timeout=120)
    print(out.read().decode("utf-8", errors="replace"))
    e = err.read().decode("utf-8", errors="replace")
    if e: print("STDERR:", e[:500])

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
