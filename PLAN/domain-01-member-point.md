# 도메인 01: 회원/고객 + 포인트

> **분석 범위:** `sample/adm/member_*.php`, `sample/adm/member_xls/*.php`, `sample/adm/point_*.php`
> **(백업 `*_2024xxxx`, `*_2025xxxx`, `member_form1.php`, `point_list_.php` 제외)**
>
> **대상:** PHP 그누보드5 → React(`web/mng`) + NestJS(`api/src/admin`) 이관

---

## 개요

이 도메인은 라이브 관리자에서 **회원 마스터(g5_member)** 와 **포인트 변동(g5_point)** 을 다루는 가장 핵심적인 영역이다.
- **회원 카테고리:** 회원 검색/필터 → 상세 폼 → 저장/삭제(소프트/하드) → 일괄 처리(CSV/엑셀)
- **포인트 카테고리:** 포인트 변동 이력 조회 → 수동 가감(+/-) → 이력 삭제 → 엑셀 추출

데이터 흐름:
```
[admin 화면] → member_list*.php / point_list.php (조회 + 검색 폼)
            → member_form.php (단건 폼)
            → member_form_update.php / point_update.php (DB 쓰기)
            → goto_url() 리다이렉트로 list 화면 복귀
```

회원과 포인트가 강하게 묶여 있다:
1. `member.mb_point` 컬럼이 단일 합계로 **별도 캐시**되어 있음 (g5 패턴).
2. `point` 테이블(`g5_point`)은 **변동 row 누적**. `po_mb_point`(잔액 후) 컬럼으로 스냅샷.
3. 두 곳을 동기화하는 책임이 **공통 함수(insert_point/get_point_sum)** 에 분산.
4. **mtonet(외부 결제/상담 게이트웨이)** 과 회원 작업 시 동기화 — `mb_1`(membid/csrid)에 외부 PK 저장.

라이브 운영 측면에서 사고 위험이 높은 부분(분석 결과 요약, 자세한 건 본문):
- **모든 검색/저장 SQL이 변수 직접 삽입** — SQL injection 다발.
- **포인트 가감/회원 일괄 수정에 트랜잭션 없음**, 검증 누락.
- **point_update.php 는 IP별로 분기되어 사내 IP에서만 음수 검증** 작동(나머지 환경에서 동일 검증이 추가로 있긴 하지만 해당 분기 자체가 잘못된 패턴).
- **member_xls_update.php** 의 `mb_datetime = '{!mb_datetime}'`는 명백한 버그 (느낌표 prefix).
- **member_list_update.php**가 `<pre>print_r($_POST)`를 production에 그대로 출력.
- **member_form.php** 가 매 요청마다 `ALTER TABLE` (회원 컬럼 자동추가 try) 실행.

---

## DB 테이블 인벤토리

| 영카트 테이블 | 사용 컬럼 (요약) | 신규 매핑 |
|---|---|---|
| `g5_member` | mb_id, mb_password, mb_name, mb_nick, mb_email, mb_hp, mb_tel, mb_level (2/5/10), mb_point, mb_intercept_date, mb_leave_date, mb_datetime, mb_today_login, mb_login_ip, mb_ip, mb_certify, mb_adult, mb_zip1/2, mb_addr1~3, mb_addr_jibeon, mb_recommend, mb_mailling, mb_sms, mb_open, mb_birth, mb_time, mb_1~mb_20 (의미 평탄화), mb_no, state, use_phone, use_chat, mb_sort, mb_rising, ev_1~ev_5, org_source | `member` (0001) |
| `g5_member_cert_history` | ch_id, mb_id, ch_name, ch_hp, ch_birth, ch_type, ch_datetime | `member_cert_history` (0001) |
| `g5_member_file` | mb_id, bf_no, bf_source, bf_file, bf_filesize, bf_width, bf_height, bf_type, bf_datetime | `member_file` (0001) |
| `g5_group_member` | mb_id, gr_id (그룹 권한) | (B-G 권한은 폐기 또는 별도 phase) |
| `g5_point` | po_id, mb_id, po_datetime, po_content, po_point, po_use_point, po_expired, po_expire_date, po_mb_point, po_rel_table, po_rel_id, po_rel_action | `point_history` (0004) + `point` (0004 집계) |
| `g5_write_counselor` | wr_id, mb_id, amt, sec | (상담사 도메인 별도) |
| `g5_shop_coupon` | mb_id 카운트만 사용 (고객 리스트에서) | `coupon` (0004) |
| `platform_consulting` | csrid, membid, from(전화번호), preflag, reason, usetm, amt | `consultation` (0003) |

**핵심 관찰:** 회원 권한은 `mb_level` 정수형 (2=일반/5=상담사/10+=관리자). 신규 스키마에서는 `role` (user/counselor/admin) + `level` 정수 두 컬럼으로 분리되어 있어 ETL 시 `level=2 → role=user`, `level=5 → role=counselor`, `level≥10 → role=admin` 매핑.

---

## 파일별 분석

### 1) `member_list.php` (전체 회원 목록)

- **역할:** 모든 회원을 한눈에 보는 관리자 메인 회원 리스트. 차단/탈퇴/상담사/일반 카운트, 메일/SMS/차단 토글, 권한 변경 멀티수정.
- **엔드포인트:** `GET /adm/member_list.php`. `form action="./member_list_update.php" method="post"`로 일괄 처리.
- **읽는 테이블/쿼리:**
  - `g5_member` count + 페이지네이션 select
  - `g5_member` 추가 5회 count (탈퇴/차단/상담사/일반)
  - row마다 `g5_group_member` count (N+1 — `for` 루프 안에서 매 회원당 query)
- **쓰는 테이블:** 없음 (조회 전용)
- **입력 파라미터:** `sfl`, `stx`, `sst`, `sod`, `page` (모두 GET)
  - `sfl`은 화이트리스트 없음 — 컬럼명을 그대로 SQL에 삽입
  - `stx`도 인용 없이 SQL에 삽입
- **출력:** HTML (관리자 페이지)
- **비즈니스 로직:**
  ```
  검색 sfl/stx 파싱 → g5_member where 조건 작성 → 4번의 count
  → 페이지네이션 → row 출력 (각 row: 그룹수 추가 조회, 사이드뷰 닉네임, 권한 select 렌더링)
  ```
- **외부 의존성:** `_common.php` (auth, $g5, $config, $member, $is_admin, $auth), `admin.head.php`, `admin.tail.php`, `get_member_level_select`, `get_sideview`, `get_paging`, `subject_sort_link`, social_login_link_account
- **이슈:**
  - **SQL injection (Critical):** `where ({$sfl} like '{$stx}%')` — 컬럼명/값 모두 변수 직접 삽입. `sfl=mb_id) or 1=1 --` 등으로 우회 가능
  - **N+1 쿼리:** for 루프 내 group_member count
  - **count 4회 + select** — 단일 쿼리로 통합 가능
  - 권한 비교 `mb_level <= '{member['mb_level']}'`도 변수 보간

