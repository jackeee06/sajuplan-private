# [AI 전용] Daily Summary cron — 기술 상세

## cron

- 파일: `api/src/cron/daily-summary.service.ts`
- 스케줄: `@Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })`

## 흐름

```typescript
async sendDailySummary() {
  const yesterday = ... // KST 어제 0:00 ~ 23:59
  const summary = await this.aggregate(yesterday)
  // {매출, 가입, 채팅, 통화, 환불, 정산 대기}

  await this.opsAlert.send('daily_summary', 'info', formatBody(summary))
}
```

## 집계 SQL

```sql
SELECT
  (SELECT SUM(amount) FROM payment WHERE status='paid' AND paid_at >= ? AND paid_at < ?) AS revenue,
  (SELECT COUNT(*) FROM member WHERE created_at >= ? AND created_at < ?) AS new_signups,
  (SELECT COUNT(*) FROM consultation WHERE type='chat' AND started_at >= ? AND started_at < ?) AS chat_count,
  ...
```

## 채팅 중 차단

`ops_admin_alert_v2` 사용 → 사장님이 채팅 중일 때 차단됨.

## 핵심 코드 위치

- cron: `api/src/cron/daily-summary.service.ts`
- 집계 헬퍼: `api/src/admin/dashboard/dashboard.service.ts`

## 함정

- 시간대 (timezone) 누락 시 UTC 기준으로 집계 → 오류
- `yesterday` 계산 오류 시 같은 데이터 반복
- 0건 발송 시 알림 안 보낼지 결정 (현재는 그래도 보냄)
