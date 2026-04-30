# 도메인 03: 상담사 / 상담 + 정산

> read-only 분석 결과. `sample/adm` 코드는 미수정.
> 분석 시점: 2026-04-29.
> 담당 파일: `counselor_list.php`, `counselor_list_update.php`, `counselor_list_excel(2).php`,
> `counsel_history.php`, `coin_counsel_history.php`, `coin_counsel_history_excel.php`,
> `settlement_list.php`, `settlement_list_v2.php`, `settlement_list_excel.php`, `settlement_list_delete.php`.
> 정산 계산의 실체 함수는 `lib/common.lib.php`의 `set_con_account()`/`set_con_account_v2()`/`set_con_account_v3()`이며 함께 분석함.

---

## 개요

이 도메인은 상담사라는 특별한 회원(`mb_level=5`)을 관리하고, 그들이 실제 진행한 상담 세션(`platform_consulting`)을 조회·검색하며, 매월 1일 즈음에 전월 매출을 집계해 로열티/세금/회선비를 차감한 지급액을 계산하는 일련의 흐름이다.

세 가지가 한 도메인에 묶여야 하는 이유:

1. **상담사 마스터(member, role=counselor)** 의 단가/로열티/상태가 정산 계산식의 입력이다.
2. **상담 세션(consultation)** 이 매출의 원천이다.
3. **정산(`g5_point_end`)** 은 위 두 입력을 월말에 합산해 지급액을 산출한다.

라이브의 가장 큰 위험은 다음 세 가지다.

- **state(상담사 실시간 상태) 머신이 코드 곳곳에 흩어져 있음** — IDLE/ABSE/CONN/RESV/CRDY/RDCH/RDVC/CNCH 8개 상태 중 RDVC/RDCH가 2025-07-31에 추가됐는데 일부 SQL은 갱신되지 않아 `excel.php`엔 따옴표 깨진 SQL(`a.state!='RDCH)` — 따옴표 누락)이 그대로 남아있다.
- **정산 계산이 v1/v2/v3 세 버전 공존** — `settlement_list.php`(현행 라이브에서 호출됨)는 v1(`set_con_account()`)이지만 v3 컬럼(`price_free`, `price_paid` 등)을 화면에 출력 중. v1은 그 컬럼을 채우지 않으므로 화면이 항상 0원으로 표시된다.
- **SQL injection 전반** — `$_GET` 값이 그대로 SQL에 삽입되는 곳이 도처에 있다(검색어, 정렬, 날짜 일부).

신규 web/mng는 위 세 문제를 처음부터 정리해야 한다.

---

## DB 테이블 인벤토리

### 라이브 (g5/legacy)

| 테이블 | 역할 | 주요 컬럼 |
|---|---|---|
| `g5_member` (mb_level='5') | 상담사 마스터 | mb_no, mb_id, mb_nick, mb_hp, mb_1(csrid), mb_2(sortno), mb_3(telno), mb_4(decamt 070단가), mb_5(dectm 단위초), mb_6(preflag), mb_7(dtmfno), mb_8(은행정보 파이프), mb_9(060단가), mb_12(채팅 단위초), mb_13(채팅 단위원), mb_19(무료로열티%), mb_20(유료로열티%), state, mb_rising, mb_sort, ev_1~4 |
| `g5_write_counselor` | 상담사 프로필 글 (분야) | wr_id, mb_id, ca_name(타로/신점/사주/심리) |
| `member_status_history` | 상태 변경 이력 (1행/회원, 비-g5 prefix) | mb_id(unique), status, wr_datetime, mmb_id |
| `platform_consulting` | 상담 세션 마스터 | no, csrid, membid, mb_id(상담사), reason(DISCONNECT/END_CHAT/...), preflag(Y=070, ''=060), p_gubun(Y=유료/N=무료), amt, amt_free, amt_pro, usetm, eventtm, start, end, wr_datetime, calc_flag, roomid |
| `g5_point` | 포인트 변동 이력 | po_id, mb_id, po_datetime, po_point(±), po_content, po_rel_table, po_rel_id, po_rel_action, c_no, p_gubun, p_end |
| `g5_point_end` | **월별 정산 결과** (이 도메인의 핵심 결과 테이블) | no, mb_id, month(YYYY-MM), price(최종 지급액), price_free, price_paid, price_other, price_tot, vat_amount, withholding_tax, reply_fee, amb_id(처리 관리자), wr_datetime, up_datetime |
| `g5_write_c_history` | 상담 후 메모 (wr_2: 상담주제) | wr_id, wr_10(consulting.no), wr_2 |
| `g5_write_review` | 상담 후기 | wr_id, wr_1(상담사 mb_id), wr_10 |
| `g5_scrap` | 단골 표시 | mb_id, wr_id |
| `saju_resv` | 예약 (상태 IDLE 전환 시 알림 발송) | no, cs_id(상담사), mb_id, mb_hp, regday |

### 신규 (api/db/migrations/0001~0004)

| 신규 테이블 | 정산/상담 관련 매핑 |
|---|---|
| `member` | `csrid`, `counselor_priority`, `telno`, `call_070_unit_cost`(=mb_4), `call_unit_seconds`(=mb_5), `preflag`, `dtmfno`(=mb_7), `bank_*`(mb_8 분해), `call_060_unit_cost`(=mb_9), `chat_unit_seconds`(=mb_12), `chat_unit_cost`(=mb_13), `free_royalty_pct`(=mb_19), `paid_royalty_pct`(=mb_20), `state`, `use_phone`, `use_chat`, `is_rising`, `is_recommended`(=mb_sort), `counselor_category`(0012 분야) |
| `consultation` | `platform_consulting` 1:1 매핑. `is_settled`, `calc_flag`, `is_paid`(=p_gubun) 보존 |
| `chat_room`, `chat_message` | 채팅 상담의 내역 |
| `point_history` | `g5_point` 1:1, `is_settled`(=p_end), `consultation_no`(=c_no) |
| `point` | 회원 잔액 집계 (free/paid 분리) |
| `member_status_log` | `member_status_history` 1:N으로 풀고 (상태 변경 이력 누적) |

### 누락 — **신규 마이그레이션 필요**

| 신규 테이블 (제안) | 출처 | 비고 |
|---|---|---|
| `settlement_monthly` | `g5_point_end` | 신규 마이그레이션 0013 필요 |

`point_history.is_settled` 플래그만으로는 월별 결과(공급가액/부가세/원천세/회선비)를 표현할 수 없다. 별도 집계 테이블이 필수. PLAN/README의 "신규 설계: g5_point_end → point_history.is_settled 플래그로 통합" 메모는 보완이 필요하다.

---

## 외부 시스템 연동 (M2NET / Passcall)

| 호출 | URL | 용도 | 코드 위치 |
|---|---|---|---|
| `csr-mgr` (POST) | `http://passcall.co.kr:25205/csr-mgr/{cpid}` | 상담사 등록(=신규 csrid 발급) | `adm/ajax.csr_mgr.php` (관리자에서 "엠넷연동" 버튼) |
| `memb-mgr` (POST/PUT) | `:25205/memb-mgr/{cpid|membid}` | 일반회원 등록/포인트 동기화 | `lib/common.lib.php` 정산 후 mb_level=2 회원 잔액 PUT |
| `chat-mgr csrstat` (POST) | `http://passcall.co.kr:20102/chat-mgr/{cpid}` | 상담사 상태 즉시 반영 (AG9) | `lib/common.lib.php::set_crs_status_chg()` |

