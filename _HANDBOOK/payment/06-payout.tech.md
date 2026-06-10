# [AI 전용] 선지급 정책 — 기술 상세

## 정책 박제 (2026-05-21 / 갱신 2026-06-10)

메모리 `[[payout-system-plan]]`:
- 가용 한도: **현재 수익금(earning_balance) × 70%** ← "지금 그 사람 남은 수익금" 기준 (누적 전체 아님)
- 수수료: 5%
- 원천징수: 3.3%
- 최소 신청액: 30,000원
- 신청 한도: 일 1회
- **prod 실제 신청 0건** (시스템 준비, 미사용)

## 가용 계산

가용 = **현재 수익금(earning_balance) × 70%**. earning_balance 자체가 이미 정산·선지급으로 빠진 뒤의 "현재 남은 수익금"이므로, 옛날처럼 누적에서 선지급 누적을 또 빼지 않는다.

```typescript
async getAvailable(counselorId) {
  // 현재 수익금 = point.earning_balance (이미 정산/선지급 차감 반영된 잔액)
  const pt = await this.sql`SELECT earning_balance FROM point WHERE member_id = ${counselorId}`;
  const balance = Number(pt[0]?.earning_balance ?? 0);

  // ※ 미정산 선지급(status='paid' AND settled_at IS NULL)은 아직 earning에서 안 빠진
  //   상태이므로, 가용 산정 시 한 번 더 차감한다 (이중 인출 방지).
  const earlyRow = await this.sql`
    SELECT COALESCE(SUM(requested_amount), 0)::int AS total
      FROM payout_request
     WHERE counselor_id = ${counselorId} AND status = 'paid' AND settled_at IS NULL
  `;
  const unsettledAdvance = Number(earlyRow[0].total);

  const available = Math.floor((balance - unsettledAdvance) * 0.7);
  return Math.max(0, available);
}
```

> 핵심: earning 차감은 **정산 [정산하기] 처리 시점**에만 일어난다(아래 §정산 연동 참조). 그래서 선지급 직후~정산 전까지는 earning_balance가 아직 안 줄어 있고, 그 사이의 미정산 선지급은 가용 계산에서 명시적으로 빼줘야 한다.

## 신청 처리

```typescript
async createRequest(counselorId, amount) {
  // 0. 최소 신청액 검증 (3만원)
  if (amount < 30000) throw new BadRequestException('최소 신청액 30,000원');

  // 1. 가용 한도 검증
  const available = await this.getAvailable(counselorId);
  if (amount > available) throw new BadRequestException('가용 초과');

  // 2. 일 1회 한도 검사
  const todayCount = await this.sql`
    SELECT COUNT(*) FROM payout_request
    WHERE counselor_id = ${counselorId}
      AND created_at >= DATE_TRUNC('day', NOW())
      AND status <> 'rejected'
  `;
  if (todayCount[0].count >= 1) throw new BadRequestException('일 1회 한도');

  // 3. payout_request INSERT
  const fee = Math.floor(amount * 0.05);
  const tax = Math.floor(amount * 0.033);
  const actual = amount - fee - tax;

  await this.sql`
    INSERT INTO payout_request (counselor_id, requested_amount, fee, withholding_tax, actual_amount, status)
    VALUES (${counselorId}, ${amount}, ${fee}, ${tax}, ${actual}, 'received')
  `;

  // 4. 알림톡 발송
  await this.sms.sendAlimtalkByCode('payout_request_received', counselor.phone, { amount });
}
```

## 운영자 처리

```typescript
async approve(requestId, adminId) {
  await this.sql`UPDATE payout_request SET status='paid', paid_at=NOW(), paid_by=${adminId} WHERE id=${requestId}`;
  // 알림톡 payout_request_paid
}

async reject(requestId, adminId, reason) {
  await this.sql`UPDATE payout_request SET status='rejected', rejected_reason=${reason} WHERE id=${requestId}`;
  // 알림톡 payout_request_rejected
}
```

## DB 스키마

```
payout_request
- id BIGSERIAL
- counselor_id INT FK
- requested_amount INT
- fee INT (5%)
- withholding_tax INT (3.3%)
- actual_amount INT (실 입금)
- status VARCHAR — 'received' / 'paid' / 'rejected'
- rejected_reason TEXT
- paid_at TIMESTAMPTZ — 운영자 지급완료 시각
- paid_by INT FK admin
- settled_at TIMESTAMPTZ — ★정산 반영 시각 (NULL = 미반영, 정산예상에서 차감 대상)
- created_at TIMESTAMPTZ
```

> **정산 연동 인덱스 핵심**: `WHERE counselor_id=? AND status='paid' AND settled_at IS NULL` 조회가 가용계산·정산계산 양쪽에서 쓰이므로 부분 인덱스 권장.

## 정산 연동 — 미정산 선지급은 정산에서 제외 (2026-06-10 정산단순화 기준)

### 핵심 규칙
정산이 **earning 합산 방식**으로 전환 중이다(별도 문서 `payment/05-settlement`). 새 방식에서 선지급은 다음과 같이 맞물린다:

```
정산예상금액(settleAmount) = 전달 말일까지 미정산 earning(earning_balance 흐름) 순액 합산
미정산 선지급(earlyPayoutTotal) = SUM(payout_request.requested_amount
                                   WHERE status='paid' AND settled_at IS NULL)
실지급액(price) = MAX(0, settleAmount − earlyPayoutTotal) × (1 − 0.033)
```

즉 **이미 받았지만 아직 정산에 반영 안 된 선지급(`status='paid' AND settled_at IS NULL`)은 정산예상금액에서 빠진다** → 이중 지급 방지.

### 차감/마킹 시점 = [정산하기] 버튼 (cron 아님)
새 설계에서 earning 차감과 선지급 마킹은 cron이 아니라 **운영자가 [정산하기]를 누를 때**(`markPaid`) 일어난다:

```typescript
// markPaid (정산하기) 트랜잭션 내
// 1) earning_balance 차감 + point_history is_settled=true 이력
// 2) 대상 earning 이력 is_settled=true 마킹
// 3) 미정산 선지급 정산반영 마킹:
await tx`UPDATE payout_request SET settled_at = NOW()
         WHERE counselor_id = ${memberId} AND status = 'paid' AND settled_at IS NULL`;
```

→ `settled_at`이 찍히면 다음 정산부터 그 선지급은 더 이상 차감 대상이 아니다.

> ⚠️ **구현 예정**: 위 연동(정산예상 − 미정산 선지급, settled_at 마킹)은 다음 세션 정산단순화 작업에서 구현한다.
> 인수인계: `PLAN/_NEXT_SESSION_정산단순화.md` (§2 확정 정책, §3-B markPaid 재작성).
> 현재 정산 cron은 비활성(주석처리)됨, prod settlement_monthly 0건, prod 선지급 0건.

### ⚠️ 폐기된 옛 모델 (참고용 — 더 이상 사용 안 함)
초기 설계는 cron이 매월 `consultation.amt`에서 등급정산률을 재계산하고 `period_overlap`으로 선지급을 빼는 방식이었다. 이는 ① earning에 이미 정산률 반영분이 적립돼 **이중 계산**, ② 추천수익금 실시간화로 amt 전체 계산 시 **과지급** 문제가 있어 폐기. 새 방식은 earning 잔액 합산 + `settled_at` 기준으로 단순화한다.

## DB 스키마 보강 (정산 연동)

`payout_request`에 **`settled_at TIMESTAMPTZ`** 컬럼 추가 필요(정산 반영 시각). NULL = 아직 정산 미반영(=정산예상금액에서 차감 대상). 아래 스키마 섹션 참조.

## 핵심 코드 위치

- 신청 처리: `api/src/user/payout/payout.service.ts`
- 운영자: `api/src/admin/payouts/payouts.service.ts`
- 정산 차감/선지급 마킹: `api/src/admin/settlements/settlements.service.ts` `markPaid` (cron 아님, 버튼 처리)
- 정산 계산(미정산 선지급 제외): `api/src/cron/settlement-cron.service.ts` `settleOne`

## 알림톡 템플릿

- `payout_request_received` — 신청 접수 (`#{amount}`)
- `payout_request_paid` — 입금 완료 (`#{amount}, #{fee}, #{withholding}, #{actual}`)
- `payout_request_rejected` — 반려 (`#{amount}, #{reason}`)

## 운영 SQL

```sql
-- 이번 달 선지급 합계
SELECT COUNT(*), SUM(requested_amount), SUM(actual_amount)
FROM payout_request
WHERE status='paid'
  AND paid_at >= DATE_TRUNC('month', NOW());

-- 상담사별 선지급 누적
SELECT counselor_id, SUM(requested_amount) AS total
FROM payout_request
WHERE status='paid'
GROUP BY counselor_id
ORDER BY total DESC;

-- 정산에서 차감해야 할 미정산 선지급 (정산예상금액 검산용)
SELECT counselor_id, SUM(requested_amount) AS unsettled_advance
FROM payout_request
WHERE status='paid' AND settled_at IS NULL
GROUP BY counselor_id;
```

## 함정

1. **음수 가용** — 환불 다수 발생 시. 신청 거부 + 다음 정산까지 대기
2. **일 1회 우회** — 같은 날 reject 됐다가 재신청 시도. status 검사로 차단
3. **선지급 이중 지급** — 정산예상금액에서 미정산 선지급(`status='paid' AND settled_at IS NULL`)을 빼지 않으면, 이미 미리 준 돈을 정산 때 또 준다. settleOne 계산 + markPaid의 `settled_at` 마킹이 짝으로 정확해야.
4. **차감 시점 혼동** — earning 차감/선지급 settled_at 마킹은 **cron이 아니라 [정산하기] 버튼(markPaid)** 에서 발생. 옛 period_overlap 방식은 폐기됨.

## 관련 메모리 / 문서

- `[[payout-system-plan]]` (정책 박제)
- `PLAN/_NEXT_SESSION_정산단순화.md` (정산 연동 구현 인수인계 — settleOne/markPaid 재작성)
- `_HANDBOOK/payment/05-settlement` (정산 단순화 전환)
