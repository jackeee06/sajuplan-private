# 📋 백로그 — 카톡 알림톡 버튼 클릭 시 "해당 화면으로 바로 이동"

> **상태**: 대기 (앱 재빌드 필요 — 모바일 개발자 작업)
> **작성**: 2026-06-21 (실제 아이폰 라이브 테스트로 확정)
> **우선순위**: 중 (UX 개선. 기능적 대체수단=FCM 푸시 이미 있음)
> **핵심 한 줄**: 화면 이동 "엔진"은 앱에 이미 있다. **카톡 버튼 입구만 그 엔진에 연결**하면 되는데, 그 연결이 앱 코드라 **재빌드 1회** 필요하다.

---

## 사장님이 원하는 것
회원·상담사가 받은 **카카오 알림톡의 버튼**(예: "후기 확인하기")을 누르면 → **앱이 열리며 그 내용 화면(후기/문의 등)으로 바로 이동**.
(현재는 "버튼 → 푸시 알림 탭 → 화면" 2-step만 됨. 사장님은 버튼 1번으로 직행을 원함.)

---

## ✅ 오늘 실측 결과 (2026-06-21, 확정)
- **대상**: 홍루연 공동대표(선샤인선생, id 112, 01065766886) **아이폰** + 최신 앱
- **방법**: `review_for_counselor_v2` 템플릿("후기 확인하기" 버튼, 앱링크 AL, `sajuplan://counselor-mypage/reviews/345`) 1건 발송 → 버튼 클릭
- **결과**: **앱이 정상적으로 열렸으나 후기 화면이 아닌 "홈"으로 감.** (크래시 없음)

### 이 결과로 확정된 것
| 항목 | 상태 |
|---|---|
| 옛 iOS 크래시(버튼 누르면 앱 꺼짐) | ✅ **해결됨** (앱 업데이트가 고침) |
| 카톡 버튼 → 앱 호출 | ✅ 정상 (비즈엠/카톡 측 문제 아님 — 경로까지 정확히 싣고 앱 띄움) |
| 앱이 그 경로를 읽어 해당 화면으로 이동 | ❌ **미구현** → 그래서 홈으로 떨어짐 |

### 미확인 (다음에 1초 체크)
- **안드로이드**에서 같은 버튼 클릭 시 직행하는지 미테스트. 옛 문서엔 "안드는 페이지 이동 정상"이라고 돼 있어, **안드는 이미 될 가능성**이 있음. 사장님 폰(찬물선생=안드로이드)으로 같은 버튼 눌러 홈/직행만 확인하면 "iOS만 문제"인지 "둘 다"인지 판가름.

---

## 진단 — 왜 홈으로 가나
알림이 사용자에게 도달하는 **입구가 두 개**인데, 화면이동 엔진(`navigateWebView`)에 **하나만 연결**돼 있다.

| 입구 | 엔진(navigateWebView) 연결 | 결과 |
|---|---|---|
| **FCM 푸시 알림** 탭 | ✅ 연결됨 (`onNotificationOpen → extractDeepLink → navigateWebView`) | 화면 직행 |
| **카톡 버튼**(`sajuplan://` openURL) | ❌ 안 연결됨 | 홈으로 |

> 비유: 엔진(이동기능)은 있는데, "카톡 버튼" 운전대가 그 엔진에 안 물려 있다. 푸시 운전대는 물려 있음.

### 왜 서버·비즈엠·웹으로 못 고치나 (전부 검토 완료)
- **비즈엠**: 버튼은 이미 제대로 동작(경로 싣고 앱 호출). 고칠 것 없음. 버튼 스킴을 임의 변경하면 카카오 검수 거부(K108/K208).
- **웹(https 링크)**: 카톡 인앱 브라우저로 열려 로그인 화면 노출 = 사장님이 "사업 망친다"고 금지한 그 증상. → 불가.
- **서버**: 카톡 버튼이 보낸 경로는 앱 네이티브(openURL)로만 들어오고 웹/서버 층에 안 닿음 → 서버에서 못 가로챔.
- **결론**: 화면이동 처리는 **앱 코드**라서, 앱을 빌드해 배포해야만 들어간다.

---

