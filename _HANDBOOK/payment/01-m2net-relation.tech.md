# [AI 전용] m2net (PassCall) 통합 — 기술 상세

## 외부 시스템 정보

- 서비스명: PassCall (m2net)
- 가맹점 CPID: 0047 (사주플랜)
- API 호스트: `passcall.co.kr:25205`
- 통신: HTTPS REST + push callback

## 주요 API

### 회원/상담사 등록 (사주플랜 → m2net)
- `registerMember(name, phone, mb_id)` → `m2net_membid` 발급
- `registerCounselor(name, phone, mb_id)` → `csrid` 발급

### 통화 호출
- `PUT /etc-mgr/{cpid}/drconn` body: `{ telno, csrid }` → 가상번호 라우팅 설정
- 응답: `{ req_result: '00', telno, csrid }`

### 채팅
- m2net 측 wss 토큰 발급 (chat_room 생성 시)
- 클라이언트가 wss 직접 연결 (회원/상담사 양쪽)

### Push callback (m2net → 사주플랜)
- `POST /api/pg/m2net/call-push` — 통화 상태 (TRY_OK, NO_ANSWER_CSR, DISCONNECT 등)
- `POST /api/pg/m2net/state-push` — 채팅 상태 (START_CHAT, END_CHAT)

## DB 매핑

```
member
- m2net_membid VARCHAR — m2net 측 회원 ID
- csrid VARCHAR — m2net 측 상담사 ID (상담사만)
- phone VARCHAR

consultation (통화/채팅 이력)
- callee_phone — m2net 가상번호 (070-XXXX)
- caller_phone — 회원 폰 SIM 번호 (m2net 인식한 발신자)
- telno — 상담사 phone
- csrid — m2net 측 상담사 ID
- reason — TRY_OK / NO_ANSWER_CSR / DISCONNECT / END_CHAT / 등
- usetm — 사용 시간 (초)
- amt, amt_free, amt_paid — 차감 코인 양

chat_room
- roomid — m2net 측 채팅방 ID
- wss_token — m2net wss 인증 토큰
```

## 등록 흐름 (구체)

### 회원 가입
```typescript
// api/src/user/auth/auth.service.ts
async signup() {
  // 1. member row INSERT (role='user')
  const member = await this.sql`INSERT INTO member ...`
  try {
    // 2. m2net 등록 시도
    const r = await this.m2net.registerMember(...)
    // 3. m2net_membid UPDATE
    await this.sql`UPDATE member SET m2net_membid=${r.membid} WHERE id=${member.id}`
  } catch (e) {
    // 4. 등록 실패 시 사주플랜 가입도 롤백
    await this.sql`DELETE FROM member WHERE id=${member.id}`
    throw new Error('가입 실패: 통신 시스템 오류')
  }
}
```

### 상담사 신청 승인
```typescript
// api/src/admin/counselor-apply/counselor-apply.service.ts
async approve(applyId) {
  // 1. counselor_apply.status='approved' + member.role='counselor'
  // 2. m2net 상담사 등록 시도
  try {
    const csrid = await this.m2net.registerCounselor(...)
    await this.sql`UPDATE member SET csrid=${csrid} WHERE id=${memberId}`
  } catch {
    // 실패해도 사주플랜 상담사 상태는 유지 — 운영자 수동 재시도 (linkCounselorToM2net)
  }
}
```

## 잔액 동기화

### 충전 시
```typescript
// api/src/user/charge/charge.service.ts
async chargeSuccess() {
  // 1. point.paid_balance += amount
  // 2. m2net.addMemberCoin(m2net_membid, amount) — 양쪽 적립
  // (옛 이중 적립 사고: AG9 직통 + 사주플랜 양쪽 fill → 자동 정정 안전망 도입)
}
```

### 채팅·통화 종료 시 (강제 동기화)
```typescript
// api/src/pg-callbacks/m2net-push.service.ts END_CHAT 핸들러
async onEndChat() {
  // ...정산 처리
  // 강제 동기화: 사주플랜 측 잔액이 진실원천 → m2net 측 overwrite
  await this.m2net.syncM2netBalanceForMember(memberId)
}
```

## 자동 정정 cron

`api/src/cron/retry-cron.service.ts` `retryPaymentM2netSync()`:
- 매 10분
- 옛 충전 중 m2net 측 동기화 실패 건 재시도
- alimtalk_log 또는 별도 retry 테이블 추적

## 외부 의존성 사고 (메모리 박제)

- `[[pg-m2net-double-fill]]`: AG9 직통 + 사주플랜 양쪽 fill → 이중 적립 사고. 자동 정정 안전망 도입 (2026-05-23).
- `[[ubub1234 → 찬물선생 전화 실패]]`: 폰 자동 차단으로 NO_ANSWER_CSR. m2net 측 라우팅은 정상이었으나 회원 폰 측 차단.

## 운영 SQL

```sql
-- m2net 미등록 회원 (사고 흔적)
SELECT COUNT(*) FROM member WHERE role='user' AND m2net_membid IS NULL;

-- 상담사 csrid 미발급 (수동 재시도 대상)
SELECT id, mb_id, nickname FROM member WHERE role='counselor' AND csrid IS NULL;

-- 최근 통화 실패 (NO_ANSWER_CSR 등)
SELECT reason, COUNT(*) FROM consultation
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY reason
ORDER BY COUNT(*) DESC;
```

## 핵심 코드 위치

- m2net 클라이언트: `api/src/shared/m2net/m2net.service.ts`
- push 핸들러: `api/src/pg-callbacks/m2net-push.service.ts`
- 회원 등록 흐름: `api/src/user/auth/auth.service.ts`
- 상담사 등록: `api/src/admin/counselor-apply/counselor-apply.service.ts`
- 잔액 동기화: `m2net.service.ts` `syncM2netBalanceForMember()`
- 자동 정정 cron: `api/src/cron/retry-cron.service.ts`

## 협의 채널

- m2net 영업담당 (사장님 직접)
- m2net 콘솔: 상담사 csrid 등록 phone 등 직접 확인
- 사고 시 m2net 고객센터

## 관련 메모리

- `[[money-flow-master]]` (MONEY_FLOW.md 전체 정리)
- `[[pg-m2net-double-fill]]` (이중 적립 사고 + 안전망)
