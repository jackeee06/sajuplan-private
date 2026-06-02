# [AI 전용] 운영 알림 (OpsAlert) — 기술 상세

## 카탈로그 (28종)

상세 박제: `_OPS_ALERT_CATALOG.md`

카테고리:
- 결제·정산 (12종)
- 채팅·통화 (5종)
- 시스템 (7종)
- 회원 운영 (4종)

## 발송 흐름

```typescript
// api/src/shared/ops-alert/ops-alert.service.ts
async send(category, level, detail) {
  // level: 'info' | 'warning' | 'critical'
  // 운영자 (사장님) phone 으로 알림톡 ops_admin_alert_v2 발송
  // 인앱 알림 (선택)
}
```

## 알림톡 템플릿

`ops_admin_alert_v2`:
```
[사주플랜 운영 알림]
유형: #{category}
시각: #{at}
#{detail}
```

## 채팅 중 차단 정책

`ops_admin_alert_v2` 도 화이트리스트 외 차단:
- 사장님이 채팅 중일 때 운영 알림도 drop
- 채팅 끝나고 인앱에서 확인 가능

→ 운영자 1명 (사장님) 일 때 정책. 여러 명 되면 재검토.

## 핵심 코드 위치

- 서비스: `api/src/shared/ops-alert/ops-alert.service.ts`
- 카탈로그: `_OPS_ALERT_CATALOG.md`
- daily-summary cron: `api/src/cron/daily-summary.service.ts`

## 운영 SQL

```sql
-- 최근 24시간 OpsAlert 발송
SELECT
  vars->>'category' AS category,
  COUNT(*)
FROM alimtalk_log
WHERE template_code='ops_admin_alert_v2'
  AND sent_at >= NOW() - INTERVAL '24 hours'
GROUP BY category;
```

## 관련 메모리

- `[[ops-alert-catalog]]` (28종 전수)
