# 사주플랜1 프로젝트 핵심 결정사항

> 작업 재개 시 이 문서를 먼저 확인하세요. 아키텍처/기술 스택 핵심 결정이 모여있습니다.
> 마지막 업데이트: 2026-04-27

---

## 🚨 프론트엔드: SSR (Server-Side Rendering)

**결정일**: 2026-04-27

**사용자향 페이지는 SSR로 작업합니다. SPA(CSR) 아님.**

### Why

- SEO 중요: 사주/운세/상담사 프로필 콘텐츠는 검색 노출 의존도 큼
- 초기 페이지 로딩 속도, 메타태그(OG, Twitter Card) 동적 처리
- 소셜 공유 시 미리보기 이미지/제목

### 작업 시 반드시 지킬 것

- ✅ **새 페이지/컴포넌트는 SSR 호환 패턴**으로 작성
- ✅ 서버에서 데이터 fetch → props로 내려받기
- ❌ `window`, `document`, `localStorage` 같은 브라우저 전용 API 직접 사용 금지
  - 필요하면 `useEffect` 안에서 또는 `typeof window !== 'undefined'` 가드
  - 또는 dynamic import (`{ ssr: false }`)
- ✅ 환경변수 분리: 클라이언트 노출 가능 vs 서버 전용 시크릿 명확히
- ✅ 데이터 fetch는 가능한 서버 사이드에서

### 적용 범위

| 영역 | 렌더링 방식 |
|---|---|
| **사용자향 사이트** (사주플랜 메인, 상담사 프로필, 콘텐츠) | **SSR** ⭐ |
| **Admin 페이지** ([web/mng/](web/mng/)) | **SSR 지향** (현재 React+Vite SPA → 추후 마이그레이션 검토) |
| API 백엔드 ([api/](api/)) | NestJS (REST/JSON) |

### Admin SSR 관련 메모 (2026-04-27)

- 사용자가 "admin도 SSR이면 좋긴 한데" 의향 표시
- 현재 [web/mng/](web/mng/)는 React+Vite SPA 상태이지만, 새 admin 페이지를 만들 때는 SSR 가능한 구조로 설계
- 기존 SPA 코드는 점진적 마이그레이션 검토 (Next.js 등 도입 시)
- → 결론: **새 페이지/모듈은 처음부터 SSR 호환으로**, 기존 코드는 시간 두고 이전

### 프레임워크

추후 결정 (Next.js / Remix / Nuxt / SvelteKit 등). 결정되면 이 문서 업데이트.

후보 검토 시 고려할 점:
- NestJS 백엔드와 모노레포로 같이 갈지 / 별도 프로젝트로 갈지
- Admin과 사용자향 사이트를 같은 앱으로 갈지 / 분리할지

---

## 🗄️ 백엔드 / DB

| 항목 | 값 |
|---|---|
| API 프레임워크 | NestJS 11 |
| ORM | **사용 안 함** — `postgres.js` + 태그드 템플릿 SQL |
| DB 엔진 | PostgreSQL 18.1 |
| 비밀번호 해시 | bcrypt (cost 12) |
| 외부 시스템 | 엠투넷(M2NET) — 컬럼명을 페이로드 키와 정렬 (csrid, cpid, dtmfno 등) |

### 서버 정보

| 환경 | IP | DB |
|---|---|---|
| **테스트(작업 대상)** | 172.235.211.75 | `sajumoon` (신규), `sajumoon_db` (레거시 g5_*) |
| **운영(미수정)** | 104.64.128.103 | `sajumoon_db` (라이브) |

---

## 📚 관련 문서

- [DB_REFACTOR_PROGRESS.md](DB_REFACTOR_PROGRESS.md) — DB 리팩토링 진행 상황
- [DB_SCHEMA_PLAN.md](DB_SCHEMA_PLAN.md) — DB 스키마 설계 플랜
- [api/db/migrations/](api/db/migrations/) — DDL 마이그레이션 (0001~0008)
- [api/db/scripts/](api/db/scripts/) — ETL/유틸 스크립트
