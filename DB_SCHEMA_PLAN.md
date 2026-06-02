# 사주플랜1 신규 DB 스키마 설계 플랜 (전체 테이블)

> 풀 DDL 작성 전 단계의 **테이블 목록·매핑·설계 의도** 정리 문서. 이게 합의되면 카테고리별로 풀 DDL 작성으로 넘어감.
> 마지막 업데이트: 2026-04-27

---

## 0. 정책 변경 요약 (이번 세션 결정)

| 항목 | 이전 | 변경 |
|---|---|---|
| 대상 DB | 라이브 DB에 `v2` 스키마 추가 | **새 서버에 새 DB** 처음부터 구축 |
| 드롭 리스트 | 영카트 잔재 폐기 | **모두 마이그레이션**, 의미 있게 재설계 |
| 테이블 수 | 약 45개 | **약 60~65개** (드롭 리스트 재설계 포함) |
| 네이밍 접미사 | `_t` 검토 → 철회 | **접두사·접미사 없는 단수형** 유지 |

---

## 1. 결정이 필요한 항목 (사용자 확인)

### 1-1. 소셜 로그인 — 평탄화 확정 (2026-04-27 사용자 결정)

**정책:**
- 한 사람이 다른 소셜 계정(카카오, 네이버, 애플 등)으로 가입하면 **별도 회원**이 만들어짐 (1 row = 1 계정)
- **동일인 중복 가입은 `phone` UNIQUE 제약으로 차단** — 같은 휴대폰 번호로는 두 번째 계정을 못 만듦
- 따라서 `member_social_profile` 별도 테이블 **불필요** → `member`에 평탄화

**`member` 테이블에 추가될 컬럼:**
```sql
social_provider    VARCHAR(20),       -- 'kakao' | 'naver' | 'apple' | 'google' | 'local' | NULL
social_uid         VARCHAR(255),      -- 소셜 측 사용자 식별자
social_email       VARCHAR(120),      -- 소셜 측 이메일 (member.email과 다를 수 있음)
social_linked_at   TIMESTAMPTZ        -- 소셜 연결 시각
```

**제약 조건:**
```sql
-- 같은 소셜 계정으로 두 번 가입 차단 (DB 강제)
CONSTRAINT uq_member_social UNIQUE (social_provider, social_uid)

-- phone 중복은 application 로직에서 차단 (사용자 결정 2026-04-27)
-- DB UNIQUE 제약은 두지 않음 → 레거시 중복 데이터 마이그레이션 가능
-- 단, 인덱스는 검색 성능용으로 둠:
CREATE INDEX idx_member_phone ON member (phone) WHERE phone IS NOT NULL;
```

**phone 중복 차단 정책:**
- NestJS auth 서비스의 회원가입 핸들러에서 `SELECT id FROM member WHERE phone = $1`로 사전 검증
- 트랜잭션 + advisory lock 또는 race condition 검토 필요 (동시 가입 시도 대비)
- 레거시 `g5_member.mb_hp` 중복은 ETL 시 그대로 들어옴 → 운영 시점에 운영자가 정리 결정

> 옵션: race condition까지 완벽 방어하려면 추후 `CREATE UNIQUE INDEX ... WHERE phone IS NOT NULL`을 추가할 수 있음 (단, 레거시 정리 후에)

### 1-2. 결제수단(자동결제) — 빌링키만 보존 확정 (2026-04-27 사용자 결정)

`g5_member_auto_pay`의 평문 카드번호/주민번호/비밀번호는 PCI/개인정보 위반 → 마이그레이션 시 **폐기**.

**`payment_method` 테이블에 살릴 컬럼:**
- `member_id`, `billkey`, `card_company`, `card_no_masked` (`1234-****-****-5678` 형태로 변환), `expires_at` (월/년 합성), `is_active` (`autopayflag` Y/N), `registered_at`

**버릴 컬럼:** `card_no`, `socno`, `pass`, `exp_month`, `exp_year`(원형), `coinamt`, `pushurl`, `mb_name`(중복), `telno`(중복)

### 1-3. `g5_write_way` — 폐기 확정 (2026-04-27 사용자 결정)

사용 안 함 → 마이그레이션 X. 아래 §2 카테고리 8 폐기 목록으로 이동.

---

## 2. 전체 테이블 목록 (재설계 후)

### 카테고리 1. 회원 / 인증 (8개)

