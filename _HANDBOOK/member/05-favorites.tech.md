# [AI 전용] 단골/즐겨찾기 — 기술 상세

## DB

```
member_favorite_counselor
- id BIGSERIAL
- member_id INT FK
- counselor_id INT FK
- created_at TIMESTAMPTZ
- UNIQUE (member_id, counselor_id)
```

## 컴포넌트

- 회원 페이지: `web/user/src/pages/Favorites.tsx`
- 컨텍스트: `web/user/src/lib/like-context.tsx`
- 하트 아이콘: 각 상담사 카드 컴포넌트

## API

- `POST /user/favorites/{counselorId}` — 등록
- `DELETE /user/favorites/{counselorId}` — 해제
- `GET /user/favorites` — 본인 단골 목록

## 알림톡

- `counselor_v2` — 단골 상담사 접속 알림
- 발송 조건: 단골 상담사 last_active_at 변경 + 회원 알림 설정 ON
- 일일 1회 제한 (옵션)

## 핵심 코드 위치

- `api/src/user/favorites/favorites.service.ts`
- 알림: `api/src/cron/counselor-online-notify.service.ts` (또는 inline)

## 운영 SQL

```sql
-- 인기 상담사 (단골 수 기준)
SELECT counselor_id, COUNT(*) AS fav_count
FROM member_favorite_counselor
GROUP BY counselor_id
ORDER BY fav_count DESC LIMIT 20;

-- 활발한 단골 회원
SELECT member_id, COUNT(*) AS fav_count
FROM member_favorite_counselor
GROUP BY member_id
ORDER BY fav_count DESC LIMIT 50;
```