전화/채팅 시스템은 **AG9(엠투넷)** 가 별도 서버에서 운영한다. 070(선불) / 060(후불) 구분은 `preflag='Y'/''` 값으로 표현되며, 이 값은 platform_consulting에 저장돼 정산 시 분류 키로 쓰인다.

신규 NestJS는 이미 `api/src/shared/m2net/m2net.service.ts`에 csr-mgr/chat-mgr/memb-mgr 호출이 모두 구현돼 있다. CounselorList의 m2net 필드(`csrid`, `dtmfno`, `telno`)는 이 서비스로 등록 시 자동 채워진다.

---

## 상담사 상태 머신

### canonical 정의 — `sample/config.php:266`

```php
$s_state = array(
  "IDLE" => "전화상담가능",
  "ABSE" => "부재중",
  "CONN" => "전화상담중",
  "RESV" => "예약",
  "CRDY" => "상담준비",
  "RDVC" => "전화채팅가능",   // 2025-07-31 추가
  "RDCH" => "채팅상담가능",   // 2025-07-31 추가
  "CNCH" => "채팅상담중"
);
```

### 의미

| 코드 | 의미 | 사용가능: 전화 | 사용가능: 채팅 |
|---|---|---|---|
| IDLE | 전화 대기 (전통 070/060) | ✅ | ❌ |
| ABSE | 부재중 | ❌ | ❌ |
| CONN | 전화 상담중 | (lock) | ❌ |
| RESV | 예약 잡힘 | (예약 시간만) | ❌ |
| CRDY | 상담 준비 (전이 상태) | ❌ | ❌ |
| RDCH | 채팅만 가능 | ❌ | ✅ |
| RDVC | 채팅+전화 둘 다 가능 | ✅ | ✅ |
| CNCH | 채팅 상담중 | ❌ | (lock) |

### 전이

```
       관리자/스케줄러 토글           회원 호출(consult.start)
   ┌───────────────────────────┐  ┌──────────────────┐
   │                           ↓  │                  ↓
ABSE ◄──── (자동 전환) ───── IDLE/RDCH/RDVC ───────► CONN/CNCH
                                  ▲                  │
                                  │      종료(DISCONNECT/END_CHAT)
                                  └──────────────────┘
```

- **상담 가능 = IDLE OR RDVC OR RDCH** — `counselor_list.php:226` (그러나 `counselor_list_excel.php:123`은 같은 라인에서 `'RDCH)` 따옴표 누락 SQL 오류, 동작 안 함).
- **부재중 = NOT (IDLE OR RDVC)** — `counselor_list.php:242`. 여기서도 RDCH가 빠짐 (excel은 포함). 일관되지 않음.
- IDLE→ABSE 자동 전환 시점은 통화 종료 후 일정 시간 응답 없을 때(엠투넷 webhook). 라이브 코드에서는 `member_status_history`에 상태 변경 시 시각이 기록돼 부재중 경과시간을 표시하는 데 사용된다 (`counselor_list.php:741, diff_time()`).
- 상태 변경 시 양방향 동기 필요: ① DB(`g5_member.state`) ② `member_status_history` upsert ③ AG9에 `chat-mgr csrstat` 호출. 라이브의 `set_constate()`는 ①②만, AG9 호출은 별도 함수(`set_crs_status_chg()`)로 분리돼 있음.
- IDLE/RDVC/RDCH 진입 시 `set_resv_alrm()`이 `saju_resv`를 조회해 예약자에게 카톡 발송 후 예약 row를 삭제 — 신규 설계에서는 reservation 테이블 status로 관리해야 함(삭제 금지).

### 신규 설계 권장

`member.state`는 그대로 8개 enum 유지 (이미 0001_member.sql에 반영됨). 단:

1. 상태 전이 로직은 **NestJS 서비스에 단일 함수**(`CounselorStateService.transition`)로 모으고, ① DB update + member_status_log insert + ② chat-mgr csrstat 호출을 한 트랜잭션 + 보상 패턴으로 묶는다.
2. 부재중 경과시간 계산은 별도 "마지막 상태 변경 시각" 컬럼(`state_changed_at TIMESTAMPTZ`)을 member에 추가하면 매번 status_log를 join하지 않아도 된다. 0013 마이그레이션에 포함 권장.
3. **RDCH가 빠진 SQL 오류 잔존** — 이관 시 통일된 enum 헬퍼(`STATE_AVAILABLE = ['IDLE','RDVC','RDCH']`, `STATE_BUSY = ['CONN','CNCH','RESV']`)로 정리.

---

## 정산 계산 로직

### 정산 단위

- **월 단위.** 월 키는 `YYYY-MM` (예: `2026-03`).
- **기준 기간**: `[해당월-01 00:00:00, 다음달-01 00:00:00)` — v2/v3는 반열린 구간을 사용해 월 경계를 정확히 처리. v1(`set_con_account`)은 `endday = 이번달-01 00:00:00`인데 `<` 비교로 사용해 결과는 같으나 의도가 불명확.
- 매월 1일 자정 즈음 운영자가 관리자에서 **"월정산하기"** 버튼 → 팝업으로 `pay_month.php` 실행 → mb_level=5 전체 상담사 루프 → `set_con_account($mb_id)` 호출.
- 크론으로 자동 실행되지 않는다 (수동). `pay_month.php` 스크립트에는 cron 주석은 있으나 실제 cron 등록은 외부.

### v3 (가장 정확한 식, 2026-03부터)

```
royalty_free   = member.mb_19  (%)        — 무료 로열티
royalty_paid   = member.mb_20  (%)        — 유료 로열티

// 1) 환불 제외 + 포인트 매칭된 상담만 집계
amt_free = SUM(consultation.amt_free)  WHERE NOT (reason='DISCONNECT' AND usetm<30 AND amt<=mb_4)
                                         AND EXISTS(point_history WHERE c_no = consultation.no)
amt_paid = SUM(consultation.amt_pro)   같은 조건

// 2) "기타 포인트" — 상담/정산차감 외 모든 포인트 변동
amt_other_plus  = SUM(point_history.po_point WHERE po_point>0 AND rel_table NOT IN ('@member','@platform_consulting'))
amt_other_minus = SUM(point_history.po_point WHERE po_point<0 AND rel_table NOT IN ('@member','@platform_consulting'))  // 음수

// 3) 로열티 적용
price_free  = floor(amt_free  * royalty_free  / 100)
price_paid  = floor(amt_paid  * royalty_paid  / 100)
price_other = floor(amt_other_plus * royalty_paid / 100) + amt_other_minus

price_tot       = price_free + price_paid + price_other  // 부가세 포함 가격
supply_price    = floor(price_tot / 1.1)                 // 공급가액 (VAT 분리)
vat_amount      = price_tot - supply_price               // 부가세 (10%)
withholding_tax = floor(supply_price * 0.033)            // 원천세 3.3%
reply_fee       = (price_tot >= 50000) ? 20000 : 0       // 회선비 (5만원 이상에만 부과)

price = supply_price - withholding_tax - reply_fee       // 최종 지급액
```

### v2 vs v3 차이

- v3는 포인트 차감(`point_history insert with po_point=-price`)을 **하지 않음** — 정산 결과 테이블만 갱신.
- v2는 포인트 차감 + `g5_point.p_end='Y'` + `consultation.calc_flag='Y'` 모두 처리.
- 라이브에서 실제 호출은 `set_con_account()` (v1) — v2/v3는 더 정확한 계산식이지만 `pay_month.php`에 연결되지 않음. **운영 중인 정산은 v1로 돌고 있다.**

