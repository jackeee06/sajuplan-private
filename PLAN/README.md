# 신규 관리자(web/mng) 클린 빌드 — sample/adm 참고

## 배경 — 작업 성격 (중요)

**이 작업은 "이관"이 아니다.** sample/adm(PHP 그누보드5 기반 라이브)을 그대로 옮기는 마이그레이션이 아니라, sample을 **참고만** 하면서 비효율과 보안·정합성 문제를 처음부터 개선해 **클린하게 새로 만드는 신규 빌드**다.

라이브에는 다음과 같은 부실이 누적되어 있다:
- SQL injection (변수 직접 SQL 보간) 만연
- 트랜잭션 누락 (포인트 수정, 회원 일괄 처리, mtonet 외부 호출 동기화 등)
- CSRF 토큰 주석처리, IP별 분기 로직, 디버그 코드(`exit;`, `print_r($_POST)`) 잔존
- 자가 ALTER TABLE을 페이지 로드마다 호출
- 포인트 변경 이력 부족 (누가 언제 왜 조정했는지 기록 미흡)
- 백업 파일 다수, dead code, placeholder 잔존

신규 mng는 이 부실을 한 줄도 재현하지 않는다. **라이브 점검·수정은 하지 않는다.** sample 코드는 비즈니스 로직 추론용 reference로만 활용.

대표적으로, 현재 `https://sajumoon.kr/mng/members/customers/:id`에서 회원 포인트가 직접 수정 가능했던 흐름은 신규에서는 **이력 기반 조정으로만 가능**하도록 처음부터 다시 설계한다.

---

## 현재 상태

| 영역 | 상태 |
|---|---|
| 새 DB 스키마 (DDL) | 73개 테이블, 12개 마이그레이션 파일 작성 완료 (`api/db/migrations/0001~0012`) |
| 마이그레이션 러너 | `api/db/migrate.ts` 작성 완료 |
| 실제 새 서버 적용 | **미완** (서버 정보 미확정) |
| ETL (g5_* → 신규 스키마) | **미시작** — 각 Phase에서 도메인별로 병행 작성 |
| Admin API (NestJS) | 회원/상담사 CRUD 완성, 그 외 미구현 |
| Admin UI (React) | Dashboard, CustomerList/Form, CounselorList/Form, Popup, Settings, Login 완성 |
| 포인트 조정 UI/API | **미구현** (CustomerForm에 disabled 필드 + hint만 있음) |

상세 진행 상황: [DB_REFACTOR_PROGRESS.md](../DB_REFACTOR_PROGRESS.md)

---

## 정책 결정 (확정)

| 항목 | 결정 |
|---|---|
| 포인트 조정 권한 | 모든 admin 가능, 단 `actor_admin_id`/`actor_ip` 필수 기록 |
| 포인트 음수 정책 | **잔액까지만 차감** (음수 잔액 금지). sample의 IP별 분기 폐기 |
| 이관 순서 | Phase A → Phase B → 이후 협의 |
| 레거시 ETL | **각 Phase에서 해당 도메인 ETL 병행 작성** |
| Phase B 환불 시 포인트 회수 | Phase B 시작 시점 재확인 |
| **라이브 점검** | **하지 않음**. 분석에서 발견된 라이브 버그(v1 정산 SQL, pay_cancel 미정의, member_xls_update SQL 등)는 신규 mng에서 처음부터 재현하지 않는 것으로 대응. 라이브 운영팀에 별도 보고/수정 안 함 |
| **상담사 정산 사이클** | 월별 정산 (달이 넘어갈 때마다 실행). 정산일에 상담사 포인트 잔액이 **0으로 리셋**되고, 다음 달 누적 후 또 정산. 정산 데이터 소스는 **그 달에 쌓은 포인트 + 상담 내역**. 라이브에서 정상 동작 중. |
| **정산 로직 기준** | **sample의 v2 정산 함수/화면 기준**으로 신규 설계 진행. v1은 폐기, v3는 호출처 없음. 단 v2의 실제 동작은 sample 코드 추적으로 정밀 검증 중 |

