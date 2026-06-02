# [AI 전용] 채팅 중 알림 차단 — 기술 상세

## 정책 배경

2026-05-30 사장님 결정: "채팅때는 또다른 채팅요청 말고는 모두 알리지 않는 것이 어때?"

### 검토 옵션 (당시)
- A. Home 강제 이동 → 유료 채팅 끊김 위험 (❌)
- B. 토스트 + 채팅 그대로 → 사용자 혼란 (❌)
- C. 종료 컨펌 → 한 번 더 탭 (❌)
- **D. 알림톡 자체 발송 차단 (채택)** — 앱 빌드 변경 0, 단순화

## 화이트리스트

`SmsService.IN_CHAT_PASS_THROUGH = Set(['chat_request_to_counselor'])`

→ 다른 회원의 새 채팅 요청만 통과. 그 외 모든 알림톡 drop.

## 판정 알고리즘

```typescript
async sendAlimtalkByCode(code, phone, vars, label) {
  if (!IN_CHAT_PASS_THROUGH.has(code)) {
    const inChat = await this.isPhoneInActiveChat(phone)
    if (inChat) {
      this.logger.log(`[ALIMTALK skip:in_chat] tpl=${code} phone=${phone}`)
      void this.logToAlimtalkLog(code, phone, vars, false, null, null, 'recipient_in_chat', null)
      return { ok: false, reason: 'recipient_in_chat' }
    }
  }
  // 정상 발송
}
```

## 핸들러 SQL

```sql
SELECT cr.id FROM chat_room cr
  JOIN member m ON (m.id = cr.member_id OR m.id = cr.counselor_id)
 WHERE m.phone = ?
   AND cr.status IN ('STAY', 'CNCH')
 LIMIT 1
```

→ phone 의 사용자가 회원 또는 상담사로 활성 채팅에 있는지 검사.

## 핵심 코드 위치

- 차단 로직: `api/src/user/sms/sms.service.ts:158-200`
- 헬퍼: `SmsService.isPhoneInActiveChat()`
- 화이트리스트: `SmsService.IN_CHAT_PASS_THROUGH`
- 로깅: `alimtalk_log.error_reason = 'recipient_in_chat'`

## DB 스키마

```
alimtalk_log
- template_code VARCHAR(100)
- phone VARCHAR(20)
- success BOOLEAN
- error_reason VARCHAR(50) — 'recipient_in_chat' 등
- sent_at TIMESTAMPTZ
```

## 운영 추적

```bash
# 채팅 중 차단 발생 추적
pm2 logs sajumoon-api --nostream --lines 200 | grep "skip:in_chat"

# DB 차단 통계
psql -c "SELECT template_code, COUNT(*) FROM alimtalk_log
         WHERE error_reason='recipient_in_chat'
         AND sent_at >= NOW() - INTERVAL '24 hours'
         GROUP BY template_code;"
```

## FCM 푸시 차단 (백로그)

알림톡 차단은 완료. FCM 푸시는 호출처가 여러 파일에 분산 → 도입 시 작업 큼.

도입 방법: `PushService.sendToMember(memberId, ...)` 헬퍼 신설 + 모든 푸시 호출처 통일 → 거기에 차단 분기.

## 관련 메모리

- `[[mobile-deep-link-status]]` (정책 박제)
- `[[alert-channel-policy]]` (알림 채널)
