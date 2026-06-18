# [AI 전용] 채팅 이탈 처리 — 기술 상세 (2026-06-17 개편)

## 핵심 원칙
1. **이탈 ≠ 종료.** pagehide/blur/visibility-hidden 은 모두 **복구 가능한 soft 이탈**로 처리. 즉시 종료(close)는 명시적 "상담종료" 버튼만.
2. **CNCH(상담 중)은 누가 이탈하든 과금 계속.** m2net 실시간 과금과 일치 — 과금정지 금지(사주플랜 적자). STAY 만 보호.
3. **진짜 방치(양쪽 나감 + 무활동)는 cron 이 정산.** soft 이탈 전환의 짝 안전망.

## 왜 바꿨나 (사고)
기존: `pagehide`/`beforeunload` → `leave('close')` → 즉시 DISCONNECT.
→ iOS WebView 는 백그라운드(알림·앱전환·잠금) 때도 `pagehide` 발화 → **진행 중 채팅 즉사.**
→ WSS 상시 연결로 bfcache 불가 → `event.persisted` 로도 background/close 구분 불가.
→ 그래서 "모든 이탈 = soft, 복귀 = rejoin, 진짜 방치 = cron 정산" 으로 재설계.

## 프론트 — ChatRoom.tsx Effect A
```typescript
// 모든 이탈을 복구 가능한 soft 로. 즉시 종료(close)는 '상담종료' 버튼만.
const softLeave = (useBeacon) => {            // mode:'soft' (pagehide 는 sendBeacon)
  if (chatStatusRef.current !== 'active' || !wssEnabledRef.current) return
  // navigator.sendBeacon(`${API_BASE}/user/chat/rooms/${id}/leave`, {mode:'soft'})  또는 chatApi.leave(id,'soft')
}
const doRejoin = () => chatApi.rejoin(chatRoomIdRef.current)

onPageHide / onBeforeUnload → softLeave(true)         // 탭/앱 이탈 = soft (즉시 종료 X)
onVisibility hidden → softLeave(false) / visible → doRejoin()
onBlur → softLeave(false) / onFocus → doRejoin()      // RN WebView visibilitychange 미발화 보완
onPageShow → doRejoin()                                // bfcache 복귀
```
- `fireEndRef`(close) 는 더 이상 lifecycle 에서 호출 안 함. '상담종료' 버튼(`chatApi.leave(id,'close')`)만 사용.
- Effect B(unmount): 회원 30초 grace leave / 상담사 leave 안 함(명시 종료만).

## 백엔드 — leave / tickRoom
```typescript
// leave(mode)  — chat.service.ts
//   'soft' : member_try_out/counselor_try_out = TRUE (복구 가능, 시스템 메시지 X)
//   'close': status='DISCONNECT' + roomid __c_<id> suffix + 정산
// rejoin     — try_out=FALSE + rejoin_count++ + (TRUE→FALSE 전환 시) 시스템 메시지

// tickRoom — CNCH 무조건 과금 (2026-06-17: member_try_out/counselor_try_out 과금정지 제거)
if (status === 'DISCONNECT') return disconnected
if (status === 'STAY')       return awaiting_counselor   // 차감 0 (F 정책)
// ⛔ try_out 으로 과금 멈추지 않음 — CNCH 면 use_seconds += 10 계속
if (remain < 10) → DISCONNECT + settleChatRoomLocal()    // 시간 소진
```

## 방치 정산 cron — settleAbandonedChats
```sql
-- chat.service.ts settleAbandonedChats() — 매분 chat/auto-cancel cron 에서 호출
SELECT id FROM chat_room
 WHERE status='CNCH'
   AND (member_try_out OR counselor_try_out)                 -- 한쪽 이상 명시 이탈
   AND started_at < NOW() - INTERVAL '1 minute'
   AND NOT EXISTS (SELECT 1 FROM chat_message cm
                    WHERE cm.chat_room_id=id
                      AND cm.created_at > NOW()-make_interval(mins=>3))  -- 3분 무활동
-- 매칭 → DISCONNECT(+roomid suffix) → settleChatRoomLocal()
```
- 2중 가드(try_out + 3분 무활동)라 정상 진행/조용한 활성 채팅은 매칭 안 됨.
- 복귀(rejoin)로 try_out 해제된 방도 매칭 안 됨.

## cron 2종
```
GET /api/cron/chat/auto-cancel  (매분)
  → consult.autoCancelStaleChats()  : STAY 3분 → 자동취소 + 알림톡
  → chat.settleAbandonedChats()     : CNCH 방치 → 정산 (신규 2026-06-17)
응답: { cancelled, details, abandoned:{settled, ids} }
```

## DB
```
chat_room
- status            STAY / CNCH / DISCONNECT
- member_try_out    BOOL — soft 이탈 마킹 (과금엔 영향 X, 방치 cron 판정용)
- counselor_try_out BOOL
- use_seconds       누적 사용초 (클라 tick 구동 — 백그라운드면 안 늘어남)
- started_at, counselor_joined_at, ended_at
```

## 함정
- pagehide 를 close 로 처리하면 iOS 백그라운드마다 채팅 즉사 → soft 로. (2026-06-17)
- WSS 열려 bfcache 불가 → `persisted` 로 background/close 구분 시도 금지.
- use_seconds 는 클라가 화면 켜야 누적 → 최종 손실 0 보장은 정산을 m2net 실과금 기준으로. settleChatRoomLocal 이 m2net 잔액조회로 처리.
- **CNCH 과금정지 절대 추가 금지** — [[feedback-no-chat-billing-pause]]

## 관련
- `[[feedback-no-chat-billing-pause]]`, `[[prepaid-chat-plan]]`
- [채팅 과금 정책](chat/07-billing-policy), [상태 흐름](chat/02-state-machine)
