# [AI 전용] iOS 알림톡 크래시 OS 분기 — 기술 상세 (2026-06-11)

## 크래시 원인 (크래시로그 .ips 로 확정)
- `-[(dynamic class) application:openURL:options:]: unrecognized selector` → NSInvalidArgumentException → SIGABRT(Abort trap:6).
- iOS 가 `sajuplan://` 를 받아 `application:openURL:options:` 델리게이트를 호출하는데, 배포 IPA 의 해당 객체에 그 메서드가 없어 abort.
- **URL 형식 무관**: `scheme_ios` 를 `sajuplan:///path`(슬래시3) ↔ `sajuplan://path`(슬래시2) 로 바꿔 실발송해도 둘 다 동일 크래시 (신호 받는 순간 죽음, path 처리 전).
- 안드로이드 정상. repo `mobile/ios/Sajumoon/AppDelegate.swift:43` 에 openURL override 있으나 RN 0.78 New Architecture 에서 호출체인 연결 안 됨 → 배포 IPA ≠ repo.

## 왜 백엔드/웹으로 못 고치나 (전부 실증)
- BizM 버튼은 카카오 승인 템플릿과 **일치 강제**: 발송 시 `scheme_ios` 를 sajuplan:// 외 값으로 바꾸면 **K108**(NoMatchedTemplateButton), 빈값이면 **K208**(MissingRequiredParameter) → 발송거부.
- 웹(https) 우회는 금지 방침("고객은 앱 안에서만 본다", 사장님 100회 강조).
- → 앱 재빌드만 근본. 그 전까지 OS 분기로 회피.

## OS 분기 발송 — `api/src/user/sms/sms.service.ts`
```ts
// 수신자 OS 판정: member_push_token.platform. ios 토큰 1개라도 있으면 'ios'(회피 우선), 없으면 'unknown'(=발송)
private getRecipientPlatform(memberId): 'ios'|'android'|'unknown'

async sendAlimtalkByCode(templateCode, rawPhone, vars, smsTitle?, opts?)
//   opts = { recipientMemberId?: number; iosSkip?: boolean }
//   iosSkip && getRecipientPlatform()==='ios' → logToAlimtalkLog(..,'ios_crash_skip') + return { ok:false, reason:'ios_crash_skip' }
//   (BizM 호출 안 함 = 실발송 0. FCM 푸시는 이 함수와 별개라 그대로 발송됨)
```

## 적용된 발송처 (opts.iosSkip = true)
| 템플릿 | 대상 | 파일 |
|---|---|---|
| `qa_answer_v2` | 고객 | qna.service.ts notifyQaAnswer (recipientMemberId = r.member_id) |
| `qa_ask_v2` | 상담사 | qna.service.ts notifyQaAsk (counselorId) |
| `chat_request_to_counselor` | 상담사 | consult.service.ts:542 (counselorId) |
| `counselor_request_v1` | 상담사 | counselors.service.ts:202 (params.counselorId) |
| `review_for_counselor_v2` | 상담사 | reviews.service.ts (counselorId) |
| `review_req_v2` | — | 발송 코드 없음(미사용) → 제외 |

## 새 템플릿 (상담신청 iOS 상담사용 — 검수 신청 2026-06-11)
- `chat_request_to_counselor_v2` / `counselor_request_v2` — **버튼 완전 없음**(순수 정보), 카테고리 "업무알림/내부 업무 알림", 본문에 "앱을 열어 확인" 안내.
- 변수: 각각 `#{상담사닉네임}` / `#{member_nickname}`.
- **검수 통과 후 TODO**: ① 우리 DB `alimtalk_template` 에 _v2 INSERT (primary_btn 없음) ② 분기를 "iOS 상담사 = skip → _v2 발송" 으로 전환. (BizM 검수통과 ≠ 우리 DB — 반드시 INSERT)

## 정책 (사장님 결정)
- 아이폰+안드 둘 다 보유 → iOS 기준(크래시 회피). OS 모름(토큰없음) → 안드(발송).
- 푸시는 절대 건드리지 않음. 임시조치 → 앱 빌드 후 제거.

## 검증 (prod 실측)
- 회원 OS: iOS 33 / 안드 284. `iOS + iosSkip → ios_crash_skip`(발송 0) PASS. alimtalk_log 에 `ios_crash_skip` 기록 확인. 안드 회원 → 발송대상 판정.
- 커밋 `2fd1c905` (GitHub 2곳 push).

## 관련
- 인수인계: `PLAN/_NEXT_SESSION_iOS크래시_알림톡임시조치.md`
- 메모리: `[[mobile-deep-link-status]]`
