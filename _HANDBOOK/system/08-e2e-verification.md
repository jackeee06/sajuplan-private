# E2E 엄격검증 전체 결과 (2026-06-06, v2)

## 한 줄로 답하면
**2026-06-06 기준, Playwright E2E 자동 테스트 41개 스펙 파일 / 270+건 시나리오 전수 통과. 실 데이터(쿠폰/후기코인/선지급)까지 검증 완료. 수정 버그 2건.**

---

## 2026-06-12 추가 개선 — 팝업 기능 + 공지 비공개 + DOMPurify (사장님 요청)

5순위 검증 후 사장님 결정으로 추가 구현·배포:

- ✅ **팝업 기능 신설/강화** — 사용자 노출(홈/상담사 마이페이지) + 이미지 업로드 `/api` 404 fix + **대상 구분(전체/회원만/상담사만)** + 본문 **에디터(Toast UI)**. 상세 [admin/05-banners-popups.tech]. spec 71·72·73·74.
  - 대상×위치: home→비로그인 all / 로그인 all+member, counselor영역→상담사 all+counselor.
- ✅ **공지 비공개(is_secret) 임시저장** — 관리자 공지 폼에 "비공개" 체크박스 신설(백엔드 create/update + 사용자 목록 필터). 공지를 즉시 전체공개 말고 숨겨둘 수 있음. spec 75.
- ✅ **XSS 정화 DOMPurify 전환** — 사용자/관리자 `sanitizeIntroHtml` 을 정규식 denylist → **DOMPurify(allowlist)** 로 교체(`web/{user,mng}/src/lib/sanitizeHtml.ts`). denylist 변형·중첩 우회 위험 구조적 제거. 콘텐츠 렌더 무회귀(11·60·71 GREEN). dompurify@3 설치(--legacy-peer-deps: 기존 toast-editor react17 peer 충돌 회피).
- ✅ **일반 브라우저 접근 게이트(앱 전용화)** — sajuplan.com 을 일반 PC/모바일 브라우저로 직접 열면 "앱에서 이용해주세요 + 스토어 링크" 전체화면(`web/user/src/components/WebAppGate.tsx`, App.tsx 루트). **통과 조건: 앱 WebView(`isNativeApp`) / 자동화(`navigator.webdriver`, E2E 무영향) / 수동(`localStorage __allow_web__=1`)**. 스토어 링크는 `/api/app/version`(setting `app.*_store_url`) 단일 출처. spec 76(자동화 통과·일반 노출·앱 통과).
  - **스토어 링크 실값 채움**(이전 placeholder): AOS=`play.google.com/store/apps/details?id=com.dmonster.sajumoon`, iOS=`apps.apple.com/kr/app/id6761353255`(앱명 "사주플랜"). → 게이트 + **강제업데이트 모달**도 정상화(둘 다 placeholder였음).
  - **QR 코드(2026-06-12)**: PC(데스크탑) 게이트엔 Play/App Store **QR 2개**(폰으로 찍어 설치), 모바일 브라우저엔 **탭 버튼**(바로 스토어). QR은 `qrcode.react`(클라이언트 SVG 생성, 외부 QR 서비스 미의존). spec 76(데스크탑 QR·모바일 버튼·앱/자동화 통과 + 앱로고 깨짐검사).
  - **디자인(2026-06-12)**: 앱 아이콘(`/img/android-chrome-512x512.png` = 사주플랜 고양이 로고)을 상단에 라운드+그림자로, 그라데이션 배경(primary-50), QR은 흰 카드. 별도 마스코트 일러스트 자산은 없어 앱 아이콘으로 갈음.
- ✅ **채팅 메시지 저장형 XSS 차단(2026-06-12)** — 당초 "m2net 서버 의존이라 보류"로 봤으나, 재점검 결과 **`chat.service.ts:493`이 사용자 전송 `message_type`을 검증 없이 저장** → 일반 사용자가 `message_type=2`+악성 HTML 을 보내면 상대 화면(`ChatRoom.tsx`/`ChatLog.tsx` isHtml innerHTML)에서 실행되는 **사용자→상대방 저장형 XSS**였음. 렌더 시점 `sanitizeIntroHtml`(DOMPurify) 적용으로 차단(이미지·서식 보존). ⚠️ 후속 권장(선택): 사용자 전송 message_type 백엔드 클램프(이미지 [img] prefix 경로 확인 후).

