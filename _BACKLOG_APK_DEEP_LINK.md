# 📋 백로그 — APK Deep Link / Universal Links 정식 등록

> **상태**: 백로그 (운영 시작 후 정식 APK 업데이트 시 진행)
> **작성**: 2026-05-30 (사장님과의 명확한 결정 후)
> **우선순위**: 높음 (사용자 UX 핵심, 사장님 사업적 우려)
> **연결 메모리**: [[mobile-deep-link-status]] / [[mobile-app]]

---

## 🔍 증상 (2026-05-30 사장님 보고)

### 시나리오 1 — 알림톡 클릭

상담사가 받은 채팅 요청 알림톡을 클릭 → **사주플랜 사이트는 열리지만 카톡 인앱 브라우저 안** 에서 표시됨 → **로그인 화면** 노출 (= 별개 환경 = 미로그인 쿠키).

### 시나리오 2 — 앱 직접 진입

상담사가 사주플랜 앱을 직접 열기 → 이미 로그인 유지 → Home 핑크 배너 "새 채팅 요청 N건" → 클릭 → 채팅방 정상 진입.

→ **시나리오 1 이 비정상 (사업적 손실)**, 시나리오 2 가 정상.

---

## 🎯 사장님 핵심 결정 (2026-05-30)

| 항목 | 결정 |
|---|---|
| 카톡 인앱 브라우저 안 동작 | **❌ 절대 금지** ("사업을 망치는 이야기") |
| 매직 링크 (URL 토큰 자동로그인) | ❌ 카톡 브라우저 안 동작 자체가 문제 |
| 알림톡 본문에 "앱에서 열어주세요" 안내 | ❌ 상담사 불편 + 부정적 인상 |
| 푸시(FCM) 알림 추가 | ❌ 상담사들이 알림톡 선호 |
| **APK intent filter + iOS Universal Links 정식 등록** | ✅ **유일한 정답** |

→ 정상적인 앱들 (카카오/네이버/인스타) 처럼 알림톡 클릭 시 **사주플랜 앱이 자동으로 호출**되는 것이 정상.

## ⭐ 단순화 결정 (2026-05-30 사장님 + 모바일 개발자 협의)

> **"알림톡 = 앱 호출 트리거. 페이지 라우팅 / 자동 로그인 / 토큰 처리 등 모든 추가 로직 X. 앱 안 동작은 Home 배너가 처리."**

### 핵심 원칙

| 영역 | 정책 |
|---|---|
| 알림톡의 역할 | **앱을 열기만** 한다. 어떤 페이지로 갈지 정보 X |
| 앱이 열린 후 | 무조건 Home 으로 진입 (이미 로그인 유지된 쿠키 활용) |
| 사용자 안내 | 사주플랜이 이미 작업한 **Home 핑크 배너** 가 처리 (5초 polling — `_PREPAID_CHAT_POLICY.md` §15) |
| URL path 처리 | **불필요** — 모바일 개발자 작업 단순화 |
| 알림톡 8개 동작 | 모두 동일 (chat_request / qa_ask / qa_answer / review_for_counselor / counselor_request_v1 / review_req / 등) |

### 이 결정의 효과

| 영역 | 단순화 |
|---|---|
| 모바일 개발자 | URL path 라우팅 X. **단순 scheme 등록 + Linking 이벤트 받기** 만 |
| iOS Universal Links | URL path 매칭 X — `applinks:sajuplan.com` 만 등록하면 OK |
| 사주플랜 백엔드/프론트 | **변경 0** — Home 배너 이미 완성 (오늘 작업) |
| BizM 알림톡 본문 | 버튼 URL 만 단순 형태로 (`sajuplan://open` 등) |
| 사용자 학습 | "알림 받으면 앱 열림 → 배너 따라가기" 단순 패턴 |

### 사용자 흐름 (최종)

```
회원 A 가 박기수 라온선생에게 채팅 요청
  ↓
박기수 폰에 알림톡 도착
  ↓ 클릭
[모바일 개발자가 등록한 스키마로 사주플랜 앱 호출]
  ↓
사주플랜 앱이 Home 으로 진입 (이미 로그인 유지)
  ↓
Home 의 핑크 배너 "💬 새 채팅 요청 1건 → 바로가기" 즉시 노출 (5초 polling)
  ↓
박기수 배너 클릭 → /counselor/mypage/incoming 리스트
  ↓
회원 A 의 row 클릭 → /chat/{chat_room_id} 진입
  ↓
채팅 진행
```

### 작업 분담 (단순화 후)

| 작업 | 담당 |
|---|---|
| AndroidManifest 커스텀 scheme intent filter | **모바일 개발자** |
| iOS Info.plist URL scheme + Associated Domains | **모바일 개발자** |
| RN App.tsx — Linking 이벤트 받기 (앱 호출 감지만, URL 정보 처리 X) | **모바일 개발자** |
| APK / IPA 빌드 + 스토어 심사 | 모바일 개발자 / 사장님 |
| BizM 알림톡 본문의 버튼 URL 변경 (예: `sajuplan://open`) | **사장님** (BizM 콘솔) + 카카오 재검수 (1-3일) |
| **사주플랜 백엔드/프론트** | **변경 0** ✅ (Home 배너 이미 완성) |

