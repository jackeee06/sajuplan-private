# [AI 전용] 사주플랜페이 자동충전 — 기술 상세

## 현재 상태

- 코드 완성 (메모리 `[[autopay-handoff]]`)
- 실 등록 0건 (운영 시작 전)
- 핸드오프 문서: `_NEXT_SESSION_자동충전.md` (실 테스트 시 읽기)

## AG9 빌링키 흐름

```typescript
// api/src/user/charge/charge.service.ts
async registerAutoPayCard(memberId, cardInfo) {
  // 1. AG9 빌링키 발급 요청
  const result = await this.ag9.registerBillingKey({
    customer_id: memberId,
    card_no, card_exp, card_pwd2, card_birth
  })

  if (result.req_result === '00') {
    // 2. DB 저장
    await this.sql`
      INSERT INTO auto_pay_card (member_id, billing_key, card_last4, is_active)
      VALUES (${memberId}, ${result.billing_key}, ${cardLast4}, true)
    `
    return { success: true }
  } else {
    throw new Error(`카드 등록 실패: ${result.message}`)
  }
}
```

## 자동 결제 트리거 (cron 또는 inline)

```typescript
async checkAndAutoCharge() {
  // 잔액 임계값 이하 + 자동충전 활성 회원 찾기
  const candidates = await this.sql`
    SELECT m.id, m.point, ac.billing_key, ac.charge_amount
    FROM member m
    JOIN auto_pay_card ac ON ac.member_id = m.id AND ac.is_active = true
    WHERE m.point < ac.threshold
  `

  for (const c of candidates) {
    try {
      // AG9 빌링키로 자동 결제
      const result = await this.ag9.chargeWithBillingKey({
        billing_key: c.billing_key,
        amount: c.charge_amount
      })
      if (result.req_result === '00') {
        // 적립 + 알림톡
        await this.creditPointsAndNotify(c.id, c.charge_amount)
      }
    } catch (e) {
      // 실패 → 알림톡 + 재시도 카운트
      await this.logFailureAndNotify(c.id, e.message)
    }
  }
}
```

## DB 스키마

```
auto_pay_card
- id BIGSERIAL
- member_id INT FK UNIQUE
- billing_key VARCHAR(100)
- card_last4 VARCHAR(4)
- charge_amount INT (자동 결제 금액)
- threshold INT (잔액 임계값, 예: 5000 코인)
- is_active BOOLEAN
- registered_at TIMESTAMPTZ
- last_charged_at TIMESTAMPTZ

auto_charge_log
- id BIGSERIAL
- member_id INT FK
- billing_key VARCHAR
- amount INT
- result VARCHAR — 'success' / 'failed'
- ag9_response TEXT
- created_at TIMESTAMPTZ
```

## 핵심 코드 위치

- 카드 등록: `api/src/user/charge/charge.service.ts:registerAutoPayCard()`
- 자동 결제: `charge.service.ts:autoCharge()` 또는 별도 cron `api/src/cron/auto-charge-cron.service.ts`
- AG9 빌링키: `api/src/shared/ag9/ag9.service.ts`

## 알려진 에러 (메모리 박제)

### `req_result=27` (기존 자동결제 정리 실패)
- AG9 측에서 옛 빌링키 잔존 → 새 등록 시 충돌
- 해결: 기존 빌링키 삭제 호출 후 재등록

## 운영 SQL

```sql
-- 자동충전 활성 회원
SELECT m.id, m.mb_id, m.nickname, m.point, ac.charge_amount, ac.threshold
FROM member m
JOIN auto_pay_card ac ON ac.member_id = m.id
WHERE ac.is_active = true;

-- 자동 결제 성공률
SELECT result, COUNT(*) FROM auto_charge_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY result;
```

## 운영 시작 시 모니터링 포인트

1. 첫 카드 등록 발생 → 즉시 운영자 알림 (OpsAlert 추가 검토)
2. 자동 결제 실패 다수 → 재시도 정책 + 회원 안내
3. AG9 측 빌링키 상태 변경 (카드 만료 등) → 알림톡 발송

## 관련 메모리

- `[[autopay-handoff]]` (전체 핸드오프)
- `_NEXT_SESSION_자동충전.md`