### 2) `member_list_customer.php` (고객 목록)

- **역할:** 일반 고객 위주의 정밀 리스트. 가입경로, 결제/상담 누적, 쿠폰수, 가입경과일, 마지막 접속까지 포함된 운영용 화면. **현재 가장 활발하게 쓰이는 화면.**
- **엔드포인트:** `GET /adm/member_list_customer.php`
- **읽는 테이블:**
  - `g5_member` (메인)
  - row마다 `g5_group_member` count
  - row마다 `g5_shop_coupon` count
  - row마다 `platform_consulting` 누적합 (070/060 분리, 환불 제외 복잡 CASE WHEN, 상담사 분당요금 lookup 서브쿼리 포함)
  - row마다 `get_member_pay_count`, `get_join_dur` 호출
- **쓰는 테이블:** 없음
- **입력 파라미터:** `sfl`, `stx`, `mb_status`(1=차단/2=탈퇴), `fr_date`, `to_date`, `page`
  - `fr_date`/`to_date`는 정규식 검증 (좋음)
  - `sfl`/`stx`는 미검증 (위험)
- **출력:** HTML + 엑셀다운로드 링크
- **비즈니스 로직:**
  ```
  날짜 검증 → 조건 누적 → count 6회 → 페이지 select
  → row 출력 (소셜 아이콘, 권한 select, 결제건수, 누적결제(평일에만 페이지 로드시 N건당 6 query))
  ```
- **외부 의존성:** `format_phone`, `getAge`, `get_member_pay_count`, `get_con_pay_sum`, `get_join_dur`, `social_login_link_account`, `social_get_provider_service_name`, `print_address`, `subject_sort_link`
- **이슈:**
  - **SQL injection 동일** (sfl/stx 보간)
  - **심각한 N+1:** 한 row 당 평균 6~8개 query. 100건 조회 시 600~800 query
  - row마다 `get_member` 도 호출 (point_list.php 내부 호출 패턴)
  - HTML 안에 비즈니스 로직(070/060 누적결제 SQL)이 직접 임베드됨
  - 비활성 상담사/일반 카운트는 동일 페이지에서 재사용 안 되는데도 매번 계산
  - `mb_status` 변수 register_globals 의존 (직접 `$_POST`/`$_GET` 안 읽고 글로벌)

### 3) `member_list_customer_excel.php` (고객 엑셀)

- **역할:** 위 리스트를 그대로 .xls로 다운로드.
- **엔드포인트:** `GET /adm/member_list_customer_excel.php?...`
- **읽는 테이블:** 동일 (limit 없이 전체)
- **출력:** `Content-Type: application/vnd.ms-excel` 헤더 + HTML table
- **이슈:**
  - **SQL injection 동일**
  - **메모리 위험:** limit 없는 전체 select. 회원 50000명이면 OOM 가능
  - 사용자별 N+1 동일하게 발생 (전 회원에 대해)
  - .xls가 실제로는 HTML — Excel 호환성 깨지기 쉬움

### 4) `member_form.php` (회원 상세/수정 화면)

- **역할:** 회원 단건 등록/수정 폼. 일반/상담사/관리자 모두 동일 폼.
- **엔드포인트:** `GET /adm/member_form.php?w=u&mb_id=xxx` (수정), `GET /adm/member_form.php` (신규)
- **읽는 테이블:** `g5_member`, `g5_member_cert_history`, `g5_write_counselor`(상담사 프로필 link)
- **쓰는 테이블:** ⚠️ **이 화면이 매 요청마다 ALTER TABLE 실행**:
  - `mb_certify` 컬럼 타입 자동 변경 (날짜→TINYINT)
  - `mb_adult`, `mb_addr_jibeon`, `mb_addr3`, `mb_dupinfo`, `mb_email_certify2` 컬럼 자동 추가 시도
  - `g5_member_cert_history` 테이블 자동 생성 시도
- **입력 파라미터:** `w`, `mb_id`, `sfl`, `stx`, `sst`, `sod`, `page` (GET)
- **출력:** HTML 폼
- **외부 의존성:** `register.lib.php`, `thumbnail.lib.php`, `get_member`, `is_admin`, `auth_check_menu`
- **이슈:**
  - ⚠️ **요청마다 DDL 실행 (Critical):** lock contention 위험. 이미 컬럼이 있어도 `ALTER TABLE ... ADD` 시도(에러 무시).
  - 권한 검사: `if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level'])` 만 — 자기보다 낮은 권한만 수정 가능. 그러나 super 가 아니면 `member_form.php` 자체에는 들어올 수 있어서 일반 admin도 다른 admin 폼 진입 가능
  - 포인트 필드 `mb_point` 가 화면에 readonly로 표시되지만 **실제로는 `name="mb_point"`로 폼에 포함** 되어 다음 화면으로 전송됨 (직접 hidden 필드를 조작하면 우회 가능)

### 5) `member_form_update.php` (회원 저장 처리)

- **역할:** 회원 신규 등록/수정 처리. 가장 큰 PHP 파일(36k). 회원 + mtonet(외부 시스템) + 상담사 프로필 + 첨부파일 + 회원이미지/아이콘 + 본인인증을 한 트랜잭션 안에 처리(트랜잭션은 없음).
- **엔드포인트:** `POST /adm/member_form_update.php`
- **읽는 테이블:** `g5_member`, `g5_write_counselor`, `g5_member_file`
- **쓰는 테이블:**
  - `g5_member` insert(신규) / update(수정)
  - `g5_write_counselor` update (상담사 프로필 amt/sec 동기화)
  - `g5_member_file` insert/update/delete (첨부파일)
  - 회원 이미지/아이콘 파일시스템 쓰기 (G5_DATA_PATH/member/, /member_image/, /member2/)
- **입력 파라미터:** 30개 이상 POST 필드 (mb_id, mb_no, mb_certify_case, mb_certify, mb_zip, org_source, use_phone, use_chat, mb_hp, state, mb_email, mb_nick, mb_sort, mb_rising, mb_2~mb_20, mb_8_1/2/3, mb_memo, ev_1~ev_3, mb_password, w, smode, ...)
- **출력:** `goto_url('./member_form.php?...&mb_id=...')` 리다이렉트
- **외부 의존성:**
  - `register.lib.php`, `thumbnail.lib.php`
  - `send_mjson($murl, $data, 'POST'|'PUT'|'DELETE', $csrid)` — mtonet REST API 호출
  - `set_constate($mb_id, $state_final)` — 상태 변경 로그
  - `set_crs_status_chg($csrid, $state_final)` — AG9 채팅 서버 상태 동기화
  - `set_resv_alrm($mb_id, $state_final)` — 예약 알림
  - `get_counselor_ready_state($use_phone, $use_chat)` (이 파일 내 정의)
