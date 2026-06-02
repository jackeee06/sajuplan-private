# 도메인 02: 결제/코인/주문

> **분석 범위**: `sample/adm/`의 결제·코인·주문 관리 PHP 9개 파일 (백업 `*_2024xxxx`/`*_2025xxxx` 제외)
> **목적**: web/mng (React + NestJS) 이관을 위한 read-only 정밀 분석. sample/ 코드는 절대 수정하지 않음.
> **연관 Phase**: [PLAN/README.md](README.md) — Phase B (결제/취소)
> **연관 마이그레이션**: [api/db/migrations/0004_payment.sql](../api/db/migrations/0004_payment.sql), [api/db/migrations/0005_cms_system.sql](../api/db/migrations/0005_cms_system.sql) (`account_setting`)

---

## 개요

라이브 관리자(`sample/adm`)의 결제/코인/주문 도메인은 **9개 PHP 파일**로 구성:

| 분류 | 파일 | 역할 |
|---|---|---|
| 충전 상품 설정 | `coin_pay_form.php` / `coin_pay_form_update.php` | 1~5번 등급의 결제금액·보너스%·총포인트·문구 설정 (account_config 테이블) |
| 이력 조회 | `coin_pay_history.php` / `coin_pay_history_excel.php` | 결제 내역 목록·엑셀 다운로드 (saju_payment 조인 g5_member) |
| 이력 (placeholder) | `coin_charge_history.php` | **미완성 상태** — `<td></td>` 빈 칸만 출력하는 골격만 있음 |
| 이력 삭제 | `coin_pay_history_delete.php` | 다중 선택 삭제 (saju_payment row 물리 삭제) |
| 카드 취소 | `order_cancle.php` | PG (AG9 passcall) 카드 취소 호출 + 포인트 회수 + 로그 |
| 카드 취소 (신규) | `coin_cancel.php` | **트랜잭션 + 부분취소 지원**의 신규 버전 (lib/pay_ag9.php의 `pay_cancel` 호출, 단 함수 시그니처 미일치) |
| 가상계좌 취소 | `order_vbank_cancel.php` | 가상결제(VBANK) 건을 단순히 ResultMsg='취소완료'로 마킹만 (PG 실호출 없음, 수동 환불 후 사용) |

핵심 발견:
- **결제 마스터 = `saju_payment`** (Oid UNIQUE, AG9 passcall PG 응답을 그대로 컬럼화)
- **PG사 = AG9 / 패스콜 (passcall.co.kr:32837)** — `Authorization: $headerKey` 단일 헤더 인증
- **코인/포인트 시스템 = `g5_point` + `g5_member.mb_point`** — 영카트 그누보드5 표준 사용
- **`order_cancle.php`(상시 사용 추정) vs `coin_cancel.php`(신규/파일 위치 `/adm/`이지만 `../common.php` 인클루드 — 실호출 흔적 미확인) 두 버전이 공존** → 이관 시 신버전 로직(`coin_cancel.php`)을 정책 기준으로 사용하되 시그니처 버그 수정 필요

---

## DB 테이블 인벤토리

### 레거시 (라이브)

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `saju_payment` | 결제 마스터. PG 응답 그대로 저장 | `no` PK, `Oid` UNIQUE 후보, `Tid`, `mb_id`, `Membid`, `PayMethod`, `Amount`, `Coin_Amount`, `ReqResult`(0000=성공), `ResultMsg`, `BankCd`, `banknm`, `VrNo`, `DepositNm`, `DepositTm`, `od_time`, `mrtn`(엠투넷 동기화 결과), `CancelAmount`, `CancelCoin`, `CancelAt`(coin_cancel.php에서만 사용), `cancel_status`, `cancel_amount`, `cancel_coin_amount`, `cancel_reason`, `cancel_tid`, `cancel_req_payload`, `cancel_res_payload`, `mtonet`(lib/pay_ag9.php에서만 사용) |
| `account_config` | 충전 상품 설정 | `product_id`(1~5), `price`, `point`, `bonus_percent`, `total_point`, `message` |
| `payment_cancel_log_t` | 취소 API 호출 추적 | `log_date`, `started_at`, `finished_at`, `duration_ms`, `success`(Y/N), `req_result`, `resultmessage`, `http_status`(NULL로만), `url`, `oid`, `tid`, `membid`, `request_body`, `response_body`, `trace_id` |
| `g5_member` | 회원. mb_id로 saju_payment에 조인 | `mb_id`, `mb_nick`, `mb_email`, `mb_point` |
| `g5_point` | 포인트 변동 이력 | (insert_point() 호출로 적립/차감) |
| `saju_pay_outbox` | PG 콜백/요청 outbox (lib/pay_ag9.php에서만 사용) | `request_type`, `endpoint`, `payload_json`, `response_code`, `response_body` |

### 신규 스키마 매핑 (이미 정의됨)

| 레거시 | 신규 | 마이그레이션 |
|---|---|---|
| `saju_payment` | `payment` | `0004_payment.sql:13-65` |
| `saju_pay_outbox` | `payment_outbox` | `0004_payment.sql:70-114` |
| `payment_cancel_log_t` | `payment_cancel_log` | `0004_payment.sql:120-157` |
| `account_config` | `account_setting` | `0005_cms_system.sql:122-148` |
| `g5_point` | `point_history` | `0004_payment.sql:221-262` |
| `g5_member.mb_point` | `point.free_balance + point.paid_balance` | `0004_payment.sql:201-216` |

---

## 외부 PG 연동 (AG9 / 패스콜)

| 항목 | 값 |
|---|---|
| 호스트 (취소) | `https://passcall.co.kr:32837/` ([common.lib.php:4171](../sample/lib/common.lib.php)) |
| 호스트 (lib/pay_ag9.php) | `AG9_HOST` 상수 (정의 미확인 — `_pay_config.php`엔 `AG9_AUTH_TOKEN='여기에_AG9_토큰'` placeholder만) |
| 인증 | HTTP 헤더 `Authorization: $headerKey` (전역 변수, 위치 미확인) |
| CPID | `0006` (예시 트랜잭션 주석에서 확인 — `coin_pay_ok_20280829.php`) |
| 카드 취소 엔드포인트 | `cptl/cancelpay/gnrc_cancel_pay` (POST), payload `{"oid": "..."}` |
| 회원 코인 동기화 | `memb-mgr` PUT, payload `{"amt": -회수코인}`, 별도 헤더로 `mb_1`(membid) 전달 (send_mjson1) |
| 응답 성공 코드 | `req_result == "00"` (order_cancle.php) **OR** `req_result == "0000"` (lib/pay_ag9.php) — **불일치 주의** |

