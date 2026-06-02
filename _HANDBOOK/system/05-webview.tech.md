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

### 4. APK Deep Link (scheme intent filter)
- `sajuplan://` scheme 등록 필요
- 알림톡 클릭 → 앱 자동 호출
- 현재 진행 중 (`_BACKLOG_APK_DEEP_LINK.md`)

## 메모리 박제

- `[[mobile-app]]` (RN WebView 셸 정보)
- `[[webview-external-url]]` (외부 URL 처리)
- `[[webview-cache-policy-change]]` (캐시 갱신 지연)
- `[[mobile-deep-link-status]]` (scheme + 채팅 중 차단)

## 핵심 코드 위치

- 외부 URL: `web/user/src/lib/openExternalUrl.ts`
- 캐시 버스트: `web/user/vite.config.ts`
- visibilitychange/blur: `web/user/src/pages/ChatRoom.tsx:660-720`
- mobile/ 폴더: RN 앱 코드

## 함정

- WebView 환경에서 표준 모바일 브라우저와 다른 동작 (visibilitychange, target="_blank" 등)
- 캐시로 인한 디버깅 어려움 — "내 화면은 정상인데 사용자만 옛 동작"
