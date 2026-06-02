# [AI 전용] 5분 잔여 알림 — 기술 상세

## 임계값

- 운영 (15분 이상): **300초 (5분) 남음**
- 테스트 (1분, 메모리 `[[test-phase]]`): **30초 남음**

판정: `alertThreshold = allocSec < 300 ? 30 : 300`

## 동적 메시지

```typescript
const alertMsg = alertThreshold === 30
  ? '[ALERT_5MIN]잔여 시간 30초 안내'
  : '[ALERT_5MIN]잔여 시간 5분 안내';
```

## 발화 위치 (2곳, 일관 분기)

1. **클라이언트 `tickRoom` 10초 폴링** — 잔여 ≤ 임계값 시 시스템 메시지 INSERT
2. **백엔드 cron `scanFiveMinAlerts`** — 매분, 클라이언트 미동작 시 백업 발화

## 클라이언트 처리

수신 흐름 (`web/user/src/pages/ChatRoom.tsx`):
1. 메시지 폴링이 시스템 메시지 `[ALERT_5MIN]...` 발견
2. `SystemPill` 표시 (메시지 영역)
3. `Modal` 노출 (1회, sessionStorage `chat5min_seen_{roomId}`)
4. TTS + 진동
5. 회원: "충전하기" 버튼 / 상담사: "마무리 안내" 버튼

## dedup_key

시스템 메시지 prefix `[ALERT_5MIN]` 정규식으로 떼고 본문 표시:
```typescript
const m = raw.match(/^\[ALERT_5MIN\](.+)$/)
if (m) return { ...msg, body: m[1], isFiveMinAlert: true }
```

## 핵심 코드 위치

- 클라이언트 tickRoom: `api/src/user/chat/chat.service.ts:1100-1200` `tickRoom()`
- 백엔드 cron: `api/src/user/chat/chat.service.ts` `scanFiveMinAlerts()`
- 클라이언트 감지/모달: `web/user/src/pages/ChatRoom.tsx` `useEffect` ALERT_5MIN
- sessionStorage 키: `chat5min_seen_${chatRoomId}`

## DB

- 시스템 메시지 INSERT: `chat_message` (message_type=3, sender_id=NULL)
- 본문에 `[ALERT_5MIN]` prefix 로 마킹

## 관련 메모리

- `[[prepaid-chat-plan]]` §7
- `[[test-phase]]` (1분 테스트 케이스의 30초 임계값 분기 배경)
