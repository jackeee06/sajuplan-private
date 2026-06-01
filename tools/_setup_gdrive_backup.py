"""prod 에 rclone 설치 + Google Drive 백업 cron 신설.

사장님 PC 에서 받은 OAuth 토큰을 prod 의 ~/.config/rclone/rclone.conf 에 박음.
DB 백업 스크립트에 rclone copy 한 줄 추가 → 매일 03:30 자동 업로드.
즉시 1회 업로드 검증.
"""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

# 사장님 PC 에서 받은 OAuth refresh_token (rclone authorize drive 결과).
# git 노출 방지 — 환경변수 또는 별도 파일로 전달. 실제 토큰은 prod 의
# /root/.config/rclone/rclone.conf 에만 있음 (2026-06-02 셋업 완료).
TOKEN_JSON = os.environ.get("GDRIVE_TOKEN_JSON", "")
ROOT_FOLDER_ID = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "")

if not TOKEN_JSON or not ROOT_FOLDER_ID:
    # 재실행 필요 시 사장님 PC 에서 'rclone authorize "drive"' 한 번 실행 후
    # 출력 토큰을 GDRIVE_TOKEN_JSON 환경변수로 전달, 폴더 ID 는 GDRIVE_ROOT_FOLDER_ID 로.
    print("이미 prod 셋업 완료. 재실행 시 GDRIVE_TOKEN_JSON + GDRIVE_ROOT_FOLDER_ID env 필요.", file=__import__("sys").stderr)
    raise SystemExit(0)

RCLONE_CONF = f"""[gdrive]
type = drive
scope = drive
token = {TOKEN_JSON}
root_folder_id = {ROOT_FOLDER_ID}
"""

NEW_BACKUP_SCRIPT = r"""#!/bin/bash
# 사주플랜 prod DB 자동 백업 + Google Drive 업로드.
# 매일 03:30 실행. prod 7일 보관 + Google Drive 30일 보관.
set -euo pipefail

BACKUP_DIR="/data/backup/db"
ENV_FILE="/data/wwwroot/api.sajumoon.co.kr/.env"
LOG_FILE="/var/log/sajumoon_db_backup.log"

mkdir -p "$BACKUP_DIR"

DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'")

TS=$(date +%Y%m%d_%H%M)
OUT="$BACKUP_DIR/sajumoon_${TS}.sql.gz"

echo "[$(date '+%F %T')] DB backup start → $OUT" >> "$LOG_FILE"
pg_dump "$DB_URL" --no-owner --no-acl 2>>"$LOG_FILE" | gzip > "$OUT"
SIZE=$(stat -c %s "$OUT")
echo "[$(date '+%F %T')] DB backup ok size=$SIZE bytes" >> "$LOG_FILE"

# Google Drive 업로드 (사장님 사주플랜백업 폴더)
if command -v rclone >/dev/null 2>&1; then
  echo "[$(date '+%F %T')] gdrive upload start" >> "$LOG_FILE"
  rclone copy "$OUT" gdrive: --quiet 2>>"$LOG_FILE" || echo "[$(date '+%F %T')] gdrive upload FAILED" >> "$LOG_FILE"
  # Google Drive 30일 이상 된 파일 자동 삭제
  rclone delete gdrive: --min-age 30d --include 'sajumoon_*.sql.gz' --quiet 2>>"$LOG_FILE" || true
  echo "[$(date '+%F %T')] gdrive upload + retention done" >> "$LOG_FILE"
else
  echo "[$(date '+%F %T')] rclone 없음 - gdrive 업로드 skip" >> "$LOG_FILE"
fi

# 로컬 7일 이상 백업 삭제
find "$BACKUP_DIR" -name 'sajumoon_*.sql.gz' -mtime +7 -delete
echo "[$(date '+%F %T')] local retention purge done" >> "$LOG_FILE"
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=30)

    # 1. rclone 설치 (Ubuntu)
    print("[1] prod 에 rclone 설치")
    _, o, _ = c.exec_command("which rclone || apt-get install -y rclone 2>&1 | tail -3", get_pty=False, timeout=120)
    print(o.read().decode("utf-8", errors="replace"))

    # 2. rclone.conf 배치
    print("[2] /root/.config/rclone/rclone.conf 배치")
    c.exec_command("mkdir -p /root/.config/rclone && chmod 700 /root/.config/rclone", get_pty=False)[1].read()
    s = c.open_sftp()
    with s.file("/root/.config/rclone/rclone.conf", "w") as f:
        f.write(RCLONE_CONF)
    c.exec_command("chmod 600 /root/.config/rclone/rclone.conf", get_pty=False)[1].read()
    s.close()

    # 3. rclone 연결 테스트
    print("[3] rclone ls gdrive: (연결 검증)")
    _, o, _ = c.exec_command("rclone ls gdrive: 2>&1 | head -5", get_pty=False, timeout=30)
    print(o.read().decode("utf-8", errors="replace"))

    # 4. 백업 스크립트 갱신 (Google Drive 업로드 추가)
    print("[4] /root/sajumoon_db_backup.sh 업데이트")
    s = c.open_sftp()
    with s.file("/root/sajumoon_db_backup.sh", "w") as f:
        f.write(NEW_BACKUP_SCRIPT)
    c.exec_command("chmod +x /root/sajumoon_db_backup.sh", get_pty=False)[1].read()
    s.close()

    # 5. 즉시 1회 실행 (검증)
    print("[5] 즉시 1회 백업 + Google Drive 업로드")
    _, o, _ = c.exec_command("/root/sajumoon_db_backup.sh && rclone ls gdrive: 2>&1", get_pty=False, timeout=120)
    print(o.read().decode("utf-8", errors="replace"))

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
