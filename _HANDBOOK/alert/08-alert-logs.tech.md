# 알림 이력 & 시스템 점검 (기술)

## 화면 / 라우트

- mng: `/alert-logs` → `web/mng/src/pages/AlertLogList.tsx`
- 사이드바: 알림 > 📋 알림 이력 (`web/mng/src/components/layout/Sidebar.tsx`)
- 전체메뉴 인덱스: `AllMenus.tsx` + `MENU_TO_HANDBOOK['/alert-logs'] = 'alert/08-alert-logs'` (메뉴→바이블 deep-link)

## API

- `GET /api/admin/alert-logs?page=&limit=&template=&only_fail=1` — alimtalk_log 발송 이력 목록
- `GET /api/admin/alert-logs/health` — 현재 health-check 위반 + 실제 대상 + 테스트 판별
- 코드: `api/src/admin/alert-logs/` (controller / service / module)
- ⚠️ `alert-logs.module.ts` 는 `AdminAuthModule` import 필수 (AdminAuthGuard 의 JwtService DI — 누락 시 부팅 크래시)

## alimtalk_log 테이블

모든 알림톡 발송(성공·실패) 영구 기록. (2026-05-29 신설, 분쟁 시 "보냈다" DB 증거)

| 컬럼 | 의미 |
|---|---|
| template_code | BizM 템플릿 코드 (ops_admin_alert_v2, settlement_complete 등) |
| phone | 수신번호 |
| vars | jsonb — 치환 변수 (OpsAlert 는 `{category, at, detail}`) |
| success | 발송 성공 여부 |
| error_reason | 실패 사유 (phone_invalid, template_not_found, bizm_rejected, network_error 등) |
| response_message / raw_response | BizM 응답 |
| sent_at / caller | 발송 시각 / 호출처 |

인덱스: (phone, sent_at) / (template_code, sent_at) / 실패 partial.

## health-check

- 매시간 crontab: `0 * * * * GET /api/cron/health-check`
- 점검 코드: C-1(음수잔액) / C-8(member.point ≠ free_balance+paid_balance drift) / C-17(chat_room.settle_status='m2net_failed')
- `HEALTH_CHECK_LABEL` (`api/src/cron/daily-summary.service.ts` 의 export const) — 코드 → 사람 문장. **일일요약 + 알림이력 화면 공용**.
- 테스트 추정 판별: mb_id / roomid 가 `/e2e|dummy|test|qwerty|tkarm/i` 패턴이면 test_suspect=true.

## 일일 운영 요약 (daily-summary)

- `api/src/cron/daily-summary.service.ts` `run()` → `collect()` + `format()`
- crontab: `0 9 * * * GET /api/cron/daily-summary` (NestJS @Cron 아님 — 외부 crontab 호출)
- `OpsAlertService.send('일일 운영 요약', detail)` → template `ops_admin_alert_v2`
- **수신자**: `setting` namespace='ops' key='admin_alert.recipients' = `'01075740572,01030323004'` (사장님 + 박기수). 콤마 구분, `for (const phone of recipients)` 루프로 각자 1건씩 발송 → 로그 2건은 **2명 각 1건**(중복 아님).
- cooldown: `admin_alert.cooldown_sec` = 300 (같은 category 5분 중복 차단)

## 테스트 흔적 정리 SQL (참고)

- C-8 보정: `UPDATE member m SET point = pt.free_balance+pt.paid_balance FROM point pt WHERE pt.member_id=m.id AND m.point <> (pt.free_balance+pt.paid_balance)`
- C-17 정리: consultation 없는 m2net_failed 방 → `UPDATE chat_room SET settle_status='dropped' WHERE settle_status='m2net_failed'`

## 코드 위치

- `web/mng/src/pages/AlertLogList.tsx`
- `api/src/admin/alert-logs/{controller,service,module}.ts`
- `api/src/cron/daily-summary.service.ts` (HEALTH_CHECK_LABEL + 일일요약)
- `api/src/shared/ops-alert/ops-alert.service.ts` (OpsAlert 발송 + recipients 루프)
