# [AI 전용] 출석 보상 — 기술 상세

## 처리 흐름

```typescript
async checkIn(memberId) {
  const today = await this.sql`SELECT 1 FROM attendance WHERE member_id=${memberId} AND DATE(created_at, 'Asia/Seoul') = DATE(NOW(), 'Asia/Seoul')`
  if (today.length) throw new BadRequestException('이미 출석')

  // 보상 금액 (설정값 또는 연속 출석 보너스)
  const reward = await this.getRewardAmount(memberId)

  await this.sql.begin(async (tx) => {
    await tx`INSERT INTO attendance (member_id, reward, created_at) VALUES (${memberId}, ${reward}, NOW())`
    await tx`UPDATE point SET free_balance = free_balance + ${reward} WHERE member_id=${memberId}`
    await tx`INSERT INTO point_history (member_id, amount, type, reason) VALUES (${memberId}, ${reward}, 'attendance', 'daily_check_in')`
  })

  return { reward }
}
```

## 연속 출석 보너스 (옵션)

`getRewardAmount(memberId)`:
1. 어제 출석 row 있으면 streak 카운트
2. 7일 연속 / 30일 연속 등 임계값 도달 시 추가 보너스

→ 운영자가 설정한 정책 따름.

## DB 스키마

```
attendance
- id BIGSERIAL
- member_id INT FK
- reward INT
- streak INT (연속 출석 카운트)
- created_at TIMESTAMPTZ

attendance_settings (운영자 설정)
- daily_reward INT
- streak_7_bonus INT
- streak_30_bonus INT
```

## 핵심 코드 위치

- 회원: `api/src/user/attendance/attendance.service.ts`
- 운영자: `api/src/admin/attendance/attendance.service.ts`

## 운영 SQL

```sql
-- 일별 출석률
SELECT DATE_TRUNC('day', created_at) AS day, COUNT(DISTINCT member_id) AS unique_checkins
FROM attendance
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY day ORDER BY day DESC;

-- 회원별 누적 출석
SELECT member_id, COUNT(*) AS total, MAX(streak) AS max_streak
FROM attendance
GROUP BY member_id
ORDER BY total DESC LIMIT 50;
```

## 관련 메모리

- `[[coin-system]]` (무료 코인 정책)
