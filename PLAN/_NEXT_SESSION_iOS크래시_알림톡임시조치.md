# 🔴 iOS 앱 크래시 + 알림톡 OS별 분기 임시조치 (인수인계)

> 작성: 2026-06-11 · 이 문서 하나로 작업을 정확히 이어받는다. 긴 대화 다시 읽지 말 것.
> 사장님 성향: 방향 묻지 말고 자율. 위험 작업만 확인. 코드 세부는 안 궁금(구경하는 입장).

---

## 0. 한 줄 요약

**iOS 앱이 카카오 알림톡의 `sajuplan://` 버튼을 받으면 즉시 크래시(앱 강제종료)한다.**
앱 재빌드(App Store 심사) 전까지, **백엔드에서 iOS 사용자에게만 알림톡을 skip 하거나 "버튼 없는 새 템플릿"으로 대체 발송**하는 임시조치를 넣는다. (안드로이드는 정상이라 그대로)

---

## 1. 근본 원인 (크래시 로그로 100% 확정)

iOS 단말의 크래시 로그(`.ips`) 2건(아침 9:16 제보 + 11:20 테스트) **동일 원인**:

```
"-[(dynamic class) application:openURL:options:]: unrecognized selector sent to instance"
name: NSInvalidArgumentException → abort() → SIGABRT (Abort trap: 6)
```

- iOS가 `sajuplan://` 를 받아 앱을 열며 **`application:openURL:options:`** 델리게이트를 호출하는데,
  배포된 iOS 앱의 그 객체에 **해당 메서드가 없어서**(unrecognized selector) **앱이 스스로 abort**.
- **URL 형식과 무관** — `scheme_ios` 를 `sajuplan:///mypage`(슬래시3) → `sajuplan://mypage`(슬래시2)로
  바꿔 실제 발송 테스트했으나 **둘 다 동일 크래시**. (신호를 "받는 순간" 죽으므로 URL 내용은 처리도 안 됨)
- **안드로이드는 완전 정상** (앱 켜지고 정확한 페이지 이동).
- repo `mobile/ios/Sajumoon/AppDelegate.swift:43` 에 openURL override 가 **있긴 함** → RN 0.78
  New Architecture 에서 호출 체인에 연결이 안 돼 "(dynamic class)"로 빗나가는 것으로 추정.
  배포 IPA 는 repo 와 다른 빌드 → 크래시 코드는 그 바이너리 안.

## 2. 왜 백엔드/웹으로는 못 고치나 (전부 실증)

| 시도 | 결과 |
|---|---|
| `scheme_ios` 슬래시 제거 | 동일 크래시 (URL 무관) |
| `scheme_ios` = https 웹링크 | ❌ **사장님 절대 금지** — "고객은 무조건 앱 안에서 본다. 웹브라우저로 보는 일은 비즈니스가 망해도 없다" |
| `scheme_ios` = 빈 값 | BizM **K208** (AL 버튼 필수값 누락) 발송거부 |
| `scheme_ios` = 더미 scheme | BizM **K108** (승인 템플릿 버튼과 불일치) 발송거부 |

**결론: BizM 알림톡 버튼은 "카카오가 승인한 그 주소(`sajuplan://`)"와 일치해야만 발송된다.**
우리가 발송 코드에서 iOS 주소만 바꾸는 건 불가능. → **앱을 고치거나, 카카오에 새 템플릿을 등록**하는 수밖에 없다.

## 3. 근본 해결 (앱 — 별도 트랙, Mac 필요)

- iOS 앱의 `application:openURL:options:` 를 New Arch 에서 제대로 연결 → 재빌드 → App Store 심사(보통 1~2일).
- **빌드는 Mac + Xcode 필수**(윈도우 불가). 사장님 Mac 가용 여부 미확정.
- 앱이 고쳐지면 아래 임시조치는 **전부 제거하고 원래대로 통일**한다.

---

## 4. 채택한 임시조치 (현재 진행 중)

### 4-1. BizM 새 템플릿 2개 — **2026-06-11 검수 신청 완료** (승인까지 1~2일)

iOS 상담사가 "상담신청"을 **크래시 없이** 알림톡으로 받기 위한 **버튼 없는(순수 정보) 템플릿**.
기존 템플릿은 **그대로 두고**(안드용 + 앱 업데이트 후 복귀용), iOS 상담사에게만 새 템플릿 발송.

