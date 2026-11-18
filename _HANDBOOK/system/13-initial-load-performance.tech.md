# [AI 전용] 초기 로딩 속도 최적화 — 기술 상세

## 진단 (2026-06-25)
- **서버/DB 무관**: prod localhost `curl 127.0.0.1:3001` 측정 — stats/main 4.3ms, counselors?limit=300 4.7ms, reviews 5.2ms. `uptime` load 0.00, pm2 cpu 0.3%. 해외(개발자 PC)에서 측정한 1~2초는 매 호출 새 TLS 핸드셰이크 + 한국까지 RTT 누적 잡음 → **측정 착시. 진단은 서버 localhost 또는 한국망 기준으로.**
- **진짜 원인**: 홈 첫 화면 상담사 카드 수 = 프로필 이미지 동시 로드 수. `web/user/src/pages/Home.tsx` `COUNSELOR_INITIAL` 을 2026-06-23 에 20→30 으로 올린 것이 "2~3일 전부터 느려짐"의 직접 원인. (활성 상담사 ~32명, list API 자체는 20KB·4.7ms 로 가벼움 — 데이터가 아니라 이미지 개수가 비용.)
- 카드 이미지: webp 우선(`UploadedImage` = `<picture><source webp><img></picture>`), webp ~29KB / 원본 png ~616KB. JS 번들은 nginx gzip 적용(1.5MB→~400KB 전송).

## 적용 완료(①②④, 배포·검증됨)
- **① 카드 이미지 lazy**: `web/user/src/components/CounselorCard.tsx` 의 `<UploadedImage>` 에 `loading="lazy" decoding="async" width={100} height={100}`.
  - ⚠️ `UploadedImage` 컴포넌트 자체에 lazy 기본값을 넣지 말 것 — 홈 배너/히어로 첫 슬라이드는 `fetchPriority="high"` LCP 후보라 lazy 되면 LCP 퇴행. **호출부(카드)에서만** 지정.
- **② `COUNSELOR_INITIAL` 30→12** (`Home.tsx`). 나머지는 "더보기" 누적 패턴 유지. list fetch 는 그대로(limit 300→실제 ~32), 렌더 슬라이스만 12.
- **④ 업로드 webp `maxDimension:1280`**: `convertImageToWebp(file.path, { maxDimension:1280, quality:80 })` — `auth.controller`(회원프로필) / `admin/members`(상담사) / `admin/banners` / `admin/events` / `admin/popup-layers` / `admin/notices`. `image-to-webp.ts` 는 이미 maxDimension 지원(호출부가 안 넘기던 것). 기존 webp 29KB라 충분 → **재인코딩 backfill 안 함**(원본 fallback 은 비-webp 구형기기만, 비중 작음). `_patch_api.py` FILES 에 banners/events/popup-layers/notices 추가(auth/members 는 기존 등록).
- 검증: prod 실측(홈 12장·lazy 12·크래시0) + E2E `02·07·28·114` 16/16.

## ✅ ③ 라우트 코드분할 = 완료·배포(2026-06-25). 진짜 원인 = cache-bust `?v` 가 .js 중복 로드.
**결과**: `App.tsx` 전 페이지 동적 import(데이터 라우터 + `React.lazy`) → 초기 JS **1,554,880B → 331,148B**(약 79%). 초기 진입(Home) = index 95KB + router 206KB + Home 30KB. editor 784KB·85페이지 청크는 lazy 분리(초기 로드 제외). **부수효과(복리)**: 신규 페이지 자동 분리 → 번들 영구 비대화 차단.