- **비즈니스 로직 (의사코드):**
  ```
  check_demo() → check_admin_token() (CSRF)
  POST 파싱 → posts[] 배열 (clean_xss_tags)
  state_final 결정:
    if mb_level=5 (상담사):
      ABSE → 그대로
      CONN/RESV/CRDY → 그대로
      else → use_phone+use_chat 토글에 따라 RDVC/RDCH/IDLE/ABSE
  if w == '' (신규):
    중복체크 → INSERT g5_member
    상담사 프로필 update
    if mb_level=5: mtonet csr-mgr POST + set_constate + set_crs_status_chg
    if mb_level=2~4: mtonet memb-mgr POST
  else if w == 'u' (수정):
    권한 검증 (자신보다 높거나 같은 권한 수정 불가)
    UPDATE g5_member
    상담사 프로필 update
    이전등급/현등급 조합으로 mtonet API:
      일반→상담사: csr-mgr POST + memb-mgr DELETE
      상담사→일반: csr-mgr DELETE + memb-mgr POST
      상담사→상담사: csr-mgr PUT
      일반→일반: memb-mgr PUT (mb_1 비어있으면 POST 후 다시 PUT)
    set_constate + set_crs_status_chg
  파일/이미지 업로드 처리 (mb_icon, mb_img, bf_file[])
  redirect → member_form.php (smode=1이면 member_form1.php)
  ```
- **이슈 (이 파일이 가장 많음):**
  - **SQL injection (Critical):** `mb_name = '{$posts['mb_name']}'` 등 모든 컬럼 보간. `clean_xss_tags`는 XSS 처리지 SQL 이스케이프 아님
  - **트랜잭션 없음 (Critical):** g5_member insert → mtonet API → mb_1 update 가 분리 실행. 중간 실패 시 정합성 깨짐. mtonet가 등록됐는데 DB에 mb_1이 안 들어가는 케이스 존재 가능
  - **에러 복구 부재:** `@sql_query()` 로 에러 묵살. mtonet API 실패 알림은 alert()이지만 일부 분기에선 주석처리됨 (line 411, 462, 495, 537)
  - **하드코딩된 mtonet URL:** `csr-mgr`, `memb-mgr` 엔드포인트 문자열
  - **mb_level 정수 검증 없음:** 임의 정수가 들어올 수 있음
  - **이메일/닉네임 중복체크 모두 주석처리** (line 213-223, 352-362)
  - **상담사 mb_2 default = "1"** 하드코딩 (sortno)
  - **send_mjson1**(line 450)이라는 정의되지 않을 가능성 높은 함수 호출 (오타 추정)
  - **JSON 직접 문자열 조립**: `'{"csrnm":"'.$posts['mb_nick'].'", ...}'` — 닉네임에 따옴표/줄바꿈 들어가면 JSON 깨짐
  - **세션 race condition:** mb_level=5 변경 시 두 번의 SELECT 후 update 하는 패턴이 동시 요청에 안전하지 않음
  - **redirect URL injection:** `goto_url('./member_form.php?'.$qstr.'&mb_id='.$mb_id)` 에 `$mb_id` 미인코딩 (smode=1 분기에서는 rawurlencode 적용)

### 6) `member_delete.php` (회원 단건 삭제)

- **역할:** 단건 회원 영구 삭제 (member_delete()는 g5의 soft delete 함수).
- **엔드포인트:** `POST /adm/member_delete.php`
- **읽는 테이블:** `g5_member`
- **쓰는 테이블:** member_delete() 내부에서 g5_member 등 삭제
- **입력:** POST `mb_id`, `qstr`, `url`
- **이슈:**
  - **CSRF 토큰 검증이 alert 후 호출** — alert()는 die() 효과지만 alert() 안에서는 호출 안 됨. 다만 alert 미발생 분기에선 토큰 검사 통과
  - `goto_url("{$url}?$qstr&...")` — `$url`이 외부에서 오면 open redirect

### 7) `member_list_update.php` (선택 수정/삭제)

- **역할:** 회원 리스트에서 체크박스 선택 후 일괄 수정/삭제/완전삭제.
- **엔드포인트:** `POST /adm/member_list_update.php`
- **읽는 테이블:** `g5_member` (`get_member` 호출)
- **쓰는 테이블:** `g5_member` update / member_delete() / `delete from g5_member`
- **입력:** chk[], mb_id[], mb_level[], mb_intercept_date[], mb_mailling[], mb_sms[], mb_open[], mb_certify[], mb_adult[], mb_sort[], ev_1, ev_2, ev_3, act_button
- **이슈:**
  - ⚠️ **`<pre>print_r($_POST)` 디버그 출력 노출 (line 22-23)** — 모든 회원의 POST 내용이 production에 노출됨. **즉시 보안 이슈.**
  - **CSRF 토큰 검증 위치 부적절:** `auth_check_menu` 다음에야 `check_admin_token` 호출 — chk 미체크 alert로 우회 가능
  - **이력 없음:** 일괄 권한/차단 변경에 누가/언제/뭘 했는지 기록 없음
  - sql_real_escape_string 부분만 사용 (post_mb_intercept_date, post_mb_certify, mb_id) — 나머지는 정수 캐스팅이지만 ev_1/ev_2/ev_3은 그냥 보간
  - 완전삭제는 `delete from g5_member where mb_id = '{...}'` — 회원에 연관된 다른 테이블(point, board 등)은 정리 안 됨

### 8) `member_list_delete.php`

- **역할:** 단순한 다중 삭제. (`member_list_update.php`가 이걸 흡수했지만 코드는 남아있음)
- **엔드포인트:** `POST /adm/member_list_delete.php`
- **로직:** chk[] 루프 → member_delete()
- **이슈:** 거의 사용 안 되는 사실상 dead code. CSRF 검증은 있음.

### 9) `member_xls.php`

- **역할:** 회원 엑셀 일괄 등록/다운로드 진입 페이지 (UI만).
- **엔드포인트:** `GET /adm/member_xls.php`
- **출력:** HTML 폼 3개:
  - 일반회원 다운로드 (member_xls_download1.php)
  - 상담사 다운로드 (member_xls_download.php)
  - csv 신규등록 (member_xls_upload_csv.php)
  - csv mtonet 등록 (member_xls_upload_csv_mtonet.php)
- **이슈:** 별 거 없음. 최초 페이지 진입은 `auth_check`만 있음.

### 10) `member_xls/_common.php`

- **역할:** member_xls 디렉토리 공통 부트스트랩.
- **로직:** `define('G5_IS_ADMIN', true); include('../../common.php'); include(admin.lib.php)`
- **이슈:**
  - `G5_USE_SHOP` 가 아니면 die — 의존성이 shop 모듈
  - 별도의 추가 인증/IP 화이트리스트 없음

### 11) `member_xls/member_xls.php`

- **역할:** 같은 이름 듀얼 — `adm/member_xls.php`와 거의 동일하지만 `member_xls/member_xls.php` 는 csv 기반이고 추가 폼이 있음.
- **이슈:** 두 파일이 거의 같은 이름으로 존재 → 어느 게 사용되는지 모호. 메뉴 링크에 따라 다름.

