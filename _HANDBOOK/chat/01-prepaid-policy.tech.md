# [AI 전용] 채팅 선결제 정책 — 기술 상세

> 이 파일은 운영 바이블 UI 에 노출되지 않습니다. AI agent 가 깊은 질문에 답할 때 참조.

## 정책 배경 (역사)

### 옛 정책: 분당 차감
- 사용 시간만큼 차감 (1분 단위)
- m2net 측 정산 단가 (분당 X 원) 와 동기화 필요
- **사고 빈발**: 회원이 끊은 시간 vs m2net 측 기록 어긋남 → 정산 오류 빈번
- **해결 시도**: m2net push (END_CHAT) 으로 정확한 사용 시간 받음 → 그래도 push 누락 시 사고

### 현재 정책: 선결제 (2026-05-24 합의, 2026-05-29 도입)
- 회원이 시작 시 선택 시간 전액 차감
- m2net 측 단가와 무관 (사주플랜이 단가 X 시간 = 코인 양 결정)
- 사고 0
- F·G 정책으로 회원 보호

→ 옛 정책으로 회귀 권장 X. m2net 동기화 사고 재발.

## 시간 옵션 (운영 vs 테스트)

| 분량 | 운영 활성 | 비고 |
|---|---|---|
| 1분 | ❌ 테스트 전용 | `SHOW_TEST_MINUTE_TO_ALL` 플래그. 운영 시 비활성. 메모리 [[test-phase]] |
| 15분 | ✅ 운영 메인 | 가장 짧은 옵션 |
| 30분 | ✅ | |
| 45분 | ✅ | |
| 60분 | ✅ | |

화이트리스트: `[1, 15, 30, 45, 60]` (코드) 중 1분은 테스트 단계 한정 노출.

## F 정책 구현 흐름

```
회원이 ConsultModal "채팅 시작" 클릭
  ↓
POST /user/consult/start-chat { counselorId, chargeMinutes }
  ↓
백엔드:
  1. chat_room INSERT (status='STAY', charge_minutes, started_at=NOW())
  2. m2net drconn API 호출 → 가상 통화 세션 시작 (상담사 측 알림 트리거)
  ↓
상담사에게 알림톡 chat_request_to_counselor
  ↓
[F 정책 - 차감 0]: 이 시점에 코인 차감 안 함. paid_balance 그대로.
  ↓
3분 대기 (autoCancelStaleChats cron):
  - 상담사 미입장 → 3분 후 status='DISCONNECT', use_seconds=0, amt=0
  - 회원에게 환불 처리 X (애초 차감 안 했음)

상담사 입장 시 (m2net START_CHAT push):
  ↓
m2net-push.service.ts 의 START_CHAT 핸들러:
  - chat_room.status='CNCH', counselor_joined_at=NOW()
  - **이 시점에 charge_minutes × 분당 단가 차감** (paid_balance 또는 free_balance)
  - point_history INSERT (사유='chat_start')
```

## G 정책 구현 흐름

```
상담사 입장 후 (CNCH) → 5초 안에 회원 또는 상담사가 종료 (leave 'close')
  ↓
m2net-push.service.ts 의 END_CHAT 핸들러:
  - use_seconds 계산 (NOW() - counselor_joined_at)
  - if use_seconds <= 5:
      - member_chat_quick_refund_log 카운트 (회원 일/주별)
      - 일 2회 / 주 4회 한도 검사
      - 한도 내면: 차감 코인 전액 복원 (paid_balance += charge_amount)
                  point_history INSERT (사유='g_policy_refund')
      - 한도 초과면: 환불 X, 정상 차감 유지
  - chat_room.status='DISCONNECT'
```

## 핵심 코드 위치

### 시작 트리거
- 컨트롤러: `api/src/user/consult/consult.controller.ts` `startChat()`
- 서비스: `api/src/user/consult/consult.service.ts:471-525`
  - `chargeMinutes` 화이트리스트 검증
  - `chat_room` INSERT
  - 알림톡 `notifyCounselorChatRequest`
- DTO: `api/src/user/consult/dto/start-chat.dto.ts`

### F 정책 (차감 시점)
- `api/src/pg-callbacks/m2net-push.service.ts` START_CHAT 핸들러
- DB UPDATE: `member.point`, `point.paid_balance` / `free_balance`
- 트랜잭션 안에서 처리 (atomicity)

### G 정책 (5초 환불)
- `api/src/pg-callbacks/m2net-push.service.ts` END_CHAT 핸들러
- 한도 검사: `member_chat_quick_refund_log` 일/주 카운트
- 환불 처리: paid_balance 복원 + history 기록

### 3분 자동 취소 cron
- `api/src/user/consult/consult.service.ts:547-595` `autoCancelStaleChats()`
- 매분 실행
- 조건: `status='STAY' AND started_at < NOW() - INTERVAL '3 minutes'`
- 알림톡: `chat_auto_cancelled_to_member` (회원에게), 상담사 측 별도