| 새 코드 | 대체 대상(기존) | 버튼 | 카테고리 |
|---|---|---|---|
| `chat_request_to_counselor_v2` | `chat_request_to_counselor` (채팅 상담 요청) | **없음** | 업무알림 / 내부 업무 알림 |
| `counselor_request_v2` | `counselor_request_v1` (상담 요청) | **없음** | 업무알림 / 내부 업무 알림 |

**본문 (검수 신청된 내용 그대로):**

`chat_request_to_counselor_v2` (변수 `#{상담사닉네임}`):
```
[ 사주플랜 ] 채팅 상담 요청

#{상담사닉네임} 선생님께 새로운 채팅 상담이 들어왔어요.

3분 안에 채팅방으로 입장하지 않으시면
해당 요청은 자동으로 종료됩니다.

▶ 사주플랜 앱을 열어 채팅방에 입장해주세요.

- 사주플랜
```

`counselor_request_v2` (변수 `#{member_nickname}`):
```
[사주플랜 상담요청]

상담 요청이 도착했습니다.

고객: #{member_nickname}

지금 접속해서 상담을 시작해주세요.

▶ 사주플랜 앱을 열어 확인해주세요.

- 사주플랜
```

### 4-2. 백엔드 OS 분기 발송 — ✅ **1단계 구현·배포·검증 완료 (2026-06-11)** / 2단계(상담신청 `_v2`)는 검수 후

> **완료**: `sms.service` 에 `getRecipientPlatform()` + `sendAlimtalkByCode(... , opts{recipientMemberId, iosSkip})`
> 추가 → iOS 수신자면 `ios_crash_skip` 으로 발송 차단(푸시는 별개라 유지). 5개 발송처 적용
> (qa_answer·qa_ask·chat_request·counselor_request·review_for_counselor. `review_req`는 미발송).
> **검증(prod 실측)**: iOS 33/안드 284. iOS+iosSkip→`ios_crash_skip`(발송0) PASS, alimtalk_log 기록 확인, 안드→발송대상.
> **2단계 남음**: 검수 통과 후 `chat_request`/`counselor_request` 의 iOS 처리를 `skip → _v2 발송`으로 전환(아래 §6 검수통과 후).

운영 중인 `sajuplan://` AL 템플릿 = **6개**. (`chat_counseling_v2` 는 옛 템플릿, 코드 미사용 → 제외)
각각 iOS 처리 정책:

| 템플릿 | 받는 사람 | FCM 푸시 | iOS 처리 |
|---|---|---|---|
| `chat_request_to_counselor` | 상담사 | ✅ | **검수 전: skip(푸시로)** → **검수 후: `_v2` 발송** |
| `counselor_request_v1` | 상담사 | ✅ | **검수 전: skip(푸시로)** → **검수 후: `_v2` 발송** |
| `qa_ask_v2` (문의 도착) | 상담사 | ✅ | **iOS skip** (푸시로 받음, 긴급 아님) |
| `qa_answer_v2` (답변) | **고객** | ❌ | **iOS skip** (가장 불만 많던 케이스 — 1순위) |
| `review_for_counselor_v2` (후기) | 상담사 | ❌ | **iOS skip** (긴급 아님) |
| `review_req_v2` (후기작성) | 고객 | ❌ | **iOS skip** (긴급 아님) |

> 핵심: **상담신청(채팅·상담 요청) 2개만** 새 템플릿으로 알림톡을 살리고, 나머지 4개는 iOS skip.
> 모든 경우 **FCM 푸시는 그대로 유지**(상담사 진입로 + 안전망).

---

## 5. OS 식별 + 정책 (사장님 결정 — 2026-06-11)

- **OS 식별 근거**: `member_push_token.platform` (값 `'ios'` / `'android'`). 앱이 FCM 토큰 등록 시 함께 보냄
  (`api/src/user/auth/auth.controller.ts` `POST /push-token`).
- **한 사람이 아이폰+안드 둘 다 보유** → **아이폰 기준**(크래시 회피 최우선. 안드 미수신 손실 < 크래시).
- **앱 미설치 / OS 모름(토큰 없음)** → **기존(안드)대로 발송**.
- 이 분기는 **임시** — 앱 업데이트 후 제거하고 원복.

---

## 6. 백엔드 작업 TODO (다음 세션이 이어서)

