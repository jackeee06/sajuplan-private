# [AI 전용] 사고 매뉴얼 — 기술 상세

## 빠른 진단 명령

```bash
# API 상태
curl -s -o /dev/null -w "%{http_code}\n" https://api.sajuplan.com/api/health

# pm2 프로세스
pm2 list
pm2 logs sajumoon-api --nostream --lines 100

# DB 연결
psql $DATABASE_URL -c "SELECT 1"

# 최근 에러 로그
pm2 logs sajumoon-api --nostream --lines 200 | grep -iE "error|fail"

# m2net 응답 실패
pm2 logs sajumoon-api --nostream | grep -iE "m2net.*fail|req_result.*[^0]"

# BizM 응답 실패
pm2 logs sajumoon-api --nostream | grep -iE "K10[0-9]|M10[0-9]"
```

## 데이터 정합성 점검

```sql
-- 회원 m2net 미등록 (사고 흔적)
SELECT COUNT(*) FROM member WHERE role='user' AND m2net_membid IS NULL;

-- 상담사 csrid 미발급
SELECT COUNT(*) FROM member WHERE role='counselor' AND csrid IS NULL;

-- 활성 채팅 잔존 (cron 정지 의심)
SELECT COUNT(*) FROM chat_room WHERE status IN ('STAY','CNCH');

-- 정산 누락 가능성
SELECT COUNT(*) FROM consultation
WHERE reason='END_CHAT' AND is_settled=false
  AND started_at < NOW() - INTERVAL '1 day';
```

## 위험한 사고 (절대 금지)

### TRUNCATE CASCADE
메모리 `[[db-truncate-cascade-disaster]]` — 실 사고 발생. 자동 FK 발견 시 연쇄 삭제.
대응: 화이트리스트 + pg_dump 백업 필수.

### env 치환 누락
메모리 `[[deploy-env-substitution]]` — prod 가 test API 호출 실 사고.
대응: 배포 후 `grep "env.*prod"` 검증.

## 사고 후 회고

- `_OPS_INCIDENT_MANUAL.md` 에 사례 추가
- 메모리에 박제
- 운영 바이블 (`.tech.md`) 의 "함정" 섹션에 추가

## 핵심 자료

- 상세 매뉴얼: `_OPS_INCIDENT_MANUAL.md`
- 운영 가이드: `_OPS_RUNBOOK.md`
- D-Day 체크리스트: `_DDAY_CHECKLIST.md`
- 알림 카탈로그: `_OPS_ALERT_CATALOG.md`

## 관련 메모리

- `[[db-truncate-cascade-disaster]]`
- `[[deploy-env-substitution]]`
- `[[deploy-stale-lock]]`
- `[[pg-m2net-double-fill]]`
