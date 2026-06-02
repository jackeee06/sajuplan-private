# [AI 전용] 상담사 정산 — 기술 상세

## cron 자동 정산

- 파일: `api/src/cron/settlement-cron.service.ts`
- 스케줄: 매월 말 (예: `@Cron('0 0 1 * *')` — 매월 1일 00:00 = 전월 정산)

## 정산 계산

```typescript
// 상담사별 누적 earning_balance 집계
const earnings = await this.sql`
  SELECT counselor_id, SUM(amt) AS total_amt
  FROM consultation
  WHERE is_settled = false
    AND started_at >= ?
    AND started_at < ?
  GROUP BY counselor_id
`;

for (const row of earnings) {
  const grossAmount = row.total_amt;
  const withholdingTax = Math.floor(grossAmount * 0.033);
  const netAmount = grossAmount - withholdingTax;

  await this.sql`
    INSERT INTO settlement (counselor_id, gross_amount, withholding_tax, net_amount, period_from, period_to, status)
    VALUES (${row.counselor_id}, ${grossAmount}, ${withholdingTax}, ${netAmount}, ?, ?, 'pending')
  `;

  // consultation 행 정산 마킹
  await this.sql`UPDATE consultation SET is_settled = true WHERE counselor_id = ${row.counselor_id} AND is_settled = false AND started_at < ?`;
}
```

## DB 스키마

```
settlement
- id BIGSERIAL
- counselor_id INT FK
- period_from / period_to DATE
- gross_amount INT (원천세 차감 전)
- withholding_tax INT (3.3%)
- net_amount INT (실 지급액)
- status VARCHAR — 'pending' / 'paid' / 'cancelled'
- paid_at TIMESTAMPTZ
- created_at TIMESTAMPTZ

consultation
- counselor_id, amt (사용 시간 × 등급별 단가)
- is_settled BOOLEAN
- started_at, ended_at
```

## 등급별 단가 적용

`consultation.amt` 가 그 시점 등급 단가로 INSERT 시 확정. 후속 등급 변경되어도 옛 row 단가 안 바뀜.

코드: `m2net-push.service.ts` END_CHAT 시점에 `member.grade` 조회 → 단가 적용

## 핵심 코드 위치

- 정산 cron: `api/src/cron/settlement-cron.service.ts`
- 수동 정산: `api/src/admin/settlements/settlements.service.ts`
- 등급 단가: `api/src/admin/grade/grade.service.ts`
- 단가 적용: `api/src/pg-callbacks/m2net-push.service.ts` END_CHAT

## 운영 SQL

```sql
-- 이번 달 정산 미발생 상담사
SELECT counselor_id, SUM(amt) AS pending_amt
FROM consultation
WHERE is_settled = false AND amt > 0
GROUP BY counselor_id
ORDER BY pending_amt DESC;

-- 정산 합계 (월별)
SELECT
  DATE_TRUNC('month', period_to) AS month,
  COUNT(*) AS counselors,
  SUM(gross_amount) AS total_gross,
  SUM(withholding_tax) AS total_tax,
  SUM(net_amount) AS total_net
FROM settlement
WHERE status='paid'
GROUP BY month
ORDER BY month DESC;
```

## 함정

1. **정산 cron 정지** → 매월 누락. 다음 달 누적되어 큰 정산. 알림톡 안 옴.
2. **earning_balance 음수** → 환불 다수로 발생 가능. 다음 정산에서 차감 처리.
3. **`is_settled` 동시성** → 정산 cron 중 새 상담 발생 → 다음 달로 이월

## 관련 메모리

- `[[grade-system-plan]]` (등급 단가 시스템)
- `[[payout-system-plan]]` (선지급은 별도)