1. **OS 식별 헬퍼**: `getRecipientPlatform(memberId)` → `'ios' | 'android' | 'unknown'`
   (해당 회원/상담사의 `member_push_token` 조회. iOS 토큰 1개라도 있으면 `'ios'`.)
2. **분기 발송 지점**: `sms.service.ts sendAlimtalkByCode` 에 옵션 추가하거나, 각 발송처에서 분기.
   - iOS + skip 대상 → 발송 안 함 (`logToAlimtalkLog` 에 `recipient_ios_skip` 사유 기록)
   - iOS + 대체 템플릿 대상 → `_v2` 발송 (검수 통과 후)
   - 안드/unknown → 기존 그대로
3. **발송처**(참고): `qa_answer`/`qa_ask` = `qna.service.ts`,
   `chat_request_to_counselor` = `consult.service.ts:542`,
   `counselor_request_v1` = `counselors.service.ts:202`,
   `review_*` = `reviews.service.ts`.
4. **"채팅중 알림 차단" 정합성**: `sms.service.ts IN_CHAT_PASS_THROUGH` 화이트리스트에
   새 채팅요청(`chat_request_to_counselor_v2`)도 포함시킬 것.
5. **푸시는 절대 건드리지 말 것** (알림톡만 skip).

### 검수 통과 후 (사장님이 "승인됐다" 알리면)

1. **우리 DB `alimtalk_template` 에 `_v2` 2개 INSERT** (본문·`primary_btn_*` = NULL/없음).
   - ⚠️ `sendAlimtalkByCode` 는 **우리 DB**에서 본문을 읽는다. BizM 검수통과 ≠ 우리 DB. 반드시 INSERT.
   - `_INFRA_LOCKED.md` / `health-check.service.ts:414 AL_TEMPLATES` 와 정합성 확인(새 코드는 버튼 없으니 AL 검증 대상 아님).
2. 분기에서 `chat_request_to_counselor`/`counselor_request_v1` 의 iOS 처리를 **skip → `_v2` 발송**으로 전환.
3. 발송 테스트(prod, 일회성 스크립트 = NestFactory `createApplicationContext` + `SmsService` 직접 호출.
   임시 발송 스크립트 패턴은 이 세션 기록 참조. 대상은 Spicygirl member id 112).

### 반려 시
- 카카오 반려 사유 확인 → 본문/카테고리 조정 후 재신청. (버튼 없는 정보성은 보통 통과)

---

## 7. 현재 코드 상태 (2026-06-11 기준, 배포 완료)

- `sms.service.ts` AL 버튼: `scheme_android = scheme_ios = sajuplan://#{url}` (**원복 상태**, 발송 정상).
  - 실험(슬래시/빈값/더미/https) 다 롤백됨. 관련 경위 주석 보존됨.
- `qna.service.ts notifyQaAnswer`: **iOS 고객 skip 적용 완료(2026-06-11 배포)** → iOS 크래시 0.
  안드만 발송(버튼 정상). 본문 `#{문의링크}` 는 빈값 복구(안드는 버튼으로 진입).
- **6개 발송처 중 5곳에 `iosSkip` 적용·배포·검증 완료**. iOS 회원(33명) 크래시 알림톡 발송 0.
  남은 것은 §6 "검수 통과 후" (상담신청 2개를 `_v2` 알림톡으로 복구).
- **미커밋**: 이 세션 변경분 커밋 안 됨. 사장님 "커밋해" 시 진행(post-commit hook → GitHub 2곳 push).

## 8. 앱 업데이트 완료 후 원복 (미래)

- 앱 openURL 수정 + 스토어 반영 확인되면:
  1. 백엔드 OS 분기 로직 제거 (skip / `_v2` 분기 삭제).
  2. 모든 상담사/고객에게 **기존 템플릿 하나로 통일** 발송.
  3. `_v2` 템플릿은 보존하거나 정리(재사용 가능성 고려).

---

## 9. 관련 메모리/문서

- 메모리 `project_mobile_deep_link_status` (앱 이동 = 푸시/FCM 방식 / iOS 크래시 확정)
- `_INFRA_LOCKED.md` (BizM AL 템플릿 계약값 — 임의 변경 금지)
- `feedback_e2e_strict_verification` / `reference_jwt_sub_string_compare` 등 메모리 인덱스 참조