### 보고/보류 (사장님 결정)
- 약관 변경 재동의: **보류**(6개월 뒤 재검토).
- 배너 위치 2종(중앙/가입완료): 미사용 결정 — **메인상단 배너만 사용**, 나머지는 팝업으로 대체.
- 상담사 페이지 직접URL 빈 셸: 데이터 안전(백엔드 가드). 앱 전용 서비스라 **비앱 웹 접근 게이트**는 별도 논의 예정.
- 채팅 message HtmlFlag: m2net 서버 의존 — DOMPurify 적용 시 안전하게 정화 가능(후속).

---

## 2026-06-12 5순위(시스템/설정) 무관용 정밀검증

방식: 무에러 베이스라인(09·11·12·26·40·60·62 = 58 passed) → 병렬 적대감사 4영역(콘텐츠XSS/외부URL·배너팝업·핀/헬스체크/cron·모드전환/콘텐츠CRUD) → 확정 수정·배포·검증. prod-state 의심 2건(search_keyword_pin 테이블·crontab)은 **직접 확인 결과 정상**(테이블 실재, 모든 cron 등록·정산 의도적 주석).

### 수정·배포 완료
| 등급 | 버그 | 위치 | 검증 |
|---|---|---|---|
| 🔴 | **관리자/상담사 작성 콘텐츠 6종 sanitize 전무** → 저장형 XSS | 공지/이벤트/알림/상담사공지 상세 + 상담사상세 문의·후기 탭(CounselorDetailLayout 단일점) + 약관모달 → 전부 `sanitizeIntroHtml` | 렌더 무회귀(11·60 GREEN) |
| 🔴 | 이벤트 사용자 목록에 upcoming(예정·초안) 조기 노출 | `user/events/events.service.ts` 기본 필터(미시작 숨김) | spec70 GREEN |
| 🟠 | 홈 배너 외부링크 `target=_blank`(앱 WebView 먹통) | `Home.tsx` → `openExternalUrl` | 코드 |
| 🟠 | 인기검색어 핀 DELETE+INSERT 비트랜잭션(빈 상태 race) | `board-ops.service.ts` `sql.begin` | 코드+타입 |

### 신규 spec
- `70-system-5th-priority` — 사용자 이벤트 목록 upcoming 미노출 검증.

### 보고만 (feature gap / 정책 / 백로그)
- ✅ **팝업레이어 사용자 노출 — 2026-06-12 신설 완료** (사장님 요청). 백엔드 `GET /api/user/popups` + 프론트 `PopupLayer.tsx`(홈 모달, sanitize, openExternalUrl, "오늘 하루 보지않기"). spec 71. [admin/05-banners-popups.tech]
- 🟠 배너 위치 2종(중앙/가입완료) 미노출, 약관 재동의 메커니즘 부재(법적·Phase2), 상담사 마이페이지 라우트 가드 부재(데이터는 백엔드 JWT로 안전, UI 셸만 노출), 공지 is_secret 폼 부재 — 보고.
- 🟡 채팅 message HtmlFlag sanitize 미적용(m2net 서버 의존, 포맷 깨짐 우려로 보류), denylist→DOMPurify 전환 권장, search_log retention, C-3 reason 한정, invariant 개수 문서 불일치 — 백로그.

### 회귀
- 베이스라인 58 + 신규 70 + 콘텐츠 렌더(11·60) GREEN. 콘텐츠 sanitize가 정상 HTML 안 깨뜨림 확인.

---

## 2026-06-12 4순위(관리자 기능) 무관용 정밀검증

방식: 무에러 전수 스캔(관리자 40 라우트 = pageErr·5xx·4xx·brokenImg·overflow **전부 0**) → 4개 영역 병렬 적대적 코드감사(회원운영·승인·결제정산·권한경계) → 확정분 수정·배포·검증. **관리자는 쓰기 흐름이라 prod 실데이터 보호**(차단 테스트 + 더미 net-zero + 코드정독 위주).
일반관리자 세션 = `admin_e2e`(is_super=false, 이미 E2E 연결), 슈퍼 = `lee`.

