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

---

## 📞 전화(phone) 5분 알림 — 채팅과 완전히 별도 경로

> 위(`chat_message` 시스템 메시지)는 **채팅** 전용. **전화**는 m2net push 기반의 다른 코드다. 헷갈리지 말 것.

### 발화 2경로 (둘 다 `consultation.five_min_alert_sent_at` 멱등)
1. **`setTimeout` 예약** — `CONNECT_CSR`(통화시작) push 시 1회. `remainSec = floor(회원코인 × 단위초 ÷ 단가)`, `delayMs = max(0,(remainSec-300))×1000` 후 발화. 통화 종료(`DISCONNECT` 등) 시 `cancelPhoneFiveMinAlert(callid)` 로 취소. (`remainSec ≤ 300` 이면 즉시 발화 — 잔액 적으면 통화 시작 직후 뜰 수 있음)
2. **안전망 cron `scanPhoneFiveMinAlerts`** (매분) — pm2 reload 로 setTimeout 손실 대비. active 통화 스캔해 잔여 ≤5분이면 발화.
- 실제 발화 = `firePhoneFiveMinAlert`: `UPDATE consultation SET five_min_alert_sent_at=now() ... RETURNING` (first-write-wins) → `AlertsService.enqueue` (회원/상담사 폰 폴링 큐). 상담사 메시지 = "마무리 멘트 안내 부탁드립니다".
- 코드: `api/src/pg-callbacks/m2net-push.service.ts`

### 🐛 사고 + 수정 (2026-06-18) — "통화 끊었는데 마무리 멘트 5분 팝업"
- **원인**: cron 이 좀비 `CONNECT_CSR` 행(`ended_at` 영원히 NULL — [[payment/01-m2net-relation]] §12)을 "진행 중"으로 착각 → **통화 종료 후 발화**. 종료+9초~최대 55분, 과거 5/28부터 **21건** 반복(고객 항의 1건).
- **수정 (2겹)**:
  1. **발화 직전 게이트** — `firePhoneFiveMinAlert` UPDATE 에 `AND NOT EXISTS(같은 callid 종료 행)`. cron·setTimeout·레이스 전부 차단(최후의 문).
  2. **cron 후보 제외** — `scanPhoneFiveMinAlerts` 후보 쿼리에도 동일 `NOT EXISTS`.
- **돈 영향 없음** — 차감/정산 무관, UX 오알림만.

### 🛡️ 상시 감시 — health-check **C-24**
- 검사: 같은 callid 의 종료시각보다 5분알림 시각이 뒤면 위반(최근 90분). `severity=critical` → **관리자 문의톡 자동 통보**.
- 수정 후 0건이어야 정상. 재발 시 고객 항의 전에 시스템이 먼저 잡는다. 코드: `api/src/cron/health-check.service.ts`.

## 관련 메모리

- `[[prepaid-chat-plan]]` §7
- `[[test-phase]]` (1분 테스트 케이스의 30초 임계값 분기 배경)
- `[[phone-five-min-zombie-row]]` (전화 5분 알림 좀비 행 사고·수정·C-24)
