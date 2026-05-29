"""prod MONEY_FLOW.md 동기화 + uploads 폴더 자동 백업 설치.

uploads 백업: 매주 일요일 04:00 (변경 자주 없어서 일주일 단위).
DB 백업은 매일이므로 차별화. 4주 보관 (월별 누적).
"""
from __future__ import annotations
import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

UPLOADS_SCRIPT = r"""#!/bin/bash
# 사주플랜 prod uploads 자동 백업 — 매주 일요일 04:00, 4주 보관.
# 설치일: 2026-05-29 (Claude / 운영 시작 안전망)
set -euo pipefail

UPLOADS_DIR="/data/wwwroot/api.sajumoon.co.kr/uploads"
BACKUP_DIR="/data/backup/uploads"
LOG_FILE="/var/log/sajumoon_uploads_backup.log"

mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d)
OUT="$BACKUP_DIR/uploads_${TS}.tar.gz"

echo "[$(date '+%F %T')] uploads backup start → $OUT" >> "$LOG_FILE"
tar czf "$OUT" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")" 2>>"$LOG_FILE"
SIZE=$(stat -c %s "$OUT")
echo "[$(date '+%F %T')] uploads backup ok size=$SIZE bytes" >> "$LOG_FILE"

# 4주 (28일) 이상 된 백업 삭제
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime +28 -delete
echo "[$(date '+%F %T')] uploads retention purge done" >> "$LOG_FILE"
"""


def main():
    pw = os.environ.get("SSHPASS")
    if not pw: return 1
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("104.64.128.103", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=15)

    # 1. MONEY_FLOW.md 동기화
    s = c.open_sftp()
    local_md = r"C:\claudeworkspace\sajumoon\MONEY_FLOW.md"
    s.put(local_md, "/data/wwwroot/sajumoon.co.kr/MONEY_FLOW.md")
    st = s.stat("/data/wwwroot/sajumoon.co.kr/MONEY_FLOW.md")
    print(f"[1] MONEY_FLOW.md updated size={st.st_size}")

    # 2. uploads 폴더 크기 확인
    _, o, _ = c.exec_command("du -sh /data/wwwroot/api.sajumoon.co.kr/uploads 2>&1", get_pty=False)
    print(f"[2] uploads 크기: {o.read().decode('utf-8', errors='replace').strip()}")

    # 3. uploads 백업 스크립트 배치
    print("[3] /root/sajumoon_uploads_backup.sh 배치")
    with s.file("/root/sajumoon_uploads_backup.sh", "w") as f:
        f.write(UPLOADS_SCRIPT)
    c.exec_command("chmod +x /root/sajumoon_uploads_backup.sh")[1].read()
    s.close()

    # 4. crontab 추가 (매주 일요일 04:00)
    print("[4] crontab append (Sun 4:00 weekly uploads backup)")
    c.exec_command(
        "(crontab -l 2>/dev/null | grep -v 'sajumoon_uploads_backup.sh'; "
        "echo '0 4 * * 0 /root/sajumoon_uploads_backup.sh') | crontab -",
        get_pty=False,
    )[1].read()
    _, o, _ = c.exec_command("crontab -l | grep uploads_backup", get_pty=False)
    print(f"[4] new cron: {o.read().decode('utf-8', errors='replace').strip()}")

    # 5. 즉시 1회 백업 테스트
    print("[5] 즉시 1회 백업 실행 (검증)")
    _, o, e = c.exec_command("/root/sajumoon_uploads_backup.sh && ls -la /data/backup/uploads", get_pty=False, timeout=120)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err: print("ERR:", err[:300])

    c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