| 신규 테이블 | 출처 (g5_*) | 비고 |
|---|---|---|
| `member` | `g5_member` (79→50컬럼) | 상담사 필드 평탄화 |
| `member_session` | `g5_login` (대체) | JWT/세션 토큰. 라이브 g5_login은 마이그 안 함 |
| `member_cert_history` | `g5_member_cert_history` + `g5_cert_history` | 본인인증 통합 |
| `member_status_log` | `member_status_history` | 상태 변경 이력 |
| `member_file` | `g5_member_file` | 회원 첨부파일 |
| `member_push_token` | `member_push` + `tbl_android_phone` | iOS/Android 토큰 통합. `gubun` → `platform` enum |
| `member_message` | `g5_memo` | 회원간 쪽지 (sender/receiver/content/read_at) |
| `sms_auth` | `sms_auth` | SMS 인증코드 (그대로) |

(소셜은 옵션 A 채택 시 `member`에 평탄화. 옵션 B면 `member_social_profile` 추가 → 9개)

### 카테고리 2. 게시판 / 콘텐츠 (24개)

| 신규 | 출처 | 비고 |
|---|---|---|
| `board` | `g5_board` (95컬럼→20컬럼) | 영카트 보드 옵션 대거 정리. 본문/모바일 스킨, count_*, write_min/max 등 폐기 |
| `board_group` | `g5_group` + `g5_group_member` | 보드 그룹화 (옵션) |
| `post_counselor` | `g5_write_counselor` | 상담사 프로필 ★핵심 |
| `post_fortune` | `g5_write_fortune` | 운세 콘텐츠 |
| `post_charm` | `g5_write_charm` | 부적/부신 |
| `post_wish` | `g5_write_wish` | 소원 |
| `post_wish_event` | `g5_write_wish_event` | 소원 이벤트 |
| `post_column` | `g5_write_column` | 컬럼/조언 |
| `post_notice` | `g5_write_notice` | 공지 |
| `post_event` | `g5_write_event` | 이벤트 |
| `post_review` | `g5_write_review` | 리뷰 |
| `post_qa` | `g5_write_qa` | Q&A 게시판 |
| `post_apply` | `g5_write_apply` | 상담사 신청 |
| `post_chat_room` | `g5_write_chat_room` | 채팅방 소개 |
| `post_benefit` | `g5_write_c_benefits` | 상담사 혜택 |
| `post_history` | `g5_write_c_history` | 상담사 이력 |
| `post_tip` | `g5_write_c_tip` | 상담사 팁 |
| `post_c_notice` | `g5_write_c_notice` | 상담사 공지 |
| `post_c_faq` | `g5_write_c_faq` | 상담사 FAQ |
| `post_new` | `g5_write_new` | 신규 콘텐츠 (정체 확인 필요) |
| `post_file` | `g5_board_file` | 모든 보드 첨부 (board_slug + post_id polymorphic) |
| `post_comment` | (생성) | 모든 보드 공통 댓글 (현재는 wr_is_comment로 같은 테이블에 섞여있음) |
| `post_like` | `g5_board_good` | 좋아요/싫어요 (`bg_flag` → `like`/`dislike`) |
| `post_report` | `g5_board_singo` | 신고 |
| `post_scrap` | `g5_scrap` | 스크랩 |
| `post_autosave` | `g5_autosave` | 글 자동저장 |

> ⚠️ `g5_board_new`(신규글 마커)는 폐기. `created_at`로 계산 가능.

### 카테고리 3. 상담 / 사주 도메인 (7개)

| 신규 | 출처 | 비고 |
|---|---|---|
| `consultation` | `platform_consulting` | 상담 세션 |
| `consultation_log` | `platform_consulting_log` | 상담 이벤트 로그 |
| `consultation_request` | `request_consulting_t` | 상담 신청 |
| `chat_room` | `chat_room` | 채팅방 (그대로 컬럼만 정리) |
| `chat_message` | `chat_t` | 채팅 메시지 |
| `reservation` | `saju_resv` | 사주 예약 |
| `inquiry` | `g5_qa_content` | 1:1 문의 (Q&A 게시판과 분리, 본인+admin만 조회) |

### 카테고리 4. 결제 / 포인트 (8개)

| 신규 | 출처 | 비고 |
|---|---|---|
| `payment` | `saju_payment` | 결제 마스터 |
| `payment_outbox` | `saju_pay_outbox` | 결제 알림 큐 |
| `payment_cancel_log` | `payment_cancel_log_t` | 환불/취소 |
| `payment_method` | `g5_member_auto_pay` | **빌링키만 보존, 평문 카드/주민번호 폐기** |
| `point` | (집계) | 회원별 포인트 잔액 |
| `point_history` | `g5_point` + `g5_point_end` | 포인트 변동 통합 |
| `coupon` | `g5_shop_coupon` + `g5_shop_coupon_zone` | 쿠폰 + 적용범위 |
| `coupon_history` | `g5_shop_coupon_log` | 쿠폰 사용 이력 |

### 카테고리 5. 쇼핑 (12개) — Phase 후순위