### 수정·배포 완료 (6건)
| 등급 | 버그 | 위치 | 검증 |
|---|---|---|---|
| 🔴 | 관리자 수익금 수동조정이 `balance_kind` 누락 → 정산 누락+회원내역 오염 | `admin/points/points.service.ts` | 코드+타입 |
| 🔴 | 일반관리자가 선지급 정책(가용비율·일일한도·kill switch) 변경 가능 | `settings.service SUPER_ONLY +6키` | spec66 GREEN |
| 🔴 | **환불해도 상담사 earning 미차감 → 회사 이중손실** | `admin/refunds/refunds.service.ts` step9 비례 회수 | 코드+타입 |
| 🟠 | 포인트 수동조정 더블서밋 이중 적립/차감(멱등 없음) | `points.service.ts` 10초 dedup | spec67 GREEN(더미 net-zero) |
| 🟠 | 반려/취소된 상담사 신청 재승인 가능(철회 무시) | `counselor-apply.service approve` 가드 | 코드+타입 |
| 🟠 | 마지막 슈퍼관리자 강등/비활성 → 영구 잠김 | `permissions.service` 가드 | 코드+타입 |

### 신규 spec
- `66-admin-payout-superonly` — 일반관리자 payout 정책키 변경 403.
- `67-admin-point-idempotency` — 동일 조정 더블서밋 → 2차 `duplicated=true`(더미 net-zero 원복).

### 보고만 (사장님 결정/큰 리팩터)
- ③ **결제취소↔환불 자동 상호가드 미적용** — payment↔consultation 연결키 없음 → 자동가드는 정상작업 오차단 위험이 더 큼. actor·이력으로 추적(의도적 미적용).
- ✅ 상담사 승인 **동시성·본인확인 보강 완료**(2026-06-12) — advisory lock + post_apply FOR UPDATE 직렬화 + member_id 정확 일치 본인확인 + 데드락 회피(최종 UPDATE만 tx). 전면 단일트랜잭션은 헬퍼/외부 m2net 때문에 비채택, 재실행-멱등 유지. 검증 spec 69. [counselor/01-apply.tech]
- 🟡 일반관리자에게 계좌/전화 평문·영업이익 근사치 노출 — 관리자 도구 특성상 의도 가능, 정책 확인.
- (참고) admin_permission 매트릭스 서버 미강제는 "일반관리자=전권" 의도라 보안홀 아님(3순위에서 재분류 기록).

### 회귀
- 무에러 스캔 40 + 가드엣지(58) + 시크릿마스킹(65) + 전라우트(05) + 신규(66·67) 전부 GREEN. admin 변경이 기존 깨뜨림 0.

---

## 2026-06-12 3순위(상담사 기능) 무관용 정밀검증

방식: 무에러 전수 스캔(베이스라인 70스펙 **451 passed / 0 failed / 9 skipped**) → C-1~C-5 코드 정독 + 적대적 E2E → 확정분 수정·배포·GREEN 재검증.
**E2E가 코드정독을 보강한 결정적 사례** = 메모장이 "404"가 아니라 "콜드로드 시 호출 0건(로그인 튕김)"이었음을 런타임에서만 잡음.

### 수정·배포 완료 (8건)
| 등급 | 버그 | 위치 | 회귀 spec |
|---|---|---|---|
| 🔴 | 상담사 메모장 `/api` 누락 404 | `CounselorMyMemo.tsx` (자체 API_BASE) | 64 |
| 🔴 | 메모장 콜드로드 시 `/login` 튕김(인증 로딩 가드 레이스) | `CounselorMyMemo.tsx` | 64 |
| 🟠 | 상담사 신청 본인소개 저장형 XSS(관리자 표적) | user/mng `CounselorApplyDetail.tsx` + `sanitizeHtml.ts` 신설 | 코드 |
| 🔴 | 일반관리자 `?show_phone=1` 쿼리만으로 전 회원 평문 전화 | `members.controller.ts canShowPhone` → 슈퍼만(fail-closed) | 58 회귀 |
| 🔴 | 관리자 설정조회가 OAuth 시크릿 평문 노출 | `settings.service.ts` 마스킹+라운드트립 보호 | 65 |
| 🟡 | 정산률 fallback 1.0(마진0) → 안전값 0.4+로그 | `m2net-push.service.ts creditCounselorPointInTx` | 정산 회귀 |
| 🟡 | 상담통계 직접입력 날짜칸 375px 오버플로우 | `CounselorMyConsultStats.tsx` min-w-0/shrink-0 | 64 |
| 🟡 | "포인트 지급!" 용어 누수 3곳 | Reviews/CounselorReviews/CounselorMyProductReviews | 코드 |

