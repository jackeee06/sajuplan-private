# 사주문1 DB 리팩토링 진행 상황

> 이 문서는 작업 재개 시 컨텍스트 복원용입니다. 새 세션이 시작되면 가장 먼저 이 파일을 읽으세요.
> 마지막 업데이트: 2026-04-27
>
> ⚠️ **프론트엔드는 SSR로 작업합니다.** 자세한 내용은 [PROJECT_NOTES.md](PROJECT_NOTES.md) 참고.

---

## 한 줄 요약

운영 중인 `sajumoon_db`(영카트 `g5_*` 잔재 가득)는 **건드리지 않고**, **새 서버에 새 DB를 깨끗하게 새로 구축**하는 중. NestJS + React 신규 시스템용 스키마 설계 단계.

---

## ⚠️ 중요한 컨텍스트 정정 (2026-04-27)

이전 플랜 파일([../../../../.claude/plans/misty-hugging-lollipop.md](../../../.claude/plans/misty-hugging-lollipop.md))은 **"같은 라이브 DB에 `v2` 스키마를 추가"** 전제로 작성되어 있음. 사용자가 정정함:

> "지금 돌고있는 사주문 DB를 고치라는게 아니야. 지금 새로운 서버쪽에 DB를 다시 깔끔히 정리중인거야"

따라서 다음 항목은 **반영 필요**:
- ETL 소스가 라이브 DB(`104.64.128.103`)가 아니라 **dump 파일** (`sajumoon_db_2026-04-24.sql`)
- 작업 대상은 **테스트 서버 `172.235.211.75`** — 여기에 새 깨끗한 DB 구축
- 새 DB는 **별도 서버**의 새 PostgreSQL 인스턴스 (호스트/포트 미정 → 사용자 확인 필요)
- 따라서 `INSERT INTO member SELECT ... FROM public.g5_member`는 **임시 복원 DB → 새 클린 DB**로 이동 형태가 됨
- 라이브 DB는 손댈 일이 없으므로 `pg_dump` 백업 항목은 우선순위 낮음 (대신 dump 파일은 이미 있음)

---

## 핵심 결정 사항 (사용자 확정)

| 항목 | 선택 |
|---|---|
| DB 엔진 | PostgreSQL 15+ |
| 데이터 보존 범위 | **레거시 거의 다 마이그레이션**, 단 의미 있게 재설계 (2026-04-27 정정) |
| 네이밍 컨벤션 | **접두사·접미사 없이 단수형** (`member`, `board`, `post`, `payment`) |
| ORM | **없음** — `postgres.js` + 태그드 템플릿 SQL |
| 게시판 구조 | 18개 보드 → 게시판별 독립 테이블 유지 (`post_counselor`, `post_fortune`, `post_charm` ...) |
| 상담사 필드 | `member` 테이블에 평탄화 (별도 `counselor_profile` 안 만듦) |
| 총 테이블 수 | **약 60~65개** (드롭 리스트 재설계 포함) |

> 전체 테이블 목록과 매핑 상세는 [DB_SCHEMA_PLAN.md](DB_SCHEMA_PLAN.md) 참조.

---

## 영카트 → 신규 매핑 (핵심 사례)

`g5_member`의 익명 컬럼 의미 — 이거 잊으면 안 됨:

| 영카트 | 신규 | 의미 |
|---|---|---|
| `mb_1` | `passcall_id` | PassCall 상담사 ID (외부 콜플랫폼) |
| `mb_2` | `counselor_priority` | 연결 순위 |
| `mb_3` | `counselor_phone` | 상담사 실 전화번호 |
| `mb_4` | `call_070_unit_cost` | 070 분당 단가 |
| `mb_10` | (제거) | `mb_sex`와 중복된 성별 |
| `mb_11` | `calendar_type` | SOLAR / LUNAR |
| `mb_21` | `acquisition_source` | 유입 경로 |

---

## Phase 진행 상태

