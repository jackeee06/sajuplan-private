# 🔴 다음 세션 인수인계 — 3·4·5순위 적대적 정밀점검 + 버그수정 + 운영바이블 박제

> 작성: 2026-06-11
> 이 문서 하나만 읽으면 작업을 정확히 이어받을 수 있다. 긴 이전 대화 다시 읽지 말 것.

---

## ✅ 완료 (2026-06-11 후속 세션)

**3·4·5순위 전부 완료.** 요약:
- **C(상담사 3순위)**: 코드 정밀점검 0 버그. 선지급/단가/정산/소유권/역할 가드 모두 견고. `e2e/tests/57-counselor-edge.spec.ts`(17건) 신규 — 음수·0·가용초과·상한초과·남의데이터·비상담사 전부 차단 확인.
- **D(관리자 4순위)**: 코드 정밀점검 0 버그. 검토 후보 3건(`isSamePerson`·`total_used` 무효화·정산 슈퍼가드)은 전부 **false positive(정상 동작)** 확인. `e2e/tests/58-admin-guard-edge.spec.ts`(12건) 신규 — 비로그인·회원·상담사 토큰의 포인트/정산 라우트 전부 401.
- **E(시스템 5순위)**: spec 09·12·26·40 회귀 통과. spec 09 듀얼모드는 배너 정규식이 전환 토스트까지 매칭하던 **테스트 자체 결함**(strict-mode 2-element) → `$` 앵커로 수정. 제품 정상.
- **권한 가드 하드닝**: `admin-auth.guard.ts` 에도 `sub: Number()` 정규화 적용(user 가드와 동일) → **배포 완료**(remote build + pm2 reload OK). 향후 관리자 소유 비교 버그 원천 차단.
- **운영바이블 박제**: `system/10-auth-guard-hardening.md`/`.tech.md` 신규 + `system/08-e2e-verification.md` 2026-06-11 라운드 반영 + index.json 등록 → `_sync_handbook.py` 배포(121 files).
- **2차 심화(사장님 "대충했다" 피드백 후)**: 축1 무에러 전수 스캔을 C/D 페이지에 직접 실행(`spec 59`, 30건) + 돈 서비스 코드 직접 정독.
  - **실버그 2건 발견·수정·배포·재검증**: ① SettlementHistory 날짜검색 행 가로 오버플로우(397px→`min-w-0`) ② CounselorMyReferral 카카오버튼 깨진 이미지(`kakao_logo.png` 404→`icon-kakao.svg`).
  - **⚠️ 정책 결정 필요 보고건**: `members.controller.canShowPhone` — 일반관리자가 `?show_phone=1` 만으로 전 회원 전화 평문 열람 가능(서버측 토글 강제 없음). 사장님 결정 후 처리.
- **최종 검증**: 신규 57·58·59 + 회귀 35·38·42·09·40 = **0 failed**.
- **미커밋**: 사장님 "커밋해" 대기 (post-commit hook 이 GitHub 2곳 자동 push).

---

## 0. 한 줄 요약

**1·2순위(돈 + 핵심 사용자 흐름)는 2026-06-11 운영 직전 정밀점검 완료**.
이어서 **3순위(상담사 기능)·4순위(관리자 기능)·5순위(시스템)**를 **똑같은 방식**으로 점검·버그수정·문서화한다.
사장님 성향: **방향 묻지 말고 자율로 빠짐없이**. 위험 작업만 확인. 발견 버그는 그 자리에서 수정→배포→검증→운영바이블 박제까지 한 세트.

---

## 1. 먼저 읽을 것 (시작 5분)

1. **CLAUDE.md** — 배포 명령(fast패치)·E2E 엄격검증·돈 용어(코인/수익금) 규칙
2. **메모리 `MEMORY.md`** — 특히 아래 3개:
   - `reference_jwt_sub_string_compare` — JWT sub 문자열 비교 함정 (아래 §3)
   - `reference_api_base_double_api` — `/api/api/` 404 함정
   - `feedback_e2e_strict_verification` — 모든 검증은 Playwright E2E 자동 클릭