### PayMethod 코드 매핑 (coin_pay_history.php에서 추출)

| 코드 | 의미 |
|---|---|
| `DIR_CARD`, `*PACA*` | 카드결제 |
| `PAYCO_PAY`, `*PACP*` | 페이코 |
| `KAKAO_PAY`, `*PAKM*` | 카카오페이 |
| `NAVER_PAY`, `*PANP*` | 네이버페이 |
| `*PABK*` | 계좌이체 |
| `*PATK*` | 상품권 |
| `*PAVC*`, `*VRBANK*`, `GNR_VRBANK`, `VRBANK_PAY`, `GNR_PC_PAVC`, `GNR_MOB_PAVC` | 가상결제 |
| `*PAMC*` | 휴대폰 |
| `*PAPT*` | 포인트 |
| `GNRC_AUTO_PAY_CARD` | 등록카드 자동결제 |

---

## 파일별 분석

### 1) `coin_pay_form.php` (충전 상품 설정 화면)

| 항목 | 내용 |
|---|---|
| 역할 | 1~5번 등급별 결제금액·보너스%·총포인트·노출문구 입력 폼 |
| HTTP | GET, sub_menu=`350460`, `auth_check_menu($auth, $sub_menu, 'r')` |
| 읽기 | `select * from account_config where product_id='$i'` (i=1..5 루프, 행이 없어도 빈 입력으로 표시) |
| 쓰기 | 없음 (보기 전용). 저장은 `coin_pay_form_update.php`로 POST |
| 입력 | 없음 (단순 화면) |
| 출력 | 5개 행의 input 폼 + 클라이언트 JS `recalc(i)` (price × (100+bonus)/100 으로 total_point 자동계산) |
| 이슈 | (1) **루프 안에서 5번 SQL 쿼리** (인덱스 PK 조회라 무겁진 않으나 N+1) (2) **`is_admin == 'super'`만 저장 버튼 노출** — 등록 권한이 super 한정 (3) `$row["price"]` 등 출력 시 **htmlspecialchars 미적용** → product_name/message에 XSS 가능 |

---

### 2) `coin_pay_form_update.php` (충전 상품 저장)

| 항목 | 내용 |
|---|---|
| 역할 | account_config 전체 truncate 후 1~5번 재삽입 |
| HTTP | POST (action="./coin_pay_form_update.php") |
| 읽기 | 없음 |
| 쓰기 | `delete from account_config` → `insert into account_config(...)` × 5회 |
| 입력 | `it_price_$i`, `it_spoint_$i`, `it_tpoint_$i`, `it_msg_$i` (i=1..5). `preg_replace("/[^0-9]/", ...)` 으로 숫자만 통과 (it_msg는 그대로) |
| 출력 | `goto_url('/adm/coin_pay_form.php')` 리다이렉트 |
| 이슈 | (1) **`check_admin_token()` 호출 없음** → CSRF 무방비 (2) **`auth_check_menu` 호출 없음** → 로그인만 되어 있으면 권한 무관하게 수정 가능. `coin_pay_form.php`에서 super만 버튼 노출하지만 URL 직접 호출로 우회 가능 (3) **`$it_point` 변수 미정의 그대로 SQL에 삽입** (코드상 22~28행, `//$it_point = ...` 주석 처리 후 그대로 사용) → MySQL이 `''` 으로 받으나 PHP NOTICE 발생 (4) **`it_msg`에 SQL injection 가능** — preg_replace 미적용 (5) **delete-then-insert 비원자적** — 중간 실패 시 데이터 소실. 트랜잭션 부재 (6) `check_demo()`만 있고 권한 검증 없음 |

---

### 3) `coin_pay_history.php` (결제 내역 목록)

| 항목 | 내용 |
|---|---|
| 역할 | saju_payment + g5_member 조인 결과를 카드/가상결제/취소 탭, 기간/검색 필터로 보여주고 카드 취소 버튼 노출 |
| HTTP | GET (검색 폼), sub_menu=`350420`, `auth_check_menu($auth, $sub_menu, 'r')` |
| 읽기 | `from saju_payment a left join g5_member b on (a.mb_id=b.mb_id)` 베이스, 5개 카운트 쿼리(전체/카드/가상/카드취소/총결제금액) + 1개 페이징 쿼리 |
| 쓰기 | 없음 (단, `coin_pay_history_delete.php`로 다중 선택 삭제 폼 포함) |
| 입력 | `sfl`(b.mb_id/TelNo/b.mb_nick), `stx`(검색어), `fr_date`/`to_date`(YYYY-MM-DD 정규식 검증 OK), `smode`(card/card_cancle/vbank), `sst`/`sod`(정렬), `page` |
| 출력 | 결제일/방법/사용자코드(Membid)/ID/닉네임/폰/금액/충전코인/결과(+취소버튼) |
| 비즈니스 로직 | (1) 결제수단 분기로 `order_paytype` 결정 (2) **카드결제 + 5일 이내**만 취소 버튼 노출. **로직 중복 — 결제수단 체크 후 일자 체크가 카드결제 외에도 cancle_flag를 true로 덮어씀** (line 304~322) → 카드 외 결제도 5일 이내면 취소 버튼이 잘못 노출되는 **버그**. (3) ResultMsg 값에 따라 표시: `processing completed`→입금완료, `정상처리`(가상결제)→입금전, `ok`→입금완료, `취소완료`→그대로 (4) 가상결제 취소: ResultMsg가 입금완료/ok/processing completed + BankCd/DepositNm 모두 있을 때만 버튼 노출 → `vbank_cancel(no)` 호출 |
| 이슈 | (1) **SQL injection 위험** — `$sfl`, `$stx`, `$fr_date`, `$to_date`, `$sst`, `$sod`, `$smode`를 escape 없이 SQL에 직접 보간. fr_date/to_date는 정규식 검증 있으나 sfl/stx/sst/sod/smode는 검증 부재. 그누보드 register_globals 자동 매핑에 의존 (2) **하드코딩 IP** `115.93.39.5` (line 75)에서만 `echo $sql` 디버그 (현재는 주석처리) — 디버그 분기 잔존 (3) **취소 가능 일자 로직 버그** — 위 (2) 참조 (4) **htmlspecialchars 미적용** — `$row["mb_nick"]`, `$row["Membid"]` 등 직접 출력 (5) **token CSRF 토큰이 빈값** (line 265) — fmemberlist 폼 (6) `cancle_order(no)`는 popup window 사용 — 모던 React 패턴과 부적합 |