### v1의 결정적 버그

```php
// sample/lib/common.lib.php:5019
$sql = "select sum(po_point) as price from g5_point
        where  and mb_id='{$mb_id}' ..."
//             ^^^ 'where  and' 가 syntactically invalid
```

- `where` 다음에 곧바로 `and`가 와서 항상 SQL 에러. 즉 v1에서는 `$price = 0`이 되어 `g5_point_end.price = 0`으로 INSERT, 포인트 차감(if `$price > 0` 가드) 미실행.
- 결과적으로 라이브 정산은 **0원으로 INSERT만 되고 실제 지급은 별도 수동 처리**되는 듯. v2의 `[수동] 11월 정산 중복`, `[수동]정산 시스템 오류로인한 미지급건` 코멘트가 이 정황을 뒷받침.

### 화면(`settlement_list.php`)과의 불일치

- 화면은 v3 컬럼(`price_free`, `price_paid`, `price_other`, `price_tot`, `vat_amount`, `withholding_tax`, `reply_fee`, `price`)을 출력한다.
- 그러나 정산 함수가 v1이므로 위 컬럼들은 INSERT 시 채워지지 않아 항상 0(또는 NULL).
- v3 컬럼이 채워지려면 누군가 `set_con_account_v2/v3()`을 외부 스크립트로 별도 실행해야 한다 (운영 중 실제 그렇게 처리하고 있을 가능성 높음).

### 월 경계/타임존

- 모두 `Asia/Seoul` 가정 (PHP `date()` 기본 설정). 신규는 `TIMESTAMPTZ` + `at time zone 'Asia/Seoul'` 명시 필요.
- 월의 마지막 시각을 `YYYY-MM-{lastday} 23:59:59`로 잡는 v1 패턴은 1초 오차 가능. v2/v3의 반열린 구간 `[start, next_month_start)`이 정확.

---

## 파일별 분석

### counselor_list.php (28KB, 가장 핵심)

1. **역할**: 상담사 (mb_level=5) 리스트 + 검색 + 분야/상태별 카운트 + 일괄 권한/로열티/이벤트/추천순서 수정 + 엑셀 export 진입점.
2. **HTTP**: `GET adm/counselor_list.php`. 폼 제출은 `POST counselor_list_update.php`.
3. **읽는 테이블**: `g5_member a`, `g5_write_counselor b` (left join, sub-select with group by mb_id), `g5_group_member` (per-row count), `g5_write_review` (`get_counselor_afcnt`), `platform_consulting` (`get_counselor_counter_all`, `get_counselor_sum_time`, `get_con_total_account_befre_mode`), `g5_scrap` (`get_counselor_scrap_count`), `member_status_history` (per-row 1쿼리).
4. **쓰는 테이블**: 없음.
5. **입력 파라미터**: `sfl`(필드), `stx`(키워드), `fr_date`/`to_date`(YYYY-MM-DD 정규식 검증), `sst`/`sod`(정렬 — **검증 없음**), `page`. 검증은 날짜만, sfl/sst는 직접 SQL 삽입.
6. **출력**: 페이지당 cf_page_rows 행, 분야별 카운트, IDLE/ABSE 카운트, 가입일~로열티~상태~이벤트.
7. **흐름**:
   ```
   1. 권한 체크 auth_check_menu(350120, 'r')
   2. WHERE 조립 ($sfl, $stx 직삽입)
   3. count(*) → total_count
   4. 4번의 분야별 count (타로/신점/사주/심리) - 각각 별도 쿼리
   5. 2번의 상태별 count (IDLE+RDVC+RDCH / NOT IDLE NOT RDVC) - 부재중 카운트는 RDCH 누락
   6. 페이징 list 쿼리
   7. for each row: 그룹 카운트, 후기, 누적상담, 누적시간, 단골수, 지난달 070/060, member_status_history per row
   ```
8. **외부 의존성**: `member_form1.php` (단건 수정 폼, 별도 분석 필요), `bbs/write.php?bo_table=counselor` (프로필 글), `counselor_list_excel.php` 새 창.
9. **발견된 이슈**:
   - **SQL injection**: `$sfl`, `$stx`, `$sst`, `$sod` 모두 직삽입. `sfl=a.mb_id'; drop ...` 형태 가능.
   - **N+1 쿼리 폭증**: 행마다 6~8 쿼리 (group, review, consult count, sum time, scrap, this/last month 070, last month 060, member_status_history) → 페이지당 100~150 쿼리. 페이지 크기 50이면 5천 쿼리. 매월 부담 큼.
   - **상태 enum 불일치**: 부재중 카운트에서 RDCH 빠짐 (line 242), excel.php는 또 다른 분기.
   - **권한 검증**: 일괄저장 버튼은 `is_admin == 'super'`만 보이지만 백엔드(`counselor_list_update.php`)에서 재검증 없음 — `auth_check_menu(350100, 'w')`만 있음.
   - **mb_id 키**: 같은 mb_id가 g5_write_counselor에 여러 row면 group by로 wr_id가 임의 — 분야 결정이 비결정적.
10. **이관 권장**: 이미 `web/mng/CounselorList.tsx` + `api/src/admin/members/findCounselors()`로 80% 구현됨. 보완 필요:
    - 분야별 카운트는 이미 `by_category` 응답에 있음 ✅
    - 상태별 카운트 — `summary.idle/busy/absent` 있으나 **idle = IDLE/RDCH/RDVC/CRDY** 로 묶어 라이브 행동 그대로 재현. busy = CONN/CNCH/RESV.
    - 일괄 저장: `PATCH /admin/members/counselors/bulk-update` body로 `{updates: [{id, is_rising_priority, is_recommended_priority, level, ev_flags}]}` (현재 미구현).
    - 부재중 경과시간: `member.state_changed_at` 컬럼 추가(0013) + `now() - state_changed_at`.

### counselor_list_update.php

1. **역할**: counselor_list 폼 일괄 처리 (일괄저장/선택삭제/완전삭제).
2. **HTTP**: `POST adm/counselor_list_update.php`.
3. **권한**: `auth_check_menu(350100, 'w')` + `check_admin_token()`.
4. **읽는/쓰는 테이블**: `g5_member` UPDATE (ev_1~4, mb_level, mb_sort, mb_rising), `member_delete()` 호출, `g5_member` DELETE (완전삭제).
5. **입력**: `act_button`(일괄저장/선택삭제/완전삭제), `chk[]`(선택 인덱스), `mb_id[$k]`, `mb_level[$k]`, `mb_sort[$k]`, `mb_rising[$k]`, `ev_1[$k]~ev_4[$k]`.
6. **이슈**:
   - **mb_level 권한 우회**: 백엔드에서 `is_admin != 'super'` 검증 없이 어떤 관리자라도 `mb_level=10` 슈퍼관리자로 만들 수 있음.
   - mb_id는 `sql_real_escape_string` 사용하지만 mb_level/mb_sort는 `(int)` 캐스트 → 안전 (다행).
   - 트랜잭션 없음. 5명 일괄 수정 중 3번째 실패하면 1,2만 수정된 상태로 남음.
7. **이관**: `PATCH /admin/members/counselors/bulk-update` 단일 트랜잭션 + 슈퍼관리자만 mb_level 변경.

