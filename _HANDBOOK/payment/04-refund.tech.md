# [AI 전용] 환불 정책 — 기술 상세

## 3가지 환불 메커니즘

### 1. G 정책 — 채팅 5초 이내 자동 환불
- 트리거: 채팅 종료 (CNCH → DISCONNECT) + use_seconds ≤ 5
- 한도: 일 2회 / 주 4회 (어뷰징 차단)
- DB: `member_chat_quick_refund_log`

### 2. 고객보호비용 — 통화 50초 이내
- 트리거: 통화 종료 (consultation.usetm ≤ 50)
- 회원 환불 + 상담사 정산 미발생 + 회사가 m2net 통화료 흡수
- DB: `short_call_refund`

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

### 고객보호비용
- cron: `api/src/cron/short-call-refund-cron.service.ts` (또는 m2net-push 직접)
- 매분 또는 push 트리거 시 처리

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

## 관련 메모리

- `[[prepaid-chat-plan]]` §5 (G 정책)
- `[[money-flow-master]]`