---

### 4) `coin_pay_history_delete.php` (결제 이력 삭제)

| 항목 | 내용 |
|---|---|
| 역할 | 다중 선택된 saju_payment 행을 물리 삭제 |
| HTTP | POST, super 관리자 + `check_admin_token()` 필수 |
| 읽기 | 없음 |
| 쓰기 | `delete from saju_payment where no='$no'` (체크된 항목 수만큼 루프) |
| 입력 | `chk[]`, `no[]` (체크박스 인덱스 → 실제 no 매핑) |
| 출력 | `goto_url('./coin_pay_history.php?...')` |
| 이슈 | (1) **결제 이력 물리 삭제는 매우 위험** — PG 연동/세금계산/회계감사 측면에서 절대 삭제하면 안됨. 신규 시스템에서는 soft delete로 변경하거나 아예 삭제 기능 제거 필요 (2) **포인트 회수 로직 없음** — 삭제 시 mb_point는 그대로 → 데이터 정합성 깨짐 (3) **SQL injection 위험** — `$no` escape 없이 보간 (4) **트랜잭션 없음** (5) **삭제 감사로그 없음** — 누가 언제 어떤 결제건을 삭제했는지 흔적 없음 |

---

### 5) `coin_pay_history_excel.php` (결제 이력 엑셀 다운로드)

| 항목 | 내용 |
|---|---|
| 역할 | coin_pay_history.php와 동일 쿼리로 엑셀(application/vnd.ms-excel) 출력 |
| HTTP | GET, `auth_check_menu($auth, $sub_menu, 'r')` |
| 읽기 | coin_pay_history.php와 거의 동일 (smode 분기 없음) |
| 쓰기 | 없음 |
| 입력 | 동일 |
| 출력 | 엑셀 다운로드 헤더 + HTML 테이블 |
| 이슈 | (1) **smode 필터 미적용** — 화면에선 카드/가상결제/취소 탭별 다른 결과인데 엑셀은 항상 전체 (2) **SQL injection 위험** 동일 (3) `$cancle_flag` 변수가 코드 상에 정의되지 않은 상태로 사용 (line 176, 188) — 항상 false로 동작 (4) **htmlspecialchars 미적용** (5) `colspan` 미정의 — 빈 결과 시 NOTICE |

---

### 6) `coin_charge_history.php` (코인 충전 내역 — placeholder)

| 항목 | 내용 |
|---|---|
| 역할 | **미완성 placeholder** — 빈 `<td></td>` 11개만 반복 출력 |
| HTTP | GET, sub_menu=`350430`, `auth_check_menu($auth, $sub_menu, 'r')` |
| 읽기 | `select * {$sql_common} {$sql_search} {$sql_order} limit ...` — sql_common/search/order가 미정의 (notice/error) |
| 쓰기 | 없음 |
| 출력 | 카드/가상결제/이벤트/쿠폰/후기/베스트후기/VIP리워드/관리자(지급)/사용자(지급) 카운트 8개 표시 (모두 `$leave_count` 동일변수 — placeholder), 표 본문은 빈칸 |
| 이슈 | **이 파일은 디자인만 잡아놓고 실제 데이터 로직 미작성**. 이관 시 신규 설계로 대체. **카테고리 분류(이벤트/쿠폰/리워드 등) 요구사항만 추출**해서 신규 화면 설계 |

---

### 7) `coin_cancel.php` (신규 카드 취소 — 트랜잭션 + 부분취소)

```
경로: sample/adm/coin_cancel.php (단, include는 ../common.php — adm/_common.php 아님)
```

| 항목 | 내용 |
|---|---|
| 역할 | JSON/POST/GET 입력으로 PG 카드 결제 부분/전액 취소. 트랜잭션 안에서 (1) saju_payment FOR UPDATE → (2) PG 호출 → (3) saju_payment.CancelAmount/Coin/At 누적 → (4) g5_member.mb_point 회수 |
| HTTP | POST/GET, JSON 또는 form-urlencoded |
| 의존성 | `lib/pay_ag9.php` 의 `pay_cancel($oid, $partial, $recamt, $reccoin, $reason)` — **하지만 lib/pay_ag9.php에 정의된 함수는 `pay_cancel_full($oid, $reason)` 1개뿐. `pay_cancel`은 미정의** → **호출 시점에 fatal error 발생할 가능성 매우 높음** |
| 입력 검증 | `oid` 필수, partial=true면 recamt>0 필수. `(int)` 강제캐스팅. |
| 비즈니스 로직 (의사코드) | <pre>BEGIN;<br>SELECT * FROM saju_payment WHERE Oid=:oid FOR UPDATE;<br>if ReqResult != '0000' → rollback NOT_SUCCESSFUL<br>can_amt = Amount - CancelAmount;<br>if partial && recamt > can_amt → rollback OVER_REMAIN<br>if !partial → recamt = can_amt;<br>if reccoin <= 0:<br>    reccoin = floor(coin_amount * recamt / amount); // 비례 회수<br>if PayMethod=VBANK && DepositTm 비어있음:<br>    reccoin = 0; // 미입금 가상결제는 포인트 회수 없음<br>SELECT mb_point FROM g5_member WHERE mb_id=... FOR UPDATE;<br>if mb_point < reccoin → rollback INSUFFICIENT_COIN<br>res = pay_cancel(oid, partial, recamt, reccoin, reason);  // ← 미정의 함수<br>if !res.ok → rollback;<br>UPDATE saju_payment SET CancelAmount += recamt, CancelCoin += reccoin, CancelAt = NOW();<br>insert_point(mb_id, -reccoin, "결제 취소(oid)", '@coin_cancel', oid, uniqid('coin_cancel_'), 0);<br>COMMIT;</pre> |
| 출력 | JSON `{ok:true, recamt, reccoin}` 또는 에러 코드 |
| 이슈 | **(★ 치명) `pay_cancel()` 함수 정의 부재** — lib/pay_ag9.php에는 `pay_cancel_full()`만 존재. 운영에서 호출되면 무조건 실패. **(★) `is_admin` 단순 체크** — 빈값만 거름. 권한 등급 검증 없음 (2) **트랜잭션 락 + PG 외부 호출 동시 보유** — PG가 느리면 saju_payment 행 lock이 길게 유지 → 다른 결제 처리 블록 (3) **누가 환불했는지 기록 없음** — actor_admin_id, actor_ip 미기록 (4) **payment_cancel_log_t 미기록** — order_cancle.php는 기록하지만 이 신규 버전은 누락 (5) **부분취소 시 reccoin 비례 계산이 floor** — 누적 부분취소 시 마지막엔 회수못한 코인 잔존 가능 (6) `sql_real_escape_string` 사용은 OK (7) `'CancelAmount'` 등 saju_payment에 컬럼이 실재하는지 검증 필요 — 라이브 스키마 확인 |

