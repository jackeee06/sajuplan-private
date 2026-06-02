# [AI 전용] 코인 구조 — 기술 상세

## 용어 정책 (CLAUDE.md 박제, 2026-05-25)

### UI 라벨
- 회원 영역 → "코인" 통일
- 상담사 영역 → "수익금" 통일
- 관리자/시뮬레이터 → 회계 표준 (매출/영업이익 등)

### DB / 코드 (변경 X)
- `member.point` — 총 보유
- `point.free_balance` — 무료 적립
- `point.paid_balance` — 유료 결제 적립
- `point.earning_balance` — 상담사 수익 적립

→ 변경 시 API 응답 / 외부 시스템 (m2net) 영향. UI 라벨 매핑만 유지.

## 3 잔액 분리 (2026-05-22 도입, 메모리 `[[point-separation-done]]`)

옛: `member.point` 하나 (총합)
새: `point.free_balance` + `paid_balance` + `earning_balance` 3종 + `member.point` (합산 캐시)

→ 환불·정산 정확성 + 무료 보상 보호

## 차감 우선순위

```
사용 (채팅·통화) 시:
  paid_balance -= cost (먼저)
  if paid_balance == 0:
    free_balance -= remaining
```

코드: `api/src/pg-callbacks/m2net-push.service.ts` END_CHAT 차감 로직

## 적립 매핑

| 이벤트 | 적립 컬럼 |
|---|---|
| 카드/계좌 결제 | `paid_balance` (충전 금액) |
| 출석 보상 | `free_balance` |
| 이벤트 보상 | `free_balance` |
| 추천인 보상 (양쪽) | `free_balance` |
| 상담사 수익 (회원 채팅·통화) | `earning_balance` |

## 핵심 코드 위치

- 차감: `api/src/pg-callbacks/m2net-push.service.ts`
- 충전 적립: `api/src/user/charge/charge.service.ts`
- 출석 적립: `api/src/user/attendance/attendance.service.ts`
- 추천인 적립: `api/src/user/auth/auth.service.ts` (회원가입 시)
- 정산: `api/src/cron/settlement-cron.service.ts`

## DB 스키마

```
point (회원당 1 row)
- member_id INT FK (PK)
- free_balance INT DEFAULT 0
- paid_balance INT DEFAULT 0
- earning_balance INT DEFAULT 0
- updated_at TIMESTAMPTZ

member (캐시 컬럼 — 위 3개 합산)
- point INT — free + paid + earning 합

point_history (변동 이력)
- member_id, amount (양/음), balance_after, type, reason, created_at
- type: 'charge' / 'use' / 'refund' / 'attendance' / 'event' / 'referral' / 'settlement' / 'payout'
```

## 운영 SQL

```sql
-- 회원별 코인 잔액 (상위 50)
SELECT m.id, m.mb_id, p.free_balance, p.paid_balance, p.earning_balance
FROM member m JOIN point p ON p.member_id = m.id
ORDER BY p.paid_balance DESC LIMIT 50;

-- 무료 코인 비중 (정책 검토용)
SELECT
  SUM(free_balance) AS total_free,
  SUM(paid_balance) AS total_paid,
  ROUND(100.0 * SUM(free_balance) / NULLIF(SUM(free_balance + paid_balance), 0), 1) AS free_pct
FROM point;

-- 차감 우선순위 검증 (paid 먼저 빠지는지)
SELECT type, COUNT(*), SUM(amount)
FROM point_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type;
```

## 관련 메모리

- `[[point-separation-done]]` (3 잔액 분리 도입)
- `[[money-flow-master]]`
- `[[id-unification-complete]]`

## 함정

1. **`member.point` 캐시 컬럼 어긋남** — INSERT/UPDATE 시 트리거로 합산. 트리거 정지 시 어긋남.
2. **출석 보상이 paid_balance 로** — 정책 위반. 무료 보상 → free 로.
3. **추천인 보상 적립 누락** — 가입 시 referrer_id 매칭 실패 시. 검토.
