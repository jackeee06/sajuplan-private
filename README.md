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