3. **운영바이블 `_HANDBOOK/user/` 카테고리 (01~08)** — 1·2순위를 어떻게 문서화했는지 **포맷 예시**. 3~5순위도 `counselor/`·`admin/`·`system/` 에 같은 포맷으로 보강할 것.
4. 이 문서.

---

## 2. 검증 방법론 (2026-06-11 확립 — 그대로 적용)

**축1 → 축2 순서로.**

### 축1: 무에러 전수 스캔 (모바일 375px)
관리자 페이지(`/mng/*`) 또는 상담사 화면(`/counselor/mypage/*`) 전 페이지 진입하며:
- pageerror(JS 예외) 0 / 5xx 0 / 깨진 이미지 0 / 375px 가로 오버플로우 0 → **치명, 반드시 0**
- console.error / 4xx → 진단 로그로 전량 수집 (참고: `e2e/tests/53-no-error-scan.spec.ts` 그대로 응용)

### 축2: 적대적 엣지케이스 ("깨뜨리려" 찌름)
각 주제마다 **차단되어야 하는 케이스**를 API/클릭으로 시도 → 전부 차단(4xx) 확인:
- 잘못된 입력 / 권한 없음 / 경계값 / 중복 / 만료 / 우회 시도 / 남의 데이터 접근
- **모두 "차단" 케이스 위주로** → prod 데이터 오염 0. 생성형 테스트는 self-clean(생성→정리).

### 5축 체크 (각 주제)
① 무에러 ② 적대적 엣지 ③ UX(빈/로딩/에러, 모바일) ④ DB 정합성(화면값=DB) ⑤ 풀 시나리오

---

## 3. ⚠️ 주의사항 (오늘 발견한 함정 — 또 나올 수 있음)

1. **JWT sub 타입 함정 (중요)**: `req.user.sub` 는 런타임 **문자열**. DB id(숫자)와 `===` 직접 비교하면 무력화됨(`'141' === 141` = false).
   - user 측은 `user-auth.guard.ts` 에서 `Number()` 정규화 **완료**(2026-06-11).
   - **`admin-auth.guard.ts` 는 아직 미점검** — 관리자 권한/소유 비교에 같은 버그 있는지 **반드시 확인**(D-2~D-6 작업 시).
2. **`/api/api/` 함정**: `API_BASE` 가 이미 `/api` 포함. 컴포넌트에서 직접 `fetch(\`${API_BASE}/...\`)` 할 때 앞에 `/api` 또 붙이면 404. (`grep '}/api/(user|admin)/' web/*/src` 로 점검)
3. **배포 (fast패치)**:
   - 프론트: `python tools/_patch_frontend_fast.py user|mng` (먼저 `npx vite build`)
   - API: `set -a; . ./.env.local; set +a; MSYS_NO_PATHCONV=1 python tools/_patch_api.py root@104.64.128.103 /data/wwwroot/api.sajumoon.co.kr sajumoon-api`
     - ⚠️ `MSYS_NO_PATHCONV=1` 없으면 Git Bash 가 경로를 `C:/Program Files/Git/...` 로 변환해 엉뚱한 곳에 배포됨(실제 사고).
     - 바꾼 파일이 `_patch_api.py` 의 `FILES` 목록에 있는지 확인, 없으면 추가.
   - 핸드북 MD: `python tools/_sync_handbook.py`
4. **E2E 엄격검증**: `0 failed`. reload 직후 일시적 DB 끊김(ECONNREFUSED) 가능 → `--retries=1` 또는 단독 재실행으로 확인(코드 버그 아님).
5. **DB 조회/정리**: paramiko + `.env` 의 `DATABASE_URL` 로 prod psql. self/오염 데이터 정리는 화이트리스트(id 명시) + soft 우선. `consultation`(돈 이력 연결)은 삭제 신중.
6. **돈 직결**(C-3 수익금/C-4 선지급/D-4 포인트/D-6 정산)은 변경 시 더 신중 + E2E 0 failed 필수.

---

## 4. 작업 대상 (C/D/E)

