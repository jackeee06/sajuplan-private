# [AI 전용] 외부 서비스 협의 — 기술 상세

## 상세 의존성 박제

- `_AUDIT_PHASE_D_EXTERNAL_DEPS.md` 전체 검토
- 메모리 `[[money-flow-master]]`

## 각 서비스별 핵심 정보

### m2net (PassCall)
- 가맹점 CPID: 0047
- API 호스트: passcall.co.kr:25205
- 클라이언트: `api/src/shared/m2net/m2net.service.ts`
- push 핸들러: `api/src/pg-callbacks/m2net-push.service.ts`
- 외부 의존성: 회원·상담사 등록 phone, 단가, 가상번호, wss 토큰
- **사고**: `[[pg-m2net-double-fill]]` (이중 적립)

### AG9 (PG)
- 가맹점 정보: 사장님 영업담당
- 클라이언트: `api/src/shared/ag9/ag9.service.ts`
- callback: `api/src/pg-callbacks/ag9-callback.controller.ts`
- 카드 / 가상계좌 / 간편결제 / 빌링키 (자동충전)
- **사고**: `req_result=27` (옛 빌링키 잔존)

### BizM (비즈엠)
- 발신 프로필 (사주플랜)
- 클라이언트: `api/src/user/sms/sms.service.ts:sendAlimtalkByCode()`
- API: `https://alimtalk-api.bizmsg.kr/v2/sender/send`
- **사고**: K104 TemplateNotFound, M107 DeniedSenderNumber
- 메모리 `[[alimtalk-bizm-only]]`

### Firebase FCM
- 서비스 계정 JSON
- 클라이언트: `api/src/shared/push/push.service.ts`
- 거의 안 씀 (메모리 `[[fcm-push-system]]`)

## 환경 변수

```
.env
- BIZM_USER_ID
- BIZM_PROFILE_KEY
- BIZM_TPL_SIGNUP_AUTH
- ALIGO_USER_ID / ALIGO_KEY / ALIGO_SENDER (폴백, 미설정)
- FCM_CREDENTIALS_PATH 또는 GOOGLE_APPLICATION_CREDENTIALS
- AG9_* (PG 키들)
- M2NET_* (m2net 키들)
```

## 자동 정정 안전망

- `retryPaymentM2netSync` cron (10분) — 옛 m2net 동기화 실패 재시도
- m2net END_CHAT push 시 `syncM2netBalanceForMember` 강제

## 관련 메모리

- `[[money-flow-master]]`
- `[[pg-m2net-double-fill]]`
- `[[alimtalk-bizm-only]]`
- `[[fcm-push-system]]`
- `[[autopay-handoff]]`