| 신규 | 출처 |
|---|---|
| `product` | `g5_shop_item` |
| `product_option` | `g5_shop_item_option` |
| `product_relation` | `g5_shop_item_relation` |
| `product_qa` | `g5_shop_item_qa` |
| `product_use_log` | `g5_shop_item_use` |
| `product_stocksms` | `g5_shop_item_stocksms` |
| `category` | `g5_shop_category` |
| `banner` | `g5_shop_banner` |
| `cart` | `g5_shop_cart` |
| `wishlist` | `g5_shop_wish` |
| `order` | `g5_shop_order` |
| `order_item` | (g5_shop_order JSON 컬럼에서 분해 필요할 수도) |
| `order_address` | `g5_shop_order_address` |
| `order_data_log` | `g5_shop_order_data` |
| `order_delete_log` | `g5_shop_order_delete` |
| `order_post_log` | `g5_shop_order_post_log` |
| `personal_pay` | `g5_shop_personalpay` |
| `sendcost` | `g5_shop_sendcost` |
| `shop_event` | `g5_shop_event` + `g5_shop_event_item` |
| `shop_inicis_log` | `g5_shop_inicis_log` |

(약 18개. 필요하면 추후 절반은 폐기 검토)

### 카테고리 6. CMS / 시스템 / 운영 (15개)

| 신규 | 출처 | 비고 |
|---|---|---|
| `page` | `g5_content` | 정적 페이지 |
| `faq` | `g5_faq` | FAQ |
| `faq_category` | `g5_faq_master` | FAQ 카테고리 |
| `setting` | `g5_config` + `g5_shop_default` + `saju_config` + `g5_qa_config` + `sms5_config` | **key/value로 통합** |
| `account_setting` | `account_config` | 결제 상품 설정 |
| `site_menu` | `g5_menu` | 메뉴 정의 |
| `popup_notice` | `g5_new_win` | 팝업 공지 |
| `poll` | `g5_poll` (po_poll1~9 정규화) | 투표 마스터 |
| `poll_option` | `g5_poll` (po_poll1~9 → row 분해) | 투표 옵션 정규화 |
| `poll_vote` | `g5_poll.po_ips`, `mb_ids` (분해) | 투표자 |
| `poll_comment` | `g5_poll_etc` | 투표 의견 |
| `search_log` | (확장) | 검색 raw 로그 (`g5_popular`보다 풍부하게) |
| `search_popular_daily` | `g5_popular` | 일별 인기검색어 집계 |
| `visit_log` | `g5_visit` | 방문 raw (파티션 권장) |
| `visit_summary` | `g5_visit_sum` | 일별 집계 |
| `email_send_log` | `g5_mail` | 메일 발송 이력 |
| `cron_job_log` | `crontab_t` | 크론 실행 로그 (운영은 pg_cron으로) |
| `admin_permission` | `g5_auth` | RBAC 재설계: (member_id, resource, actions) |

### 카테고리 7. 알림톡 / SMS (8개)

| 신규 | 출처 | 비고 |
|---|---|---|
| `alimtalk_template` | `g5_alimtalk_tplmsg` | 알림톡 템플릿 (버튼 5개 → JSONB 정규화) |
| `alimtalk_event_binding` | `g5_alimtalk_tplsel` | 이벤트 → 템플릿 매핑 |
| `sms_template` | `sms5_form` | SMS 양식 |
| `sms_template_group` | `sms5_form_group` | 양식 그룹 |
| `sms_contact` | `sms5_book` | 주소록 |
| `sms_contact_group` | `sms5_book_group` | 주소록 그룹 |
| `sms_send_batch` | `sms5_write` | 발송 배치 (예약/메시지/결과집계) |
| `sms_send_log` | `sms5_history` | 수신자별 발송 결과 |

### 카테고리 8. 진짜 폐기 (마이그레이션 X)

| 폐기 | 이유 |
|---|---|
| `g5_uniqid` | 그누보드 내부 ID 생성기. PostgreSQL `BIGSERIAL`로 대체 |
| `g5_login` | 현재 접속자 표시용 IP 캐시. 의미 없음, member_session으로 대체 |
| `g5_board_new` | 신규글 마커. `created_at`로 계산 가능 |
| `g5_popular`의 IP 단위 raw | `pp_ip` per row는 과함. `search_log`에 집계 형태로만 |
| `g5_write_way` | 사용 안 함 (사용자 확인 2026-04-27) |

> 합계: **약 73개 신규 테이블 + 4개 폐기**. 옵션 A 채택 + 쇼핑 절반 정리 시 60~65개로 줄어듦.

---

## 3. 구조 개선 포인트 (영카트 → 깔끔)