---

### 8) `order_cancle.php` (운영 중 카드 취소 — 단순 전액)

| 항목 | 내용 |
|---|---|
| 역할 | 팝업창에서 호출되는 단순 전액 카드 취소. PG 호출 → ResultMsg 변경 → 코인 회수 → 윈도우 닫기 |
| HTTP | GET, popup window (width=500,height=200) |
| 의존성 | `send_mjson_cancle('cptl/cancelpay', '{"oid":...}', 'POST')` → passcall.co.kr:32837/cptl/cancelpay/gnrc_cancel_pay |
| 비즈니스 로직 (의사코드) | <pre>row = SELECT * FROM saju_payment WHERE no='$no';<br>if !row.Oid → 종료<br>// 로그 INSERT (payment_cancel_log_t)<br>jresult = send_mjson_cancle(...);<br>// 로그 UPDATE (finished_at, success, req_result, response_body)<br>if jresult.req_result == "00":<br>    UPDATE saju_payment SET ResultMsg='취소완료' WHERE no='$no';<br>    insert_point(mb_id, -Coin_Amount, '결제취소', '@saju_payment', mb_id, '관리자 결제 취소: $Oid');<br>    window.opener.reload(); alert('취소처리 되었습니다.');<br>else:<br>    alert(error_msg); window.close();</pre> |
| 입력 검증 | `$no = $_REQUEST["no"]` — **escape 없이 SQL에 보간** |
| 출력 | JS alert + window.close + window.opener.reload |
| 이슈 | (1) **트랜잭션 부재** — PG 성공 후 `update saju_payment` 실패하거나 `insert_point` 실패해도 PG는 이미 환불된 상태. 데이터 불일치 (2) **PG 응답 검증이 req_result만** — `tid`/`amount` 검증 없음 (replay attack 가능성) (3) **부분취소 미지원** — Coin_Amount 전액 회수만 (4) **하드코딩 PG URL** in common.lib.php (5) **insert_point 호출 형식이 coin_cancel.php와 다름** — 인자 개수도 맞지 않음 (`insert_point($mb_id, $point, $content, $rel_table, $rel_id, $rel_action)` 6개가 표준이지만 여기선 6번째 인자가 reason 문자열) (6) **popup window 모델** — 모던 SPA에 부적합 (7) **카드 외 결제수단도 호출 가능** — PayMethod 체크 부재. 가상결제 건도 cptl/cancelpay 호출하면 PG에서 거부될 가능성 (8) **로그는 잘 남기지만 actor_admin_id 미기록** (9) **5일 이내 제약 미체크** — 화면(coin_pay_history.php)에서 버튼 노출만 막고 endpoint 자체는 무방비 → 직접 URL 호출로 우회 가능 |

---

### 9) `order_vbank_cancel.php` (가상계좌 취소 마킹)

| 항목 | 내용 |
|---|---|
| 역할 | 가상결제 건의 ResultMsg='취소완료' 마킹만 (PG 실호출 없음). **수동으로 환불 후** 관리자가 표시용으로 사용 |
| HTTP | GET, popup window (width=520,height=240) |
| 검증 | `is_admin` 체크 / no 정수 캐스팅 / 가상결제 PayMethod 체크 / ResultMsg가 입금완료 동의어인지 / BankCd, DepositNm 비어있지 않은지 / 이미 취소완료가 아닌지 |
| 쓰기 | `UPDATE saju_payment SET ResultMsg='취소완료' WHERE no=$no` |
| 입력 | `?no=숫자` |
| 출력 | alert + opener.reload + window.close |
| 이슈 | (1) **포인트 회수 없음** — 입금된 가상계좌 코인이 그대로 남음. 이미 사용했을 가능성도 있어 단순 회수 못함 (정책 결정 필요) (2) **수동 환불 → 마킹** 흐름 자체는 합리적이나 **누가 언제 마킹했는지 기록 없음** (3) **payment_cancel_log_t 미기록** (4) **트랜잭션 없음** (단일 update라 큰 문제는 아님) (5) **무통장 환불 영수증/근거 첨부 기능 없음** |

---

## 발견된 이슈 (전체 종합)

### A. SQL Injection (심각도: 높음)

| 파일 | 위치 |
|---|---|
| `coin_pay_form.php:55` | `where product_id='".$i."'` (i가 정수 루프라 실제 위협은 낮음) |
| `coin_pay_form_update.php:28` | it_msg를 escape 없이 INSERT — message에 `'`만 있어도 깨짐 |
| `coin_pay_history.php:38,46,71,73` | sfl, stx, fr_date, to_date, sst, sod, smode 모두 직접 보간 |
| `coin_pay_history_excel.php` | 동일 |
| `coin_pay_history_delete.php:21` | `where no='".$no."'` |
| `order_cancle.php:9,59` | `where no='$no'` 직접 보간 |
| `order_vbank_cancel.php` | `(int)$_GET['no']` 캐스팅으로 안전 (예외) |

### B. 트랜잭션 누락 / 데이터 정합성

| 케이스 | 문제 |
|---|---|
| `order_cancle.php` 환불 흐름 | PG 성공 후 saju_payment update 실패하면 PG는 환불됐는데 DB는 그대로 |
| `coin_pay_form_update.php` | delete-then-insert 사이 중단되면 상품 설정 소실 |
| `coin_pay_history_delete.php` | 결제 이력 삭제 시 mb_point 회수 안 됨 |
| `order_vbank_cancel.php` | 가상결제 취소 시 코인 회수 정책 자체가 부재 |