### 🟡 3순위 — 상담사 기능
| 번호 | 주제 | 코드 위치 힌트 | 적대 케이스 아이디어 |
|---|---|---|---|
| C-1 | 상담사 신청(폼/지역/스타일) | `admin/counselor-apply`, `web/user CounselorApplyNew.tsx`. spec 25·27 회귀 | 중복 신청, 필수 누락, 반려 후 재신청 |
| C-2 | 등급 표시/단가 설정 | `api user/counselor-mypage-grade`, `admin/grade`, `web CounselorMyPage`. **등급=실시간 승급, 정산률** | 등급 범위 밖 단가 선택, 단가 변경 락(`unit_cost_changeable_at`) 우회 |
| C-3 | 수익금 내역 | `web SettlementHistory.tsx`, `api user/settlements`. **용어=수익금(원)** | 남의 수익금 조회, 음수 표시 |
| C-4 | 선지급 신청 UI | `web CounselorMyPayout.tsx`, `api user/payout`. **가용70%·수수료5%·원천3.3%·일1회·최소3만** | 가용 초과 신청, 일1회 초과, 음수, 남의 선지급 |
| C-5 | 상담사 마이페이지 전체 탭 | `App.tsx` 의 `/counselor/mypage/*` 라우트 전체 | 비상담사 접근 차단, 보호 라우트 |

### 🟢 4순위 — 관리자 기능
| 번호 | 주제 | 코드 위치 힌트 | 적대 케이스 |
|---|---|---|---|
| D-2 | 회원 목록/검색/상세 | `admin/members.service.ts`, `web MembersList` | 정지/복원, phone 마스킹, 권한 |
| D-3 | 상담사 관리(승인/반려) | `admin/counselor-apply approve/reject` | 중복 승인, m2net 등록 실패 처리 |
| D-4 | 포인트 수동 지급/차감 | `admin/points.service.ts` | **음수 잔액 방지**, 사유 필수, 권한, 멱등 |
| D-5 | 결제 내역 조회 | `admin/payments.service.ts` | 필터/페이지 경계 |
| D-6 | 정산 이력/지급완료 마킹 | `admin/settlements (markPaid)`, `web SettlementList`. **정산단순화 완료(earning 합산·markPaid 차감)** | markPaid 멱등, voided 복구, 중복 정산, 음수 |
| D-7 | 베스트 후기 선정 | spec 32 회귀 | (이미 멱등성 검증됨) |

### ⚪ 5순위 — 시스템/설정
| 번호 | 주제 | 힌트 |
|---|---|---|
| E-4 | 공지/이벤트/FAQ | `admin/notices·events·faqs` (⚠️부분) |
| E-5 | 배너/팝업 | `admin/banners·popup-layers`, `PopupLayerForm`(api/api 버그 수정됨) (낮은 우선순위) |
| E-1·E-2·E-3 | 헬스체크·모드전환·인기검색어 | spec 12·09·26 회귀로 충분 |

**슈퍼 전용 주의**(D 작업 시): 슈퍼 전용은 ①다른 관리자 슈퍼 승격 ②영업이익 시뮬레이터(비밀 수치)뿐. 그 외 일상 돈업무는 일반관리자 전권. 빨강=숨김(`SuperOnlySection`)/노랑=읽기전용(`ReadOnlyForSuper`).

---

## 5. 산출물 (작업 한 세트)

1. 발견 버그 → **수정 + 배포 + E2E 재검증(0 failed)**
2. 검증 spec 추가 (`e2e/tests/57~` 부터)
3. **운영바이블 박제**: `_HANDBOOK/counselor/`·`admin/`·`system/` 에 C/D/E 기능을 `user/` 카테고리와 **같은 포맷**(.md 운영자용 + .tech.md 개발/AI용)으로 보강. `index.json` 등록 → `_sync_handbook.py` 배포
4. self/오염 데이터 정리
5. **커밋**(사장님 "커밋해" 시) — post-commit hook 이 GitHub 2곳 자동 push

---

## 6. 다음 세션 시작 멘트 (사장님이 입력)

> `PLAN/_NEXT_SESSION_검증_3-5순위.md 읽고 이어서 꼼꼼하게 작업해줘. 방향은 묻지 말고 자율로 빠짐없이.`