### 12) `member_xls/member_xls_download.php` (상담사 csv 추출)

- **역할:** `mb_level=5` 상담사를 엑셀로 다운로드.
- **읽는 테이블:** `g5_member where mb_level='5'`
- **출력:** XLS (HTML table). UTF-8 meta + 한글 컬럼명 헤더.
- **이슈:**
  - **검색 sfl/stx SQL injection 동일**
  - 비밀번호 컬럼 mb_password 가 빈칸으로 출력되긴 하지만 계좌정보(mb_8) 등 민감정보 노출
  - 인증 검사 누락 — `auth_check_menu` 호출 없음 (의도인지 누락인지 불명확)

### 13) `member_xls/member_xls_download1.php` (일반회원 csv 추출)

- **역할:** `mb_level < 5` 일반회원 다운로드.
- **출력:** 위와 동일 구조의 XLS.
- **이슈:** 동일.

### 14) `member_xls/member_xls_upload.php` (xls 업로드 - 사용 안 됨)

- **역할:** PHPExcel 라이브러리로 .xls 파싱 후 회원 일괄 신규등록.
- **읽는 테이블:** `g5_member` (mb_id 중복 체크)
- **쓰는 테이블:** `g5_member` insert + `insert_point()` 호출
- **이슈:**
  - **`exit;` 가 line 23에 박혀 있음** — 이 파일은 현재 동작하지 않음 (sheet load 직후 exit). 제거되지 않은 디버그 코드.
  - SQL injection 동일 (`mb_id`, `mb_email` 등 미이스케이프)
  - addslashes로만 처리 — `'` 만 처리, charset 따라 우회 가능
  - $mb_time 컬럼명 SQL: `$mb_time = '{$mb_time}'` — line 142, 변수명 자체가 SQL이 됨 → **type confusion bug**
  - mb_password 빈 문자열인데 `get_encrypt_string('')` 호출

### 15) `member_xls/member_xls_upload_csv.php` (csv 신규등록)

- **역할:** EUC-KR 인코딩 csv를 UTF-8로 변환 후 회원 일괄 등록 (사주문에서 실사용).
- **읽는 테이블:** `g5_member`
- **쓰는 테이블:**
  - `g5_member` insert
  - `insert_point()` 호출 (mb_point > 0 시) — 엠투넷 동기화용
- **입력:** csv 파일 + 헤더 1줄 스킵
- **이슈:**
  - SQL injection 동일 (모든 필드 addslashes만)
  - **mb_id 빈 row 처리 부실**: `for ($i = 0; $i <= $num_rows; $i++)` — `<=`라 마지막 인덱스 초과 → undefined offset warning
  - **iconv 실패 시 false 반환** → 빈 문자열 처리 안 됨
  - mb_leave_date 분기 (`이용` 또는 그 외) — 이 단순 비교로 EUC-KR 정상 변환 의존
  - mb_mailling/mb_sms 강제로 '1' 입력 (사용자 동의 무시)
  - 트랜잭션 없음
  - get_point_sum 결과를 무시하고 mb_point > 0 면 무조건 insert_point — 중복 적립 가능

### 16) `member_xls/member_xls_upload_csv_mtonet.php` (csv mtonet 등록)

- **역할:** 위와 거의 동일 + 등록 후 **mtonet에 일괄 회원 등록 API** 호출, 받은 membid로 `mb_1` 업데이트.
- **외부 의존성:** `send_mjson("memb-mgr", $json_data, 'POST')`
- **이슈:**
  - 위 csv upload의 모든 이슈 + JSON 수동 문자열 조립 (이름에 따옴표 들어가면 깨짐)
  - 디버그 echo 잔존 (`echo "중복오류"`, `print_r($json_data)`, `echo "<br><br>"`)
  - mtonet 등록 후 매핑이 **전화번호 일치**로 이뤄짐 → 동명이인/공유 단말 위험
  - `$rowData = $arr[$i];` undefined offset (마지막 인덱스 초과)

### 17) `member_xls/member_xls_update.php` (xls 업로드 - 회원 정보 수정)

- **역할:** PHPExcel로 xls 파싱 후 기존 회원 일괄 수정.
- **읽는 테이블:** g5_member 없음 (직접 update)
- **쓰는 테이블:** `g5_member` update
- **이슈:**
  - **명백한 버그:** `mb_datetime = '{!mb_datetime}'` (line 134) — `!` 가 변수 prefix가 아님 → "{!mb_datetime}" 문자열이 그대로 들어감. 모든 mb_datetime이 깨진 문자열로 덮어씌워짐.
  - **mb_nick = mb_id 강제** (line 98) — `mb_nick = '{$mb_id}'`. 사용자가 수정한 닉네임과 무관하게 mb_id가 닉네임으로 들어감
  - mb_certify, mb_memo 변수가 정의되지 않은 상태로 SQL 보간 (PHP undefined notice + 빈 문자열로 덮어쓰기)
  - SQL injection 동일

### 18) `point_list.php` (포인트 목록 + 가감 입력 폼)

- **역할:** 포인트 변동 이력 조회 + 검색 + 단건 가감 폼 (point_update.php POST).
- **엔드포인트:** `GET /adm/point_list.php`
- **읽는 테이블:**
  - `g5_point` count + select
  - `g5_point` 전체 sum (sum_point — limit 없이 메모리에서 합산)
  - row마다 `g5_member` (mb_id별 캐시 — 이전 row와 다를 때만 fetch, **마이크로 캐싱이지만 정렬에 의존**)
  - row마다 `get_member()` 추가 호출 (구분 표시용)
- **쓰는 테이블:** 없음
- **출력:** HTML + 가감 폼 (point_update.php 로 POST)
- **이슈:**
  - **SQL injection 동일** (sfl/stx)
  - **메모리 위험:** sum 계산을 PHP 루프로 모든 row 가져와서 합산 (line 95-109). 100만 건이면 OOM
  - row마다 get_member 두 번 호출되는 구조 (한 번은 sql_fetch, 한 번은 get_member 함수)
  - 페이지네이션 안 적용된 sum select 가 별도로 발생

### 19) `point_update.php` (포인트 가감 처리) ⭐ Phase A 대상