---

## Phase 로드맵

### Phase A: 포인트 조정 이력화 — **진행 예정 (최우선)**

회원 포인트 가감을 트랜잭션 + 감사로그 기반으로 처음부터 새로 구현.

- 상세: [phase-a-point-adjustment.md](phase-a-point-adjustment.md)
- 참고 sample: [sample/adm/point_update.php](../sample/adm/point_update.php), [sample/adm/point_list.php](../sample/adm/point_list.php)
- 신규 DB 마이그레이션: `0013_point_history_actor.sql`

### Phase B: 결제/취소

회원의 결제 내역 조회와 환불·취소 처리. 환불 시 포인트 회수 로직과 직결되므로 Phase A의 이력 기반 패턴 그대로 재사용.

- 참고 sample: [sample/adm/coin_pay_history.php](../sample/adm/coin_pay_history.php), [sample/adm/coin_cancel.php](../sample/adm/coin_cancel.php)
- DB 사용: `payment`, `payment_cancel_log`, `point_history` ([api/db/migrations/0004_payment.sql](../api/db/migrations/0004_payment.sql))
- 상세: 추후 작성 (Phase A 완료 후 `phase-b-payment.md`)

### Phase C: 상담사/상담 관리

상담사 등록·수정 (단가, 정산율, 상태 등), 상담 이력 조회.

- 참고 sample: [sample/adm/counselor_list.php](../sample/adm/counselor_list.php), [sample/adm/counsel_history.php](../sample/adm/counsel_history.php), [sample/adm/coin_counsel_history.php](../sample/adm/coin_counsel_history.php)
- DB 사용: `member`(role='counselor'), `consultation`, `consultation_log` ([api/db/migrations/0003_consultation.sql](../api/db/migrations/0003_consultation.sql))

### Phase D: 정산 (월별)

상담 매출을 월별로 집계해 상담사에게 지급할 금액 계산.

- 참고 sample: [sample/adm/settlement_list.php](../sample/adm/settlement_list.php), [sample/adm/settlement_list_excel.php](../sample/adm/settlement_list_excel.php)
- 신규 설계: `g5_point_end`(월별 정산 별도 테이블) → `point_history.is_settled` 플래그로 통합
- ETL 매핑 주의

### Phase E: 게시판/콘텐츠

18개 게시판 (post_counselor, post_fortune, ... post_qa)과 [ContentList.tsx](../web/mng/src/pages/ContentList.tsx) (현재 placeholder) 실구현.

- 참고 sample: [sample/adm/board_list.php](../sample/adm/board_list.php), [sample/adm/board_form.php](../sample/adm/board_form.php) (78KB — 분해해서 공통 컴포넌트화)

### Phase F: 통계/대시보드 강화

[Dashboard.tsx](../web/mng/src/pages/Dashboard.tsx)의 더미 KPI를 실데이터 API로 연결. 일/월별 매출, 결제, 방문자 통계.

- 참고 sample: [sample/adm/revenue_list_day.php](../sample/adm/revenue_list_day.php), [sample/adm/revenue_list_month.php](../sample/adm/revenue_list_month.php), [sample/adm/pay_month.php](../sample/adm/pay_month.php)

### Phase G: 권한/감사

관리자 권한 관리 (`admin_permission` 테이블) + 모든 변경 작업의 감사로그 통일.

- 참고 sample: [sample/adm/auth_list.php](../sample/adm/auth_list.php), [sample/adm/admin.lib.php](../sample/adm/admin.lib.php)
- IP 화이트리스트는 환경변수/setting 테이블로 (코드 하드코딩 금지)

### ~~Phase H: 쇼핑몰~~ (제외 확정)

`sample/adm/shop_admin/` 112개 파일 — **사주문1에서 실제 운영 안 함, 완전 제외**. 신규 mng로 옮기지 않음.

---

## 분석/이관 제외 대상 (확정)