### 신규/변경 spec
- `64-counselor-3rd-priority` (신설) — 메모 `/api` 200 + 통계 오버플로우. 배포 전 RED → 배포 후 GREEN.
- `65-admin-security-hardening` (신설) — 설정 시크릿 마스킹 검증.
- `46-review-load-more` — counselor 141 더미후기가 prod에서 사라져(API total:0) 전제 미충족 → **제품버그 아님**, graceful skip 처리(전제 충족 시 자동 재활성).

### 보고만 (정책/설계 결정 — 사장님 판단)
- **R1 🟠 선지급 가용한도 base 불일치** — 신청게이트(당월 consultation 재계산) ≠ 정산엔진(earning 원장). 정산 자동기능 당분간 미사용 결정 → **보류**(1년 뒤 재검토). [payment/06-payout.tech]
- **R2 🟠 admin 추천 수동등록 rate/months 스냅샷 누락**(무조건 1%) — 사장님 인지, **보류**.
- **C 🟡 admin_permission 서버 미강제** — "일반관리자=전권"이 의도, 민감 기능은 이미 슈퍼게이트 → 보안홀 아님, 미완 기능으로 재분류. [admin/01-permissions.tech]

### 회귀 결과
- 신규/연관: spec64 GREEN, spec65 GREEN, 연관영역 132 passed, admin 88 passed, 정산/등급/선지급 14 passed. flaky는 모두 재시도 통과(환경성 `networkidle`).

---

## 2026-06-11 운영 직전 적대적 정밀점검 (1~5순위)

축1(무에러 전수 스캔) + 축2(적대적 엣지 — "깨뜨리려" 찌르고 전부 막히는지 확인) 방식으로 보강.
**모두 "차단" 케이스 위주 → 운영 데이터 오염 0.**

| 순위 | 영역 | 신규 spec | 결과 |
|---|---|---|---|
| 1·2 | 돈 + 핵심 사용자 흐름 | 53(무에러스캔) · 54(인증) · 55(후기) · 56(문의) | self 소유권 4곳 수정(JWT sub) |
| 3 | 상담사 기능 (선지급/단가/정산) | 57-counselor-edge (17건) | 0 버그 — 경계·소유·역할 전부 차단 |
| 3·4 | 상담사 전탭 + 관리자 돈/회원 페이지 무에러 스캔(375px) | 59-counselor-admin-scan (30건) | **버그 2건 발견·수정** ↓ |
| 4 | 관리자 돈 라우트 (포인트/정산) | 58-admin-guard-edge (12건) | 0 버그 — 비로그인·회원·상담사 토큰 전부 401 |
| 5 | 시스템/설정 | 09·12·26·40 회귀 | spec 09 flaky locator 수정(strict-mode) |

### 축1 스캔에서 발견·수정한 버그 (spec 59, 2026-06-11)
- **B-1 SettlementHistory 가로 오버플로우(397px)**: 날짜검색 행의 `<input type=date>` 가 flex-1 로도 안 줄어들어(네이티브 최소폭) 375px 초과. → 인풋에 `min-w-0`, 버튼에 `shrink-0` 추가.
- **B-2 CounselorMyReferral 카카오 공유 버튼 깨진 이미지**: `/img/kakao_logo.png` 404(자산 없음). onError 로 숨겨져 로고만 비어 보였음. → `/img/icon-kakao.svg` 로 교체.