- **역할:** 회원에게 포인트 +/- 변동을 적용. **현재 라이브의 포인트 조정 진입점.**
- **엔드포인트:** `POST /adm/point_update.php`
- **읽는 테이블:** `g5_member` (get_member)
- **쓰는 테이블:** `g5_point` (insert_point 호출 — 함수 내부에서 g5_point insert + g5_member.mb_point update)
- **입력:** mb_id, po_point, po_content, po_expire_term
- **이슈 (Phase A에서 이미 식별):**
  - **트랜잭션 없음 (Critical)** — insert_point 내부도 트랜잭션 없음
  - **actor_admin_id/actor_ip 미기록** — 누가 조정했는지 기록 없음. `$member['mb_id']`(현재 admin id)를 `po_rel_id`에 uniqid와 함께 박는 것이 전부
  - **음수 잔액 검증이 IP 분기**: `if ($_SERVER['REMOTE_ADDR'] == "115.93.39.5")` — 사내 IP에서만 검증 적용. (실제로 보면 둘 다 같은 검증을 하고 있어 실질 영향은 없으나 코드 구조 자체가 잘못됨)
  - clean_xss_attributes는 XSS 방지지 정수 검증 아님 — `po_point=-9999999999` 같은 임의 정수 가능
  - 임의 회원 id에 가감 가능 (회원 존재만 체크)
  - 음수 잔액 차단 시에도 alert으로 끝 — 클라이언트 우회 가능 (alert는 PHP가 die(), 그러나 명확한 트랜잭션이 없으니 race로 음수 잔액 가능)

### 20) `point_list_delete.php` (포인트 변동 삭제)

- **역할:** point_list에서 선택한 변동 row를 삭제 + 잔액/누적 재계산.
- **엔드포인트:** `POST /adm/point_list_delete.php`
- **읽는 테이블:** `g5_point`
- **쓰는 테이블:**
  - `g5_point` 삭제
  - `g5_point` 후속 row의 po_mb_point 보정 (이후 모든 row에서 해당 변동값 차감)
  - `g5_member.mb_point` 재계산
- **입력:** chk[], po_id[], mb_id[], act_button
- **이슈:**
  - 트랜잭션 없음 (3 단계 update가 분리 실행)
  - 음수 변동 row 삭제 시 `delete_expire_point` / `delete_use_point` 호출 — 정확한 보상 로직이 함수 안에 숨어있어 검증 어려움
  - **시간 경과한 row 삭제는 정합성 파괴**: 후속 row의 po_mb_point만 단순 차감하지만 이후 만료된 행이 있으면 잘못 계산됨

### 21) `point_list_excel.php`

- **역할:** point_list와 동일 조회를 .xls로.
- **출력:** XLS (HTML table)
- **이슈:**
  - SQL injection 동일
  - limit 없는 전체 select — OOM 위험
  - row마다 `get_member` 호출 (N+1)
  - 변수 `$colspan` 미정의 (empty_table 분기에서 사용)

---

## 발견된 이슈 (전체 — 우선순위별)

### Critical (Production-Breaking 또는 즉시 보안 사고)

1. **member_list_update.php의 `<pre>print_r($_POST)`** — 회원 일괄 수정 시 모든 필드가 production HTML로 출력됨. **이관 시 즉시 제거.**
2. **모든 SQL이 변수 직접 보간** — sfl/stx/mb_id/post_mb_*/mb_email/mb_name 등 거의 모든 입력. SQL injection으로 admin 권한 탈취/DB 덤프 가능.
3. **member_form.php가 매 요청마다 ALTER TABLE** — 운영 DB에 lock contention 유발. 컬럼 자동 생성은 1회 마이그레이션으로 대체해야 함.
4. **member_xls_update.php의 `'{!mb_datetime}'` 버그** — 실행되면 모든 회원의 가입일시가 `{!mb_datetime}` 문자열로 깨짐. 데이터 손실.
5. **member_xls_upload.php의 `exit;` 디버그 잔재** — 파일이 동작 자체를 멈춤. 사용 안 되는 dead path.
6. **point_update.php 트랜잭션 누락 + IP별 분기** — Phase A 핵심.

### High (운영 안전성/정합성)

7. **member_form_update.php 트랜잭션 부재** — 회원 INSERT/UPDATE + mtonet API + 후속 mb_1 update 가 모두 분리. 중간 실패 시 정합성 깨짐.
8. **mtonet 외부 API 호출 동기/실패 처리 부실** — alert 또는 주석 처리된 alert. 일부 분기는 실패 알림 자체가 없음.
9. **이력/감사로그 부재** — 회원 권한 변경, 차단/탈퇴, 일괄 수정에 누가/언제/뭘 했는지 기록 없음.
10. **N+1 쿼리** — 모든 list 화면이 row 별로 5~8개의 추가 쿼리 발생. 수만 건 회원 환경에서 페이지 로딩 수십 초.
11. **CSRF 토큰 검증 위치 일관성 부족** — `check_admin_token`이 alert 분기 후에 호출되거나 일부 파일에서 누락.
12. **member_xls_download.php 인증 검사 부재** — auth_check_menu 호출이 없어 인증된 admin 누구나 전체 회원 dump 가능 (메뉴 권한과 무관).

### Medium (보안/코드 품질)

13. **JSON 수동 문자열 조립** (member_form_update, csv_mtonet) — 닉네임에 따옴표/줄바꿈 들어가면 mtonet 호출 페이로드 파괴.
14. **이메일/닉네임 중복 체크 주석처리됨** — duplicate 가능.
15. **회원 첨부파일 처리에 ext 검사만, MIME 타입 검사 없음** — exec 스크립트 우회 (`.php-x` 변환은 있지만 우회 가능한 확장자 다수).
16. **Open Redirect** — `goto_url("{$url}?...")` 의 `$url`이 외부 입력.
17. **register_globals 의존** — `$mb_status`, `$page`, `$qstr`, `$is_admin` 등 명시적 GET/POST 파싱 없이 사용. PHP 8 환경에서는 정의 안 되어 있을 수 있음.
18. **회원 완전삭제 시 연관 테이블 정리 없음** — point, board, payment, member_file 등이 고아 데이터로 남음.
19. **상담사 등급 변경 시 일반→상담사/상담사→일반 전환 로직이 PHP 분기 5개로 분기** — 매 분기마다 DB+API 호출. 상태 머신으로 정리 필요.
20. **백업 파일 다수 잔존** (`member_list.php.bak_20260327`, `member_list_20230403.php`, `point_list_.php`) — 이관에서 제외 대상.

### Low (정리/개선)

21. **하드코딩된 mtonet URL** (`csr-mgr`, `memb-mgr`) — env로 분리.
22. **하드코딩된 IP** `115.93.39.5` (point_update.php) — 로직 자체가 폐기 대상.
23. **상담사 mb_2(sortno) default = "1"** — 정책 컬럼화 필요.
24. **member_form.php에 `member_form1.php` 분기 (smode=1)** — 중복 폼.
25. **member_xls 디렉토리에 `member_xls.php` 가 두 개** (adm/member_xls.php 와 adm/member_xls/member_xls.php) — 어느 게 메인인지 모호.

---

## web/mng 이관 설계

### NestJS API 설계

**기존(이미 구현됨):** `api/src/admin/members/`
- `MembersController` — `/admin/members/customers`, `/admin/members/counselors` 리스트/단건/생성/수정 완료
- `MembersService` — `findCustomers`, `findCounselors`, `createCustomer`, `updateCustomer` 등