## 🎯 해결책 (재빌드 1회, 작업량 작음)
**이미 있는 FCM 이동 엔진을 카톡 버튼 입구에도 연결**만 하면 된다. 새 기능 개발 아님.

### 모바일 개발자에게 줄 정확한 요청 (그대로 전달)
> "FCM 푸시 알림을 탭하면 `event_url`/`link` 경로로 `navigateWebView` 가 화면 이동하는데, **카카오 알림톡 버튼(`sajuplan://경로`)으로 앱이 열렸을 때도 똑같이** 그 경로를 뽑아 `navigateWebView` 로 이동시켜 주세요.
> 즉 iOS `application:openURL:options:` (그리고 RN `Linking.getInitialURL()` / `addEventListener('url')`) 에서 들어온 `sajuplan://...` 의 path 를 `extractDeepLink` 로 뽑아 `navigateWebView(path)` 호출. 안드로이드도 동일하게 확인."

### 관련 코드 위치 (모바일)
- `mobile/src/fcm.ts` — `extractDeepLink`(경로 키 우선순위 `event_url>url>link>...`), `navigateWebView` (재사용 대상)
- `mobile/App.tsx` — `navigateWebView` 호출부 (FCM 연결돼 있음)
- `mobile/ios/Sajumoon/AppDelegate.swift:43` — `application(open url:)` 존재하나 현재 path 라우팅 안 함(Naver 로그인 처리 후 super 로 흘림) → 여기서 RN Linking 으로 path 전달 필요
- 안드로이드: `mobile/android/.../AndroidManifest.xml` 에 `sajuplan` 스킴 intent-filter 가 있는지 확인 (없으면 추가)
- ⚠️ 배포된 APK/IPA 가 정답 — repo grep 만으로 단정 금지

---

## 작업 후 검증
1. 새 빌드 설치한 **아이폰 + 안드로이드** 각각에서 `review_for_counselor_v2`("후기 확인하기") 버튼 클릭 → **후기 화면 직행** 확인
2. 발송 방법(관리자): `POST /api/admin/notifications/alimtalk-test` `{template_code, phone, vars:{상담사명, url}}` (admin lee 로그인). 테스트 대상은 홍루연(아이폰)·찬물선생(안드) 등.
3. 직행 확인되면 → **사장님이 비즈엠 콘솔에서 템플릿별 버튼을 AL+정확한 화면경로로 정비 + 카카오 검수**(템플릿마다 가는 화면 다름: 후기→reviews, 문의→qnas, 답변→my-qnas…). 이 부분은 사장님 몫.

---

## 재빌드 전까지의 현재 상태
- **화면 직행 자체는 FCM 푸시 탭으로 이미 됨** (기능적 대체수단 존재). "카톡 버튼 1번"만 안 되는 것.
- iOS 크래시는 해결됐으므로 버튼 알림톡은 현재 iOS에도 정상 발송 중(`iosSkip:false`).

---

## ✅ 범위·우선순위 확정 (2026-06-21 사장님 결정)
- **대상 = 3종만**: ① 채팅요청(최우선·3분타임) ② 문의도착 ③ 새후기. (받는 사람 전부 **상담사**)
- **전화요청 제외**: counselor_request_v1 은 **부재중 상담사 호출**("지금 접속해주세요")이라 목적이 "접속해라" → 버튼 화면직행 불필요(앱 열기만으로 충분). 카톡 알림 자체만 유지. (상담사 접속 중이면 회원이 바로 전화→폰이 실제로 울림→알림 불필요)
- **쿠폰 제외**: 안 씀.
- 문의·후기는 **"보기+답변/답글"이 같은 상세 화면**(상담사 마이페이지). 후기는 상담사가 받은 후기에 답글 다는 흐름.

### URL 규칙 (사장님 결정 — "앱은 일반방식 견고하게, 수정은 서버")
- **서버가 경로를 `/`로 시작하게 통일해서 보냄** (= FCM event_url 과 동일 형식). 앱빌드 잦게 못 하니 서버가 형식 책임.
  - 채팅 `chat/{id}` → `/chat/{id}` · 후기 `counselor-mypage/reviews/{id}` → `/counselor/mypage/reviews/{id}` · 문의 `/counselor/mypage/customer-qnas/{id}`(이미 OK)
