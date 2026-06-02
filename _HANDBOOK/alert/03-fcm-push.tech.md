# [AI 전용] FCM 푸시 — 기술 상세

## 환경 설정

- `FCM_CREDENTIALS_PATH` = Firebase 서비스 계정 JSON 경로
- 또는 `GOOGLE_APPLICATION_CREDENTIALS`
- 키 파일 없으면 `PushService.enabled=false` (개발 모드)

## API

```typescript
// 토큰 다중 발송
sendToTokens(tokens, { title, body, data: { event_url: '/chat/123' } })

// 토픽 발송
sendToTopic('all', { title, body, data })

// 구독 관리
subscribeToTopic(tokens, 'all')
```

## Deep link 처리

`data.event_url` 표준:
- 푸시 클릭 → RN 앱 받음 → WebView 라우팅 (`/chat/123` 진입)

## DB

```
member_push_token
- id, member_id INT FK
- token VARCHAR (FCM 토큰)
- platform VARCHAR — 'ios' / 'android' / 'web'
- created_at, last_used_at
```

## 핵심 코드 위치

- 서비스: `api/src/shared/push/push.service.ts`
- 카탈로그: `[[alert-system-complete]]` (38이벤트 × 3채널 중 FCM 부분)

## 채팅 중 차단 (백로그)

알림톡 차단은 완료. FCM 차단은 호출처 분산 → 도입 미정. `PushService.sendToMember()` 헬퍼 신설 + 모든 호출처 통일 필요.

## 운영 SQL

```sql
-- 푸시 토큰 보유 회원
SELECT COUNT(DISTINCT member_id) FROM member_push_token;

-- 만료 의심 토큰 (30일 이상 last_used_at 미갱신)
SELECT COUNT(*) FROM member_push_token
WHERE last_used_at < NOW() - INTERVAL '30 days';
```

## 관련 메모리

- `[[fcm-push-system]]`
- `[[alert-channel-policy]]`
