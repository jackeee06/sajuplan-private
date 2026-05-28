# 사주문 (Sajumoon)

사주·타로·신점 상담 서비스 플랫폼.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 사용자 웹 (`web/user`) | React 18 + Vite + TailwindCSS + React Router (SSR) |
| 관리자 웹 (`web/mng`) | React 18 + Vite + TailwindCSS + React Router |
| 백엔드 API (`api`) | NestJS + TypeScript + PostgreSQL |
| 디자인 시스템 | Pretendard + Lucide Icons + Tailwind |
| 인증 | JWT (HTTP-only cookie) + bcrypt |

## 디렉토리 구조

```
사주문1/
├── api/              # NestJS 백엔드 API
│   ├── src/          # 소스 (컨트롤러·서비스·엔티티)
│   ├── db/           # 마이그레이션·DB 스크립트
│   └── ecosystem.config.js  # PM2 설정
├── web/
│   ├── user/         # 사용자향 프론트엔드 (SSR)
│   └── mng/          # 관리자 프론트엔드
├── mobile/           # (예정) 모바일 앱
├── sample/           # 레거시 PHP 참조 코드
├── images/           # 디자인 아이콘·이미지 에셋
├── PLAN/             # 도메인별 구현 로드맵 (Phase 별)
├── docs/             # 설계 문서, Figma Make 프로토타입
├── tools/            # 유틸리티 스크립트
├── CLAUDE.md         # Claude 작업 지침 (퍼블리싱·디자인 규칙)
├── DB_SCHEMA_PLAN.md
├── DB_REFACTOR_PROGRESS.md
└── INSTALL.md        # 설치·셋업 가이드
```

## 프로젝트 정보

- **Figma 디자인**: https://www.figma.com/design/v9JT0ZgilboPxdXAnpH4sS/사주문_디자인
- **뷰포트**: 모바일 전용 (기준 375px, 최대 600px 가운데 정렬)
- **폰트**: Pretendard Variable (로컬 woff2)
- **컬러 키**: `#9b7af7` (primary-400)

## 개발 환경

### 백엔드 (`api/`)

```bash
cd api
npm install
cp .env.example .env       # 환경변수 설정
npm run start:dev          # 개발 서버
npm run build              # 빌드
```

### 사용자 프론트 (`web/user/`)

```bash
cd web/user
npm install
npm run dev                # 개발 서버
npm run build              # 프로덕션 빌드
```

### 관리자 프론트 (`web/mng/`)

```bash
cd web/mng
npm install
npm run dev
npm run build
```

## 주요 문서

- [`CLAUDE.md`](CLAUDE.md) — 퍼블리싱·디자인 시스템 규칙, 컴포넌트 카탈로그
- [`INSTALL.md`](INSTALL.md) — 환경 설치 가이드
- [`DB_SCHEMA_PLAN.md`](DB_SCHEMA_PLAN.md) — DB 스키마 설계
- [`DB_REFACTOR_PROGRESS.md`](DB_REFACTOR_PROGRESS.md) — DB 리팩토링 진행 상황
- [`PLAN/README.md`](PLAN/README.md) — 도메인별 구현 로드맵 인덱스

## 인증·보안

관리자 라우트는 `AdminAuthGuard` (JWT 쿠키 + bcrypt + throttler + helmet) 기반. 새 admin 라우트 추가 시 가드 부착 필수.

## 배포

- 백엔드: PM2 (`api/ecosystem.config.js`)
- 프론트: 정적 빌드 후 서버 배포
- 배포 스크립트는 별도 관리 (저장소 미포함)

### 모바일 앱 (Android / iOS)

상세 가이드: [`mobile/README.md` §9](mobile/README.md#9-release-빌드--스토어-배포)

#### Android (Google Play)

**서명 키는 이미 repo에 포함**되어 있다. 별도 다운로드/설정 불필요.

| 파일 | 위치 | 내용 |
|---|---|---|
| 키스토어 | [`mobile/android/app/key.jks`](mobile/android/app/key.jks) | 업로드 키 (Play App Signing) |
| 키 설정 | [`mobile/android/app/key.properties`](mobile/android/app/key.properties) | alias / store password / key password |

현재 키 정보 (참고용 — 노출 시 즉시 재발급 필요):

- `keyAlias` = `key`
- `storePassword` = `keyPassword` = `pCRXsYQVWFHj4hwUDstj`

빌드 명령:

```bash
cd mobile/android

# Play Console 업로드용 (권장)
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab

# 단말 직접 설치/배포용 APK
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

업로드: [Google Play Console](https://play.google.com/console) → `사주문(com.dmonster.sajumoon)` → Production/Testing → 새 버전 만들기 → `app-release.aab` 업로드.

> 버전 번호 올리는 곳 (안 올리면 Play Console 이 반려):
> - `mobile/android/app/build.gradle` 의 `versionCode` (정수, 매 빌드마다 +1) / `versionName` (예: `1.1.5`)
> - `mobile/src/appVersion.ts` 의 `APP_VERSION.android` 도 같은 값 (강제 업데이트 모달 비교 로직 기준)

#### iOS (App Store)

Mac + Xcode + Apple Developer 계정 필요. 키 정보는 Apple provisioning profile 로 관리되므로 repo 에 별도 키 없음.

```bash
cd mobile/ios
pod install
open Sajumoon.xcworkspace
```

Xcode → `Product` → `Archive` → Organizer 에서 `Distribute App` → App Store Connect 업로드.

버전 올리는 곳:
- Xcode 타겟 General 탭 또는 `mobile/ios/Sajumoon.xcodeproj/project.pbxproj` 의 `MARKETING_VERSION` (사용자 노출용) / `CURRENT_PROJECT_VERSION` (빌드번호)
- `mobile/src/appVersion.ts` 의 `APP_VERSION.ios` 도 동일하게