### 점검 결과 (코드 정밀 — 직접 정독)
- **선지급/포인트/정산 서비스**: 트랜잭션·FOR UPDATE·advisory lock·음수방지·멱등 모두 견고. 0 버그.
- **⚠️ 보고대상(정책 결정 필요) — 일반관리자 전화번호 마스킹 우회**: `members.controller.canShowPhone` 가
  일반관리자에 대해 `?show_phone=1` 쿼리값만 신뢰. 문서상 의도("슈퍼가 켠 시간제한 토글 ON 시만")의
  **서버측 강제가 없어** 일반관리자가 파라미터로 전 회원 전화 평문 열람 가능. 권장: setting 테이블에
  슈퍼 전용 토글(만료시각 포함) 신설 후 서버에서 검증. **사장님 정책 결정 후 처리.**

- **권한 가드 하드닝**: user/admin 양 가드에서 JWT `sub` 를 `Number()` 정규화 → 향후 소유 비교 버그 원천 차단.
  상세: [권한 가드 하드닝](system/10-auth-guard-hardening)
- **코드 정밀점검 확정 버그 0건** — 검토 후보 3건은 전부 false positive(정상 동작). 상세는 tech 문서.
- spec 09(듀얼 모드)는 배너 정규식이 전환 토스트까지 매칭하던 **테스트 자체 결함**(strict-mode 2-element)을
  `$` 앵커(`/상담사 모드$/`)로 수정 — 제품 동작은 정상.

---

## 검증 범위 (5개 Phase)

| Phase | 내용 | 스펙 파일 | 결과 |
|---|---|---|---|
| Phase 1 | 돈 직결 (코인/결제/출석/후기/정산) | 10, 15, 17, 21, 30, 31, 32, 33, 34, 35 | ✅ 전체 통과 |
| Phase 2 | 사용자 핵심 흐름 (상담사 탐색/마이페이지/단골/후기/QnA) | 02, 06, 07, 08, 09, 11, 13, 14, 16, 18, 20, 22, 23, 24, 25, 28, 29, 36, 37 | ✅ 전체 통과 |
| Phase 3 | 상담사 기능 (마이페이지/등급/수익금/선지급) | 17, 38 | ✅ 전체 통과 |
| Phase 4 | 관리자 기능 (회원관리/포인트조정/결제/정산) | 01, 04, 05, 39 | ✅ 전체 통과 |
| Phase 5 | 시스템/설정 (운영바이블/AI/공지/FAQ/cron) | 12, 19, 26, 40 | ✅ 전체 통과 |
| 실 데이터 검증 | 쿠폰 사용, 후기 코인, 선지급 정책 | 41 | ✅ 전체 통과 |

---

## 검증 중 발견·수정된 버그

### 버그 1: 베스트 후기 코인 중복 지급 (2026-06-06)
- **증상**: 관리자가 베스트 ON/OFF를 반복할 때마다 10,000코인 중복 지급
- **원인**: SELECT→INSERT 패턴에서 동시 요청 race condition + DB UNIQUE 제약 없음
- **수정**: `ON CONFLICT DO NOTHING RETURNING id` + DB UNIQUE INDEX `uq_point_history_review_best`
- **E2E 검증**: `tests/32-best-review-idempotency.spec.ts` — ON→OFF→ON 반복 시 코인 변화 없음 확인

### 버그 2: 테스트 중 더미 계정 초과 코인 (2026-06-06)
- **증상**: dummy_cust_05(도윤) 계정에 130,000코인 (정상: 10,000)
- **원인**: 버그1 수정 전 테스트 과정에서 13회 중복 지급 누적
- **수정**: DB 직접 정리 (-120,000), UNIQUE INDEX 추가
- **E2E 검증**: 최종 잔액 10,000 확인

---

## 검증되지 않은 영역 (코드 외부 시스템)

| 영역 | 이유 | 대안 |
|---|---|---|
| 실제 카드 결제 | PG(AG9) 실제 결제 불가 | 수동 1회 실결제 테스트 |
| m2net 전화/채팅 | 외부 시스템 | m2net 콘솔 직접 확인 |
| BizM 알림톡 실수신 | 카카오 검수 필요 | 실 발송 1회 확인 |

---

## E2E 스펙 파일 목록 (e2e/tests/)