### C. PG 응답 검증 부실

- `order_cancle.php`: `req_result == "00"`만 체크. tid/oid/amount 매핑 검증 없음
- `coin_cancel.php`: `pay_cancel` 함수가 실제로는 정의되지 않음 (★ 치명)
- 응답이 비어 있거나 timeout일 때의 처리 분기 부재 (curl error 로깅 없음)

### D. 환불 금액 검증 (부분취소 처리)

- `coin_cancel.php`: `Amount - CancelAmount` 잔여액 체크 OK, partial 시 recamt 검증 OK
- 단, `CancelAmount`/`CancelCoin` 컬럼이 라이브 saju_payment에 실재하는지 미검증 → DDL 확인 필요
- `order_cancle.php`: 부분취소 미지원 — 항상 전액
- 환불 코인 비례 계산 floor → 부분취소 누적 시 잔여 코인 잘못 계산 가능

### E. 권한 / 인증 / IP 검증

- `coin_pay_form_update.php` — `auth_check_menu` 누락 (super 등급 강제 없음)
- `coin_cancel.php` — `is_admin` 빈값만 체크. 등급 분기 없음
- `coin_pay_history.php:75` — `REMOTE_ADDR == "115.93.39.5"` 하드코딩 (디버그용, 주석처리지만 잔존)
- 모든 취소/삭제 경로에 `actor_admin_id` 기록 누락 — 누가 환불했는지 추적 불가

### F. 로그 / 감사 누락

- `order_cancle.php`만 payment_cancel_log_t 기록. coin_cancel.php / order_vbank_cancel.php / coin_pay_history_delete.php 미기록
- 감사로그에 `actor_admin_id`, `actor_ip` 컬럼 부재
- 결제 이력 물리 삭제 시 audit trail 전무

### G. 디버그 코드 / 하드코딩

- `coin_pay_history.php:75-78` — IP `115.93.39.5` 분기 (주석처리)
- `coin_pay_history.php:91-92` — `echo $sql; echo "<br>"` (주석처리)
- `coin_pay_history_excel.php:62` — `//echo $sql;`
- PG 호스트 `https://passcall.co.kr:32837/` 코드 하드코딩 ([common.lib.php:4171](../sample/lib/common.lib.php))
- AG9_AUTH_TOKEN을 `_pay_config.php`에 placeholder `'여기에_AG9_토큰'` 그대로 — **실제 토큰은 다른 곳에 정의되어 있을 것**으로 추정

### H. UI/UX

