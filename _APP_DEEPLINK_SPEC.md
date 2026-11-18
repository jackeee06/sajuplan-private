# 사주플랜 앱 딥링크 설계서 — 웹링크 클릭 → 앱 열기 + 상세페이지 이동 (2026-06-25)

> 목적: 카톡 카드/검색결과/문자 등으로 받은 **상담사 웹링크(`https://sajuplan.com/counselors/123`)** 를
> 눌렀을 때 ① 앱 설치자는 **앱이 열리며 해당 상담사 상세로 바로 이동**, ② 미설치자는 **앱 설치 유도**.
> SEO(OG 카드) 작업의 후속. 강제 아님 — "앱으로 보기" 부드러운 유도가 원칙.

---

## 0. 한 줄 결론

**가능하다.** 딥링크는 타고나는 기능이 아니라 추가하는 설정이고, 우리 앱은 부품을 절반 갖고 있다
(① 앱이 *남의* 앱을 딥링크로 호출 중 — `Linking.openURL` + AndroidManifest queries, ② 앱 내 화면이동 엔진
`navigateWebView` 가 FCM 푸시에서 작동 중). **빠진 건 "외부 링크 → 우리 앱"으로 들어오는 입구 하나뿐.**

---

## 1. 현재 상태 (코드 확인값 — 2026-06-25)

| 항목 | 상태 | 근거 |
|---|---|---|
| 앱 식별자 | `com.dmonster.sajumoon` (iOS·Android 공통) | ios pbxproj / android build.gradle |
| WebView 셸 앱 | O — `source={{uri: APP_CONFIG.webUrl}}` 로 sajuplan.com 로드 | mobile/App.tsx |
| 화면이동 엔진 `navigateWebView(url)` | O — 웹뷰에 JS 주입해 해당 경로로 이동. **FCM 푸시에서 이미 사용** | App.tsx:239, :290 |
| 아웃바운드 딥링크(남의 앱 호출) | O — 결제 등에서 `Linking.openURL(scheme://...)`, 미설치 시 스토어 폴백 | App.tsx:685~699 |
| **인바운드 딥링크(우리 앱 열기)** | **X — 없음** | Universal/App Links·커스텀스킴 미등록, `Linking.getInitialURL`/`'url'` 리스너 없음 |
| iOS Associated Domains | X | Info.plist 에 applinks 없음 (kakao/naver SDK 콜백 스킴만 존재) |
| Android applink intent-filter | X | Manifest 의 scheme 들은 전부 `<queries>`(호출용), 우리 앱 수신 intent-filter 아님 |

> 즉 지금은 sajuplan.com 링크를 누르면 **무조건 브라우저로만** 열린다. 앱은 호출되지 않는다.

---

## 2. 아키텍처 (4겹)

```
[카톡/문자/검색결과의 https://sajuplan.com/counselors/123 클릭]
        │
        ├─(A) 앱 설치 + Universal Link(iOS)/App Link(안드) 동작 → 앱 열림 → navigateWebView('/counselors/123')
        │
        ├─(B) 카톡 내부 브라우저 등 유니버설링크 무시 환경
        │        → 스마트 랜딩(/open.html)이 커스텀스킴 sajuplan://counselors/123 시도
        │        → 성공: 앱 열림 / 실패(미설치): 1.5s 후 스토어로
        │
        └─(C) 미설치 → 스토어 설치 → 첫 실행
                 v1: 홈 착지(허용) / 정밀: deferred 토큰으로 원래 페이지 복원
```

- **(A) Universal Links(iOS) / App Links(Android)**: `https://sajuplan.com/...` 링크를 OS가 앱으로 연결. 가장 깔끔. 단 **카톡 인앱브라우저에선 자주 무시됨**(한국 고질).
- **(B) 커스텀 스킴 `sajuplan://` + 스마트 랜딩 페이지**: 카톡 등 까다로운 환경의 안전망. 기존 `pi.html`/`coupon-og` 랜딩 패턴 재사용.
- **(C) Deferred(설치 후 정확 페이지)**: 난이도 높은 20%. v1은 홈 착지로 타협. 정밀 필요 시 서버 토큰 또는 Branch.io.

---

## 3. 구체적 변경 (파일별)

### 3-1. iOS (앱 재빌드)
- `mobile/ios/Sajumoon/Sajumoon.entitlements` 에 Associated Domains 추가:
  ```
  applinks:sajuplan.com
  ```
- `Info.plist` 에 커스텀 스킴 추가(카톡 폴백용):
  ```xml
  <key>CFBundleURLTypes</key> ... <key>CFBundleURLSchemes</key><array><string>sajuplan</string></array>
  ```
- Xcode → Signing & Capabilities → Associated Domains 체크.

### 3-2. Android (앱 재빌드)
- `AndroidManifest.xml` 의 메인 액티비티에 intent-filter 2개 추가:
  ```xml
  <!-- App Link (https, 자동검증) -->
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https" android:host="sajuplan.com"/>
  </intent-filter>
  <!-- 커스텀 스킴 (카톡 폴백) -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="sajuplan"/>
  </intent-filter>
  ```

### 3-3. 서버 — 도메인 인증 파일 2개 (코드변경 X, `_put_prod_file.py` 로 즉시 배치)
prod 루트 `/data/wwwroot/sajumoon.co.kr/` 에:
- `/.well-known/apple-app-site-association` (확장자·Content-Type application/json, **JSON**):
  ```json
  { "applinks": { "apps": [], "details": [
    { "appID": "<TEAMID>.com.dmonster.sajumoon",
      "paths": [ "/counselors/*", "/mypage/notices/*", "/mypage/events/*", "/" ] } ] } }
  ```