- **앱은 표준 정규화 1회**: 들어온 `sajuplan://...` 에서 scheme 떼고 `/` 하나로 맞춰 `navigateWebView`(= FCM 처리와 동일). 무엇이 와도 견고 → 경로 바뀌어도 앱 안 건드리고 서버만 수정.

## 📊 버튼 알림톡 → 화면 이동 매핑 (개발자 요청, 2026-06-21 실데이터)
> 모바일 개발자 요청: "이동 URL + 이동 명칭 + 알림톡명" 정리. 엑셀판 = **`_딥링크_알림톡_매핑.csv`** (같은 폴더, 더블클릭→엑셀).
> ⚠️ **URL은 앞으로 더 추가될 수 있음** — 새 알림톡/화면이 생기면 이 표에 한 줄씩 추가. (며칠 뒤 작업 때 같이 고민)

| 알림톡코드 | 용도 | 받는이 | 버튼명 | 타입 | 현재 url 변수(코드값) | 가야 할 앱 경로 | 이동 명칭 |
|---|---|---|---|---|---|---|---|
| chat_request_to_counselor | 채팅 상담요청 | 상담사 | 채팅응답하기 | AL | `chat/{chatRoomId}` | `/chat/{chatRoomId}` | 채팅방 |
| counselor_request_v1 | 전화 상담요청 | 상담사 | 상담요청하기 | AL | `mypage` ⚠️ | `/mypage` (재검토) | 마이페이지 |
| qa_ask_v2 | 문의 도착 | 상담사 | 문의내용 확인하기 | AL | `/counselor/mypage/customer-qnas/{qnaId}` | `/counselor/mypage/customer-qnas/{qnaId}` | 고객문의 상세 |
| qa_answer_v2 | 문의 답변 | 회원 | 답변내용 확인하기 | AL | `/mypage/my-qnas/{qnaId}` | `/mypage/my-qnas/{qnaId}` | 내 문의(답변) |
| review_for_counselor_v2 | 새 후기 | 상담사 | 후기 확인하기 | AL | `counselor-mypage/reviews/{reviewId}` ⚠️ | `/counselor/mypage/reviews/{reviewId}` | 받은 후기 상세 |
| coupon_req_v2 | 쿠폰 발급 | 회원 | 쿠폰보러가기 | **WL**(웹) | `mypage/coupons` | `/mypage/coupons` | 쿠폰함 |

**제외**: 버튼 없는 알림톡(가입인증·입금확인·정산완료·선지급·부재 등)=이동 불필요. 죽은 템플릿 `chat_counseling_v2`/`review_req_v2`=발송코드 없음.

### ⚠️ 작업 시 함정 3가지 (며칠 뒤 결정)
1. **url 변수 형식 제각각** — 후기는 `counselor-mypage/reviews/..`(하이픈·`/`없음)라 실제 앱 경로 `/counselor/mypage/reviews/..` 와 안 맞음. 일부는 leading `/` 있음. → 앱 파서가 정규화하거나, **서버 발송 코드의 url 변수를 앱 경로와 1:1로 통일**해야 함. (서버 쪽 사전정리는 Claude가 가능 — 그럼 앱은 "들어온 경로 그대로 이동"만 하면 됨)
2. **coupon_req_v2 = WL(웹링크)** — 앱 직행 아님(웹으로 열림). 앱 딥링크 원하면 AL로 변경 + 카카오 재검수.
3. **counselor_request_v1 url='mypage'** — 회원영역 경로인데 상담사 수신 → 상담사용 화면(/counselor 계열)으로 갈지 재검토.

---

## 관련 문서/메모리
- `_HANDBOOK/alert/03-fcm-push.md` (FCM 이동 구조), `_HANDBOOK/alert/07-ios-alimtalk-crash.md` (옛 크래시 원인)
- `_BACKLOG_APK_DEEP_LINK.md` (옛 백로그 — 정보 충돌/혼선 있음. 이 문서가 최신 실측 기준)
- 메모리: `[[reference_alimtalk_vs_fcm_navigation]]`, `[[project_ios_alimtalk_reenabled]]`, `[[mobile_deep_link_status]]`
