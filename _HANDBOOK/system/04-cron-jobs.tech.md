# [AI 전용] cron 잡 전수 — 기술 상세

## 주요 cron

| 잡 | 주기 | 코드 |
|---|---|---|
| `autoCancelStaleChats` | 매분 | `api/src/user/consult/consult.service.ts:547-595` |
| `retryPaymentM2netSync` | 10분 | `api/src/cron/retry-cron.service.ts` |
| `scanFiveMinAlerts` | 매분 | `api/src/user/chat/chat.service.ts:scanFiveMinAlerts` |
| `counselorAutoAbsent` | 1시간 | `api/src/cron/counselor-auto-absent.service.ts` |
| `settlementCron` | 매월 말 | `api/src/cron/settlement-cron.service.ts` |
| `dailySummary` | 매일 09:00 | `api/src/cron/daily-summary.service.ts` |
| `healthCheck` | 5분 | `api/src/cron/health-check.service.ts` |

## NestJS Schedule

- `@nestjs/schedule` 패키지
- `@Cron('* * * * *')` 데코레이터
- pm2 fork mode 단일 인스턴스 → 동시 실행 충돌 없음

## 등록

`api/src/cron/cron.module.ts` + `cron.controller.ts` (수동 트리거 endpoint 도 있음)

## 운영 추적

```bash
pm2 logs sajumoon-api --nostream --lines 200 | grep -iE "cron|scheduled"

# 특정 cron
pm2 logs sajumoon-api --nostream | grep autoCancelStaleChats
```

## 함정

- pm2 reload 시 매분 cron 한 번 누락 가능
- cluster mode 전환 시 동시 실행 락 필요 (현재 fork mode 라 없음)
- 시간대 (KST) 누락 시 UTC 기준 → 시각 어긋남

## 관련 메모리

- `[[cron-jobs]]` (없으면 신규)
