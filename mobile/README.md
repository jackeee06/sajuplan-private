# Sajumoon Mobile (React Native WebView Shell)

`https://sajumoon.kr` 을 감싸는 React Native WebView 앱. Android / iOS 동시 빌드.

- Stack: **React Native 0.78.1** · TypeScript · `react-native-webview` 13
- 구조: `mobile/` 자체가 RN 루트
- 정책: 단일 WebView 셸. 네이티브 화면은 추가하지 않음. 모든 UI는 웹에서.

---

## 1. 첫 설치

> **JDK 17 이상 필수.** JDK 18은 macOS의 한글 경로(NFD/NFC 정규화 차이)에서
> D8 dexer가 깨진다. JDK 21(예: Android Studio 의 JBR) 또는 17 사용을 권장.
>
> ```sh
> export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
> export PATH="$JAVA_HOME/bin:$PATH"
> ```

```bash
cd mobile
npm install
# iOS는 추가로
cd ios && pod install && cd ..
```

> 의존성은 `package.json`에만 잡혀있고 `npm install` 은 아직 실행 안 됨.
> `react-native-config`, `react-native-image-picker`, `react-native-permissions`,
> `react-native-safe-area-context`, `react-native-webview` 가 설치된다.

### react-native-config 추가 설정 (필요 시점에)

`.env` 의 `WEB_URL` 을 빌드에 주입하려면:

- **Android** — `android/app/build.gradle` 최상단에 추가
  ```gradle
  apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
  ```
- **iOS** — Xcode에서 `Sajumoon` 타겟 → Build Phases → New Run Script Phase
  ```sh
  "${PODS_ROOT}/../.xcode.env" 2>/dev/null
  "${SRCROOT}/../node_modules/react-native-config/ios/ReactNativeConfig/BuildDotenvConfig.ruby.sh"
  ```

설치 안 해도 앱은 동작한다 — `src/config.ts` 의 `DEFAULT_WEB_URL` 로 폴백된다.

---

## 2. 실행

```bash
# Metro
npm start

# Android (에뮬레이터/디바이스 연결 후)
npm run android

# iOS
npm run ios
```

---

## 3. URL 변경

하드코딩하지 않는다. 두 가지 경로:

1. **`.env`** — `WEB_URL=https://staging.sajumoon.kr`
2. **`src/config.ts`** 의 `DEFAULT_WEB_URL` — `.env` 가 비었을 때 사용되는 폴백

운영/스테이징 분리 필요해지면 `.env.production` / `.env.staging` 추가하고 RN 빌드 스크립트로 주입.

---

## 4. 백키 처리 (Android)

**페이지별 동작은 웹쪽이 결정한다.** 네이티브는 백키 이벤트만 전달한다.

### 흐름

1. 사용자 백키 → 네이티브가 web 으로 `BACK_PRESSED` postMessage 전송
2. 웹이 등록한 핸들러 실행 → `true` 반환 시 web 이 직접 처리 (네이티브 noop)
3. 웹이 `false` 반환 / 핸들러 미등록 / 120ms 응답 없음 → 네이티브 fallback
   - `BACK_TO_HOME_PATHS` (현재 `/login`) 매칭 시 → WebView 리마운트로 홈
   - WebView 히스토리 있으면 → `webView.goBack()`
   - 루트면 → "앱을 종료하시겠어요?" 다이얼로그

iOS 는 하드웨어 백키가 없으니 `allowsBackForwardNavigationGestures` 로 좌측 스와이프 백 동작.

### 웹쪽 연동 (페이지별 백키 컨트롤)

`SajumoonBridge.isNative` 가 `true` 일 때만 네이티브 환경. 페이지가 자기 자신 책임으로 백키를 처리하려면:

```js
// 앱 진입 시 한 번만 등록 (라우터 변경 시 재등록 가능 — 마지막 등록만 유효)
window.SajumoonBridge?.onBackPressed?.(({path, url}) => {
  // 로그인 → 홈
  if (path === '/login') {
    window.location.replace('/');
    return true; // 처리됨, 네이티브는 noop
  }
  // 모달 열려있으면 모달 닫기
  if (document.querySelector('.modal.is-open')) {
    closeModal();
    return true;
  }
  // 그 외엔 네이티브 디폴트(브라우저 history.back / 종료 다이얼로그)
  return false;
});
```

핸들러 시그니처:
- 인자: `{ url: string, path: string }`
- 반환: `boolean`
  - `true` → 핸들링 완료, 네이티브는 아무것도 안 함
  - `false` → 네이티브가 디폴트 동작

핸들러를 등록하지 않으면 네이티브 fallback 만 동작하므로, 안드로이드에서 `/login` 백키는 자동으로 홈으로 가지만 다른 페이지의 커스텀 동작이 필요하면 위 API로 등록해야 한다.

---

## 5. 이미지 업로드

두 경로를 모두 지원:

### A. 웹 표준 `<input type="file">`

- iOS: 기본 동작. Info.plist 의 `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` 으로 권한 다이얼로그 자동 노출.
- Android: `AndroidManifest.xml` 에 `CAMERA`, `READ_MEDIA_IMAGES`, 33↓ 호환용 `READ_EXTERNAL_STORAGE` 설정됨. `react-native-webview` 가 `onShowFileChooser` 를 처리한다.
- **Android에서 카메라 캡처가 필요하면** `<input type="file" accept="image/*" capture="environment">` 사용.

### B. 네이티브 브리지 (postMessage) — A가 안 먹는 단말 대비

웹쪽에서:

```js
// 브리지 준비 여부
if (window.SajumoonBridge?.isNative) {
  // 카메라 / 갤러리 선택 (auto = 다이얼로그)
  const result = await window.SajumoonBridge.pickImage('auto');
  // result: { uri, mime, fileName, width, height, fileSize }

  // 이후 서버 업로드
  const form = new FormData();
  form.append('file', {
    uri: result.uri,
    name: result.fileName ?? 'photo.jpg',
    type: result.mime,
  });
  await fetch('/api/upload', { method: 'POST', body: form });
}
```

서버는 일반 multipart 업로드와 동일하게 받으면 된다. 서버 응답으로 저장 경로 / 이미지 URL 만 돌려주면 웹 쪽에서 미리보기·폼 값 세팅이 끝난다.

브리지 메시지 타입은 [`src/bridge.ts`](src/bridge.ts) 참조.

---

## 6. 패키지/번들 식별자

| 플랫폼 | 현재 | 변경 위치 |
|---|---|---|
| Android | `com.dmonster.sajumoon` | `android/app/build.gradle` (`namespace`, `applicationId`) + `MainActivity.kt`/`MainApplication.kt` 의 패키지 |
| iOS | `com.dmonster.sajumoon` | Xcode → Signing & Capabilities → Bundle Identifier 또는 `ios/Sajumoon.xcodeproj/project.pbxproj` 의 `PRODUCT_BUNDLE_IDENTIFIER` |

**스토어 등록 전에 반드시 둘 다 정식값으로 변경**.

---

## 7. 알려진 함정 (한글 프로젝트 경로)

이 프로젝트는 경로에 한글(`사주문1/`)이 포함되어 있어 두 가지 함정이 있다.

### 7-1. D8 dexer 가 NFD/NFC 차이로 깨짐

증상: `ERROR: D8: ... is located outside the root directory ...`
원인: macOS 파일시스템은 NFD, JDK 18 은 NFC 로 정규화 → 같은 파일을 다른 경로로 봄.
해결: **JDK 17 또는 21 사용**(Android Studio JBR). 위 1번 항목 참조.

### 7-2. Metro 의 `/status` 엔드포인트가 500을 뱉음

증상: 앱에서 `Unable to load script. Make sure you're either running 'npx react-native start' or that your bundle is packaged correctly`
원인: Metro 가 `X-React-Native-Project-Root` 헤더에 `process.cwd()` 를 그대로 넣는데, HTTP 헤더는 ASCII 만 허용 → 한글 경로면 `ERR_INVALID_CHAR` 로 500. 클라이언트는 Metro 가 죽었다고 판단.
임시 패치: `node_modules/@react-native-community/cli-server-api/build/statusPageMiddleware.js` 의 `process.cwd()` → `encodeURI(process.cwd())` 로 교체.
영구화: `npx patch-package @react-native-community/cli-server-api` 로 패치 파일 생성 후 `postinstall` 스크립트 추가하면 `npm install` 후에도 유지된다.

## 8. 아직 안 한 것 / TODO

- [ ] 앱 아이콘 (`android/app/src/main/res/mipmap-*` / `ios/Sajumoon/Images.xcassets/AppIcon.appiconset/`)
- [ ] 스플래시 화면 (`react-native-splash-screen` 추후 추가 예정)
- [ ] 푸시 알림 (FCM/APNs — 사주문1 PUSH_TOPIC 정책에 따라 차후 연결)
- [ ] iOS 번들 ID 정식값으로 변경
- [ ] 화면 회전 정책 (현재 default — 모바일 온리 정책에 맞춰 portrait 잠금 검토)
- [ ] 빌드 환경 분리 (.env.production / .env.staging)

---

## 9. 디렉토리 개요

```
mobile/
├─ App.tsx                  # WebView 셸 + 백키 + 브리지
├─ index.js                 # 엔트리
├─ src/
│  ├─ config.ts             # WEB_URL/상수 (env → 폴백)
│  ├─ bridge.ts             # Web↔Native 메시지 프로토콜
│  └─ useImagePicker.ts     # 카메라/갤러리 호출 래퍼
├─ android/                 # 네이티브 안드로이드
├─ ios/                     # 네이티브 iOS
└─ .env / .env.example      # WEB_URL 환경변수
```