### counselor_list_excel.php / counselor_list_excel2.php

1. **역할**: 엑셀(.xls) 다운로드. 두 파일 거의 동일.
2. **차이**:
   - `excel.php`: 070/060 분리 + 로열티 + 상태 표시 (현행).
   - `excel2.php`: 통합 매출 (`get_con_total_account_befre()` 070+060 합) + 로열티/상태 미표시. 구버전.
   - excel.php는 **SQL 따옴표 누락 버그**: `a.state!='RDCH)` (123라인) → 항상 0건.
3. **이관 권장**: **하나로 통합.** `GET /admin/members/counselors/export?format=xlsx&070=&060=&...`. excel2는 폐기.

### counsel_history.php

1. **역할**: 상담 현황(통계) 페이지 — **현재 더미 데이터만 출력**됨. 활용 안 함.
2. **읽는 테이블**: 없음 (PHP 로직 주석처리, 하드코딩 3행 출력).
3. **이슈**: 거의 placeholder. 메뉴 등록만 돼 있고 미사용.
4. **이관**: **폐기.** `coin_counsel_history.php`가 실제 상담 이력 페이지.

### coin_counsel_history.php (21KB)

1. **역할**: 사용(상담) 내역 — 실제로 운영자가 매일 보는 상담 로그.
2. **HTTP**: `GET adm/coin_counsel_history.php?view=all|call|chat&...`.
3. **읽는 테이블**: `platform_consulting` (메인), `g5_member` (search resolve mb_id↔mb_1), `g5_write_counselor` (분야), `g5_write_c_history` (`get_con_detail` — 상담 메모 wr_2).
4. **검색**:
   - sfl=mb_id: 회원아이디 → g5_member에서 mb_1 조회 → membid 매칭
   - sfl=cmb_id: 상담사 아이디 → mb_id 매칭
   - sfl=mb_hp: 휴대폰 → from 컬럼 (하이픈 제거)
   - sfl=mb_nick: 상담사 닉네임 → mb_1 → csrid 매칭
   - sfl=preflag: 060/070 분리
5. **뷰 필터**: all/call/chat. call은 reason=DISCONNECT, chat은 reason=END_CHAT.
6. **환불 표시**: `amt <= cinfo['mb_4'] && usetm < 30 && !is_chat` → 표시 "0(환불)". 단가 기준 환불 — **회원당 단가가 다른데 상담사 단가(mb_4)로 비교**하는 모순.
7. **출력**: 날짜, 회원, 상담사, 상담유형(선불/후불/채팅), 분야, 시작/종료/이용시간, 유료/무료, 사용포인트, 상담주제, 채팅내역 링크.
8. **외부 의존성**: 사내 IP(`115.93.39.5`)에서만 디버그 컬럼(개발상담사/개발사용자memb) 표시 — **하드코딩된 IP**, 환경변수화 필요.
9. **이슈**:
   - **SQL injection** 다수 (`$stx`, `$sfl` 직삽입).
   - **회원 미매핑 fallback**: membid가 비어 있으면 `from` 휴대폰으로 g5_member 재조회 — 비회원 상담을 회원으로 잘못 매핑할 가능성.
   - 환불 기준이 상담사 단가(mb_4) — 무료 상담사 단가와 유료 상담사 단가가 다르면 잘못 환불 판정.
10. **이관**: `GET /admin/consultations?view=all|call|chat&q=&fr_date=&to_date=&category=&page=&limit=`. 응답에 `is_refund`(boolean) 미리 계산해 넘기고 프론트는 그냥 표시만.

### coin_counsel_history_excel.php

1. **역할**: 위 페이지의 엑셀 export.
2. **이슈**: 같은 SQL 패턴 + xls 헤더. 환불 표시 로직 동일.
3. **이관**: 동일 엔드포인트의 `?format=xlsx` 옵션으로 통합.

### settlement_list.php (월별 정산 리스트, 핵심)

1. **역할**: `g5_point_end` 월별 정산 결과 조회 + "월정산하기" 버튼(팝업으로 `pay_month.php` 실행).
2. **HTTP**: `GET adm/settlement_list.php?fr_date=&to_date=&sfl=&stx=...`. 폼 제출은 `POST settlement_list_delete.php` (선택삭제만).
3. **읽는 테이블**: `g5_point_end` (메인), `g5_member` (`get_member`로 이름/닉네임/mb_19/mb_20 조회).
4. **쓰는 테이블**: 없음 (delete는 별도 파일).
5. **입력**: `fr_date`/`to_date`(YYYY-MM-DD 정규식 → 7자리 substr로 YYYY-MM 비교), `sfl`/`stx`(검색).
6. **출력 컬럼** (라이브 화면): 아이디, 이름, 닉네임, 해당월, 무료R%(mb_19), 유료R%(mb_20), 무료정산비(price_free), 유료정산비(price_paid), 기타정산비(price_other), 정산비전체(price_tot), 부가세공제(vat_amount), 원천세공제(withholding_tax), 회선비(reply_fee), 총정산금액(price).
7. **이슈**:
   - 위 컬럼들은 v3 결과만 채워짐. v1(라이브 정산)은 price만 채우고 나머지 0 — **운영자 보는 화면의 70%가 항상 0**.
   - **선택삭제만 지원, 재계산 없음** — 한 번 산출된 정산 row를 수정할 방법이 없다. 잘못 계산되면 삭제 후 재실행이지만 v3는 INSERT/UPDATE 분기 있음(있으면 UPDATE).
   - **월정산하기 버튼이 mb_level=5 모든 상담사를 무차별 루프** — 진행 중에 실패하면 일부만 정산됨, 트랜잭션은 v2/v3 내부 단위.
8. **이관 권장**:
   - 신규 테이블 `settlement_monthly` (별도 파일 0013) 신설.
   - 정산 실행은 비동기 큐(BullMQ 등) — 한 상담사 = 하나의 job.
   - 멱등성: `(member_id, month)` UNIQUE.
   - 재계산 API: `POST /admin/settlements/{member_id}/{month}/recalc`.
   - 결과 PATCH는 운영자 메모만 가능, 금액 컬럼은 immutable.

### settlement_list_v2.php

1. **차이**: settlement_list와 거의 동일. 단지 출력 컬럼 헤더가 "무료상담금액/무료로열티/유료상담금액/유료로열티/총매출" 등으로 다르고, **데이터 셀이 비어 있음** (`<td class="td_mng_l"></td>`만 9줄).
2. **결론**: **v2는 작업 중인 미완성 화면**. 운영에 사용되지 않음. **폐기.** 신규는 settlement_list 컬럼 셋 + 위에서 지적한 정확성 보강.

### settlement_list_excel.php

1. **역할**: 정산 결과 엑셀 export. BOM 추가 (한글 깨짐 방지) — 양호.
2. **컬럼**: settlement_list와 동일 + member 이름/닉네임 join.
3. **이관**: `GET /admin/settlements/export?fr_month=&to_month=&format=xlsx`.

### settlement_list_delete.php

1. **역할**: 정산 row 선택 삭제 (g5_point_end DELETE).
2. **HTTP**: `POST`.
3. **권한**: `auth_check_menu(350500, 'd')` + `check_admin_token()`.
4. **이슈**:
   - **버그**: `$no = get_member($_POST['no'][$k])` — `$_POST['no']`는 정산 PK인데 `get_member()`로 회원 조회. 결과 `$no`는 회원 row 객체. 그 다음 `where no='".$no."'`로 DELETE — `$no`가 Array이므로 PHP가 "Array" 문자열로 변환, **삭제 안 됨**.
   - **포인트 보정 누락**: 정산 row 삭제 시 `g5_point.p_end='Y'`로 표시된 포인트들도 해제하지 않으면 다음 정산에서 누락. 보상 처리 없음.