| 항목 | 파일 수 | 사유 |
|---|---|---|
| `sample/adm/shop_admin/` | 112 | 라이브 미사용 |
| `sample/adm/sms_admin/` | 44 | 라이브 미사용 |
| 백업 파일 (`*_20240xxx.php`, `*_20250xxx.php`, `*_backup.php`, `point_list_.php` 등) | ~25 | 신규 mng는 정리된 서비스 방식으로 새로 빌드 |
| **합계 제외** | **~181** | |

남은 분석 대상: **약 80개 핵심 파일**.

라이브에 살아있더라도 운영에 안 쓰는 메뉴(예: 일부 visit_*, poll_*)는 도메인별 분석 결과를 받은 뒤 사용자와 함께 추가로 컷.

---

## 공통 원칙 (모든 Phase 적용)

1. **모든 변경 작업은 트랜잭션 + 감사로그** — 누가, 언제, 무엇을, 왜 변경했는지 항상 기록
2. **SQL은 postgres.js 템플릿 리터럴 또는 파라미터 바인딩만 사용** — 문자열 직접 삽입 금지
3. **AdminAuthGuard 필수** — 모든 `/admin/*` 라우트에 적용
4. **CSR 패턴 유지** — 관리자(/mng)는 SPA, 사용자향 페이지(/web)는 SSR
5. **에러 메시지는 사용자에게 친화적으로** — 서버 응답의 `message` 필드를 기존 `api.ts`의 `ApiError`가 자동 표시
6. **ETL은 트랜잭션 단위로** — 도메인별 SQL 파일 (`api/db/etl/01_*.sql ~ NN_*.sql`) 작성
7. **레거시 호환은 mb_id, po_id 등 ETL용 컬럼만 유지** — 신규 코드는 `id`(BIGINT) PK 사용

---

## 작업 시작 체크리스트 (Phase별)

새 Phase 시작 시:
1. 해당 Phase의 상세 문서 (`phase-X-*.md`)를 이 폴더에 작성
2. 참고할 sample 파일 정독, 핵심 로직 추출
3. 신규 DB 컬럼/테이블 필요 시 새 마이그레이션 파일 추가
4. NestJS 모듈 → API → React 페이지 순서로 구현
5. ETL 스크립트 동시 작성
6. 검증: 트랜잭션 동시 호출, 권한 체크, 데이터 정합성
7. [DB_REFACTOR_PROGRESS.md](../DB_REFACTOR_PROGRESS.md)에 Phase 완료 기록

---

## 디렉토리 구조 (실제 작성된 파일)

```
PLAN/
├── README.md                              # 이 문서 (전체 인덱스)
├── IMPLEMENTATION_ROADMAP.md              # 9개 도메인 통합 실행 로드맵 ★
│
├── phase-a-point-adjustment.md            # Phase A 상세 (다음 세션 시작 지점)
│
├── domain-01-member-point.md              # 회원/포인트 정밀 분석
├── domain-02-payment-order.md             # 결제/주문 정밀 분석
├── domain-03-counselor-settlement.md      # 상담사/정산 정밀 분석
├── domain-03b-settlement-flow-trace.md    # 정산 cron 흐름 검증
├── domain-04-board-content.md             # 게시판/콘텐츠 정밀 분석
├── domain-05-notification.md              # 메일/푸시/알림톡 정밀 분석
├── domain-06-statistics.md                # 통계/방문/매출 정밀 분석
├── domain-07-infra-common.md              # 인프라/공통 정밀 분석
├── domain-08-auth-permission.md           # 인증/권한 정밀 분석
└── domain-09-system-settings.md           # 시스템/설정/소원다락방 정밀 분석
```

## 분석 완료 — 다음 단계

9개 도메인 정밀 분석이 완료되어 있고, [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)에 통합되어 있다.

다음 세션에서 [phase-a-point-adjustment.md](phase-a-point-adjustment.md)의 체크리스트로 Phase A 구현 시작.
