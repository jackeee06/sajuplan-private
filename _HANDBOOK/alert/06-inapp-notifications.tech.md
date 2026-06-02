# [AI 전용] 인앱 알림 — 기술 상세

## DB

```
notification
- id BIGSERIAL
- member_id INT FK
- type VARCHAR — 'qa_answer' / 'review_req' / 'coupon' / 등
- title VARCHAR
- body TEXT
- link VARCHAR — 클릭 시 이동할 페이지
- is_read BOOLEAN DEFAULT false
- created_at TIMESTAMPTZ
- read_at TIMESTAMPTZ
```

## 발송 흐름

```typescript
async createNotification(memberId, type, title, body, link) {
  await this.sql`
    INSERT INTO notification (member_id, type, title, body, link)
    VALUES (${memberId}, ${type}, ${title}, ${body}, ${link})
  `
}

// 일반적으로 알림톡 발송 + 인앱 알림 INSERT 같이
```

## 핵심 코드 위치

- 발송: `api/src/admin/notifications/notifications.service.ts`
- 회원 페이지: `web/user/src/pages/Notifications.tsx`
- 종 모양: Home 헤더 (`web/user/src/pages/Home.tsx` 등)

## 운영 SQL

```sql
-- 안 읽은 알림 다수 회원
SELECT member_id, COUNT(*) AS unread
FROM notification
WHERE is_read=false
GROUP BY member_id
ORDER BY unread DESC LIMIT 20;

-- 알림 유형별 발송량
SELECT type, COUNT(*) FROM notification
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type ORDER BY COUNT(*) DESC;
```

## 옛 알림 정리 (백로그)

30일 이상 옛 알림 자동 정리 cron 미구현. DB 크기 증가 시 도입 검토.

## 관련 메모리

- `[[alert-system-complete]]`