5. **이관**:
   - **삭제는 직접 허용 금지**. 대신 "정산 무효화"(status='voided') + 보정 history 추가 + 운영자/사유 기록.

---

## 발견된 이슈 (전체)

### A. SQL Injection (즉시 차단해야 함)

| 파일 | 위치 | 위험도 |
|---|---|---|
| counselor_list.php:33-78 | `$sfl`, `$stx`, `$sst`, `$sod` 직삽입 | 높음 |
| counselor_list_excel(2).php | 동일 | 높음 |
| coin_counsel_history.php:32-72 | mb_id resolve sub-query에 `$stx` 직삽입 | 매우 높음 (sub-query에서 union select 가능) |
| settlement_list.php:24-29 | `$sfl`, `$stx` 직삽입 | 중간 (kind만 검색) |
| settlement_list_v2.php | 동일 | 중간 |
| settlement_list_delete.php:19 | `$no` Array → 문자열 비교, **bug** | (실효성 없는 인젝션 + 기능 자체가 안 됨) |

신규 NestJS는 postgres.js 템플릿 리터럴로 자동 파라미터 바인딩 — 이미 안전. ETL 시 검색 파라미터 모두 bind variable로 변환.

### B. 정산 계산 정확성

| 항목 | 라이브 동작 | 권장 |
|---|---|---|
| 반올림 | `floor()` (절사) — 한국 회계 관행과 부합 | 그대로 유지. PG 표준 함수: `floor(numeric)` |
| 부가세 분리 | `floor(price_tot / 1.1)` → vat = price_tot - supply | 올바름. `numeric(12,0)` 컬럼 + `(price_tot * 100 / 110)::int` 명시 |
| 원천세 | `floor(supply * 0.033)` | 올바름 (3.3%). 50,000원 미만은 면제? **현재 면제 없음** — 검토 필요 |
| 회선비 | `(price_tot >= 50000) ? 20000 : 0` | 0/50000 경계 정책 검토 (49,999원은 0원, 50,000원은 20,000원 차감 → 50,001원 받는 사람이 30,001원 받음 — 역전 발생 가능) |
| 환불 기준 | `usetm < 30 AND amt <= mb_4` | mb_4는 상담사 단가 — 회원이 다른 단가로 충전했을 때 오판 |
| 월 경계 | v1: 마지막날 23:59:59 / v2,v3: 다음달-01 00:00:00 (반열린) | **v2/v3 방식만 사용.** TIMESTAMPTZ + Asia/Seoul timezone 명시 |
| 멱등성 | v2는 GET_LOCK(`SETTLE_{mb_id}`, 5초) | 신규는 `INSERT ... ON CONFLICT (member_id, month) DO UPDATE` + advisory lock |
| 트랜잭션 | v2: try/catch + COMMIT/ROLLBACK 시도 (PHP에서 try-catch는 SQL 에러 자동 throw 안 함) | NestJS `sql.begin()` |

### C. 트랜잭션 누락

- `counselor_list_update.php` 일괄 저장: 트랜잭션 없음
- `set_con_account()` (v1): 트랜잭션 없음. INSERT g5_point_end 후 INSERT g5_point 실패 시 정산 결과만 남고 차감 안 됨
- `settlement_list_delete.php`: 트랜잭션 없음 + 자체 버그

### D. 권한 검증 부실

| 위치 | 문제 |
|---|---|
| counselor_list_update.php | mb_level 변경에 super 검증 없음 (UI만 가림) |
| counselor_list_excel.php | 'r' 권한만 — 엑셀 다운로드는 별도 권한 필요 (개인정보 대량 export) |
| settlement_list_delete.php | 'd' 권한 — 정산은 더 강한 권한 필요 (super only) |
| 모든 파일 | IP 화이트리스트 없음. 사내 IP `115.93.39.5` 분기는 디버그용 (정책용 아님) |

### E. 로그/감사 누락

- 정산 결과 row에 `amb_id`(처리 관리자) 컬럼 있으나 변경 시각/변경자/사유 없음.
- 상담사 단가 변경(mb_4, mb_5, mb_19, mb_20)은 로그 없음 — 임의로 누가 바꿔도 추적 불가.
- 상태 변경(state)은 member_status_history에 기록되나 1행/회원이라 누적 이력 X.

### F. 하드코딩 정산율/단가

- 부가세 1.1, 원천세 0.033, 회선비 20,000원/임계 50,000 — 모두 함수 안에 상수.
- 신규: `setting` 테이블에 키-값으로 분리 (`settlement.vat_rate=0.10`, `settlement.withholding_rate=0.033`, `settlement.line_fee_threshold=50000`, `settlement.line_fee=20000`).
- 변경 시 영향 범위는 향후 신규 정산만 — 과거 정산은 snapshot한 율로 재계산 가능해야 함 (`settlement_monthly`에 사용된 율 컬럼 보존).

### G. 중복 코드

- counselor_list.php (28KB), counselor_list_excel.php(9.9KB), counselor_list_excel2.php(9KB) 모두 같은 WHERE 빌드를 복붙.
- counselor_list_*.php 백업 파일 4개 (20240826, 20250120, 20250710, 20250811) — 현행과 비교해야 안전한 이관 가능.
- settlement_list.php와 settlement_list_v2.php — v2는 미완성. 폐기.

### H. v1 vs v2 vs v3 (정산 함수)

| 함수 | 호출처 | 상태 | 주요 차이 |
|---|---|---|---|
| `set_con_account()` (v1) | `pay_month.php` (라이브 운영) | **버그(SQL `where  and`)** — 항상 $price=0 | 이력 없는 단순 합산 |
| `set_con_account_v2()` | 호출처 없음 (테스트용?) | 작동 — GET_LOCK + 트랜잭션 + v3 컬럼 + 포인트 차감 | 가장 완전 |
| `set_con_account_v3()` | 호출처 없음 | 작동 — 결과 테이블 갱신만 (포인트 차감 없음) | 재계산 안전 |

신규는 v3 식 + v2의 lock/포인트 차감을 합한 단일 NestJS 함수로 정리 권장 (아래 설계 참조).

---

## web/mng 이관 설계

### 신규 DB 마이그레이션 (필요)

**`api/db/migrations/0013_counselor_settlement.sql`** (신규):

