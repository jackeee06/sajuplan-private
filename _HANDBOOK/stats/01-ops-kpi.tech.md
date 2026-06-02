# [AI 전용] 운영 KPI — 기술 상세

## 페이지

- `/mng/dashboard` — 종합 (일반관리자)
- `/mng/ops-kpi` — 운영 KPI 상세
- `/mng/stats` — 통계
- `/mng/profit-simulator` — 시뮬레이터 (슈퍼만)

## 핵심 SQL

```sql
-- 일 매출
SELECT SUM(amount) FROM payment
WHERE status='paid' AND paid_at >= DATE_TRUNC('day', NOW());

-- MAU
SELECT COUNT(DISTINCT member_id)
FROM (
  SELECT id AS member_id FROM member WHERE last_login_at >= NOW() - INTERVAL '30 days'
  UNION
  SELECT member_id FROM consultation WHERE started_at >= NOW() - INTERVAL '30 days'
) t;

-- 환불 비율 (월별)
SELECT
  DATE_TRUNC('month', sent_at) AS month,
  ROUND(100.0 * SUM(refund_amount) / NULLIF(SUM(payment_amount), 0), 2) AS refund_pct
FROM ... ;

-- 상담사 가동률
SELECT
  COUNT(DISTINCT counselor_id) FILTER (WHERE last_active_at >= NOW() - INTERVAL '24 hours') * 100.0
  / COUNT(*) AS active_pct
FROM member WHERE role='counselor';

-- 일별 채팅·통화 시간
SELECT DATE_TRUNC('day', started_at) AS day, type, SUM(usetm) AS total_seconds
FROM consultation
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY day, type
ORDER BY day DESC;
```

## 핵심 코드 위치

- 대시보드: `api/src/admin/dashboard/dashboard.service.ts`
- KPI: `api/src/admin/stats/stats.service.ts`
- 시뮬레이터: `api/src/admin/profit-sim/profit-sim.service.ts` (슈퍼 전용)

## 메모리

- `[[test-phase]]` (현재 단계 — 실측 의미 작음)
