# [AI 전용] 알림톡 일괄 발송 — 기술 상세

## 모듈

- 페이지: `web/mng/src/pages/AlimtalkBulk.tsx` (`/mng/alimtalk-bulk`)
- API: `api/src/admin/alimtalk-bulk/alimtalk-bulk.service.ts` (+ controller)
- 발송 헬퍼: `sms.service.ts:sendAlimtalkByCode()` 반복

## UX 개편 (2026-06-25) — "BizM 작동방식을 관리자 언어로 번역"

관리자가 template_code·JSON·`#{변수}` 같은 개발 용어에 막히던 화면을 4단계로 재구성:
1. **템플릿** — 암호 코드 드롭다운 → 한글 이름 카드 택일. `TEMPLATE_META`(코드→한글 라벨·설명·대상그룹·autoOnly), 회원/상담사/운영자 그룹 + 검색. `autoOnly` 템플릿엔 "🔒 자동 전용" 배지 + 선택 시 중복발송 경고.
2. **빈칸 채우기** — JSON 텍스트박스 제거. 본문에서 `#{변수}` 정규식 추출 → 변수별 라벨 입력칸 자동 생성(`VAR_LABEL` 한글 매핑) + 글자수 카운터 + **실시간 미리보기**(카톡 말풍선). 변수 없으면 영역 숨김.
3. **받는 사람** — 기본 `골라서 보내기`(이름·아이디 회원검색 → 칩, `/admin/members?q=` 재사용). 번호 직접 입력은 [고급] 토글로 보존.
4. **테스트 후 발송** — 나에게 테스트 1건(`target=phones` 단건) + 발송 전 대상수·예상비용(건당 7원)·미리보기 confirm.

> 회원검색 발송은 전화번호를 프론트로 내려보내지 않음 — **`member_ids`만 전송, 서버가 phone 해석**(PII 보호, 마스킹 정책 일관).

## 흐름

```typescript
// target: 'all_members' | 'all_counselors' | 'members'(member_ids) | 'phones'
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