- `/.well-known/assetlinks.json`:
  ```json
  [{ "relation": ["delegate_permission/common.handle_all_urls"],
     "target": { "namespace": "android_app", "package_name": "com.dmonster.sajumoon",
                 "sha256_cert_fingerprints": ["<릴리즈 서명 SHA256>"] } }]
  ```
  > nginx 가 `.well-known` 을 SPA fallback/봇분기보다 먼저 정적 서빙하도록 location 1줄 확인 필요.

### 3-4. 앱 인바운드 수신부 (mobile/App.tsx — 짧은 추가)
- 콜드스타트: `Linking.getInitialURL()` → 경로 추출 → 최초 `webUrl` 을 그 경로로 로드
- 실행 중: `Linking.addEventListener('url', e => navigateWebView(toPath(e.url)))`
- `toPath()`: `https://sajuplan.com/counselors/123` 또는 `sajuplan://counselors/123` → `/counselors/123` 정규화
- **도착지 로직(navigateWebView)은 이미 있으므로 신규 코드는 "입구→경로변환→호출" 뿐.**

### 3-5. 스마트 랜딩 페이지 (선택, 카톡 안전망) — `web/user/public/open.html`
- `?to=/counselors/123` 받아서: 커스텀스킴 시도 → 1.5s 후 미반응이면 스토어로. iOS/안드 분기.
- 카톡 공유 카드의 link 를 이 랜딩으로 돌릴지(=항상 앱유도) vs 직접 상세로 둘지(=웹우선)는 **정책 선택**(아래 6번).

---

## 4. 카톡 인앱브라우저 우회 (중요)
- 카톡 내부 브라우저는 Universal/App Link 를 자주 무시 → (A)만으론 카톡에서 앱이 안 열릴 수 있음.
- 안전망: 페이지에 **"앱으로 보기" 버튼** 노출 → 누르면 커스텀스킴 시도 + 스토어 폴백(B).
- 과거 이력: 카카오 SDK 공유/`navigator.share` 가 안드 카톡에서 앱설치로 빠지거나 실패 → 순수 텍스트 링크가 가장 안전(메모리 [[project-owner-promoter-invite]]). 딥링크도 동일 보수 기조로 폴백 필수.

---

## 5. 미설치 → 설치 → 페이지 (deferred)
- **v1(권장)**: 설치 후 첫 실행은 **홈 착지**. 단순·안전. 대부분 서비스의 현실적 기본값.
- **정밀(후순위)**: 랜딩에서 의도경로를 서버에 토큰 저장 → 설치 후 앱 첫 실행이 디바이스 신호로 토큰 조회해 복원. 또는 Branch.io(유료/외부 의존) 도입. 비용·복잡도 대비 효과 판단 필요.

---

## 6. 정책 결정 포인트 (사장님 판단 필요)
1. **카톡 카드 링크 목적지**: (a) 상세 URL 직접(웹 우선, SEO 자산 보존) + 페이지 안에서 "앱으로 보기" 배너 / (b) 항상 `open.html` 경유(앱 유도 최대화, 단 웹 첫인상 한 박자 느려짐). → **권장 (a)**.
2. **강제 여부**: 전원 강제 앱열기는 비권장(방금 만든 웹 유입 자산 훼손). 부드러운 배너 권장.
3. **deferred 정밀도**: v1 홈 착지 수용 여부.

---

## 7. 외부 입력 필요 (코드 외)
- **애플 Team ID** (AASA 의 `<TEAMID>`) — Apple Developer 계정에서 확인.
- **안드 릴리즈 서명 SHA256 지문** (assetlinks 의 fingerprint) — 릴리즈 keystore 에서 `keytool` 로 추출 (Play 앱서명 사용 시 Play Console 값).
- 앱 재빌드 + 스토어 제출/심사(애플 며칠~1주, 구글 수시간~1일).

---

## 8. 검증
- 서버 인증파일: `curl https://sajuplan.com/.well-known/apple-app-site-association` (200·application/json), assetlinks 동일.
- 안드 App Link 검증: `adb shell pm verify-app-links --re-verify com.dmonster.sajumoon` / `am start -W -a android.intent.action.VIEW -d "https://sajuplan.com/counselors/123"`.
- iOS: 메모/문자에 링크 넣고 길게눌러 "사주플랜에서 열기" 확인.
- **E2E 한계**: 딥링크 OS 동작은 Playwright(웹)로 검증 불가 → 실기기 수동. 웹의 "앱으로 보기" 배너 노출/링크만 E2E 커버.

---

## 9. 단계별 롤아웃
1. 서버 `.well-known` 2파일 배치 + nginx location 확인 (코드변경 없음, 즉시).
2. 웹: 상세페이지에 "앱으로 보기" 배너 + `open.html` 랜딩 추가, 배포·E2E.
3. 앱: entitlements/Manifest + App.tsx 수신부 추가 → 재빌드 → 내부테스트(실기기) → 스토어 제출.
4. 카톡/검색결과에서 실링크 클릭 → 앱 열림·이동 실기기 확인 → 바이블 반영.

> 백로그 [[project-kakao-button-deeplink-backlog]](_BACKLOG_카톡버튼_화면이동.md) 의 "카톡버튼→화면이동, 앱재빌드 대기" 와 동일 재빌드 사이클 → **합본 처리 권장.**

---

## 10. 리스크 / 되돌리기
- 인증파일·intent-filter 추가는 **기존 동작에 무해**(새 입구만 추가). 문제 시 `.well-known` 파일 제거 = 즉시 비활성.
- App Link 자동검증 실패해도 커스텀스킴(B)이 폴백 → 완전 먹통 방지.
- 머니크리티컬 코드 무관(결제 스킴 호출부는 그대로 둠).