### 폐기된 작업 (단순화로 인해)

- ~~assetlinks.json (Android Digital Asset Links)~~ — 커스텀 scheme 만 사용 시 불필요
- ~~apple-app-site-association (iOS Universal Links)~~ — 또는 단순화 (path 매핑 X)
- ~~매직 링크 (1회용 토큰 자동로그인)~~ — 완전 폐기 (카톡 브라우저 안 동작 X)
- ~~사주플랜 백엔드 신규 endpoint (`/quick/{token}`)~~ — 불필요

---

## 🔬 진짜 원인

`mobile/android/app/src/main/AndroidManifest.xml` 에 `https://sajuplan.com` URL 처리 intent filter 가 **누락**.

현재 등록된 intent filter:
- ✅ 결제 앱 스킴 (kakaopay / tosspay / payco / ispmobile 등)
- ❌ **사주플랜 자체 도메인 (sajuplan.com) — 없음**

→ Android OS 가 URL 받으면 사주플랜 앱을 호출 X → 카톡이 인앱 브라우저로 fallback.

iOS 도 동일하게 Universal Links 설정 X.

---

## 🛠 해결 — 4가지 작업

### 1. AndroidManifest.xml 에 intent filter 추가

```xml
<!-- 위치: mobile/android/app/src/main/AndroidManifest.xml — 메인 Activity 안 -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="sajuplan.com" />
</intent-filter>
<!-- 옛 도메인 호환 (선택) -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="sajumoon.co.kr" />
</intent-filter>
```

### 2. Android — Digital Asset Links 파일 (자동 검증 통과)

`autoVerify="true"` 가 작동하려면 사주플랜 서버에 `assetlinks.json` 호스팅:

```
URL: https://sajuplan.com/.well-known/assetlinks.json
```

내용:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.dmonster.sajumoon",
    "sha256_cert_fingerprints": ["<APK 서명 SHA-256>"]
  }
}]
```

→ 사장님 keystore 의 SHA-256 fingerprint 필요 (Play Console 또는 keytool 로 확인).

### 3. iOS — Universal Links

#### 3-1. `apple-app-site-association` 파일

```
URL: https://sajuplan.com/.well-known/apple-app-site-association
Content-Type: application/json (확장자 .json 없이)
```

내용:
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "<TEAM_ID>.com.dmonster.sajumoon",
      "paths": ["/counselor/chat/*", "/chat/*", "/counselor/mypage/incoming", "/"]
    }]
  }
}
```

#### 3-2. iOS Xcode — Associated Domains

`mobile/ios/...xcodeproj` 설정:
- Signing & Capabilities → Associated Domains 추가
- `applinks:sajuplan.com`

### 4. RN App.tsx — deep link URL 처리

```ts
import { Linking } from 'react-native'

useEffect(() => {
  // 앱 콜드 스타트 시 진입 URL
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url)
  })
  // 앱 실행 중 새 URL 받음
  const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))
  return () => sub.remove()
}, [])

function handleDeepLink(url: string) {
  const parsed = new URL(url)
  const path = parsed.pathname + parsed.search
  // WebView 가 그 path 로 navigate → 앱 안 쿠키로 자동 로그인 + 채팅방 진입
  webViewRef.current?.injectJavaScript(`location.href = ${JSON.stringify(path)}; true;`)
}
```

→ 앱 안 WebView 의 쿠키 (sjm_user) 가 이미 로그인 유지 → 자동 로그인 + 채팅방.

---

## ⏱ 일정 + 분담

| 단계 | 담당 | 분량 |
|---|---|---|
| AndroidManifest 4-8줄 추가 | Claude | 5분 |
| assetlinks.json 파일 작성 | Claude | 5분 |
| apple-app-site-association 파일 작성 | Claude | 5분 |
| nginx 설정 (`/.well-known/` 경로 호스팅) | Claude (서버 설정) | 10분 |
| RN App.tsx Linking 처리 | Claude | 10분 |
| **APK 서명 keystore + SHA-256 fingerprint** | **사장님** | 5분 (keytool 명령) |
| **APK 빌드 (release)** | **사장님 (Android Studio)** | 30분 |
| **Play Store 업로드 + 심사 신청** | **사장님** | 10분 + **심사 1-3일** |
| **iOS Xcode — Associated Domains 설정** | **사장님 (Mac 필요)** | 10분 |
| **IPA 빌드 + App Store 업로드** | **사장님** | 1-2시간 |
| **App Store 심사** | 자동 | **3-7일** |

---

## 🚨 운영 시작 일정 영향

| 옵션 | 흐름 |
|---|---|
| **A. APK 통과 후 운영 시작 (사장님 권장)** | Android 1-3일 + iOS 3-7일 대기. 운영 시작 시 처음부터 깨끗 |
| **B. 운영 시작 + APK 동시 진행** | 운영 시작 직후 1주 동안은 시나리오 1 (카톡 브라우저) 가능. APK 정식 출시 후 정상화 |