- 모든 취소 작업이 popup window 모델 — React SPA 패턴과 부적합
- 검색 결과 hidden iframe 없이 alert + opener.reload — 정보 갱신 안내 부족
- coin_pay_history.php의 취소 버튼 5일 이내 로직 버그 (위 #3 참조)

### I. 비효율 / 코드 품질

- 결제수단 분기 if-elseif 체인이 history.php / excel.php / charge_history.php에 중복 → 함수화 필요
- coin_charge_history.php는 골격만 있고 실로직 없음 (placeholder)
- 5번 SELECT for account_config (배치 1개 쿼리로 가능)

---

## web/mng 이관 설계

### NestJS API 설계

#### 모듈 구조

```
api/src/admin/payments/
├── payments.module.ts
├── payments.controller.ts        # 결제 이력/취소 엔드포인트
├── payments.service.ts           # 비즈니스 로직 (트랜잭션, PG 호출)
├── account-settings.controller.ts # 충전 상품 설정
├── account-settings.service.ts
└── pg/
    ├── ag9.service.ts            # AG9 passcall HTTP 클라이언트
    └── ag9.types.ts              # 응답 타입 정의
```

`PointsService`(Phase A)와 협력 — `PaymentsService.cancel()`은 트랜잭션 내에서 `PointsService.adjust(memberId, -refundCoin, reason, actor, {actorType:'payment'})` 호출.

#### 엔드포인트

| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/admin/payments` | AdminAuthGuard | 결제 이력 목록 (q, fr_date, to_date, pay_method, status, page, limit) |
| GET | `/admin/payments/excel` | AdminAuthGuard | 엑셀(필터 동일 적용) |
| GET | `/admin/payments/:id` | AdminAuthGuard | 단건 상세 (취소이력 + 포인트 변동 포함) |
| POST | `/admin/payments/:id/cancel` | AdminAuthGuard | 카드 취소. body: `{partial?, refundAmount?, refundCoin?, reason}` |
| POST | `/admin/payments/:id/vbank-cancel-mark` | AdminAuthGuard | 가상결제 수동환불 후 마킹. body: `{reason}` |
| GET | `/admin/payments/cancel-logs` | AdminAuthGuard | payment_cancel_log 조회 (debug용) |
| GET | `/admin/account-settings` | AdminAuthGuard | 충전 상품 설정 목록 |
| PUT | `/admin/account-settings` | AdminAuthGuard (super) | 충전 상품 일괄 저장 (트랜잭션 with replace) |

#### `PaymentsService.cancel()` 의사코드

```ts
async cancel(
  paymentId: number,
  input: { partial?: boolean; refundAmount?: number; refundCoin?: number; reason: string },
  actor: { adminId: number; ip: string }
) {
  return await this.sql.begin(async (tx) => {
    // 1. payment 행 잠금
    const [pmt] = await tx`
      SELECT * FROM payment WHERE id = ${paymentId} FOR UPDATE
    `;
    if (!pmt) throw new NotFoundException('결제건을 찾을 수 없습니다.');
    if (pmt.req_result !== '0000') throw new BadRequestException('정상 결제건이 아닙니다.');
    if (pmt.status === 'cancelled') throw new BadRequestException('이미 취소된 결제입니다.');

    // 2. 이전 누적 환불액 계산 (payment_cancel_log 기준)
    const [prev] = await tx`
      SELECT COALESCE(SUM(refund_amount), 0) AS sum_amt,
             COALESCE(SUM(refund_coin), 0)   AS sum_coin
      FROM payment_cancel_log WHERE oid = ${pmt.oid} AND is_success = TRUE
    `;
    const remainAmt  = pmt.amount - prev.sum_amt;
    const remainCoin = pmt.coin_amount - prev.sum_coin;
    if (remainAmt <= 0) throw new BadRequestException('이미 전액 환불되었습니다.');

    // 3. 환불 금액 결정
    const refundAmt  = input.partial ? input.refundAmount! : remainAmt;
    if (refundAmt > remainAmt) throw new BadRequestException('남은 환불 가능 금액 초과');
    const refundCoin = input.refundCoin ??
      (input.partial ? Math.floor(pmt.coin_amount * refundAmt / pmt.amount) : remainCoin);

    // 4. 5일 정책 검증 (서버에서 강제)
    const days = (Date.now() - pmt.created_at.getTime()) / 86400_000;
    if (days > 5 && !actor.isSuper) throw new BadRequestException('5일 이전 결제는 super만 취소 가능');

    // 5. payment_cancel_log INSERT (started_at)
    const [logRow] = await tx`
      INSERT INTO payment_cancel_log (
        log_date, started_at, url, oid, tid, membid, request_body, trace_id,
        actor_admin_id, actor_ip
      ) VALUES (
        CURRENT_DATE, now(), ${url}, ${pmt.oid}, ${pmt.tid}, ${pmt.membid},
        ${JSON.stringify({oid:pmt.oid, refundAmt, reason: input.reason})},
        ${randomUUID()}, ${actor.adminId}, ${actor.ip}
      ) RETURNING id
    `;

    // 6. PG 호출 (트랜잭션 외부에서 진행하면 좋지만, 여기선 timeout 짧게 + 재시도 비활성)
    const pgRes = await this.ag9.cancelPay(pmt.oid, { partial: input.partial, amount: refundAmt });

    // 7. 결과 기록
    await tx`UPDATE payment_cancel_log
              SET finished_at = now(),
                  duration_ms = ${...},
                  is_success = ${pgRes.ok},
                  req_result = ${pgRes.req_result},
                  result_message = ${pgRes.message},
                  http_status = ${pgRes.status},
                  response_body = ${JSON.stringify(pgRes.raw)}
              WHERE id = ${logRow.id}`;

    if (!pgRes.ok) throw new BadGatewayException(pgRes.message ?? 'PG 취소 실패');

    // 8. payment 상태 갱신
    const newStatus = (refundAmt === remainAmt) ? 'cancelled' : 'partial_cancelled';
    await tx`UPDATE payment
              SET status = ${newStatus},
                  cancelled_at = ${refundAmt === remainAmt ? sql`now()` : sql`cancelled_at`},
                  updated_at = now()
              WHERE id = ${paymentId}`;

    // 9. 포인트 회수 (PointsService.adjust — 잔액 부족 시 0까지만 차감하는 정책으로 변경)
    if (refundCoin > 0) {
      // 가상계좌 미입금 케이스는 refundCoin = 0으로 호출자에서 처리
      await this.points.adjust(
        pmt.member_id,
        -refundCoin,
        `결제취소(${pmt.oid}) ${input.reason}`,
        actor,
        { isPaid: true, actorType: 'payment', relTable: 'payment', relId: String(paymentId) },
        tx  // 같은 트랜잭션
      );
    }

    return { refundAmount: refundAmt, refundCoin, status: newStatus };
  });
}
```

핵심 차이점 (sample 대비):
1. **payment_cancel_log를 single source of truth**로 사용 — 누적 환불액은 로그 SUM으로 계산. saju_payment에 `CancelAmount/CancelCoin` 컬럼 의존 폐기
2. **actor_admin_id, actor_ip 필수 기록** (payment_cancel_log에 컬럼 추가 필요 — 신규 마이그레이션)
3. **PointsService 위임** — 포인트 회수는 Phase A에서 만든 `adjust()` 재사용 (음수 잔액 검증 + balance_after 기록)
4. **PG 호출 실패 시 자동 rollback** — 트랜잭션 내에서 처리
5. **5일 정책 서버측 강제**
6. **부분취소 vs 전액취소 status 분리** (`cancelled` / `partial_cancelled`)

#### `Ag9Service` (PG 클라이언트)

```ts
@Injectable()
export class Ag9Service {
  constructor(private cfg: ConfigService) {}

  async cancelPay(oid: string, opts: { partial?: boolean; amount?: number }) {
    const url = `${this.cfg.get('AG9_HOST')}/cptl/cancelpay/gnrc_cancel_pay`;
    const headers = { Authorization: this.cfg.get('AG9_AUTH_TOKEN'), 'Content-Type': 'application/json' };
    const body = opts.partial ? { oid, amount: opts.amount } : { oid };
    const res = await firstValueFrom(this.http.post(url, body, { headers, timeout: 15000 }));
    const ok = res.data?.req_result === '00' || res.data?.req_result === '0000';
    return {
      ok,
      req_result: res.data?.req_result,
      message: res.data?.resultmsg ?? res.data?.resultmessage,
      status: res.status,
      raw: res.data,
    };
  }
}
```

환경변수: `AG9_HOST`, `AG9_AUTH_TOKEN`, `AG9_CPID` — `.env` 또는 신규 `setting` 테이블(0005_cms_system.sql)에서 관리.

---

### React 페이지 설계

#### 신규 페이지

| 파일 | 역할 |
|---|---|
| `web/mng/src/pages/PaymentList.tsx` | coin_pay_history.php 대체. 카드/가상결제/취소 탭 + 검색/날짜 + 페이지네이션 + 엑셀 다운로드 |
| `web/mng/src/pages/PaymentDetail.tsx` | 단건 상세 + 취소 버튼 + 취소 이력 + 포인트 변동 이력 |
| `web/mng/src/pages/AccountSettings.tsx` | coin_pay_form.php 대체. 충전 상품 1~5번 (또는 N개) 일괄 편집. recalc 클라이언트 자동 계산 |

[CustomerList.tsx](../web/mng/src/pages/CustomerList.tsx) 패턴 그대로 재사용 — `useState`로 filter, `api()`로 조회, Tailwind, lucide-react 아이콘.

#### 취소 다이얼로그

- React Modal로 (popup window 폐기)
- 입력: 부분취소 토글, 환불금액 (default = 잔여), 환불코인 (default = 비례계산), 취소 사유 (필수)
- 확인 시 `POST /admin/payments/:id/cancel`
- 응답 즉시 PaymentList 갱신

#### 라우트/메뉴

- `App.tsx`: `/payments`, `/payments/:id`, `/account-settings` 추가
- `Sidebar.tsx`: "결제관리" 그룹 — "결제내역", "충전상품 설정"

---

### 신규 DB 마이그레이션 필요 여부

기존 0004_payment.sql, 0005_cms_system.sql에 대부분 정의되어 있으나 **추가 컬럼 필요**:

#### `0014_payment_audit.sql` (신규 제안)

```sql
-- payment_cancel_log에 actor 추적 컬럼 추가
ALTER TABLE payment_cancel_log
  ADD COLUMN refund_amount   INT NOT NULL DEFAULT 0,
  ADD COLUMN refund_coin     INT NOT NULL DEFAULT 0,
  ADD COLUMN refund_reason   VARCHAR(500),
  ADD COLUMN actor_admin_id  BIGINT REFERENCES member(id) ON DELETE SET NULL,
  ADD COLUMN actor_ip        INET,
  ADD COLUMN is_partial      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN cancel_method   VARCHAR(20) NOT NULL DEFAULT 'pg';
  -- cancel_method: 'pg'(자동 PG 호출) | 'manual_vbank'(가상결제 수동마킹)

CREATE INDEX idx_payment_cancel_actor ON payment_cancel_log (actor_admin_id, log_date DESC);

COMMENT ON COLUMN payment_cancel_log.refund_amount   IS '환불 금액 (부분/전액)';
COMMENT ON COLUMN payment_cancel_log.refund_coin     IS '회수된 코인';
COMMENT ON COLUMN payment_cancel_log.refund_reason   IS '관리자 입력 환불 사유';
COMMENT ON COLUMN payment_cancel_log.actor_admin_id  IS '환불 처리한 관리자';
COMMENT ON COLUMN payment_cancel_log.actor_ip        IS '환불 처리한 IP';
COMMENT ON COLUMN payment_cancel_log.is_partial      IS '부분 취소 여부';
COMMENT ON COLUMN payment_cancel_log.cancel_method   IS '취소 방법: pg=PG호출, manual_vbank=가상결제 수동마킹';

-- payment 테이블 status에 partial_cancelled 추가 (CHECK 제약은 별도 추가 가능)
COMMENT ON COLUMN payment.status IS 'pending/completed/failed/cancelled/partial_cancelled';

-- account_setting에 product_id 별 의미 명시 (legacy 1~5)
ALTER TABLE account_setting
  ADD COLUMN bonus_percent INT NOT NULL DEFAULT 0,
  ADD COLUMN total_point   INT NOT NULL DEFAULT 0,
  ADD COLUMN message       VARCHAR(255);

COMMENT ON COLUMN account_setting.bonus_percent IS '보너스 비율 (legacy bonus_percent)';
COMMENT ON COLUMN account_setting.total_point   IS '총 지급 포인트 (legacy total_point)';
COMMENT ON COLUMN account_setting.message       IS '노출 문구 (legacy message)';
```

> 단, Phase A의 `0013_point_history_actor.sql`이 먼저 적용되어야 `point_history`에 actor 기록 가능.

---

### 환불 시 포인트 회수 정책 제안

| 시나리오 | 정책 |
|---|---|
| 카드 결제 + 코인 미사용 | 코인 전액 회수 (Coin_Amount 만큼) |
| 카드 결제 + 코인 부분 사용 | **회수 가능 잔액 = min(현재 잔액, 결제 시 받은 코인)**. 부족분은 마이너스 잔액으로 가지 않고 0까지만 차감하되, 차이는 `point_history`에 기록 (`reason: "환불 코인 부족 — 잔액까지만 회수"`) |
| 카드 결제 + 코인 전액 사용 (잔액 0) | 회수 0. payment_cancel_log에 `refund_coin = 0` + 사유 명시 |
| 부분취소 (예: 30000원 중 10000원 환불) | 비례 회수 = floor(coin_amount × 10000 / 30000). 누적 회수가 원래 코인을 넘지 않도록 보장 |
| 가상결제 미입금 → 취소 | 코인 회수 0 (애초에 지급 안 됨) |
| 가상결제 입금완료 후 수동환불 → 마킹 | 코인 회수 정책 결정 필요. **제안**: 자동 회수하지 않고 관리자가 별도로 PointAdjust UI에서 차감 (audit trail 분리) |

**핵심**: Phase A의 `PointsService.adjust()`를 사용하면 자동으로 잔액 검증 + balance_after 기록 + actor 기록이 보장됨. PaymentsService는 그 위임자 역할만.

---

## ETL 매핑 (saju_payment → payment, payment_cancel_log)

### `api/db/etl/05_payment.sql` (신규 작성 필요)

```sql
-- ① saju_payment → payment
INSERT INTO payment (
  no, member_id, mb_id, membid,
  pay_method, oid, tid, amount, coin_amount,
  req_result, result_message, telno,
  bank_code, bank_name, vr_account, deposit_name, deposit_time,
  status, cancelled_at, created_at
)
SELECT
  sp.no,
  m.id,
  sp.mb_id,
  sp.Membid,
  sp.PayMethod,
  sp.Oid,
  sp.Tid,
  COALESCE(sp.Amount, 0),
  COALESCE(sp.Coin_Amount, 0),
  sp.ReqResult,
  sp.ResultMsg,
  sp.TelNo,
  sp.BankCd,
  sp.banknm,
  sp.VrNo,
  sp.DepositNm,
  sp.DepositTm,
  CASE
    WHEN sp.ResultMsg = '취소완료' THEN 'cancelled'
    WHEN sp.ReqResult = '0000' AND sp.ResultMsg IN ('processing completed', '입금완료', 'ok') THEN 'completed'
    WHEN sp.ResultMsg = '정상처리' AND sp.PayMethod LIKE '%VRBANK%' THEN 'pending' -- 가상결제 입금전
    WHEN sp.ReqResult = '0000' THEN 'completed'
    ELSE 'failed'
  END,
  CASE WHEN sp.ResultMsg = '취소완료' THEN sp.od_time ELSE NULL END, -- 정확한 cancel 시각 정보 미보존
  sp.od_time
FROM legacy.saju_payment sp
LEFT JOIN member m ON m.mb_id = sp.mb_id
ON CONFLICT (oid) DO NOTHING; -- 중복 oid 방지

-- ② payment_cancel_log_t → payment_cancel_log
INSERT INTO payment_cancel_log (
  log_date, started_at, finished_at, duration_ms,
  is_success, req_result, result_message, http_status,
  url, oid, tid, membid,
  request_body, response_body, trace_id
)
SELECT
  pcl.log_date,
  pcl.started_at,
  pcl.finished_at,
  pcl.duration_ms,
  (pcl.success = 'Y'),
  pcl.req_result,
  pcl.resultmessage,
  pcl.http_status,
  pcl.url,
  pcl.oid,
  pcl.tid,
  pcl.membid,
  pcl.request_body,
  pcl.response_body,
  pcl.trace_id
FROM legacy.payment_cancel_log_t pcl;

-- ③ saju_pay_outbox → payment_outbox (있다면)
INSERT INTO payment_outbox (
  oid, cpid, membid, pay_method, amount, coin_amount,
  endpoint_url, http_method, payload, user_agent, remote_ip, is_mobile,
  cb_tid, cb_result_code, cb_message, cb_payload, cb_at, created_at
)
SELECT
  spo.oid,
  spo.cpid,
  spo.membid,
  spo.paymethod,
  COALESCE(spo.amount, 0),
  COALESCE(spo.coinamt, 0),
  spo.endpoint_url,
  COALESCE(spo.http_method, 'POST'),
  spo.payload,
  spo.user_agent,
  spo.remote_ip::inet,
  COALESCE(spo.is_mobile, FALSE),
  spo.cb_tid,
  spo.cb_result_code,
  spo.cb_message,
  spo.cb_payload,
  spo.cb_at,
  spo.created_at
FROM legacy.saju_pay_outbox spo
ON CONFLICT (oid) DO NOTHING;

-- ④ account_config → account_setting
INSERT INTO account_setting (
  no, product_name, amount, coin_amount,
  is_active, display_order, bonus_percent, total_point, message
)
SELECT
  ac.product_id,
  CONCAT('상품', ac.product_id),
  COALESCE(ac.price, 0),
  COALESCE(ac.point, 0),
  TRUE,
  ac.product_id, -- product_id를 정렬 순서로 사용
  COALESCE(ac.bonus_percent, 0),
  COALESCE(ac.total_point, 0),
  ac.message
FROM legacy.account_config ac
ORDER BY ac.product_id;
```

### ETL 검증 쿼리

```sql
-- 행 수 검증
SELECT (SELECT COUNT(*) FROM legacy.saju_payment) AS legacy,
       (SELECT COUNT(*) FROM payment) AS migrated;

-- 금액 합계 검증
SELECT (SELECT SUM(Amount) FROM legacy.saju_payment WHERE ReqResult='0000') AS legacy_sum,
       (SELECT SUM(amount) FROM payment WHERE req_result='0000') AS migrated_sum;

-- 취소 건수 검증
SELECT (SELECT COUNT(*) FROM legacy.saju_payment WHERE ResultMsg='취소완료') AS legacy_cancelled,
       (SELECT COUNT(*) FROM payment WHERE status='cancelled') AS migrated_cancelled;

-- 회원 매핑 누락 (mb_id 있는데 member_id NULL인 경우)
SELECT mb_id, COUNT(*) FROM payment WHERE member_id IS NULL AND mb_id IS NOT NULL GROUP BY mb_id;
```

### ETL 시 주의사항

1. **CancelAmount/CancelCoin 컬럼이 라이브에 실재하는지 우선 확인** — coin_cancel.php는 이 컬럼을 가정하지만 실제 스키마는 다를 수 있음. 있으면 status를 더 정확히 매핑. 없으면 `payment_cancel_log_t` 합계로 partial_cancelled 판정
2. **회원 ID 매핑 누락 케이스** — mb_id가 g5_member에 없는 결제건(탈퇴 회원 등)은 member_id NULL로 보존
3. **VRBANK 미입금 건** — ResultMsg='정상처리' && DepositTm 없음 → status='pending'으로 마이그레이션
4. **중복 Oid** — UNIQUE 충돌 가능성 → ON CONFLICT DO NOTHING + 별도 리포트
5. **타임존** — od_time이 KST로 저장됐으나 신규 스키마는 TIMESTAMPTZ — `AT TIME ZONE 'Asia/Seoul'` 변환 필요

---

## 우선순위 권장

| 우선 | 작업 | 근거 |
|---|---|---|
| **P1** | `coin_cancel.php`의 `pay_cancel()` 미정의 함수 호출 — **lib/pay_ag9.php 정합성 확인** (라이브에서 fatal error 나는지 점검) | 운영 영향 |
| **P1** | `coin_pay_history_delete.php` 물리 삭제 기능 — 신규에서는 **제거** 또는 super 한정 soft delete | 회계/감사 |
| **P2** | Phase A (point adjustment) 완료 후 Phase B (PaymentsService) 착수 | 의존성 |
| **P2** | `0014_payment_audit.sql` 신규 마이그레이션 작성 (actor 컬럼 + account_setting 보강) | DB 선행 |
| **P3** | `coin_charge_history.php`는 placeholder — 신규 PointHistoryList(Phase A)와 통합하거나 별도 "코인 변동 내역" 페이지로 (이벤트/쿠폰 카테고리) | 디자인 결정 |
| **P3** | AG9 토큰/호스트를 `setting` 테이블(0005)로 옮기고 ConfigService에서 로드 | 보안 |

---

## 참고 파일 경로 (절대경로)

### 분석 대상 (read-only)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_pay_form.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_pay_form_update.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_pay_history.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_pay_history_delete.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_pay_history_excel.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_charge_history.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/coin_cancel.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/order_cancle.php`
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/adm/order_vbank_cancel.php`

### 의존성 / PG 라이브러리
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/lib/pay_ag9.php` (`pay_cancel_full`)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/lib/common.lib.php` (`send_mjson_cancle`, `send_mjson1`, line 4168~)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/_pay_config.php` (AG9_AUTH_TOKEN placeholder)
- `/Users/jin-yubi/dwork/AI/사주플랜1/sample/coin/coin_pay_ok_20280829.php` (PG 콜백 처리, PayMethod 코드 참조용)

### 신규 시스템
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/db/migrations/0004_payment.sql`
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/db/migrations/0005_cms_system.sql` (account_setting)
- `/Users/jin-yubi/dwork/AI/사주플랜1/api/src/admin/members/members.service.ts` (NestJS 패턴 참고)
- `/Users/jin-yubi/dwork/AI/사주플랜1/web/mng/src/pages/CustomerList.tsx` (React 패턴 참고)
- `/Users/jin-yubi/dwork/AI/사주플랜1/PLAN/phase-a-point-adjustment.md` (PointsService.adjust 의존)
