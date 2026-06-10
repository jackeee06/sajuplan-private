# [AI 전용] incoming 채팅 4단 안전망 — 기술 상세

## 정책 박제

`_PREPAID_CHAT_POLICY.md` §15.

## FCM 푸시 (2026-06-08 추가) — 폴링 한계 보완

`notifyCounselorChatRequest()` 안에서 알림톡과 함께 FCM 푸시 발송.
- 파일: `consult.service.ts` `notifyCounselorChatRequest()` (startChat 에서 `void` 호출)
- **알림톡(phone 없어도 push 시도) + FCM 푸시를 분리 실행** — 각각 try/catch 독립
- FCM payload: `{ type:'chat_request', counselor_id, chat_room_id, link:'/chat/{id}' }`
- 토큰 조회: `member_push_token WHERE member_id=상담사 AND is_active=true`
- **인앱 모달(아래 1번)은 앱 포그라운드 폴링 한정 → 앱 백그라운드/종료 시 푸시가 유일 도달 경로**
- 전화 요청(`counselors.service.ts requestConsult`)과 동일 패턴 (그쪽은 2026-05-25부터 적용, 채팅은 누락됐다가 06-08 추가)

## 3가지 UI 컴포넌트

### 1. 모달 (자동)
- 파일: `web/user/src/components/CounselorIncomingChatWatcher.tsx`
- App 최상단 마운트 (모든 페이지에서 동작)
- 5초 폴링으로 status='STAY' 채팅방 감지
- 본인 매칭 + 1건 신규 발견 시 자동 모달
- "지금 응답" → `navigate(/chat/{id})`

### 2. 배너 (Home 통합)
- 파일: `web/user/src/components/CounselorIncomingBanner.tsx`
- Home (`/`) 상단 핑크 그라데이션
- N건 합계 표시
- 클릭 → `/counselor/mypage/incoming`

### 3. 리스트 페이지
- 파일: `web/user/src/pages/CounselorIncomingList.tsx`
- 라우트: `/counselor/mypage/incoming`
- 5초 폴링
- 오래 기다린 순 정렬 (started_at ASC)
- "곧 만료" 배지: `EXTRACT(EPOCH FROM (NOW() - started_at)) > 150` (3분 - 30초)

## 가드

```typescript
if (!isCounselor) return null  // 회원에게 표시 X
if (!matchesMe) return null    // 본인 매칭 아니면 X
```

## API

- `GET /user/chat/incoming` — status='STAY' AND counselor_id=현재상담사
- 응답: `[{ id, member_nickname, started_at, charge_minutes }]`

## DB 쿼리

```sql
-- 본인 incoming 채팅 (3분 이내 STAY)
SELECT cr.id, cr.member_id, m.nickname, cr.started_at, cr.charge_minutes,
       EXTRACT(EPOCH FROM (NOW() - cr.started_at)) AS waiting_sec
FROM chat_room cr
JOIN member m ON m.id = cr.member_id
WHERE cr.counselor_id = ?
  AND cr.status = 'STAY'
  AND cr.started_at >= NOW() - INTERVAL '3 minutes'
ORDER BY cr.started_at ASC;
```

## 알림톡 연동

`chat_request_to_counselor` BizM 템플릿:
- 발송: `consult.service.ts:471-525` `notifyCounselorChatRequest()`
- 채팅 중 화이트리스트 통과 (`SmsService.IN_CHAT_PASS_THROUGH`)
- APK scheme 등록 후 → 클릭 시 앱 자동 호출

## 운영 SQL

```sql
-- 상담사별 incoming 응답률 (30일)
SELECT
  c.id AS counselor_id, m.nickname,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE cr.status='CNCH' OR cr.counselor_joined_at IS NOT NULL) AS responded,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cr.counselor_joined_at IS NOT NULL) / COUNT(*), 1) AS response_rate
FROM chat_room cr
JOIN member m ON m.id = cr.counselor_id
JOIN member c ON c.id = cr.counselor_id  -- counselor row
WHERE cr.started_at >= NOW() - INTERVAL '30 days'
GROUP BY c.id, m.nickname
ORDER BY response_rate DESC;
```

## 관련 메모리

- `[[prepaid-chat-plan]]` §15 (incoming 3단)
- `[[counselor-path-matching]]` (상담사 경로 매칭 함정)
- `[[mobile-deep-link-status]]` (APK scheme)
