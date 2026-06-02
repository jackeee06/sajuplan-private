#!/bin/bash
# 사주플랜 prod uploads 자동 백업
# 매일 04:10 실행 — 서버 보관(28일) + Google Drive 동기화
set -euo pipefail

UPLOADS_DIR=/data/wwwroot/api.sajumoon.co.kr/uploads
BACKUP_DIR=/data/backup/uploads
LOG_FILE=/var/log/sajumoon_uploads_backup.log

mkdir -p $BACKUP_DIR

TS=$(date +%Y%m%d)
OUT=$BACKUP_DIR/uploads_${TS}.tar.gz

echo "[$(date '+%F %T')] uploads backup start" >> $LOG_FILE
tar czf $OUT -C /data/wwwroot/api.sajumoon.co.kr uploads 2>>$LOG_FILE
echo "[$(date '+%F %T')] uploads backup ok" >> $LOG_FILE

# 28일 이상 된 서버 백업 삭제
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +28 -delete

# Google Drive 실시간 동기화
echo "[$(date '+%F %T')] Google Drive sync start" >> $LOG_FILE
rclone sync $UPLOADS_DIR gdrive:sajumoon-backup/uploads/ --log-file=$LOG_FILE --log-level INFO
echo "[$(date '+%F %T')] Google Drive sync done" >> $LOG_FILE
