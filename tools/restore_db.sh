#!/bin/bash
# 사주플랜 DB 복구 스크립트
# 사용법: bash restore_db.sh [1|3|7]
#   1 = 어제 / 3 = 3일전 / 7 = 7일전

BACKUP_DIR=/data/backup/db
DB_NAME=sajumoon
DB_USER=sajumoon
DB_PASS=2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382
DB_HOST=127.0.0.1
DAYS=${1:-1}
TARGET_DATE=$(date -d "-${DAYS} day" +%Y%m%d)
BACKUP_FILE=$(ls ${BACKUP_DIR}/sajumoon_${TARGET_DATE}_*.sql.gz 2>/dev/null | tail -1)

if [ -z "$BACKUP_FILE" ]; then
  echo "[ERROR] ${DAYS}일전 (${TARGET_DATE}) 백업 없음"
  echo "보유 백업 목록:"
  ls ${BACKUP_DIR}/*.sql.gz 2>/dev/null | xargs -I{} basename {}
  exit 1
fi

echo "===================================="
echo "복구 시점: ${DAYS}일전 (${TARGET_DATE})"
echo "백업 파일: $(basename $BACKUP_FILE)"
echo "===================================="
echo "주의: 현재 DB가 이 시점으로 덮어씌워집니다!"
read -p "yes 입력시 복구 시작: " CONFIRM
[ "$CONFIRM" != "yes" ] && echo "취소" && exit 0

echo "1/3 현재 DB 긴급 백업 중..."
EMG=${BACKUP_DIR}/EMERGENCY_$(date +%Y%m%d_%H%M%S).sql.gz
PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > $EMG
echo "    저장: $(basename $EMG)"

echo "2/3 DB 복구 중..."
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid<>pg_backend_pid();" \
  >/dev/null 2>&1 || true
PGPASSWORD=$DB_PASS dropdb -h $DB_HOST -U $DB_USER $DB_NAME 2>/dev/null || true
PGPASSWORD=$DB_PASS createdb -h $DB_HOST -U $DB_USER $DB_NAME
zcat $BACKUP_FILE | PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER $DB_NAME >/dev/null 2>&1

echo "3/3 서버 재시작..."
pm2 restart sajumoon-api >/dev/null 2>&1

echo ""
echo "[완료] ${DAYS}일전으로 복구됨"
echo "확인: https://sajuplan.com"