**추가 필요한 엔드포인트:**

| Method | Path | 설명 | 신규/기존 |
|---|---|---|---|
| GET | `/admin/members/customers` | 고객 리스트 (검색/필터/페이지) | **기존** |
| GET | `/admin/members/customers/:id` | 고객 단건 | **기존** |
| POST | `/admin/members/customers` | 고객 생성 | **기존** |
| PATCH | `/admin/members/customers/:id` | 고객 수정 (포인트 제외) | **기존** (포인트 필드 거부 검증 추가) |
| DELETE | `/admin/members/customers/:id` | 고객 소프트 삭제 (left_at 세팅) | **신규** |
| POST | `/admin/members/customers/:id/intercept` | 차단/해제 (감사로그 동반) | **신규** |
| POST | `/admin/members/bulk-update` | 다중 권한/차단/메일/SMS 일괄 변경 | **신규** |
| GET | `/admin/members/customers/excel` | 고객 리스트 엑셀 다운로드 (스트리밍) | **신규** |
| POST | `/admin/members/customers/import-csv` | csv 일괄 등록 (트랜잭션 + 검증 + 결과 리포트) | **신규** |
| POST | `/admin/members/:id/point-adjust` | 포인트 가감 (Phase A) | **신규** |
| GET | `/admin/members/:id/point-history` | 회원별 포인트 이력 (Phase A) | **신규** |
| GET | `/admin/points/history` | 전체 포인트 이력 (검색/필터) | **신규** |
| GET | `/admin/points/history/excel` | 포인트 이력 엑셀 | **신규** |
| GET | `/admin/members/:id/cert-history` | 본인인증 이력 | **신규** |
| GET | `/admin/members/:id/files` | 첨부파일 리스트 | **신규** |
| POST | `/admin/members/:id/files` | 첨부파일 업로드 | **신규** |
| DELETE | `/admin/members/files/:fileId` | 첨부파일 삭제 | **신규** |

**Service 메서드 시그니처(주요 신규):**

```typescript
// api/src/admin/members/members.service.ts (확장)
class MembersService {
  // 신규
  softDelete(id: number, actor: AdminActor): Promise<void>;
  intercept(id: number, until: Date | null, reason: string, actor: AdminActor): Promise<void>;
  bulkUpdate(
    ids: number[],
    patch: Partial<{ level: number; intercept_until: Date | null; mailling: boolean; sms: boolean }>,
    actor: AdminActor,
  ): Promise<{ ok: number[]; fail: { id: number; reason: string }[] }>;

  exportCustomersToExcel(filter: ListFilter, res: Response): Promise<void>; // 스트리밍
  importCustomersFromCsv(file: Express.Multer.File, actor: AdminActor): Promise<ImportResult>;

  getCertHistory(id: number): Promise<CertHistoryRow[]>;
  listFiles(id: number): Promise<MemberFile[]>;
  uploadFile(id: number, file: Express.Multer.File, actor: AdminActor): Promise<MemberFile>;
}

// api/src/admin/points/points.service.ts (Phase A - 신규 모듈)
class PointsService {
  adjust(
    memberId: number,
    delta: number,
    reason: string,
    actor: AdminActor,
    opts?: { isPaid?: boolean; expireDate?: Date | null },
  ): Promise<{ balanceAfter: number; historyId: number }>;

  listHistory(filter: PointHistoryFilter): Promise<{ items: PointHistory[]; total: number }>;
  listMemberHistory(memberId: number, page: number, limit: number): Promise<{ items: PointHistory[]; total: number }>;
  exportHistoryToExcel(filter: PointHistoryFilter, res: Response): Promise<void>;
}

interface AdminActor {
  adminId: number;
  ip: string;
}
```

**이미지/첨부파일 처리:**
- 라이브 G5_DATA_PATH 파일시스템 직접 쓰기 → 신규는 NestJS Multer + S3/로컬 디스크 추상화. 정적 파일은 별도 `/static/member-files/...` 라우트.
- `member.profile_image_url` 같은 컬럼은 0001에 없음 — 필요하면 0014 추가.

### React 페이지 설계

**기존 (이미 존재):**
- `web/mng/src/pages/CustomerList.tsx` — 고객 리스트 (이미 sample/adm/member_list_customer.php 의 기능 일부 매핑)
- `web/mng/src/pages/CustomerForm.tsx` — 고객 단건 폼 (sample/adm/member_form.php 매핑, 포인트 disabled)

**확장/신규:**

| 라이브 PHP | 신규 React | 비고 |
|---|---|---|
| member_list.php | (보류) `MemberListAll.tsx` | 거의 사용 안 됨. 통합 회원(상담사+고객+admin) 뷰 필요할 때 |
| member_list_customer.php | `CustomerList.tsx` (기존) | 누적결제(070/060), 쿠폰수, 가입경과일 컬럼 추가 |
| member_list_customer_excel.php | `CustomerList.tsx` 의 다운로드 버튼 → API `/admin/members/customers/excel` 호출 | 서버사이드 스트리밍 |
| member_form.php | `CustomerForm.tsx` (기존) | 포인트 조정 섹션 + 본인인증 이력 + 첨부파일 섹션 추가 (Phase A에서 일부) |
| member_form_update.php | `CustomerForm.tsx` 제출 → `PATCH /admin/members/customers/:id` | mtonet 동기화는 백엔드에서 처리 |
| member_delete.php | `CustomerForm.tsx` 의 삭제 버튼 → `DELETE /admin/members/customers/:id` | 소프트 삭제 |
| member_list_update.php | `CustomerList.tsx` 의 일괄 수정/삭제 → `POST /admin/members/bulk-update` | 멀티 셀렉트 + 모달 |
| member_xls.php (UI) | `CustomerImport.tsx` (신규) | csv 업로드 + 결과 리포트 |
| member_xls_download*.php | `CustomerList.tsx` 의 다운로드 버튼 (위와 같음) | role 필터로 일반/상담사 구분 |
| member_xls_upload_csv*.php | `CustomerImport.tsx` 제출 → `POST /admin/members/customers/import-csv` | mtonet 일괄 등록 옵션 토글 |
| point_list.php | `PointHistoryList.tsx` (Phase A 신규) | 전체 이력 + 검색/필터 |
| point_update.php | `CustomerForm.tsx` 내 포인트 조정 섹션 (Phase A) | 단건 |
| point_list_delete.php | (폐기 또는 super-admin only `PointHistoryDeleteModal.tsx`) | 이력 삭제는 정책상 권장 안 함 — 보정용 +/- 변동을 새로 입력하는 방식으로 |
| point_list_excel.php | `PointHistoryList.tsx` 다운로드 버튼 | 서버사이드 스트리밍 |

**라우트 추가** (`web/mng/src/App.tsx`):
- `/customers/import` → `CustomerImport`
- `/points/history` → `PointHistoryList`

