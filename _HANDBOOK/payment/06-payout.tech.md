# [AI 전용] 선지급 정책 — 기술 상세

## 정책 박제 (2026-05-21)

메모리 `[[payout-system-plan]]`:
- 가용 한도: 누적 수익금 × 70%
- 수수료: 5%
- 원천징수: 3.3%
- 신청 한도: 일 1회

## 가용 계산

```typescript
async getAvailable(counselorId) {
  // 누적 수익금 (earning_balance + 옛 선지급 받은 금액 차감)
  const earned = await this.getEarningTotal(counselorId);  // 옛 정산 + earning_balance
  const advanced = await this.getAdvancedTotal(counselorId);  // 이미 선지급 받은 누적

  const available = (earned - advanced) * 0.7;
  return Math.max(0, available);
}
```

## 신청 처리

```typescript
async createRequest(counselorId, amount) {
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
- paid_at TIMESTAMPTZ
- paid_by INT FK admin
- created_at TIMESTAMPTZ
```

## 다음 정산 자동 차감

매월 정산 시:
```sql
-- 정산 계산
gross = sum(consultation.amt where settled=false)
advanced_this_month = sum(payout_request.requested_amount where status='paid' and period_overlap)
final_gross = gross - advanced_this_month
withholding = final_gross * 0.033
net = final_gross - withholding
```

## 핵심 코드 위치

- 신청 처리: `api/src/user/payout/payout.service.ts`
- 운영자: `api/src/admin/payouts/payouts.service.ts`
- 정산 차감: `api/src/cron/settlement-cron.service.ts`

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
```

## 함정

1. **음수 가용** — 환불 다수 발생 시. 신청 거부 + 다음 정산까지 대기
2. **일 1회 우회** — 같은 날 reject 됐다가 재신청 시도. status 검사로 차단
3. **다음 정산 차감 누락** — payout_request 와 settlement 의 period 매칭 정확해야

## 관련 메모리

- `[[payout-system-plan]]` (정책 박제)