### 화이트리스트 코드
```typescript
const ALLOWED_MINUTES = [1, 15, 30, 45, 60];  // 1분은 테스트 전용
```

### 프론트 (회원 화면)
- `web/user/src/components/ConsultModal.tsx`
  - chargeMinutes 선택 UI
  - `SHOW_TEST_MINUTE_TO_ALL` 플래그 (1분 노출 여부)
- `web/user/src/pages/ChatRoom.tsx`
  - 상태 머신 (STAY → CNCH → ended)

## DB 스키마

### chat_room
- `id` BIGSERIAL
- `member_id` → member(id) FK
- `counselor_id` → member(id) FK
- `status` VARCHAR — 'STAY' / 'CNCH' / 'DISCONNECT'
- `charge_minutes` INT — 선택한 분량 (15/30/45/60 운영, 1 테스트)
- `started_at` TIMESTAMPTZ
- `counselor_joined_at` TIMESTAMPTZ
- `ended_at` TIMESTAMPTZ
- `member_try_out` BOOL — soft leave 마킹
- `roomid` VARCHAR — m2net 측 roomid
- `wss_token` VARCHAR — m2net wss 토큰

### member_chat_quick_refund_log (G 정책 추적)
- `id` BIGSERIAL
- `member_id` → member(id)
- `chat_room_id` → chat_room(id)
- `refund_amount` INT
- `use_seconds` INT
- `reason` VARCHAR(40) — 'g_policy_5sec'
- `created_at` TIMESTAMPTZ

### point_history (차감/적립 이력)
- 사유 코드: `chat_start` (차감), `g_policy_refund` (환불)

## 관련 메모리

- `[[prepaid-chat-plan]]` — 정책 전체 (§1~§15, 10 결정 추적)
- `[[pg-m2net-double-fill]]` — 옛 이중 적립 사고 + 안전망
- `[[test-phase]]` — 1분 옵션은 테스트 한정
- `[[id-unification-complete]]` — 한 사람 한 mb_id (회원·상담사 듀얼)

## 관련 외부 시스템

### m2net (PassCall)
- API: `drconn` (통화/채팅 시작), START_CHAT push, END_CHAT push
- 잔액 동기화: END_CHAT 시 `syncM2netBalanceForMember` 강제
- 옛 사고: AG9 직통 + 사주플랜 양쪽 fill → 이중 적립 → 자동 정정 안전망 (`retryPaymentM2netSync` cron)

### BizM 알림톡
- 상담사에게: `chat_request_to_counselor` (회원이 채팅 요청)
- 회원에게: `chat_auto_cancelled_to_member` (3분 자동 취소)
- 채팅 중 차단 정책: 화이트리스트 `chat_request_to_counselor` 외 모든 알림톡 drop

## SQL 운영 쿼리

```sql
-- 최근 24시간 채팅 통계
SELECT
  charge_minutes,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status='DISCONNECT' AND counselor_joined_at IS NOT NULL) AS completed,
  COUNT(*) FILTER (WHERE status='DISCONNECT' AND counselor_joined_at IS NULL) AS cancelled_3min
FROM chat_room
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY charge_minutes
ORDER BY charge_minutes;

-- G 정책 환불 받은 회원 (이번 주)
SELECT
  m.id, m.mb_id, m.nickname,
  COUNT(*) AS refund_count,
  SUM(qrl.refund_amount) AS total_refund
FROM member_chat_quick_refund_log qrl
JOIN member m ON m.id = qrl.member_id
WHERE qrl.created_at >= DATE_TRUNC('week', NOW())
GROUP BY m.id, m.mb_id, m.nickname
HAVING COUNT(*) >= 3
ORDER BY refund_count DESC;

-- 상담사 미입장 자동 취소율
SELECT
  DATE_TRUNC('day', started_at) AS day,
  COUNT(*) FILTER (WHERE counselor_joined_at IS NULL) * 100.0 / COUNT(*) AS cancel_rate_pct
FROM chat_room
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```

## 알려진 함정

1. **분당 차감 모델로 회귀 금지** — m2net 동기화 사고 재발
2. **G 정책 한도 늘릴 때 어뷰징 검토** — 동일 IP 다계정 시도 가능
3. **3분 cron 정지 시 STAY 무한 대기** — `pm2 logs sajumoon-api | grep autoCancelStaleChats` 매분 로그 확인
4. **chargeMinutes 가 화이트리스트 외 값** — 검증 누락 시 1초 / 9999분 같은 비정상 차감
5. **m2net START_CHAT push 누락** — 상담사 입장했는데 차감 안 됨. 안전망: 클라이언트 측 폴링이 상태 동기화

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-23 | 옛 분당 차감 정책 → 선결제 합의 |
| 2026-05-24 | F·G 정책 도입 합의 |
| 2026-05-29 | 선결제 활성화 (chargeMinutes 컬럼 추가) |
| 2026-05-30 | 채팅 중 알림 차단 정책 추가 |
