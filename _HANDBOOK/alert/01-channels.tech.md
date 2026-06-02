# [AI 전용] 알림 채널 정책 — 기술 상세

## 채널별 모듈

| 채널 | 모듈 | 외부 의존 |
|---|---|---|
| 알림톡 | `api/src/user/sms/sms.service.ts` | BizM API |
| 인앱 알림 | `api/src/admin/notifications/notifications.service.ts` | DB only |
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
