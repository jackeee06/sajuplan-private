# CLAUDE.md

이 파일은 이 리포지토리에서 Claude Code 가 작업할 때 참고할 지침입니다.

## 프로젝트 개요

사주 상담 서비스 플랫폼.

## 타깃 아키텍처

- **웹**: Next.js
- **API**: Nest.js
- **DB**: PostgreSQL
- **모바일**: React Native (WebView 기반 하이브리드)

모바일은 자체 화면을 거의 갖지 않고 Next.js 웹을 WebView 로 렌더링하는 구조로 간다. 웹/모바일 공통 UI 이슈는 웹 쪽에서 해결.

## 현재 상태

- `docs/sajumoon/` — Figma Make 로 생성된 UI 프로토타입 (Vite + React + Tailwind v4 + Radix/MUI)
- `web/`, `api/`, `mobile/` — 아직 없음. 앞으로 생성 예정.

프로토타입은 **레퍼런스 전용**. 실제 제품 코드는 Next.js + Nest.js 로 새로 작성한다. 프로토타입의 컴포넌트/로직을 그대로 옮기지 말 것 — 화면 흐름과 디자인만 참고.

## 프로토타입 관련 작업 규칙

- `docs/sajumoon/` 빌드는 `pnpm build` → `dist/index.html` 단일 파일로 출력 (vite-plugin-singlefile).
- 라우팅은 `HashRouter` 사용 (file:// 로 더블클릭 열기를 지원해야 함).
- 고객 전달용 산출물은 `dist/index.html` 한 파일만 전달. zip 으로 묶어서 전달하는 경우 파일명은 한글(`사주문.html`) 권장.

## 커밋 / 푸시 규칙

- 절대 커밋 금지 파일: 크리덴셜 (서버/DB/관리자 계정), `.env`, 개인 시트 링크.
- 리포지토리는 private 이지만 공개로 전환될 가능성을 염두에 두고 항상 credential-free 상태로 유지.

## 문서화 원칙

- 운영 접속정보, 관리자 계정, FTP/DB 비밀번호는 **절대 리포지토리 파일에 기입하지 않는다**. 필요하면 Claude Code 메모리 또는 별도 비밀 관리 도구에 둔다.
- README 는 외부 개발자/협업자가 보는 문서. CLAUDE.md 는 에이전트 행동 규칙.