- [x] **Phase 0: 분석** — 영카트 컬럼 의미 추적, 도메인 분류
- [x] **Phase 1: 결정 합의** — 네이밍/ORM/게시판 구조/상담사 평탄화
- [x] **Phase 2a: 전체 테이블 목록·매핑 정리** — [DB_SCHEMA_PLAN.md](DB_SCHEMA_PLAN.md) 작성. 약 60~65개 신규 테이블 + 5개 폐기 결정
- [x] **Phase 2b: 사용자 결정** — 소셜 평탄화, phone은 로직 차단, 카드 빌링키만, g5_write_way 폐기 (2026-04-27)
- [ ] **Phase 2c: 카테고리별 풀 DDL 작성** — 회원→게시판→상담→결제→CMS/SMS→쇼핑 순
- [ ] **Phase 3: 인프라 셋업** — `postgres.js` 추가, `api/src/shared/db/`, `api/.env DATABASE_URL` 설정
- [ ] **Phase 4: 마이그레이션 러너** — `api/db/migrations/*.sql` + 러너 스크립트
- [ ] **Phase 5: ETL** — `api/db/etl/01_member.sql` ~ `30_*.sql` + `99_verify.sql`
- [ ] **Phase 6: NestJS 서비스 코드** — admin 멤버 API부터
- [ ] **Phase 7: 컷오버** — 별도 플랜 필요

---

## 완료된 산출물

- 플랜 파일: [../../../../.claude/plans/misty-hugging-lollipop.md](../../../.claude/plans/misty-hugging-lollipop.md) (669줄)
  - Context, 인프라 사실, 결정 사항, 카테고리별 테이블 목록, 일부 컬럼 매핑, 보안 체크리스트, 검증 방법 포함
- 회원 풀 DDL 초안 (`member` 테이블 약 50컬럼)
- 게시판 예시 DDL (`post_counselor`)
- 보안 8항목 + 안전 체크리스트

---

## 미완 작업

1. **약 45개 테이블 전체의 풀 DDL 작성** — 현재 회원/일부 게시판만 작성됨
2. **ETL 스크립트 (`01_member.sql` ~ `15_*.sql`)** — 한 줄도 안 씀
3. **NestJS 인프라** — `postgres.js` 미설치, `api/src/shared/db/` 미생성
4. **마이그레이션 러너** — 없음
5. **새 서버 정보** — 호스트/포트/DB명/계정 미확정 (사용자 확인 필요)

---

## 안전 체크리스트 (작업 재개 시 확인)

- [x] dump 파일 존재: [sajumoon_db_2026-04-24.sql](sajumoon_db_2026-04-24.sql)
- [ ] 새 서버 PostgreSQL 인스턴스 정보 확보
- [ ] 신규 DB는 격리된 서버, 라이브 DB와 네트워크/계정 분리 확인
- [ ] DDL은 트랜잭션 (`BEGIN; ... COMMIT;`) 내 실행
- [ ] ETL 멱등성 (`ON CONFLICT DO NOTHING` 또는 IF NOT EXISTS)
- [ ] DROP/RENAME/TRUNCATE는 라이브 DB(`104.64.128.103`) 대상 **절대 금지**
- [x] 작업 대상은 **테스트 서버 `172.235.211.75`** (2026-04-27 사용자 확인)
- [ ] 매 phase 진입 전 사용자 명시 승인

---

## 주요 경로

| 용도 | 경로 |
|---|---|
| 프로젝트 루트 | [/Users/jin-yubi/dwork/AI/사주문1/](.) |
| NestJS API 스켈레톤 | [api/](api/) |
| Admin 웹 (React+Vite) | [web/mng/](web/mng/) |
| 레거시 PHP (의미 추적용) | [/Users/jin-yubi/dwork/AI/사주문/](../사주문/) |
| 영카트 dump | [sajumoon_db_2026-04-24.sql](sajumoon_db_2026-04-24.sql) |
| 상세 플랜 | [../../../../.claude/plans/misty-hugging-lollipop.md](../../../.claude/plans/misty-hugging-lollipop.md) |

---

## 작업 재개 절차

1. 이 파일을 먼저 읽음
2. 위의 "Phase 진행 상태"에서 `[~]` 또는 첫 번째 `[ ]` 단계 확인
3. 사용자에게 "지금 X단계 진행 중이었음. 계속할까요?" 확인
4. 새 서버 정보가 비어 있으면 먼저 확인 받기
5. 단계별 산출물(DDL/ETL SQL/코드) 만들면 이 파일 업데이트