```sql
BEGIN;

-- 1. 부재중 경과시간 계산용 컬럼
ALTER TABLE member
  ADD COLUMN state_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN member.state_changed_at IS '마지막 state 변경 시각 (부재중 경과시간 계산용, member_status_log의 최신 row와 동기화)';

CREATE INDEX idx_member_state_changed ON member (state_changed_at DESC) WHERE role = 'counselor';

-- 2. 월별 정산 결과 (g5_point_end 대체)
CREATE TABLE settlement_monthly (
  id              BIGSERIAL PRIMARY KEY,
  no       INT,                              -- ETL 멱등 (g5_point_end.no)
  member_id       BIGINT NOT NULL REFERENCES member(id) ON DELETE RESTRICT,
  mb_id    VARCHAR(100),
  month           CHAR(7) NOT NULL,                 -- 'YYYY-MM'
  status          VARCHAR(20) NOT NULL DEFAULT 'calculated',
                                                    -- calculated / paid / voided

  -- 입력 스냅샷 (계산 시점의 회원 율 보존)
  free_royalty_pct  SMALLINT NOT NULL,             -- mb_19 스냅샷
  paid_royalty_pct  SMALLINT NOT NULL,             -- mb_20 스냅샷

  -- 매출 집계
  amt_free        INT NOT NULL DEFAULT 0,           -- 무료 상담 매출
  amt_paid        INT NOT NULL DEFAULT 0,           -- 유료 상담 매출
  amt_other_plus  INT NOT NULL DEFAULT 0,           -- 기타 가산 포인트
  amt_other_minus INT NOT NULL DEFAULT 0,           -- 기타 차감 포인트 (음수)

  -- 정산 결과
  price_free      INT NOT NULL DEFAULT 0,
  price_paid      INT NOT NULL DEFAULT 0,
  price_other     INT NOT NULL DEFAULT 0,
  price_tot       INT NOT NULL DEFAULT 0,           -- VAT 포함
  supply_price    INT NOT NULL DEFAULT 0,
  vat_amount      INT NOT NULL DEFAULT 0,
  withholding_tax INT NOT NULL DEFAULT 0,
  reply_fee       INT NOT NULL DEFAULT 0,
  price           INT NOT NULL DEFAULT 0,           -- 최종 지급액

  -- 사용된 정산 정책 (당시 값 보존, hardcode 제거)
  vat_rate            NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  withholding_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.033,
  line_fee_threshold  INT NOT NULL DEFAULT 50000,
  line_fee            INT NOT NULL DEFAULT 20000,

  -- 처리 추적
  calculated_by_id    BIGINT REFERENCES member(id),
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_by_id          BIGINT REFERENCES member(id),
  paid_at             TIMESTAMPTZ,
  voided_by_id        BIGINT REFERENCES member(id),
  voided_at           TIMESTAMPTZ,
  void_reason         TEXT,

  notes               TEXT,                           -- 운영자 메모

  CONSTRAINT uq_settlement_member_month UNIQUE (member_id, month)
);

COMMENT ON TABLE settlement_monthly IS '월별 상담사 정산 결과 (g5_point_end 대체, immutable + audit)';

CREATE INDEX idx_settlement_monthly_month ON settlement_monthly (month);
CREATE INDEX idx_settlement_monthly_member ON settlement_monthly (member_id, month DESC);
CREATE INDEX idx_settlement_monthly_status ON settlement_monthly (status, month);

-- 3. 정산 잡(비동기 처리) 추적
CREATE TABLE settlement_job (
  id              BIGSERIAL PRIMARY KEY,
  month           CHAR(7) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                                                    -- pending / running / completed / failed
  total_count     INT NOT NULL DEFAULT 0,
  success_count   INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  triggered_by_id BIGINT REFERENCES member(id),
  triggered_ip    INET,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  error_log       JSONB
);

CREATE INDEX idx_settlement_job_month ON settlement_job (month);

COMMIT;
```

추가 권장: `setting` 테이블의 키 (Phase G에서 도입할 settings와 통합):
- `settlement.vat_rate` = `0.10`
- `settlement.withholding_rate` = `0.033`
- `settlement.line_fee_threshold` = `50000`
- `settlement.line_fee` = `20000`

### NestJS API 설계

```
api/src/admin/
  ├── consultations/
  │   ├── consultations.module.ts
  │   ├── consultations.controller.ts
  │   └── consultations.service.ts
  └── settlements/
      ├── settlements.module.ts
      ├── settlements.controller.ts
      └── settlements.service.ts
```

**기존 `members.module.ts`에 추가**:

| Method | Path | 역할 | 권한 |
|---|---|---|---|
| PATCH | `/admin/members/counselors/bulk-update` | 일괄 저장 (level/sort/rising/ev_flags) | super only for level |
| GET | `/admin/members/counselors/export?format=xlsx&...` | 엑셀 export | counselor:read |

**상담 이력 API (신규)** — coin_counsel_history.php 대체:

| Method | Path | 역할 |
|---|---|---|
| GET | `/admin/consultations` | view=all/call/chat, q=, fr_date/to_date, member_id, counselor_id, page/limit |
| GET | `/admin/consultations/:id` | 단건 (메모/채팅 내역 포함) |
| GET | `/admin/consultations/export` | xlsx |
| GET | `/admin/consultations/:id/chat-messages` | 채팅 상담의 메시지 목록 |

**정산 API (신규)** — settlement_list.php 대체:

| Method | Path | 역할 | 권한 |
|---|---|---|---|
| GET | `/admin/settlements?fr_month=&to_month=&q=&status=` | 리스트 | settlement:read |
| GET | `/admin/settlements/:id` | 단건 |  |
| POST | `/admin/settlements/run` body `{month}` | 월정산 실행 (비동기 잡 등록) | super only |
| GET | `/admin/settlements/jobs/:id` | 잡 진행 상황 |  |
| POST | `/admin/settlements/:id/recalc` | 재계산 (status=voided 후 새 row) | super only |
| POST | `/admin/settlements/:id/void` body `{reason}` | 무효화 | super only |
| POST | `/admin/settlements/:id/mark-paid` | 지급 완료 표시 |  |
| GET | `/admin/settlements/export` | xlsx |  |

**핵심 서비스 메서드 (의사코드)**:

```typescript
// settlements.service.ts
async calculateMonthlyForCounselor(memberId: number, month: string, actor: { adminId: number; ip: string }) {
  const startDay = `${month}-01 00:00:00+09`;
  const endDay = nextMonthStart(month) + ' 00:00:00+09';

  return this.sql.begin(async (tx) => {
    // advisory lock — 같은 (member, month) 동시 실행 차단
    const [{ ok }] = await tx`
      SELECT pg_try_advisory_xact_lock(
        ${BigInt(memberId)},
        hashtext(${month})::bigint
      ) AS ok
    `;
    if (!ok) throw new ConflictException('이미 처리 중');

    const [m] = await tx`SELECT free_royalty_pct, paid_royalty_pct, call_070_unit_cost FROM member WHERE id = ${memberId} AND role='counselor' FOR UPDATE`;
    if (!m) throw new NotFoundException();

    // 환불 제외 + 포인트 매칭된 상담만
    const [c] = await tx`
      SELECT
        COALESCE(SUM(amt_free), 0) AS amt_free,
        COALESCE(SUM(amt_pro), 0)  AS amt_paid
      FROM consultation tc
      WHERE tc.counselor_id = ${memberId}
        AND tc.reason IN ('DISCONNECT','END_CHAT')
        AND tc.ended_at >= ${startDay}::timestamptz
        AND tc.ended_at <  ${endDay}::timestamptz
        AND NOT (tc.reason='DISCONNECT' AND tc.usetm < 30 AND tc.amt <= ${m.call_070_unit_cost})
        AND EXISTS (SELECT 1 FROM point_history p WHERE p.consultation_no = tc.no::text AND p.member_id = tc.counselor_id)
    `;

    // 기타 포인트
    const [o] = await tx`
      SELECT
        COALESCE(SUM(CASE WHEN earn_point > 0 THEN earn_point ELSE 0 END), 0) AS plus,
        COALESCE(SUM(CASE WHEN use_point  > 0 THEN -use_point ELSE 0 END), 0) AS minus
      FROM point_history
      WHERE member_id = ${memberId}
        AND created_at >= ${startDay}::timestamptz
        AND created_at <  ${endDay}::timestamptz
        AND rel_table NOT IN ('@member','@platform_consulting')
    `;

    // setting에서 율 로드 (당시 값 스냅샷)
    const policy = await this.loadPolicy(tx);

    const priceFree  = Math.floor(c.amt_free * m.free_royalty_pct / 100);
    const pricePaid  = Math.floor(c.amt_paid * m.paid_royalty_pct / 100);
    const priceOther = Math.floor(o.plus * m.paid_royalty_pct / 100) + o.minus;
    const priceTot   = priceFree + pricePaid + priceOther;
    const supply     = Math.floor(priceTot / (1 + policy.vat_rate));
    const vat        = priceTot - supply;
    const wht        = Math.floor(supply * policy.withholding_rate);
    const lineFee    = priceTot >= policy.line_fee_threshold ? policy.line_fee : 0;
    const finalPrice = supply - wht - lineFee;

    // upsert
    await tx`
      INSERT INTO settlement_monthly (
        member_id, month, status,
        free_royalty_pct, paid_royalty_pct,
        amt_free, amt_paid, amt_other_plus, amt_other_minus,
        price_free, price_paid, price_other, price_tot,
        supply_price, vat_amount, withholding_tax, reply_fee, price,
        vat_rate, withholding_rate, line_fee_threshold, line_fee,
        calculated_by_id, calculated_at
      ) VALUES (
        ${memberId}, ${month}, 'calculated',
        ${m.free_royalty_pct}, ${m.paid_royalty_pct},
        ${c.amt_free}, ${c.amt_paid}, ${o.plus}, ${o.minus},
        ${priceFree}, ${pricePaid}, ${priceOther}, ${priceTot},
        ${supply}, ${vat}, ${wht}, ${lineFee}, ${finalPrice},
        ${policy.vat_rate}, ${policy.withholding_rate}, ${policy.line_fee_threshold}, ${policy.line_fee},
        ${actor.adminId}, now()
      )
      ON CONFLICT (member_id, month) DO UPDATE SET
        free_royalty_pct = EXCLUDED.free_royalty_pct,
        ...
        calculated_by_id = EXCLUDED.calculated_by_id,
        calculated_at = now()
    `;

    // 포인트 차감 — 지급 처리 시점에만 (별도 markPaid 메서드로 분리)
    return finalPrice;
  });
}
```

`markPaid`는 별도 메서드로 분리 — 정산 계산과 실제 포인트 차감(=지급)을 다른 시점/관리자가 수행하도록.

### React 페이지 설계

신규 라우트:

| 경로 | 페이지 | 비고 |
|---|---|---|
| `/members/counselors` | CounselorList.tsx (기존) | bulk-update 버튼 추가 |
| `/members/counselors/:id` | CounselorForm.tsx (기존) | 단가/로열티 변경 시 history modal |
| `/consultations` | **ConsultationList.tsx (신규)** | view=all/call/chat 탭 |
| `/consultations/:id` | **ConsultationDetail.tsx (신규)** | 채팅 메시지 + 메모 |
| `/settlements` | **SettlementList.tsx (신규)** | 월별 리스트 + "월정산 실행" 버튼 |
| `/settlements/:id` | **SettlementDetail.tsx (신규)** | 입력 스냅샷/계산 내역 + 무효화/지급 버튼 |
| `/settlements/jobs/:id` | **SettlementJobMonitor.tsx (신규)** | 잡 진행 폴링 (5초 간격) |

기존 CounselorList의 컬럼은 라이브와 거의 1:1 — 추가할 것:
- `state_changed_at` 기반 부재중 경과시간 표시 (라이브의 `(N일)` 출력 재현)
- 일괄저장 행동: 체크박스 → 선택 행 모달 → "저장(레벨/이벤트/추천순서/급상승)" 버튼 → bulk-update PATCH
- 엑셀 내보내기: download 링크 (`/admin/members/counselors/export?...`)

### counselor_list_excel vs excel2 결정

- **excel.php만 유지**, excel2는 폐기. excel.php의 RDCH 따옴표 누락 SQL 버그를 NestJS로 옮기면서 자동 해결.
- 통합 export 엔드포인트: `GET /admin/members/counselors/export?format=xlsx`. 070/060 분리 컬럼 + 로열티 + 상태 표시 (라이브 excel.php 컬럼 셋).

### settlement_list vs v2 결정

- **settlement_list.php만 유지** (v2는 미완성).
- 신규는 settlement_list 컬럼 셋 + `settlement_monthly`에 새로 추가된 `status`/`paid_at`/`calculated_by_id` 컬럼 추가.

---

## ETL 매핑 (g5 → 신규)

### 1. g5_member (mb_level=5) → member (role=counselor)

**이미 0001_member.sql/0012에서 정의됨**. 정산 도메인에서 추가로 다음을 매핑:

| g5_member 컬럼 | member 신규 컬럼 |
|---|---|
| mb_1 | csrid |
| mb_2 | counselor_priority |
| mb_3 | telno (하이픈 제거) |
| mb_4 | call_070_unit_cost |
| mb_5 | call_unit_seconds |
| mb_6 | preflag |
| mb_7 | dtmfno |
| mb_8 (`은행|예금주|계좌`) | bank_name / bank_holder / bank_account (split) |
| mb_9 | call_060_unit_cost |
| mb_12 | chat_unit_seconds |
| mb_13 | chat_unit_cost |
| mb_19 | free_royalty_pct |
| mb_20 | paid_royalty_pct |
| state | state |
| mb_rising | is_rising |
| mb_sort | is_recommended (또는 우선순위 INT — 정책 결정 필요) |
| ev_1~ev_4 | ev_flags JSONB |

### 2. member_status_history → member_status_log + member.state_changed_at

```sql
-- 1) 모든 이력은 member_status_log로 (1행/회원 → 1행/이벤트)
INSERT INTO member_status_log (member_id, mb_id, status, changed_by, created_at)
SELECT m.id, h.mb_id, h.status, h.mmb_id, h.wr_datetime
  FROM legacy.member_status_history h
  JOIN member m ON m.mb_id = h.mb_id;

-- 2) member.state_changed_at은 가장 최근 이력 시각으로
UPDATE member m SET state_changed_at = sub.last_at
  FROM (
    SELECT mb_id, MAX(wr_datetime) AS last_at
      FROM legacy.member_status_history GROUP BY mb_id
  ) sub
 WHERE m.mb_id = sub.mb_id;
```

### 3. platform_consulting → consultation

이미 0003_consultation.sql에 `consultation` 정의돼 있음. ETL에서 mb_id↔member_id, csrid↔counselor_id 매핑:

```sql
INSERT INTO consultation (
  no, member_id, mb_id, counselor_id, csrid, ...
)
SELECT
  pc.no,
  mu.id  AS member_id,
  pc.membid AS mb_id,                 -- 사실 membid는 m2net id, mb_id 매칭 별도
  mc.id  AS counselor_id,
  pc.csrid,
  pc.cpid, pc.dtmfno,
  pc.to AS callee_phone, pc.from AS caller_phone, pc.telno,
  pc.reason,
  pc.usetm, pc.amt, pc.amt_free, pc.amt_pro,
  pc.calc_amt_tot AS calc_total, pc.calc_amt_free AS calc_free, pc.calc_amt_pro AS calc_paid,
  pc.preflag,
  (pc.amtend = 'Y') AS is_settled,
  pc.calc_flag,
  (pc.p_gubun = 'Y') AS is_paid,
  pc.membid, pc.roomid, pc.callid,
  (pc.abse_check = 'Y') AS is_absent_disconnect,
  (pc.skip_charge = 'Y') AS skip_charge,
  pc.mrtn AS mrtn,
  pc.start AS started_at, pc.end AS ended_at,
  pc.eventtm, pc.wr_datetime AS created_at
FROM legacy.platform_consulting pc
LEFT JOIN member mu ON mu.csrid IS NULL AND mu.mb_id = ... -- 회원 매칭 (membid → g5_member.mb_1 → member)
LEFT JOIN member mc ON mc.csrid = pc.csrid;
```

⚠️ membid는 m2net 일반회원 ID(g5_member.mb_1과 별도). 회원 매칭은 별도 lookup 테이블 또는 단계적 매핑 필요.

### 4. g5_point → point_history (이미 Phase A에서 일부 정의됨)

추가로 정산 도메인 관점에서:

```sql
-- 정산 차감 row (po_rel_table='@member')는 settlement_monthly 별도로 보존
-- p_end='Y' 상태는 is_settled=true 매핑
INSERT INTO point_history (
  po_id, member_id, mb_id, content,
  earn_point, use_point, is_expired, expire_date, balance_after,
  rel_table, rel_id, rel_action, consultation_no,
  is_settled, is_paid, created_at
)
SELECT
  gp.po_id, m.id, gp.mb_id, gp.po_content,
  CASE WHEN gp.po_point > 0 THEN gp.po_point ELSE 0 END,
  CASE WHEN gp.po_point < 0 THEN -gp.po_point ELSE 0 END,
  (gp.po_expired = 1),
  NULLIF(gp.po_expire_date, '0000-00-00')::date,
  gp.po_mb_point,
  gp.po_rel_table, gp.po_rel_id, gp.po_rel_action,
  NULLIF(gp.c_no, ''),
  (gp.p_end = 'Y'),
  (gp.p_gubun = 'Y'),
  gp.po_datetime
FROM legacy.g5_point gp
LEFT JOIN member m ON m.mb_id = gp.mb_id;
```

### 5. g5_point_end → settlement_monthly (이번 도메인 핵심 ETL)

```sql
INSERT INTO settlement_monthly (
  no, member_id, mb_id, month, status,
  free_royalty_pct, paid_royalty_pct,
  price_free, price_paid, price_other, price_tot,
  vat_amount, withholding_tax, reply_fee, price,
  amt_free, amt_paid, amt_other_plus, amt_other_minus,
  vat_rate, withholding_rate, line_fee_threshold, line_fee,
  calculated_by_id, calculated_at
)
SELECT
  pe.no,
  m.id,
  pe.mb_id,
  pe.month,
  'calculated',
  COALESCE(gm.mb_19, 0),
  COALESCE(gm.mb_20, 0),
  COALESCE(pe.price_free, 0),
  COALESCE(pe.price_paid, 0),
  COALESCE(pe.price_other, 0),
  COALESCE(pe.price_tot, 0),
  COALESCE(pe.vat_amount, 0),
  COALESCE(pe.withholding_tax, 0),
  COALESCE(pe.reply_fee, 0),
  COALESCE(pe.price, 0),
  -- 매출 입력은 레거시에 없음 — 0으로 backfill (재계산 가능하므로 OK)
  0, 0, 0, 0,
  -- 율은 당시 default
  0.10, 0.033, 50000, 20000,
  -- amb_id를 member로 매핑 (관리자 mb_id → member.id)
  ma.id,
  pe.wr_datetime
FROM legacy.g5_point_end pe
LEFT JOIN member  m  ON m.mb_id = pe.mb_id
LEFT JOIN member  ma ON ma.mb_id = pe.amb_id
LEFT JOIN legacy.g5_member gm ON gm.mb_id = pe.mb_id
ON CONFLICT (member_id, month) DO NOTHING;
```

⚠️ 라이브 v1이 0원만 채우고 v3 컬럼은 NULL인 row가 다수일 것. 이관 후 운영자가 월별로 `recalc` 일괄 실행 권장.

---

## 권한/감사 정리 (이 도메인 한정)

| 액션 | 권한 | 감사로그 필수 항목 |
|---|---|---|
| 상담사 리스트 조회 | counselor:read | (없음) |
| 상담사 단건 수정 | counselor:write | actor_admin_id, before/after diff (특히 단가/로열티) |
| 상담사 일괄 수정 | counselor:write (level은 super only) | 행별 diff |
| 상담사 삭제 | counselor:delete + super | actor + reason |
| 상담사 엑셀 export | counselor:export (신설) | actor + 다운로드 시각 + 행 수 (개인정보 대량) |
| 상담 이력 조회 | consultation:read | (없음) |
| 정산 실행 | settlement:write + super | settlement_job 자체가 audit |
| 정산 무효화 | settlement:write + super | voided_by_id, voided_at, void_reason |
| 정산 지급 처리 | settlement:write | paid_by_id, paid_at |
| 단가/로열티 변경 | counselor:write + super (또는 별도) | 변경 이력 별도 테이블(`counselor_pricing_log`) 권장 |

---

## 작업 순서 (Phase C/D 통합 권장)

1. **0013_counselor_settlement.sql** 마이그레이션 적용 (state_changed_at + settlement_monthly + settlement_job)
2. ETL 작성 (member 분야/단가, status_log, consultation, settlement_monthly)
3. NestJS:
   - `consultations` 모듈 (read-only 조회 + export)
   - `members.service.ts`에 bulk-update 추가
   - `settlements` 모듈 (run/recalc/void/markPaid + jobs)
   - `M2netService`에 `csrstat` 호출은 이미 있음 — counselor state 변경 트리거 시 자동 호출
4. React:
   - CounselorList: 일괄저장 모달 + 부재중 경과시간
   - ConsultationList/Detail (신규)
   - SettlementList/Detail/JobMonitor (신규)
5. 검증:
   - 환불 판정(usetm<30 + amt<=mb_4) 동작 확인
   - 월 경계 (`2026-02-28 23:59:59` 상담이 2월 정산에 포함되는가)
   - 동시 정산 잡 멱등성 (advisory lock)
   - 정산 무효화 후 재실행 가능성
6. PROGRESS.md에 Phase C/D 완료 기록

---

## 신규 web/mng가 라이브 대비 분명하게 좋아지는 점

1. **정산이 0원으로 INSERT되지 않음** — 라이브 v1 SQL 버그가 신규에선 v3식으로 정확히 계산.
2. **모든 정산 율이 audit 가능** — 당시 값이 `settlement_monthly` row에 보존돼 사후 재계산 가능.
3. **상담사 상태 머신이 한 곳에 집중** — RDCH/RDVC enum 누락 SQL 잔존 이슈 해소.
4. **트랜잭션 + advisory lock** — 동시 월정산 충돌 방지, 트랜잭션 단위 일괄 수정.
5. **개인정보 대량 export 감사** — 누가 언제 몇 건을 다운로드했는지 추적.
6. **단가/로열티 변경 이력** — 정산 분쟁 시 근거 확보.
7. **하드코딩 율 분리** — 부가세/원천세/회선비 정책 변경이 setting 갱신만으로 가능.
