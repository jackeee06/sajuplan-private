# [AI 전용] RN WebView - 기술 상세

## 셸 구조

- 사주플랜 앱 = React Native WebView 셸
- 내부: 사주플랜 웹 사이트 (web/user) 로딩
- 네이티브 기능 (push, deep link, scheme) 는 RN 측

## 주요 특이점

### 1. 외부 URL 처리
- `web/user/src/lib/openExternalUrl.ts`
- `target="_blank"` 동작 X
- 도메인 자동 감지 → 사주플랜 도메인은 WebView 내부, 외부는 RN Linking.openURL

### 2. 캐시 정책
- WebView 가 옛 번들 캐시 가능
- `cacheBustPlugin` (vite.config.ts) — `?v=APP_VERSION` 쿼리
- 메모리 `[[webview-cache-policy-change]]`: 정책 변경 후 일부 사용자 옛 동작 가능

### 3. visibilitychange 미발화 가능
- RN WebView 네이티브 처리 의존
- 안전망: `blur` / `focus` 이벤트도 등록 (2026-05-30)

### 4. 앱 화면 이동 = 푸시/FCM 이동 방식 — 안드로이드·iOS 모두 정상 등록·구현
- 카카오 알림톡 클릭 시 앱 이동 = **푸시/FCM 이동 방식**. 푸시 탭 → 핸들러 → `navigateWebView(url)` (mobile/src/fcm.ts, App.tsx). 안드로이드·iOS 둘 다 동일 기능으로 등록·구현됨 (정상). 앱이 꺼져 있어도 켜지고 정확한 페이지로 이동.
- BizM 설정(`sajuplan://#{url}`)·백엔드·서버·사주플랜 코드 = 변경 0 (정상). 안드로이드가 정상이므로 BizM/서버 문제 아님. **BizM·서버 변경 불필요.**
- 일부 아이폰 에러 제보는 iOS 기능 자체는 등록돼 있으므로 **그 단말의 앱 미설치/구버전 등 환경 가능성** (단정 금지).

### 5. 웹 개방 (2026-06-21) — 일반 브라우저 허용 ★현재 상태
- **`WebAppGate.tsx` 상단 `const WEB_OPEN = true`** → `shouldGate()` 첫 줄에서 항상 `false` 반환 = **게이트 미노출**. 브라우저(PC·모바일)도 사이트 정상 노출.
- **웹·앱 = 같은 서버·DB·계정** (앱=WebView 셸). 웹 가입→앱 로그인 정상, 웹 결제→코인 계정 충전→앱 사용. 기기 종속은 FCM 푸시 토큰뿐(브라우저 미지원). 인증=`sjm_user` JWT 쿠키(웹·앱 각자 세션, 같은 계정).
- **되돌리기**: `WEB_OPEN=false` 후 `_patch_frontend_fast.py user` 재배포 → 아래 옛 게이트 로직 부활.
- ⚠️ 옛 게이트(2026-06-12~06-21, 코드 보존, `WEB_OPEN=false`일 때만 동작):
- `shouldGate()` = `true` 일 때만 전체화면(`data-testid="web-app-gate"`) 노출. **통과(게이트 안 띄움) 조건**:
  - `isNativeApp()` (앱 WebView, `native-bridge.ts`)
  - `navigator.webdriver` (Playwright 등 자동화 → 기존 E2E 무영향)
  - `localStorage.__allow_web__ === '1'` (운영자 수동 점검)
- `detectOS()` (UA) 로 분기: `other`(PC) → `QRCodeSVG`(qrcode.react) 2개 / `android`·`ios` → 스토어 `<a>` 버튼.
- 스토어 URL: `appVersionApi.get()` → `GET /api/app/version` (setting namespace='app', 강제업데이트와 동일 출처). 실패 시 폴백 상수 `FALLBACK_AOS`(play.google…id=com.dmonster.sajumoon) / `FALLBACK_IOS`(apps.apple.com/kr/app/id6761353255).
- 앱 아이콘 이미지 `/img/android-chrome-512x512.png`.
- 검증: `e2e/tests/76-web-app-gate.spec.ts` (webdriver 통과 / webdriver=false PC→QR2개+깨진이미지0 / 안드로이드UA→탭버튼 / SajumoonBridge.isNative→통과).

### 6. 웹에서 되는 기능 — 상담·결제 코드 흐름 (2026-06-25 확인)
앱 전용 게이팅 없음(`ConsultModal.tsx`·`Charge.tsx`에 `isNativeApp` 분기 0) + `WEB_OPEN=true` → 브라우저에서도 동작.
- **전화상담**: `consultApi.phone(id, 'prepaid'|'postpaid')` → `phone_number`(070 m2net 가상번호) → `window.location.href = 'tel:'+번호` (`ConsultModal.tsx:149-153`). 모바일=다이얼러 / PC=`tel:` 무시 가능. 후불 탭은 `POSTPAID_ENABLED=false`로 숨김(060 미계약).
- **채팅상담**: `consultApi.chat(id, minutes)` → `navigate('/chat/:room', { wss_url, member_token, roomid })` (`ConsultModal.tsx:154-172`). 실시간=WebSocket(`wss_url`). 선결제=상담사 입장 시 선택분×단가 차감(_PREPAID_CHAT_POLICY).
- **결제(충전)**: 일반결제 `chargeApi.prepare` → AG9 form auto-submit → PG → returnurl `/charge/complete`. 사주플랜페이 `chargeApi.autopayCharge`(빌링키) → `/charge/complete?oid=`. 카드 미등록 시 `/mypage/charge/card-register` (`Charge.tsx`). isNativeApp 분기 없음 → 웹·앱 동일.
- **앱 우위(기기 종속)**: incoming 채팅요청 **FCM 푸시**(브라우저 미지원) · PC **전화 다이얼러**. 그 외는 웹·앱 동일.

## 메모리 박제

- `[[mobile-app]]` (RN WebView 셸 정보)
- `[[webview-external-url]]` (외부 URL 처리)
- `[[webview-cache-policy-change]]` (캐시 갱신 지연)
- `[[mobile-deep-link-status]]` (앱 이동=푸시/FCM 이동 방식 / 안드로이드·iOS 모두 정상 등록)

## 핵심 코드 위치

- 외부 URL: `web/user/src/lib/openExternalUrl.ts`
- 캐시 버스트: `web/user/vite.config.ts`
- visibilitychange/blur: `web/user/src/pages/ChatRoom.tsx:660-720`
- mobile/ 폴더: RN 앱 코드

## 함정

- WebView 환경에서 표준 모바일 브라우저와 다른 동작 (visibilitychange, target="_blank" 등)
- 캐시로 인한 디버깅 어려움 — "내 화면은 정상인데 사용자만 옛 동작"
