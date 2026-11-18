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

// [2026-07-07] 8초 유예 — 순간 blur·엠투넷 5분 재연결의 "나감/들어옴" 도배 억제
const SOFT_LEAVE_GRACE_MS = 8000
let leaveTimer = null, softLeftActive = false        // effect 지역 상태
scheduleSoftLeave() // leaveTimer/softLeftActive 없을 때만 setTimeout(8s)→softLeftActive=true; softLeave(false)
cancelOrRejoin()    // leaveTimer 있으면 clearTimeout(예약취소=leave 안나감) / 없으면 무조건 doRejoin
                    //   ★ rejoin 은 멱등 → 무조건 호출로 member_try_out self-heal. softLeftActive 로
                    //     게이팅하면 pagehide 경로(softLeftActive 미세팅)가 복귀 rejoin 누락→try_out 고착
                    //     →방치정산 오종료. (2026-07-07 엄격검증서 잡은 회귀. 무조건 rejoin 으로 수정.)

onBlur / onVisibility hidden → scheduleSoftLeave()    // 즉시 X, 8초 예약
onFocus / onVisibility visible / onPageShow → cancelOrRejoin()  // 유예 내 복귀 시 취소(노이즈 0)
onPageHide / onBeforeUnload → (leaveTimer clear) + softLeave(true)  // 진짜 종료 = 유예 없이 즉시 beacon
// cleanup: leaveTimer clear
```
- **유예 핵심**: 8초 안에 복귀하면 예약된 softLeave 를 취소 → `leave` API 자체가 안 나가므로 백엔드 시스템 메시지("나갔습니다")가 생성되지 않음 = 노이즈 0. 진짜 이탈(8초+)만 발송. 과금은 CNCH 중 try_out 무관 계속(불변식)이라 유예 둬도 영향 0.
- 왜 8초 유예가 필요: 엠투넷 wss 접속 토큰 수명(~5분, 엠투넷 서버 정책·우리 제어 불가)으로 물리 연결이 5분마다 끊겼다 자동 재연결됨. 재연결·순간 blur(푸시배너·키보드·앱전환)가 유예 0 이던 기존 코드에선 매번 "나감/들어옴" 시스템 메시지로 표시돼 대화창 도배. 재연결·메시지 복구·큐잉은 이미 자동이라 대화·과금은 영향 없었고, 화면 노이즈만 문제였음. → 유예로 순간 이탈 표시 제거. [[reference_chat_5min_reconnect]]
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

## 방치 정산 cron — settleAbandonedChats (2026-07-07 개편: 고객 중심 5분)
```sql
-- chat.service.ts settleAbandonedChats(idleMinutes=5) — 매분 chat/auto-cancel cron
SELECT id FROM chat_room
 WHERE status='CNCH'
   AND member_try_out = TRUE                                 -- 고객이 이탈 (상담사 상태는 안 봄)
   AND member_left_at IS NOT NULL
   AND member_left_at < NOW() - make_interval(mins => 5)     -- 고객이 나간 지 5분 복귀 없음
   AND started_at < NOW() - INTERVAL '1 minute'
-- 매칭 → DISCONNECT(+roomid suffix) → settleChatRoomLocal()
```
- **판정 = "고객이 완전히 나갔는가" 단일 기준.** counselor_try_out·메시지 무활동 조건 **제거**(2026-07-07).
  - 기존 `(member OR counselor try_out) + 3분무활동` 의 문제: ① 고객이 답 읽다 화면 꺼지면 정상 상담 오종료 ② 양쪽 이탈로 바꾸면 상담사 개기기 어뷰징. → 고객 이탈 5분 단일 기준으로 둘 다 해소.
- `member_left_at` = 고객 이탈(soft) 전환 시각. **markLeave(회원 soft)·handlePeerEvent(회원 leave)** 두 경로에서 `member_try_out=TRUE, member_left_at=now()`. rejoin(try_out=FALSE)하면 게이트 첫 조건에서 빠짐. 재이탈 시 now() 재기록(FALSE→TRUE 전환 시 UPDATE)이라 stale 없음.
- ⚠️ **member_try_out=TRUE 로 만드는 모든 경로가 member_left_at 을 찍어야 함** — 안 찍으면 그 방은 `member_left_at IS NULL` 로 영영 방치정산 제외(죽은 방 잔류). 신규 이탈 경로 추가 시 반드시 동반.
- 상담사 이탈만 있고 고객은 있는 방(고객 대화 중, 상담사만 자리비움)은 **안 죽음** — 정상 상담 보호.
- 어뷰징(고객 떠남+상담사 개기기/혼자 메시지)은 **5분 후 종료** — 메시지 조건이 없으니 상담사 활동 무관.

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
- **엠투넷 wss 5분 재연결은 못 막음** — 토큰 수명이 엠투넷 서버 정책. 우리 env·파라미터로 조절 불가, 엠투넷은 공용 인프라라 문의 무의미. 우리 대응 = "끊김을 안 느끼게"(자동 재연결+메시지 복구+8초 유예로 노이즈 억제). heartbeat `{CmdTp:'ping'}` 는 m2net 프로토콜에 없는 명령이라 세션 수명 리셋에 무효 가능(30초 idle 겨냥이지 5분과 별개).
- **유예 시간(8초)은 조절 가능** — 도배 심하면 상향. 단 너무 길면 진짜 이탈 표시가 늦어짐.
- **pagehide/beforeunload 는 유예 우회(즉시 leave)** — iOS WebView 앱전환 시 pagehide 를 쏘므로 iOS 에선 유예가 안 걸려 "나감/들어옴" 이 여전히 표시될 수 있음. pagehide 에 유예를 못 두는 이유: 페이지 unload 순간이라 `setTimeout` 이 실행 안 될 수 있음(진짜 종료 시 leave beacon 누락 위험). 안드(blur/visibilitychange)는 유예 정상 적용. iOS 노이즈는 백엔드 `insertActorSystemMessage` 30초 멱등 가드로 부분 완화. 완전 제거는 pagehide vs 진짜 unload 구분이 WSS 상시연결로 불가한 제약과 얽혀 후속 과제.

## 관련
- `[[feedback-no-chat-billing-pause]]`, `[[prepaid-chat-plan]]`
- [채팅 과금 정책](chat/07-billing-policy), [상태 흐름](chat/02-state-machine)