| 번호 | 파일명 | 내용 |
|---|---|---|
| 01 | 01-mng-login | 관리자 로그인 |
| 02 | 02-user-counselor-list | 상담사 목록 |
| 04 | 04-admin-pages | 어드민 페이지 |
| 05 | 05-all-admin-routes | 전체 어드민 라우트 |
| 06 | 06-user-mode-routing | 사용자 라우팅 |
| 07 | 07-user-bottom-nav | 하단 네비게이션 |
| 08 | 08-user-auth-stability | 인증 안정성 |
| 09 | 09-dual-role-mode | 듀얼 역할 모드 |
| 10 | 10-user-coin-terminology | 코인 용어 통일 |
| 11 | 11-user-public-pages-deep | 공개 페이지 심층 |
| 12 | 12-api-healthcheck | API 헬스체크 |
| 13 | 13-filter-dropdown | 필터 드롭다운 |
| 14 | 14-member-area | 회원 영역 |
| 15 | 15-charge-flow | 충전 흐름 |
| 16 | 16-password-policy | 비밀번호 정책 |
| 17 | 17-payout-policy | 선지급 정책 |
| 18 | 18-password-change | 비밀번호 변경 |
| 19 | 19-five-min-alert | 5분 알림 |
| 20 | 20-review-five-min-policy | 후기 5분 정책 |
| 21 | 21-coin-payout-terminology | 수익금 용어 |
| 22 | 22-my-qnas | 내 문의 |
| 23 | 23-qna-crud | QnA CRUD |
| 24 | 24-counselor-qna | 상담사 QnA |
| 25 | 25-counselor-apply-style / 25-review-crud | 상담사 신청 / 후기 CRUD |
| 26 | 26-keyword-pin | 인기검색어 핀 |
| 27 | 27-counselor-apply-region | 상담사 신청 지역 |
| 28 | 28-counselor-badge / 28-counselor-detail-tabs | 뱃지 / 상세탭 |
| 29 | 29-my-calls-realdata | 내 통화 내역 |
| 30 | 30-coupon-m2net-sync | 쿠폰 동기화 |
| 31 | 31-coin-system / 31-review-system | 코인 시스템 / 후기 시스템 |
| 32 | 32-best-review-idempotency | 베스트 후기 멱등성 ★ |
| 33 | 33-attendance-coin | 출석 코인 |
| 34 | 34-review-coin-realcheck | 후기 코인 실검증 |
| 35 | 35-settlement-logic | 정산 계산 로직 |
| 36 | 36-favorites | 단골 기능 |
| 37 | 37-mypage-full | 마이페이지 전체 |
| 38 | 38-counselor-mypage | 상담사 마이페이지 |
| 39 | 39-admin-members | 관리자 기능 |
| 40 | 40-system-handbook | 운영바이블/시스템 |
| 53 | 53-no-error-scan | 무에러 전수 스캔 (375px) ★ |
| 54 | 54-auth-b1-edge | 인증 적대적 엣지 |
| 55 | 55-review-edge | 후기 적대적 엣지 |
| 56 | 56-qna-edge | 문의 적대적 엣지 |
| 57 | 57-counselor-edge | 상담사 적대적 엣지 (선지급/단가/소유권) ★ |
| 58 | 58-admin-guard-edge | 관리자 돈 라우트 가드 차단 ★ |
| 59 | 59-counselor-admin-scan | 상담사 전탭+관리자 돈/회원 무에러 스캔 (375px) ★ |

---

## 이건 정상인가요? 에러인가요?

| 상황 | 판단 |
|---|---|
| E2E 0 failed | ✅ 모든 시나리오 정상 |
| 실제 카드 결제 E2E 없음 | ✅ 정상 (외부 PG 불가) |
| 출석 API `/attendance/today` (status 아님) | ✅ 정상 엔드포인트 확인됨 |
| 단골 API `POST /counselors/:id/like` | ✅ 정상 경로 확인됨 |
| 선지급 이력 배열 직접 반환 (items 래퍼 없음) | ✅ 정상 설계 |

---

## 관련 항목
- [사고 매뉴얼](system/03-incident)
- [cron 잡 전수](system/04-cron-jobs)
- [운영 바이블 AI](system/07-handbook-ai)