### 🔑 진짜 근본 원인 (오래 헤맨 지점 — 박제)
크래시(`useAuth must be used inside <AuthProvider>` + `removeChild`)의 범인은 **react-router 가 아니라 `vite.config.ts` 의 `cacheBustPlugin`** 이었다.
- 플러그인이 index.html 의 `<script>/<link>` 에 `?v=v3` 를 붙였다 → 엔트리/ modulepreload 가 `index-xxx.js?v=v3`.
- 그런데 **코드분할된 lazy 청크는 서로를 `./index-xxx.js`(쿼리 없음) 로 import** 한다.
- 브라우저는 `index-xxx.js?v=v3` 와 `index-xxx.js` 를 **다른 모듈로 취급 → 공유 청크(auth-context 포함) 2번 로드** → **React Context 인스턴스가 둘**. AuthProvider 는 인스턴스 A 로 값 제공, lazy 페이지는 인스턴스 B 로 읽음 → `useAuth`=null. 두 reconciler 가 같은 DOM 다툼 → `removeChild`.
- **eager 빌드는 동적 import 가 없어 공유 청크를 ?v 한 URL 로만 로드** → 중복 없음 → 안 터졌던 것.
- componentStack 은 정상(AuthProvider 가 Home 의 조상)인데도 context=null 인 게 결정적 단서였다(= Context 객체 자체가 둘).

**수정**(`web/user/vite.config.ts cacheBustPlugin`): URL 이 `.js` 로 끝나면 `?v` 를 **붙이지 않는다**(ESM 모듈 식별자 깨짐 방지). .js 캐시버스팅은 Vite 콘텐츠 해시 파일명이 이미 처리. CSS/아이콘/manifest 등 비-모듈만 `?v=v3` 유지. → 한 줄 가드(`if (/\.js$/i.test(url)) return match`)가 진짜 픽스.

### 배제됐던 가설(전부 무관 — 시간낭비 방지)
React 중복(실은 단일·router 청크), auth-context 모듈 중복, 부트스켈레톤(#root 비워도 동일), StrictMode 제거, manualChunks 형태, 데이터라우터 vs `<Routes>` vs `route.lazy` vs `React.lazy` — **전부 증상 동일**. 라우터 구조는 원인이 아니었음(데이터 라우터로도 크래시했음). 유일 변수 = `?v` 쿼리.

### 로컬 검증 하니스 (재사용 — `e2e/_codesplit_smoke.mjs`)
바이블이 요구한 "신뢰 가능한 로컬 게이트" 를 구축해 prod 무노출로 확정했다:
1. `cd web/user && npx vite build`
2. `dist/index.html` 의 `__SAJUMOON_ENV__`→`prod` 치환(배포 sed 모사). ⚠️ 안 하면 `runtime-env.ts` 가 'test' 폴백 → 죽은 api.sajumoon.kr 호출.
3. `npx vite preview --port 4188`(EBUSY 회피: 빌드 전 preview 포트 kill).
4. `SMOKE_BASE=http://localhost:4188 node e2e/_codesplit_smoke.mjs` — **90 라우트 딥링크 + SPA 클릭 전수**.
   - ⚠️ localhost→api.sajuplan.com 직접호출은 **CORS 전면 차단** → me() 가 네트워크 거부로 비정상 실패(로컬 하니스 인공물). 하니스가 `api.sajuplan.com` 을 가로채 **ACAO 헤더 + 깨끗한 401/200 으로 로그아웃 prod 사용자**를 흉내냄.
   - 구조적 시그니처(`must be used inside`/`removeChild`)만 합격기준. 스텁 `[]` 데이터 오류는 분류만(실 prod 무관).
   - **prod 배포 후엔 `NO_STUB=1 SMOKE_BASE=https://sajuplan.com`** 으로 실데이터 재검증(스텁 불필요·CORS 정상).

### 검증 결과 (2026-06-25)
- 로컬 스텁 스모크: 90 라우트 구조적 크래시 0 + SPA 4전환 0.
- **prod 라이브 스모크(NO_STUB)**: 91 OK / 구조적 크래시 0 / 데이터오류 0.
- 기존 E2E `02·07·28·114`: 22 passed / 0 failed (07 BottomNav 가 SPA lazy 전환 직접 커버).

**1차 사고 기록(2026-06-25 이전)**: 검증 없이 prod 직접배포 → /counselors·/search·/mypage 크래시 → eager 재빌드·재배포로 즉시 복구. 당시엔 원인을 react-router 로 오판했으나 실제는 위 `?v` 였음. 롤백은 `git revert` 또는 eager App.tsx 복원 후 재빌드·재배포(3분).

## 관련 메모리
- `[[reference-initial-load-optimization]]`
- `[[reference-deploy-windows-gotchas]]` (PowerShell·dist·SSHPASS)
- `[[feedback-e2e-strict-verification]]`