→ 사장님 정책 = 카톡 브라우저 안 동작 절대 X → **A 만 합리적**.

---

## ⚠️ 기존 사용자 영향

- 옛 APK 사용자 = intent filter 등록 X → 알림톡 클릭 시 여전히 카톡 브라우저
- 사용자가 Play Store / App Store 에서 새 버전 자동/수동 업데이트해야 정상화
- 운영 시작 후 신규 사용자 = 새 APK 다운로드 → 즉시 정상

→ **운영 시작 = 새 APK 출시 후** 가 가장 깔끔.

---

## 📂 관련 파일

### 코드
- [mobile/android/app/src/main/AndroidManifest.xml](mobile/android/app/src/main/AndroidManifest.xml) — intent filter 추가
- [mobile/App.tsx](mobile/App.tsx) — Linking 처리
- [mobile/ios/](mobile/ios/) — Associated Domains 설정

### 서버 (호스팅 파일)
- `/data/wwwroot/sajumoon.co.kr/.well-known/assetlinks.json` (Android)
- `/data/wwwroot/sajumoon.co.kr/.well-known/apple-app-site-association` (iOS)
- nginx 설정에서 두 경로 정적 파일 서빙 보장 (Content-Type 처리)

### 문서
- [_PREPAID_CHAT_POLICY.md](_PREPAID_CHAT_POLICY.md) §15 — 상담사 incoming 채팅 패턴

### 메모리
- [[mobile-deep-link-status]] — 이전엔 "deep link 미구현. FCM 푸시 전용" 으로 박제됨. 본 작업 후 "정식 등록 완료" 로 갱신
- [[mobile-app]] — RN WebView 셸 앱

---

## 🎯 차후 진행 시 사장님 손 작업 가이드

1. **keystore SHA-256 추출**:
   ```bash
   keytool -list -v -keystore <사주플랜.keystore> -alias <alias>
   ```
   → "SHA-256:" 줄 복사 → Claude 에 전달 → assetlinks.json 완성

2. **Apple Team ID**:
   - Apple Developer 콘솔 → Membership → Team ID 복사 → Claude 에 전달

3. **APK release 빌드 + 서명**:
   - Android Studio → Build → Generate Signed Bundle/APK
   - 또는 Gradle: `./gradlew bundleRelease`

4. **Play Store 신규 버전 업로드**:
   - Play Console → 앱 → Production → 새 버전 생성 → AAB 업로드 → 검토 신청

5. **iOS IPA 빌드 + 업로드**:
   - Mac + Xcode 필요
   - Archive → Upload to App Store Connect

---

## 📵 채팅중 알림 차단 정책 (2026-05-30 사장님 결정)

> "채팅때는 또다른 채팅요청 말고는 모두 알리지 않는 것이 어때?"

### 정책

| 알림 종류 | 채팅 중 동작 |
|---|---|
| `chat_request_to_counselor` (다른 회원의 새 채팅 요청) | ✅ **통과** (긴급 — 상담사가 다음 손님 받음) |
| 그 외 알림톡 (qa_answer, review_req, coupon 등) | ❌ drop |
| FCM 푸시 | ⏳ 백로그 (호출처 분산, 후속 작업) |
| ops_admin_alert (운영자 알림) | ❌ drop (현재 운영자 사장님 1명 — 채팅 끝나고 처리) |

### 판정 기준

`chat_room` 테이블에서 받는 사람 (member.phone) 이 `status IN ('STAY', 'CNCH')` 인 채팅방의 `member_id` 또는 `counselor_id` 면 → 채팅 중.

### 구현 (2026-05-30 완료)

`api/src/user/sms/sms.service.ts`:
- `IN_CHAT_PASS_THROUGH = new Set(['chat_request_to_counselor'])` — 화이트리스트
- `private async isPhoneInActiveChat(phone)` — chat_room JOIN member 로 판정
- `sendAlimtalkByCode` 진입부에 분기: 채팅 중 + 화이트리스트 외면 → drop + alimtalk_log 에 reason='recipient_in_chat' 기록

### 효과

- 앱 빌드 변경 0 (RN Linking 이벤트 핸들러 채팅방 감지/토스트 분기 추가 불필요)
- 채팅 진행 중 사용자 집중 보호 (유료 시간 차감 중인데 산만한 알림 X)
- 채팅 끝나고 Home 알림/마이페이지에서 인앱 확인 가능 — 정보 손실 X

### FCM 푸시 차단 백로그

푸시 호출처가 여러 파일에 분산 (consult/charge/admin 등). 알림톡 차단으로 80% 효과 달성. 푸시 차단은 운영 시작 후 사용자 피드백 보고 진행.

→ 구현 방향: `PushService.sendToMember(memberId, ...)` 헬퍼 신설 + 거기서 채팅 중 분기 → 모든 푸시 호출처를 헬퍼로 통일 (대공사).

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-30 | 최초 작성 — 사장님 보고 후 진단 + APK 정식 등록 계획 박제 |
| 2026-05-30 | 채팅중 알림 차단 정책 추가 + sms.service.ts 알림톡 차단 구현 |

---

작성: 2026-05-30 (운영 시작 후 진행 예정)
