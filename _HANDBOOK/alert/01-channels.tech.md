# [AI 전용] 알림 채널 정책 — 기술 상세

## 알림 전체 구조 (발송형 / 노출형 / 시스템자동) ★

- **발송형 알림** = `notification_log`(인앱·푸시) + `alimtalk_log`(알림톡). 1회 발송 → 이력이 남음.
  - **★ 통합 알림함(2026-06-20)**: 이벤트성 알림(채팅요청·문의·후기·등급·정산·선지급·쿠폰 등)도 발송 지점에서 `InboxService.record()`(`shared/inbox/inbox.service.ts`, `@Global`)로 `notification_log` 개별행 INSERT — `code`(아이콘) + `via_push`/`via_alimtalk` 플래그(`alert/06-inapp-notifications.tech.md` 참조). 종모양이 모든 알림 단일 창구. 안읽음 카운트 `GET /user/notifications/unread-count`. 보안 제외(record 미호출): 인증번호/임시비번/OpsAlert/가상계좌. 마이그 `20260619200000_notification_inbox`.
  - **인앱·푸시 (통합 발송)**: `admin/notifications.service.ts sendPush({ target, title, content, link_url, channels:{inapp,push} })`. 한 화면("알림 보내기" = `/push-notifications` 페이지)에서 채널 선택.
    - `notification_log.via_inapp` / `via_push` 플래그로 **어느 채널로 갔는지** 기록 (마이그레이션 `20260619000000_notification_channels.sql`, 기존 행 default `t/f`).
    - `inapp=true` → `notification_log` 기록(종모양 노출). `push=true` → FCM 발사(개별=`sendToTokens`, 브로드캐스트=토픽 `chl_all`/`chl_2`/`chl_5`). 둘 중 하나 이상 필수(없으면 400).
    - **사용자 종모양** (`user/notifications.service.ts list()`): `WHERE via_inapp = true` → **푸시-only(via_inapp=false)는 종모양에서 제외**. 이벤트성 인앱 INSERT(플래그 미지정)는 default `via_inapp=true` → 정상 노출.
    - **관리자 이력**: `pushHistory({ channel:'inapp'|'push' })` 채널 필터.
  - **알림톡**: `sms.service.ts sendAlimtalkByCode()` — **BizM 승인 템플릿만**(자유 작성 불가). 수동 일괄발송 = `admin/alimtalk-bulk`, 전체 발송기록 = `alimtalk_log`(알림톡 이력 = `/alert-logs`).
- **노출형 콘텐츠** = `banner` / `popup_layer`. "발송" 아님(등록 → 노출기간 동안 게시). 관리자 직접 CRUD. 메뉴 = **콘텐츠/노출** 그룹(알림 그룹 아님 — 용도 다름).
- **🤖 시스템 자동 알림** = 코드가 상황 따라 자동 표시 — `MaintenanceBanner`(점검) / `FavoriteCounselorBanner`(단골 접속) / `CounselorIncomingBanner`(채팅요청) / 채팅 5분 알림 / 출석·등급 토스트. **관리 화면 없음** → 변경은 코드(개발팀).
- 검증 영구 스펙: `e2e/tests/109-notification-channels.spec.ts` (채널 조합·엣지·이력필터·종모양제외·UI).

## 채널별 모듈

| 채널 | 모듈 | 외부 의존 |
|---|---|---|
| 알림톡 | `api/src/user/sms/sms.service.ts` | BizM API |
| 인앱·푸시 통합발송 | `api/src/admin/notifications/notifications.service.ts` `sendPush` | DB + Firebase |
| FCM 푸시 | `api/src/shared/push/push.service.ts` | Firebase Admin SDK |

## 카탈로그

`alertCatalog.ts` (살아있는 문서, 메모리 `[[alert-system-complete]]`):
- 38이벤트 × 3채널 매핑
- 가이드 페이지: `/mng/alert-guide`

## 채널 정책 (메모리 `[[alert-channel-policy]]`)

- 알림톡 = 외부 도달용 (메인)
- 인앱 = 능동 진입자용
- 푸시 = 거의 안 씀 (상담사들이 알림톡 선호)
- 마케팅성 = rejected

## 채팅 중 차단 (메모리 `[[mobile-deep-link-status]]`)

```
sendAlimtalkByCode(code, phone, ...) {
  if (code !== 'chat_request_to_counselor' && isPhoneInActiveChat(phone)) {
    return { skip: 'recipient_in_chat' }
  }
}
```

→ FCM 푸시 차단은 백로그 (호출처 분산)

## 핵심 코드 위치

- 카탈로그: `api/src/shared/alerts/alertCatalog.ts`
- 가이드 페이지: `/mng/alert-guide` (mng)
- 운영 정책: `_OPS_ALERT_CATALOG.md`

## 관련 메모리

- `[[alert-system-complete]]`
- `[[alert-channel-policy]]`
- `[[alert-mapping]]`
- `[[mobile-deep-link-status]]` (채팅 중 차단)