**Sidebar 메뉴** (`web/mng/src/components/layout/Sidebar.tsx`):
```
회원 관리
├ 고객 리스트         /customers
├ 고객 일괄 등록       /customers/import
└ 상담사 리스트       /counselors
포인트 관리
└ 포인트 이력         /points/history
```

### 신규 DB 마이그레이션 필요 여부

- **0013_point_history_actor.sql** (Phase A에서 이미 정의됨) — `point_history`에 `actor_admin_id`, `actor_ip`, `actor_type` 추가
- **0014_member_audit.sql** (신규 권장) — 회원 변경 감사로그
  ```sql
  CREATE TABLE member_audit (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT REFERENCES member(id),
    action VARCHAR(40) NOT NULL,    -- 'level_change' | 'intercept' | 'unintercept' | 'left' | 'restore' | 'bulk_update' | 'csv_import' 등
    before_value JSONB,
    after_value JSONB,
    actor_admin_id BIGINT REFERENCES member(id),
    actor_ip INET,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_member_audit_member ON member_audit (member_id, created_at DESC);
  ```
- 0001 의 `member_status_log` 테이블이 일부 역할을 하지만 status 변경에만 한정 — 권한 변경, 일괄 처리 등을 포괄하려면 위 audit 테이블 별도 추가가 좋음.

**컬럼 추가 후보 (0014에 함께):**
- `member.profile_image_url VARCHAR(500)` — 라이브의 G5_DATA_PATH/member_image/ 파일시스템 의존을 URL 컬럼으로 정규화
- `member.icon_image_url VARCHAR(500)` — 동일

### 이관 시 주의사항

1. **포인트는 직접 `member.point` 수정 금지**
   - `point_history` insert + `point` 집계 update 트랜잭션을 통해서만 변경 (Phase A 패턴)
   - 레거시와의 호환을 위해 `member.point` 미러 컬럼은 같은 트랜잭션 안에서 동기화 (Phase A 의 옵션)
2. **mtonet 동기화는 별도 큐/job 으로 분리**
   - 라이브: 회원 수정 직후 동기 send_mjson 호출 → 실패하면 alert
   - 신규: `mtonet_outbox` 테이블에 작업 적재 → 별도 워커가 retry. 회원 수정 트랜잭션과 분리
3. **bulk update / bulk import 는 chunk 트랜잭션**
   - 1만 건 이상 import 시 100건씩 chunk 트랜잭션. 실패 row만 결과 리포트.
4. **CSV는 UTF-8 강제**
   - 라이브의 EUC-KR → UTF-8 iconv 의존 폐기. `Content-Type: text/csv; charset=utf-8` 가이드.
5. **회원 권한 변경 시 자기보다 같거나 높은 권한 변경 금지** 정책 유지
   - AdminAuthGuard에 `req.adminUser.level` 추가
6. **소프트 삭제 정책 정의 필요**
   - `left_at` 세팅 = 탈퇴, `intercept_until` 세팅 = 차단. 두 컬럼 모두 0001에 있음
   - 완전삭제(라이브 "완전삭제" 버튼)는 GDPR 등 법적 요청 시에만 — super-admin only 별도 엔드포인트
7. **첨부파일/이미지 폴더 마이그레이션**
   - 라이브: `/data/member2/{mb_id}/...`, `/data/member/{mb_dir}/{icon}.gif`
   - 신규: S3 또는 `/storage/member-files/{member.id}/...` — ETL 시 파일 이동 + URL 컬럼 채움
8. **CSRF**
   - 라이브: `check_admin_token()` (g5 token field). 신규: NestJS는 cookie-based JWT + SameSite=strict + helmet. POST에 별도 토큰 검증 권장 (csurf 또는 더블쿠키)
9. **회원 검색 N+1 제거**
   - 누적결제/쿠폰수/가입경과일 등은 SQL JOIN 또는 view로 사전 집계
   - 현재 `getCustomers` 의 SQL을 JOIN-aggregate 쿼리로 재작성 (이미 mng API에서 일부 진행)
10. **point_list_delete (이력 삭제) 은 mng 에서 폐기 권장**
    - 이력은 immutable. 잘못 입력한 변동은 반대 방향 +/- 변동을 새로 추가하여 보정. UI에 "취소" 버튼은 백엔드에서 자동으로 보정 변동을 만드는 방식
    - 정책 결정 필요

---

## ETL 매핑 (g5_* → 신규 스키마)

### `g5_member` → `member` (0001)

| g5_member | member | 변환 규칙 |
|---|---|---|
| mb_no | id | BIGSERIAL이지만 매핑성 유지. mb_no 자체가 PK 비슷한 정수면 그대로 사용 가능 |
| mb_id | mb_id (보존) + login_id | mb_id 가 `kakao_xxx` 형태면 social_uid로 추출. 그 외 login_id로 정규화 |
| mb_password | password | 형식 그대로(sha256:12000:...) 보존. 신규 가입은 bcrypt |
| mb_name | name | trim |
| mb_nick | nickname | strip_tags 적용된 그대로 |
| mb_nick_date | nickname_changed_at | DATE |
| mb_email | email | get_email_address 적용 |
| mb_email_certify | email_verified_at | `0000-00-00 00:00:00` → NULL |
| mb_hp | phone | 하이픈 제거 또는 보존 (정책 확인) |
| mb_tel | tel | 그대로 |
| mb_sex | gender | M/F |
| mb_10 | (폐기) | 한글 성별 중복 |
| mb_birth | birth_date | varchar → DATE, 빈값/잘못된값 NULL |
| mb_time | birth_time | 사주용 |
| mb_11 | calendar_type | `양력`→`SOLAR`, `음력`→`LUNAR` |
| mb_adult | is_adult_verified | 1/0 → BOOLEAN |
| mb_certify | cert_method | hp/ipin/simple/admin |
| mb_zip1+mb_zip2 | zip | concat |
| mb_addr1/2/3, mb_addr_jibeon | addr1/2/3, addr_jibeon | 그대로 |
| mb_signature, mb_profile | signature, profile | 그대로 |
| mb_level | role + level | 2→user / 5→counselor / ≥10→admin (level 보존) |
| mb_point | point | 그대로 (음수면 0으로 clamp 필요) |
| org_source | signup_source | 그대로 |
| mb_21 | acquisition_source | 그대로 |
| mb_1 | csrid (상담사) | 5자리 zero-padded (`00123`) |
| mb_2 | counselor_priority | sortno |
| mb_3 | telno | 실제 전화 |
| mb_4 | call_070_unit_cost | decamt |
| mb_5 | call_unit_seconds | dectm |
| mb_6 | preflag | Y/P/'' |
| mb_7 | dtmfno | |
| mb_8 (pipe-split) | bank_name + bank_holder + bank_account | explode("|") |
| mb_9 | call_060_unit_cost | |
| mb_12 | chat_unit_seconds | |
| mb_13 | chat_unit_cost | |
| mb_19 | free_royalty_pct | |
| mb_20 | paid_royalty_pct | |
| state | state | 그대로 |
| use_phone | use_phone | Y→true |
| use_chat | use_chat | Y→true |
| mb_rising | is_rising | 1→true |
| mb_sort | is_recommended | 1→true |
| push_all | push_all | Y→true |
| ev_1~ev_5 | ev_flags | JSONB `{"ev1": true, ...}` |
| mb_today_login | last_login_at | datetime |
| mb_login_ip | last_login_ip | |
| mb_ip | signup_ip | |
| mb_intercept_date | intercept_until | varchar(8) → TIMESTAMPTZ (00000000은 NULL) |
| mb_leave_date | left_at | 동일 |
| mb_datetime | created_at | |

