# [AI 전용] 채팅 이탈 처리 — 기술 상세

## 4가지 이탈 경로 처리

### A. 헤더 종료 버튼 / 뒤로가기 (명시적)
- 컨펌 모달 → `handleEnd()` → m2net `room_out_req` + 백엔드 `leave('close')`
- DB: `chat_room.status='DISCONNECT'` + 정산 트리거
- 알럿 모달 (정산 결과) + 풀폭 [채팅방 나가기]

### B. 브라우저 탭 닫기 / 새로고침 (`pagehide`, `beforeunload`)
```typescript
const maybeFireEnd = (immediate: boolean) => {
  if (counselorJoinedRef.current || isMeCounselor) {
    fireEndRef.current(immediate)
  }
  // STAY + 회원 = 종료 호출 안 함 (3분 cron 처리)
}
```

### C. 백그라운드 (`visibilitychange = 'hidden'`)
```typescript
if (!counselorJoinedRef.current && !isMeCounselor) {
  chatApi.leave(id, 'soft')  // member_try_out=TRUE
}
// 복귀 (visible) 시: rejoin → try_out=FALSE
```

### D. `window.blur` / `focus` (2026-05-30 추가)
visibilitychange 미발화 RN WebView 케이스 보완 안전망. 같은 로직.

## 3분 cron

```typescript
// api/src/user/consult/consult.service.ts:547-595
async autoCancelStaleChats() {
  const stale = await this.sql`
    SELECT id, member_id, counselor_id FROM chat_room
    WHERE status='STAY' AND started_at < NOW() - INTERVAL '3 minutes'
  `
  for (const r of stale) {
    // status='DISCONNECT'
    // 알림톡 chat_auto_cancelled_to_member 회원에게
    // 상담사 측 별도 알림
  }
}
```

## DB

```
chat_room
- status — STAY / CNCH / DISCONNECT
- member_try_out BOOL — soft leave 마킹
- counselor_try_out BOOL
- started_at, counselor_joined_at, ended_at
```

## 핵심 코드 위치

- ChatRoom Effect A (이탈 핸들러): `web/user/src/pages/ChatRoom.tsx:648-720`
- ChatRoom Effect B (unmount close): `web/user/src/pages/ChatRoom.tsx:705-716`
- 백엔드 leave: `api/src/user/chat/chat.service.ts:563-602`
- 3분 cron: `api/src/user/consult/consult.service.ts:autoCancelStaleChats()`

## 함정 (메모리 박제됨)

- 단순 새로고침 → STAY 면 leave 호출 X (2026-05-30 fix, 사장님 보고)
- blur 거짓 양성 (키보드 포커스) → soft leave 멱등 + focus 복귀 시 rejoin 으로 부작용 미미
- RN WebView visibilitychange 미발화 → blur/focus 안전망 추가

## 관련 메모리

- `[[prepaid-chat-plan]]` §3
- `[[mobile-deep-link-status]]`
