# [AI 전용] 충전 흐름 — 기술 상세

## PG (AG9) 통합

- 가맹점 등록 사주플랜 (사장님 영업담당)
- 카드 / 가상계좌 / 간편결제 / 빌링키 (사주플랜페이)
- callback 엔드포인트: `POST /api/pg/ag9/callback`
- 정산: AG9 측 별도 (사주플랜 결제일 ↔ AG9 입금일 차이)

## 충전 금액 정책 (2026-06-10 갱신)

- `charge.service.ts` `prepareCharge()`:
  ```typescript
  const payAmount = Math.round(pkg.amount * 1.1); // VAT 가산
  // sample/coin_fill.php 라인 70: 최소 결제 금액 30,000원.
  if (payAmount < 30000) {
    throw new BadRequestException('최소 결제 금액은 30,000원입니다.');
  }
  ```
- 과거 테스트용으로 `payAmount < 10`(10원)까지 허용하도록 임시 완화돼 있던 것을 **30,000원으로 복구**.
- prod DB `account_setting` 의 `id=23` "(가상계좌) 10원 테스트" 패키지(`amount=9`)를 **`is_active=FALSE`** 로 비활성화 (실 사용자 9원 결제 차단).
- 활성 패키지: 3만 / 5만 / 10만 / 20만 / 30만 (`account_setting.is_active=TRUE`). 10만 이상은 보너스 코인 포함. 모두 `amount × 1.1` 결제.

```sql
-- 활성 충전 패키지 확인
SELECT id, name, amount, is_active
FROM account_setting
WHERE type='charge'  -- 충전 패키지
ORDER BY amount;
```

## 충전 흐름 (코드)

```typescript
// api/src/pg-callbacks/ag9-callback.controller.ts
async onPaymentSuccess(payload) {
  // 1. 결제 검증 (AG9 측 응답 + 사주플랜 측 payment row 매칭)
  // 2. payment.status='paid' 마킹
  // 3. point.paid_balance += amount
  // 4. point_history INSERT (사유='charge')
  // 5. m2net.addMemberCoin(m2net_membid, amount) — 양쪽 적립
  // 6. 알림톡 order_payment_ok_v2 발송
}
```

## 이중 적립 사고 + 안전망 (메모리 `[[pg-m2net-double-fill]]`)

### 사고 (2026-05-23)
- AG9 직통 + 사주플랜 측 `addMemberCoin` 동시 호출
- m2net 측 잔액 2배 누적

### 안전망 (도입)
- 자동 정정 cron: `retryPaymentM2netSync` (10분 주기)
- 사주플랜 DB 잔액 vs m2net 잔액 비교 → 차이 있으면 사주플랜 → m2net 강제 overwrite

### 백로그
- 1주일 안정성 확인 후 `addMemberCoin` 호출 제거 검토 (메모리 박제)

## 채팅 종료 시 m2net 강제 동기화

```typescript
// api/src/pg-callbacks/m2net-push.service.ts END_CHAT
async onEndChat() {
  // ...정산
  await this.m2net.syncM2netBalanceForMember(memberId)
  // → m2net 측 잔액을 사주플랜 측에 맞춤 (사주플랜이 진실원천)
}
```

## DB 스키마

```
payment
- id BIGSERIAL
- member_id INT FK
- amount INT
- status VARCHAR — 'pending' / 'paid' / 'failed' / 'cancelled'
- pg_method VARCHAR — 'card' / 'vbank' / 'easy_pay' / 'auto'
- pg_tid VARCHAR — AG9 트랜잭션 ID
- paid_at TIMESTAMPTZ
- vbank_account VARCHAR — 가상계좌
- vbank_due_at TIMESTAMPTZ

point_history
- member_id, amount, balance_after, type ('charge'|'use'|'refund'|...), reason
```

## 핵심 코드 위치

- PG callback: `api/src/pg-callbacks/ag9-callback.controller.ts`
- 충전 처리: `api/src/user/charge/charge.service.ts`
- m2net 동기화: `api/src/shared/m2net/m2net.service.ts` `addMemberCoin()`, `syncM2netBalanceForMember()`
- 자동 정정: `api/src/cron/retry-cron.service.ts`
- 자동충전 (사주플랜페이): `charge.service.ts` `registerAutoPayCard()`, `autoCharge cron`

## 운영 SQL

```sql
-- 어제 매출
SELECT COUNT(*) AS cnt, SUM(amount) AS total
FROM payment
WHERE status='paid'
  AND paid_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
  AND paid_at < DATE_TRUNC('day', NOW());

-- 결제 실패 케이스
SELECT pg_method, COUNT(*) FROM payment
WHERE status='failed' AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY pg_method;

-- m2net 동기화 누락 (사주플랜 vs m2net 어긋남) — m2net 측 API 호출 필요
```

## 알림톡

- `order_payment_ok_v2` — 결제 확인
- `order_bankinfo_v2` — 가상계좌 안내 (입금 전)

## 외부 의존성 사고 시 대응

### AG9 응답 늦음 (1-2분 이상)
- payment.status='pending' 유지
- 클라이언트 폴링 또는 callback 재시도 대기
- 5분 이상 pending 이면 운영자 수동 확인

### 자동 정정 cron 정지
- 영향: 옛 미동기화 건 누적
- `pm2 logs sajumoon-api | grep retryPaymentM2netSync` 매 10분 로그 확인

## 관련 메모리

- `[[pg-m2net-double-fill]]` (이중 적립 사고 + 안전망)
- `[[money-flow-master]]` (전체 돈 흐름)
- `[[autopay-handoff]]` (사주플랜페이 자동충전)
