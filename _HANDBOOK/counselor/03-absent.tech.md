# [AI 전용] 상담사 접속 상태(member.state) 머신 — 기술 상세

> ⚠️ **2026-06-11 전면 교정.** 이전 버전은 "24시간 자동 부재 cron + `absent_status`/`last_active_at` 컬럼"을 기술했으나 **그 코드·컬럼은 실재하지 않는다(미구현).** 아래가 코드 검증(2026-06-11)으로 확인한 실제 구조다.

## ❌ 존재하지 않는 것 (예전 문서의 허구 — 검색해도 안 나옴)
- `api/src/cron/counselor-auto-absent.service.ts` — **파일 없음** (cron.module.ts 미등록)
- `member.absent_status`, `member.last_active_at` — **컬럼 없음** (member엔 `state`, `last_login_at`만)
- `counselor_auto_absent` OpsAlert, `counselor_state_history` 테이블 — **코드에 없음**
- 즉 **장시간 미접속/앱종료로 인한 자동 오프라인 메커니즘은 전무하다.**

## 상태값 — `member.state` VARCHAR (상담사 접속/가능 상태)

> 주의: 이건 **상담사 presence** 상태다. 채팅방 단위의 `chat_room.status`(STAY/CNCH/DISCONNECT)와 **다른 머신**이다. [chat/02-state-machine](chat/02-state-machine) 참조.

| state | 의미 | 회원 카드 노출 (전화 / 채팅) |
|---|---|---|
| `IDLE` | 전화 대기 (채팅 비활성) | 전화 available / 채팅 offline |
| `RDCH` | 채팅 대기 (전화 비활성) | 전화 offline / 채팅 available |
| `RDVC` | 전화+채팅 둘 다 대기 | 둘 다 available |
| `CONN` | 전화 통화 중 | 전화 busy / 채팅 offline |
| `CNCH` | 채팅 중 | 전화 offline / 채팅 busy |
| `ABSE` | 부재 (자리비움) | 둘 다 offline |
| `RESV` | 예약/기타 비활성 | 둘 다 offline |

도출 로직: `web/user/src/lib/counselor-mapper.ts` `derivePhoneState()` / `deriveChatState()` (`ACTIVE_STATES = {IDLE,RDCH,RDVC,CONN,CNCH}`, use_phone/use_chat 1차 필터).

## state 를 바꾸는 4개 경로 (이것 외엔 없음)

### ① 상담사 본인 토글
- API: `PATCH` → `api/src/user/counselors/counselors.service.ts:setMyAvailability()` (≈L263-327)
- 화면: `web/user/src/pages/CounselorMyPage.tsx` (마스터 "available" + 전화/채팅 ChannelToggle)
- `available=false` → use_phone/use_chat 무관하게 `ABSE`
- 그 외엔 `computeReadyState(usePhone, useChat)` 로 RDVC/IDLE/RDCH/ABSE 산출 후 UPDATE
- m2net chat-mgr csrstat 동기화 (`m2net.updateCounselorState`, 실패해도 DB는 반영)

### ② 상담 세션 lifecycle (m2net push)
- `api/src/pg-callbacks/m2net-push.service.ts`
  - CONNECT_CSR → `state='CONN'`, START_CHAT → `state='CNCH'`
  - DISCONNECT / END_CHAT / NO_ANSWER_CSR → `computeReadyState()` 로 대기상태 복귀 (≈L483, L490-491)
- 전화 세션 종료 시 consult 측에서도 복귀: `api/src/user/consult/consult.service.ts:120-122, 277-279` (active 없으면 use_phone? `IDLE` : `ABSE`)

### ③ m2net 상태 푸시 (mtonet_state)
- `handleStatePush()` `m2net-push.service.ts:1337-1375`
- list 순회하며 `UPDATE member SET state=... WHERE csrid=...`
- **`state='RDVC'` 푸시는 무시** (sample 정책, L1348)
- `CNCH`/`CONN` 푸시는 active 세션 있을 때만 반영 (stale 방지, L1354-1370)

### ④ 관리자 수동 / 등록
- `api/src/admin/members/members.service.ts` — use_phone/use_chat 매트릭스로 state 결정 (≈L909-911)
- 강제 복귀 SQL: use_phone/use_chat → RDVC/IDLE/RDCH/ABSE (≈L524-530)

## 로그인/로그아웃은 state 를 안 건드림
- 로그인: `api/src/user/auth/auth.service.ts:104` — `UPDATE member SET last_login_at=now()` **만**
- 로그아웃: 토큰 비활성화만 (`deactivateToken`), `ABSE` 설정 **없음**
- 모바일 셸: AppState(background/종료) → 상태변경 핸들러 **없음**
- cron: Settlement/Grade/Retry/HealthCheck/DailySummary 뿐 — presence/heartbeat cron **없음**

## ready state 매트릭스
```typescript
// m2net-push.service.ts computeReadyState() (≈L1793)
function computeReadyState(usePhone, useChat) {
  if (usePhone && useChat) return 'RDVC';
  if (usePhone && !useChat) return 'IDLE';
  if (!usePhone && useChat) return 'RDCH';
  return 'ABSE';
}
```

## 운영 SQL
```sql
-- 현재 상담사 상태 분포
SELECT state, COUNT(*) FROM member
WHERE role='counselor' AND left_at IS NULL
GROUP BY state ORDER BY COUNT(*) DESC;

-- "상담가능"으로 떠 있지만 오래 미접속(앱 꺼둔 의심) 상담사
SELECT id, mb_id, nickname, state, last_login_at,
       NOW() - last_login_at AS since_login
FROM member
WHERE role='counselor' AND state IN ('IDLE','RDCH','RDVC')
ORDER BY last_login_at NULLS FIRST;
```

## 함정
1. **"available인데 앱 꺼둠" 갭**: state가 manual+persistent라 리스트엔 대기로 뜨지만 실제 부재일 수 있음. 회원 채팅요청 → FCM 푸시 → 무응답 시 3분 자동취소.
2. **자동 부재 있다고 착각 금지**: 위 ❌ 섹션 참조. 24h 자동부재는 미구현.
3. **RDVC 푸시 무시**: handleStatePush가 RDVC를 무시하므로 m2net가 RDVC를 밀어도 우리 DB는 안 바뀜. RDVC는 우리쪽 setMyAvailability/세션복귀로만 설정됨.
4. **dtmfno는 varchar**: 산술연산 시 `::int` 캐스팅 필요 (표시번호 = dtmfno+150).

## 관련 메모리 / 문서
- [chat/02-state-machine](chat/02-state-machine) — chat_room.status (별개 머신)
- [chat/05-incoming](chat/05-incoming) — incoming 채팅 3단 안전망 + FCM
- [alert/03-fcm-push](alert/03-fcm-push) — 채팅요청 푸시