**드롭** (0001 코멘트 그대로): mb_password2, mb_homepage, mb_recommend(부분 폐기 — 추천인 도메인 별도), mb_dupinfo, mb_mailling, mb_sms, mb_open, mb_open_date, mb_lost_certify, mb_email_certify2, mb_memo, mb_memo_call, mb_memo_cnt, mb_scrap_cnt, mb_14~mb_18

> mb_mailling/mb_sms는 0001에서 드롭 처리되어 있는데 라이브 화면에 토글이 있음 — 정책 재검토 필요. 알림 동의는 별도 `member_consent` 테이블로 분리 권장.

### `g5_point` → `point_history` + `point` (0004)

```sql
-- point_history
INSERT INTO point_history (
  po_id, member_id, mb_id, content,
  earn_point, use_point, is_expired, expire_date, balance_after,
  rel_table, rel_id, rel_action,
  is_paid, actor_type, actor_admin_id, actor_ip,  -- actor_* 는 0013 추가 후
  created_at
)
SELECT
  gp.po_id,
  m.id,
  gp.po_mb_id,
  gp.po_content,
  CASE WHEN gp.po_point > 0 THEN gp.po_point ELSE 0 END,
  CASE WHEN gp.po_point < 0 THEN -gp.po_point ELSE 0 END,
  (gp.po_expired = 1),
  NULLIF(gp.po_expire_date, '0000-00-00')::date,
  gp.po_mb_point,
  gp.po_rel_table,
  gp.po_rel_id,
  gp.po_rel_action,
  FALSE,                                  -- is_paid: 레거시 무료/유료 미구분 → 기본 FALSE
  CASE
    WHEN gp.po_rel_table = '@passive' THEN 'admin_legacy'  -- 라이브 admin이 직접 가감
    WHEN gp.po_rel_table = '@expire'  THEN 'system'
    WHEN gp.po_rel_table LIKE '@%'    THEN 'system'
    ELSE 'legacy'
  END,
  NULL, NULL,                              -- 레거시는 actor_admin_id/ip 모름
  gp.po_datetime
FROM legacy.g5_point gp
LEFT JOIN member m ON m.mb_id = gp.po_mb_id
WHERE m.id IS NOT NULL;

-- point 집계
INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
SELECT
  m.id,
  GREATEST(gm.mb_point, 0),
  0,
  COALESCE((SELECT SUM(po_point) FROM legacy.g5_point WHERE po_mb_id = gm.mb_id AND po_point > 0), 0),
  COALESCE((SELECT -SUM(po_point) FROM legacy.g5_point WHERE po_mb_id = gm.mb_id AND po_point < 0), 0)
FROM legacy.g5_member gm
JOIN member m ON m.mb_id = gm.mb_id
ON CONFLICT (member_id) DO UPDATE SET
  free_balance = EXCLUDED.free_balance,
  total_earned = EXCLUDED.total_earned,
  total_used   = EXCLUDED.total_used;
```

> `g5_point_end` (정산 끝 row 이관) 는 Phase D 결제/정산에서 처리. 본 도메인 ETL 에서는 보류.

### `g5_member_cert_history` → `member_cert_history`

```sql
INSERT INTO member_cert_history (
  member_id, mb_id, cert_name, cert_phone, cert_birth, cert_type, certified_at
)
SELECT m.id, ch.mb_id, ch.ch_name, ch.ch_hp, ch.ch_birth, ch.ch_type, ch.ch_datetime
FROM legacy.g5_member_cert_history ch
LEFT JOIN member m ON m.mb_id = ch.mb_id;
```

### `g5_member_file` → `member_file`

- ETL 시 파일 자체는 별도 storage migration job (rsync/aws s3 cp)
- DB row 만 매핑

### 검증 쿼리 (ETL 후)

```sql
-- 회원 수 일치
SELECT (SELECT count(*) FROM legacy.g5_member) AS legacy,
       (SELECT count(*) FROM member) AS new;

-- 포인트 정합성: 마지막 history.balance_after == point sum == member.point
WITH last_h AS (
  SELECT DISTINCT ON (member_id) member_id, balance_after
  FROM point_history
  ORDER BY member_id, created_at DESC, id DESC
)
SELECT m.id, m.mb_id, m.point AS member_point,
       p.free_balance + p.paid_balance AS point_sum,
       lh.balance_after
FROM member m
LEFT JOIN point p ON p.member_id = m.id
LEFT JOIN last_h lh ON lh.member_id = m.id
WHERE m.point <> COALESCE(p.free_balance + p.paid_balance, 0)
   OR (lh.balance_after IS NOT NULL AND lh.balance_after <> m.point)
LIMIT 100;
```

---

## 이관 순서 권장

1. **Phase A (확정/진행중):** `point_update.php` → `PointsService.adjust` + `PointHistoryList.tsx` (이미 phase-a-point-adjustment.md 에 상세화됨)
2. **Phase 확장 1: 회원 일괄 처리** — `member_list_update.php`(`<pre>print_r` 보안 이슈 즉시 해결) → `POST /admin/members/bulk-update`
3. **Phase 확장 2: 회원 첨부/이미지** — `member_form.php` 의 파일 업로드 → `/admin/members/:id/files`
4. **Phase 확장 3: CSV 일괄 등록** — `member_xls_upload_csv*.php` → `CustomerImport.tsx` + `POST /admin/members/customers/import-csv` (mtonet outbox 분리)
5. **Phase 확장 4: 본인인증 이력/감사로그** — `member_audit` 테이블 + 모든 회원 변경 hook
6. **Phase 확장 5: 엑셀 다운로드 통일** — list 페이지 다운로드 버튼 + 서버 스트리밍
7. **레거시 정리:** `point_list_delete.php` 폐기 또는 super-admin only / `member_form1.php`, `member_xls_update.php` 폐기

---

## 백업/제외 파일 (이관 대상 아님)

- `member_list.php.bak_20260327`
- `member_list_20230403.php`
- `member_list_customer.php.bak_20240xxx` (있다면)
- `member_form1.php` (구버전 사본)
- `point_list_.php` (백업)

이관 후 라이브에서 **삭제** 권장. 마이그레이션 후 라이브 sample/adm 디렉토리 자체를 freeze (read-only) 하고 `_archived/` 로 이동.
