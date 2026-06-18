# [AI 전용] 환불 정책 — 기술 상세

## 3가지 환불 메커니즘

### 1. G 정책 — 채팅 5초 이내 자동 환불
- 트리거: 채팅 종료 (CNCH → DISCONNECT) + use_seconds ≤ 5
- 한도: 일 2회 / 주 4회 (어뷰징 차단)
- DB: `member_chat_quick_refund_log`

### 2. 고객보호비용 — 짧은 통화 자동 환불 (`refund_status='short_call_refund'`)
- 트리거: 통화/채팅이 짧게 종료 (m2net-push 가 `shortCallRefund` 판정)
- **회원 차감 SKIP(환불)** + **상담사 earning 정상 적립** + **회사(사주플랜)가 차액 전부 부담**
- ⚠️ **2026-06-12 정정**: 예전엔 "상담사 정산 미발생"이라 했으나 **코드와 반대**다. 실제는 상담사 적립 O.
- 근거 코드: `api/src/pg-callbacks/m2net-push.service.ts` (≈L813, L824-837)
  - L813 `if (!shortCallRefund ...)` → 회원 차감 안 함
  - L824-837 `creditCounselorPointInTx(...)` → counselorId 있으면 **무조건 적립** (shortCallRefund 가드 없음)
  - 주석: "단기통화환불 시에도 상담사 적립은 정상 발생 (사장님 정책 2026-05-22 재확인)"
  - L843-849 `refunded_amount = amt`, `refund_status='short_call_refund'` 기록 (회계/m2net 청구 대조용)
- settlement-cron 은 `refund_status='full'` 만 제외, `short_call_refund` 는 제외 안 함 → 상담사 수익에 그대로 합산
- **그래서 상담사 "매출"(consultation.amt 합)에 짧은통화 금액이 잡히는 건 버그가 아니라 정상** (상담사가 실제로 번 것)
- DB: `short_call_refund` 메타 (consultation.refund_status / refunded_amount)

### ⚖️ 자동 vs 수동 환불 — 상담사 처리가 정반대 (혼동 주의)
| 환불 종류 | 회원 | 상담사 earning | 회사 |
|---|---|---|---|
| 자동 짧은통화(고객보호비용) | 환불 | **유지(적립)** | 차액 부담 |
| 관리자 수동 환불 | 환불 | **회수(차감)** | 손실 차단 |
수동 환불의 earning 회수 로직은 아래 "관리자 수동 환불 시 상담사 earning 회수" 섹션 참조.

### 3. 수동 환불 — 운영자 처리
- `/mng/refunds` 에서 등록
- 사유 입력 필수
- DB: `refund` 테이블

## 임계값

| 항목 | 값 |
|---|---|
| G 정책 (채팅) | 5초 |
| G 정책 일 한도 | 2회 |
| G 정책 주 한도 | 4회 |
| 고객보호비용 (통화) | 50초 |

## 핵심 코드 위치

### G 정책 (5초 환불)
- 발화: `api/src/pg-callbacks/m2net-push.service.ts` END_CHAT 핸들러
- 한도 검사 SQL:
```sql
-- 회원의 오늘 G 환불 카운트
SELECT COUNT(*) FROM member_chat_quick_refund_log
WHERE member_id = ? AND created_at >= DATE_TRUNC('day', NOW());

-- 회원의 이번 주 G 환불 카운트
SELECT COUNT(*) FROM member_chat_quick_refund_log
WHERE member_id = ? AND created_at >= DATE_TRUNC('week', NOW());
```

### 고객보호비용 (짧은통화 자동 환불)
- ❌ 별도 cron 없음 (`short-call-refund-cron.service.ts` 는 실재하지 않음 — 옛 문서 오류)
- 실제: `api/src/pg-callbacks/m2net-push.service.ts` 의 통화/채팅 종료 push 처리 트랜잭션 안에서 `shortCallRefund` 판정 시 즉시 처리 (회원 차감 skip + 상담사 적립 + refund_status 기록)

### 수동 환불
- 운영자: `api/src/admin/refunds/refunds.service.ts`
- API: POST `/api/admin/refunds`

## DB 스키마

```
member_chat_quick_refund_log
- id BIGSERIAL
- member_id INT FK
- chat_room_id INT FK
- refund_amount INT
- use_seconds INT
- reason VARCHAR(40)
- created_at TIMESTAMPTZ

short_call_refund
- consultation_id INT FK
- refund_amount INT
- reason VARCHAR
- created_at TIMESTAMPTZ

refund (수동 환불)
- id BIGSERIAL
- member_id, amount, reason TEXT
- admin_id INT (처리한 운영자)
- created_at TIMESTAMPTZ
```

## 운영 SQL

```sql
-- 이번 주 G 환불 다수 받은 회원 (어뷰징 의심)
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

-- 환불 비율 (월별)
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS cnt,
  SUM(refund_amount) AS total
FROM member_chat_quick_refund_log
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY month
ORDER BY month DESC;
```

## 정책 변경 시 검토

- G 정책 5초 → 30초: 어뷰징 위험 ↑. 한도 (일/주) 도 같이 강화
- G 정책 한도 변경: 정상 사용자 vs 어뷰징 균형
- 고객보호비용 50초 → 30초: 회사 비용 ↓ but 회원 클레임 ↑

## 관리자 수동 환불 시 상담사 earning 회수 (2026-06-12 fix)

**버그**: `admin/refunds/refunds.service.ts createAndApprove` 가 회원 잔액만 복원하고 `consultation.refunded_amount` 만 갱신했다. 옛 주석은 "정산 cron 이 refunded_amount 만큼 차감"이라 했으나, **2026-06-10 정산 단순화로 cron 은 earning 원장만 합산**(refunded_amount 무시)한다. 결과: 환불해준 상담도 상담사 earning 은 그대로 100% → **회사 이중손실**(회원 환불 + 상담사 지급).

**수정**: 환불 트랜잭션 안에서 상담사 earning 을 **환불 비율만큼 즉시 회수**(step 9).
```
회수액 = SUM(상담사 earning 적립분 for 이 consultation) × (이번 환불액 / 상담 총액)
       (point_history WHERE member_id=counselor AND balance_kind='earning'
        AND rel_table='consultation' AND rel_id=this AND earn_point>0)
earning_balance 차감(GREATEST 0) + point_history(balance_kind='earning', use_point,
   rel_action='refund_earning_reversal@<phId>', is_settled=false) 기록
```
- 비례·가산적이라 부분 환불 누적 안전. rel_action 에 회원 환불 history id(phId) suffix → 부분환불마다 유니크 + ON CONFLICT 멱등.
- is_settled=false 라 추후 정산 합산에 자동 반영.
- ⚠️ **알려진 한계(추천수익금)**: 추천관계가 있던 상담은 추천자(referrer)가 받은 incentive 는 이 회수에서 빠진다(상담사 gross 기준 회수라 회사는 보호됨, 추천자↔피추천자 분배 미세차만 잔존). 추천 비율 낮아 우선순위 낮음.
- 검증: 코드+타입체크. 실 상담+환불 E2E 는 외부의존(실통화)이라 미수행(카드결제 E2E 부재와 동일 한계).

## 관련 메모리

- `[[prepaid-chat-plan]]` §5 (G 정책)
- `[[money-flow-master]]`