### 3-1. 타입 정확화
- 모든 `varchar(255)` 금액·시간·플래그 → `INT` / `TIMESTAMPTZ` / `BOOLEAN`
- `datetime DEFAULT '0000-00-00 00:00:00'` → `TIMESTAMPTZ` (NULL 허용)
- 'Y'/'N' enum → `BOOLEAN`
- `mb_level 0/5/10` → `role` enum (`'user'`, `'counselor'`, `'admin'`)

### 3-2. 정규화
- `g5_poll.po_poll1~9, po_cnt1~9` → `poll_option` row
- `g5_member.ev_1~ev_5` → `member.ev_flags JSONB`
- `g5_alimtalk_tplmsg.at_button1~5_*` → `buttons JSONB`
- `g5_member.mb_zip1+mb_zip2` → 하나의 `zip VARCHAR(6)`
- `g5_write_*.wr_1~wr_10` → 도메인별 의미 컬럼으로 분해 (이미 post_counselor 예시)

### 3-3. 통합
- 흩어진 설정 테이블 5개(`g5_config`, `g5_shop_default`, `saju_config`, `g5_qa_config`, `sms5_config`) → `setting` (namespace, key, value, type, updated_at)
- 본인인증 이력 2개(`g5_cert_history`, `g5_member_cert_history`) → `member_cert_history`
- 첨부파일 3종(`g5_board_file`, `g5_member_file`, 기타) → 공통 패턴

### 3-4. 폐기
- 영카트 보드 옵션의 90% (skin/include_head/board_subject_len/sort_field/...) → 코드 레벨에서 처리, DB에서 제거
- `mb_password2`, `mb_homepage`, `mb_recommend`, `mb_dupinfo`, `mb_open`, `mb_lost_certify` 등 영카트 회원 잔재 컬럼

### 3-5. 보안 강화
- `g5_member.mb_password` bcrypt 재해시 (또는 그대로 살리되 Phase 5에서 점진 재해시)
- `g5_member_auto_pay.card_no`, `socno`, `pass` 등 평문 카드/주민번호 → 마이그레이션 시 **버림**, 빌링키만 보존
- `mb_ip`, `vi_ip` → `INET` 타입 + 운영자만 조회

### 3-6. 인덱스 추가
- `member`: role, passcall_id, (state, use_phone), (state, use_chat), last_login_at
- `post_*`: (board_id, created_at DESC), member_id
- `payment`: (member_id, created_at DESC), status
- `chat_message`: (chat_room_id, created_at)
- `visit_log`: 파티션 (vi_date) 또는 TimescaleDB

---

## 4. ETL 흐름 (새 서버 구축)

```
[1] 새 서버에 PostgreSQL 15+ 설치 (호스트/포트/DB명/계정 미정 — 사용자 확인 필요)
[2] 새 DB 생성: CREATE DATABASE sajumoon_db;
[3] 임시 영카트 dump 복원:
    - 새 서버에 임시 schema `legacy` 생성
    - sajumoon_db_2026-04-24.sql을 MySQL→PG 변환 후 legacy 스키마에 적재
    - 또는 별도 인스턴스에서 dump 복원 후 FDW로 연결
[4] 신규 스키마 DDL 실행:
    - api/db/migrations/0001_init.sql ~ 0010_*.sql 트랜잭션 내 순차 실행
    - 모든 테이블이 public 또는 단일 schema에 생성됨
[5] ETL 스크립트 실행 (api/db/etl/01_*.sql ~ 30_*.sql):
    - INSERT INTO member SELECT ... FROM legacy.g5_member
    - 멱등성: ON CONFLICT (legacy_id) DO NOTHING
[6] 검증 (99_verify.sql): 행 수 비교, 샘플 spot check
[7] legacy 스키마는 한 달 후 DROP, 또는 별도 보관 DB로 이전
```

---

## 5. 이번 합의 후 다음 작업

- [x] **소셜 로그인 정책** (1-1) — 평탄화 + phone 중복은 로직에서 차단 (2026-04-27)
- [x] **`g5_write_way`** (1-3) — 폐기 (2026-04-27)
- [x] **카드정보 처리** (1-2) — 빌링키만 보존, 평문 카드/주민번호 폐기 (2026-04-27)
- [ ] **새 서버 정보** (호스트/포트/DB명/계정) 확보 — DDL 적용 시점에 필요
- [ ] 카테고리별 풀 DDL 작성 (회원→게시판→상담→결제→CMS/SMS→쇼핑 순)
- [ ] 마이그레이션 러너 스크립트 (`api/db/migrate.ts`)
- [ ] ETL SQL 파일 30여 개

---

## 6. 작업 재개 절차

1. 이 파일 + [DB_REFACTOR_PROGRESS.md](DB_REFACTOR_PROGRESS.md) 먼저 읽기
2. 위 "이번 합의 후 다음 작업"에서 첫 번째 미해결 항목 확인
3. 사용자에게 진행 상태 확인 후 다음 단계 진입
