# [AI 전용] 알림톡 일괄 발송 — 기술 상세

## 모듈

- 페이지: `/mng/alimtalk-bulk`
- API: `api/src/admin/alimtalk-bulk/alimtalk-bulk.service.ts`
- 발송 헬퍼: `sms.service.ts:sendAlimtalkByCode()` 반복

## 흐름

```typescript
async bulkSend(adminId, templateCode, targetMembers, vars) {
  const results = []
  for (const member of targetMembers) {
    const r = await this.sms.sendAlimtalkByCode(templateCode, member.phone, vars)
    results.push({ member_id: member.id, ...r })
  }
  // alimtalk_bulk_log INSERT (요약)
  return { success_count, fail_count, total }
}
```

## 채팅 중 차단 정책

각 회원 발송 시 `sendAlimtalkByCode` 안에서 자동 검사 → 채팅 중이면 drop (`error_reason='recipient_in_chat'`).

## 대용량 처리

10만+ 발송 시:
- 1000명씩 배치 분할 권장
- 진행률 표시
- 중간 중단 가능

## 핵심 코드 위치

- 서비스: `api/src/admin/alimtalk-bulk/alimtalk-bulk.service.ts`
- 페이지: `web/mng/src/pages/AlimtalkBulk.tsx`

## DB

```
alimtalk_bulk_log (대량 발송 추적)
- id, admin_id, template_code, target_count, success_count, fail_count, created_at
```

## 운영 SQL

```sql
-- 일괄 발송 이력
SELECT created_at, admin_id, template_code, target_count, success_count, fail_count
FROM alimtalk_bulk_log
ORDER BY created_at DESC LIMIT 20;
```

## 비용 추정

- BizM 알림톡 건당 약 7원
- 1만명 발송 = 약 70,000원

## 관련 메모리

- `[[alert-channel-policy]]` (마케팅 거부 정책)
