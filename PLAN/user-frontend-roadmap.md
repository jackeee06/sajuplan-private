# 사용자향 프론트엔드(web/user) 빌드 로드맵

## 1. 개요

사주플랜 사용자향 사이트(`https://sajumoon.kr/`) 프론트엔드를 신규 구축한다. 디자인 소스는 Figma 파일 `사주플랜_디자인` (file_key: `v9JT0ZgilboPxdXAnpH4sS`), 모바일 우선(390×844 컨테이너).

**관리자([web/mng/](../web/mng/))와 동일 스택**으로 구성하여 절대/상대 경로 이슈, 빌드 도구 분기, 디자인 토큰 분기를 제거.

---

## 2. 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 위치 | `web/user/` ([web/user/](../web/user/)) | mng와 형제 폴더로 코드 구분, 웹서버에서 `/`로 라우팅 |
| URL | `https://sajumoon.kr/` (root) | mng는 `/mng/`, user는 `/` |
| Vite `base` | `/` | root 서빙 |
| 스택 | React 18 + Vite 5 + TS 5.6 + Tailwind 3.4 + react-router-dom 6 + lucide-react | mng와 동일 |
| 디자인 토큰 | mng의 `tailwind.config.js` brand/gray 팔레트 그대로 복사 | 일관성 |
| 폰트 | Outfit (mng와 동일) | 일관성 |
| 인증 | (미정) — 로그인 화면은 UI만 우선 작성, API는 `// TODO` | 사용자 API 미구축 |
| SSR | **없음** (SPA) | 관리자와 동일 스택 우선 결정. SSR/SEO 필요 시 추후 마이그레이션 검토 |

---

## 3. 디렉토리 구조 (목표)

```
web/user/
├── index.html
├── package.json
├── vite.config.ts            # base: '/', proxy /api → :3001
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── tailwind.config.js        # mng 팔레트 동일
├── postcss.config.js
├── public/
│   ├── logo.png              # mng/public/logo.png 복사
│   ├── logo_w.png
│   └── favicon/
└── src/
    ├── main.tsx
    ├── App.tsx               # BrowserRouter basename='/', /login 라우트부터
    ├── index.css             # @tailwind + 공통 input/checkbox 스타일
    ├── pages/
    │   └── Login.tsx         # Phase 1
    ├── components/
    │   └── (각 화면 진행하며 추가)
    ├── lib/
    │   ├── api.ts            # (Phase에서 추가)
    │   └── auth.ts           # (Phase에서 추가)
    └── vite-env.d.ts
```

---

## 4. Phase 로드맵

### Phase 1 — 로그인 (현재 진행)

- 위치: [web/user/src/pages/Login.tsx](../web/user/src/pages/Login.tsx)
- Figma 노드: `16:47143` 섹션의 첫 자식 `01로그인_로그인` (id `6:2246`, 390×844)
- 레퍼런스 이미지: `/tmp/figma_export/login_16_47143.png`
- 구성:
  - 헤더 (60h): 뒤로가기 + "로그인"
  - 로고 영역 (140×46) — purple 심볼 + "사주플랜" 텍스트
  - ID/PW 입력 (358×40, bg `#f9fafb`)
  - "로그인 상태 유지" 체크박스
  - 로그인 버튼 (358×48, bg `#9b7af7` ≈ `brand-400`)
  - 회원가입 | 아이디/비밀번호 찾기 (분리선 LINE)
  - SNS 분리선 (좌우 가로선 + 가운데 텍스트)
  - 카카오 로그인 (#fee500)
  - 네이버 로그인 (#03a94d)
- API: 미구현 — `onSubmit`은 placeholder, validation만 적용
- 라우트: `/login`. 진입 후 미인증이면 `/login`으로, 인증되면 `/`(추후 홈) 으로 (홈 미구현이므로 일단 `/login`만)

### Phase 2 — 회원가입

- Figma 섹션 내 회원가입 화면들 (단계별)
- 단계: 약관 동의 → 본인인증 → 정보 입력 → 완료
- 라우트: `/signup/*`

### Phase 3 — 아이디/비밀번호 찾기

- 라우트: `/find-id`, `/find-pw`

### Phase 4 — 홈 (메인)

- Figma 노드: `홈` 프레임 (별도 추출 필요)
- 라우트: `/`

### Phase 5 — 상담사 리스트 / 상세

- 라우트: `/counselors`, `/counselors/:id`

### Phase 6 — 채팅방

- 라우트: `/chat/:roomId`

### Phase 7 — 마이페이지 (일반회원 / 상담사 / 비회원)

- 라우트: `/mypage`, `/mypage/counselor`, `/mypage/guest`

### Phase 8 — 결제/충전, 알림 등 부가 기능

---

## 5. 진행 메모

- API 연동은 각 Phase에서 백엔드(`api/`) 측 엔드포인트 확인하며 진행. 현재 NestJS 기반 admin API만 존재 — 사용자용 API는 추후 구축 또는 admin API 재사용 결정 필요.
- 인증: 사용자 인증은 admin과 별도 (member 테이블 기반). 쿠키/토큰 정책은 Phase 2 시작 시 확정.
- 다크모드: mng는 지원하나 user 사이드는 일단 라이트만 (디자인이 라이트 기준). dark variant는 Tailwind에서 살려두고 사용 안 함.
- 진행 상황은 [DB_REFACTOR_PROGRESS.md](../DB_REFACTOR_PROGRESS.md)와 별개로, 큰 변동 시 본 문서 업데이트.

---

## 6. 배포 인프라 (2026-04-30 구축 완료)

| 항목 | 상태 |
|---|---|
| Vite `base: '/'` + BrowserRouter `basename='/'` | ✅ |
| Production docroot | `/data/wwwroot/sajumoon.kr/` (`mng/` 형제 폴더로 함께 존재) |
| nginx vhost | `/usr/local/nginx/conf/vhost/sajumoon.kr.conf`에 `location / { try_files $uri $uri/ /index.html; }` 추가 (2026-04-30) |
| `index.html` 캐시 | `no-cache, no-store, must-revalidate` (해시된 assets만 장기 캐시) |
| `deploy.sh user` | 빌드 후 rsync `--delete --exclude='/mng/'` → docroot. 관리자 폴더 절대 삭제 안 됨. |
| favicon | `web/user/public/`에 svg + png(16/32/180/192/512) + site.webmanifest. Figma symbol(46x46 음양) 기반. 관리자 favicon과 별도 |
| 로그인 라이브 | `https://sajumoon.kr/login` ✅ HTTP 200 (2026-04-30) |

### 배포 명령

```bash
./deploy.sh user        # 사용자 프론트만
./deploy.sh             # mng + user + api 전체
```

### 신규 배포 시 주의

- nginx vhost는 이미 SPA fallback 적용됨 → 새 라우트 추가 시 nginx 변경 불필요
- index.html 외의 정적 자산(`/img/`, `/favicon-*`)은 nginx의 `expires 7d` (js/css) 또는 `expires 30d` (이미지)로 캐시됨

---

## 7. 작업 시작 시 체크리스트

새 세션에서 이어가는 경우:
1. 본 문서 읽기
2. [web/mng/tailwind.config.js](../web/mng/tailwind.config.js) — 토큰 변동 있는지
3. Figma 토큰: 필요 시 사용자에게 재발급 요청
4. `web/user/src/pages/` 진행 상태 확인
5. 배포: `./deploy.sh user`
