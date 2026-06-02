# [AI 전용] 자동 부재중 전환 — 기술 상세

## cron

- 파일: `api/src/cron/counselor-auto-absent.service.ts` (또는 cron.controller.ts inline)
- 스케줄: 매 1시간 (`@Cron('0 * * * *')`)
- 조건: `member.role='counselor' AND last_active_at < NOW() - INTERVAL '24 hours' AND absent_status=false`
- 처리: `member.absent_status=true` + 알림톡 + OpsAlert

## DB

```
member
- absent_status BOOLEAN DEFAULT false
- last_active_at TIMESTAMPTZ
```

## last_active_at 갱신 시점

- 상담사가 채팅·통화 응답
- 상담사가 incoming 리스트 진입
- 상담사가 마이페이지 진입

## 자동 활성 복귀

채팅 응답 / 통화 응답 등 트리거 시:
```typescript
await this.sql`UPDATE member SET absent_status=false, last_active_at=NOW() WHERE id=${counselorId}`
```

## 알림톡

- 상담사 본인: `counselor_state_changed_v2` ("자동 부재중 전환")
- 운영자: `ops_admin_alert_v2` (유형='counselor_auto_absent')

## 핵심 코드 위치

- cron: `api/src/cron/...`
- last_active_at 갱신: 여러 곳 (auth.service login, chat.service answer, etc.)
- OpsAlert: `api/src/shared/ops-alert/ops-alert.service.ts` `counselor_auto_absent`

## 운영 SQL

```sql
-- 현재 부재중 상담사
SELECT id, mb_id, nickname, last_active_at,
       NOW() - last_active_at AS inactive_duration
FROM member
WHERE role='counselor' AND absent_status=true
ORDER BY last_active_at;

-- 자동 부재중 ↔ 활성 빈도 (잦은 상담사)
SELECT counselor_id, COUNT(*) FROM counselor_state_history
WHERE state_change='auto_absent' AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY counselor_id ORDER BY COUNT(*) DESC;
```

## 관련 메모리

- `[[ops-alert-catalog]]` (counselor_auto_absent 알림)
