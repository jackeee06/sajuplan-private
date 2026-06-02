# [AI 전용] BizM 알림톡 템플릿 — 기술 상세

## DB

```
alimtalk_template
- template_code VARCHAR (UNIQUE) — 코드 (예: chat_request_to_counselor)
- message TEXT — 본문 (변수 #{...} 포함)
- primary_btn_name VARCHAR
- primary_btn_url VARCHAR — 버튼 URL (sajuplan:// scheme 또는 https)
- buttons JSONB
- is_active BOOLEAN

alimtalk_log (발송 이력)
- template_code, phone, success, response_code, error_reason, sent_at
```

## 발송 API

`api/src/user/sms/sms.service.ts:sendAlimtalkByCode()`:

```typescript
async sendAlimtalkByCode(templateCode, phone, vars, smsTitle?) {
  // 1. 채팅 중 차단 검사
  // 2. alimtalk_template 조회 (is_active=true)
  // 3. 변수 치환 (#{nick} → vars.nick)
  // 4. BizM API 호출
  // 5. alimtalk_log INSERT
}
```

## 활성 템플릿 목록 (사주플랜 발신프로필)

### 회원에게
- `register_num_v2` (인증번호)
- `register_idpw_v2` (비밀번호 찾기)
- `order_payment_ok_v2` (결제 확인)
- `order_bankinfo_v2` (가상계좌)
- `qa_answer_v2` (답변 도착)
- `review_req_v2` (후기 요청)
- `chat_auto_cancelled_to_member` (자동 취소)
- `counselor_v2` (단골 상담사 접속)
- `coupon_req_v2` (쿠폰 발급)

### 상담사에게
- `chat_request_to_counselor` (채팅 요청)
- `qa_ask_v2` (질문 도착)
- `review_for_counselor_v2` (후기 알림)
- `settlement_complete` (정산 완료)
- `payout_request_received/paid/rejected` (선지급)
- `counselor_state_changed_v2` (자동 부재중)
- `counselor_request_v1` (부재 상담사 복귀 알림)

### 운영자에게
- `ops_admin_alert_v2` (운영 알림)

## 변수 치환 패턴

```
"안녕하세요 #{nick}님" + vars={nick:"홍길동"} → "안녕하세요 홍길동님"
```

→ `#{...}` 패턴 정규식 치환

## 채팅 중 차단 정책

`SmsService.IN_CHAT_PASS_THROUGH = Set(['chat_request_to_counselor'])` — 화이트리스트 외 차단

## BizM API

- URL: `https://alimtalk-api.bizmsg.kr/v2/sender/send`
- 인증: userId (사주플랜 가맹점)
- profile: BizM 발신 프로필 키
- 응답 코드:
  - K104: TemplateNotFound (검수 미통과)
  - M107: DeniedSenderNumber (발신번호 미등록)
  - 정상: code='success'

## SMS 폴백

- 알리고 SMS 폴백 (메모리 `[[alimtalk-bizm-only]]`)
- **현재 미설정** → 알림톡 실패 시 SMS 안 감

## 핵심 코드 위치

- 발송: `api/src/user/sms/sms.service.ts`
- DB: `alimtalk_template`, `alimtalk_log`
- 카탈로그: `_OPS_ALERT_CATALOG.md`

## 운영 SQL

```sql
-- 발송 실패 케이스 (최근 24시간)
SELECT template_code, error_reason, COUNT(*)
FROM alimtalk_log
WHERE success=false AND sent_at >= NOW() - INTERVAL '24 hours'
GROUP BY template_code, error_reason
ORDER BY COUNT(*) DESC;

-- 채팅 중 차단 통계
SELECT template_code, COUNT(*) FROM alimtalk_log
WHERE error_reason='recipient_in_chat'
  AND sent_at >= NOW() - INTERVAL '7 days'
GROUP BY template_code;
```

## 관련 메모리

- `[[alimtalk-bizm-only]]`
- `[[ops-alert-catalog]]`
- `[[mobile-deep-link-status]]` (scheme URL)
