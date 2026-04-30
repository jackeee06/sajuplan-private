# 도메인 03-b: 상담사 정산 흐름 정밀 추적

> read-only 분석. 코드 수정 없음. 분석 시점 2026-04-29.
> 추적 대상: `sample/lib/common.lib.php`, `sample/cron/*`, `sample/adm/settlement_list*.php`,
> `sample/adm/pay_month.php`, `sample/my/account_pay_end.php`, `sample/mtonet/mtonet_rcv.php`,
> `sample/common.php`, `sample/mobile/shop/mypage.php`, `sample/adm/admin.menu350.php`,
> 그리고 라이브 DB 덤프 `sajumoon_db_2026-04-24.sql`(g5_point_end 스키마 추출용).

## 목적

사용자가 설명한 정산 사이클(월말 0 리셋 → 다음달 누적 → 또 정산)이 sample 코드의 어느 경로로 **실제로** 동작하는지 코드 레벨에서 검증한다. 이전 분석(`domain-03-counselor-settlement.md`)이 "v1만 라이브에서 호출되고 SQL 버그로 항상 0원 INSERT"라고 결론지었는데, 그 결론에 보강·정정이 필요함을 본 추적이 확인한다.

**핵심 정정**: 라이브 정산은 **v1이 아니라 v2(`set_con_account_v2()`)** 가 매월 1일 cron으로 자동 실행되고 있다. v1의 SQL 버그(`where  and ...`)는 사실이지만, v1을 호출하는 경로는 cron이 아니라 (a) 관리자 수동 팝업 `pay_month.php` (b) 사용자 페이지 `my/account_pay_end.php` 두 곳이며, **두 경로 모두 현재 라이브에서 사실상 비활성**이다(상세는 §2).

---

## 1. 정산 함수의 모든 정의 위치

| # | 함수 | 정의 위치 | 라인 | 호출처 | 라이브 활성? | 동작 |
|---|---|---|---|---|---|---|
| F1 | `set_con_account($mb_id)` | `sample/lib/common.lib.php` | 4997 | `adm/pay_month.php:18`, `my/account_pay_end.php:16`, `cron/account_pay_end.php:25(주석)`, `test.php:811(주석)` | **호출 가능하나 사실상 비활성** | v1. 5019라인 SQL 버그(`where  and mb_id=...`) — 무조건 SQL 에러로 `$price=0` |
| F2 | `set_con_account_v2($mb_id, $test_only=false, $month='')` | `sample/lib/common.lib.php` | 4611 | `cron/month_pay_end.php:31`, `cron/month_pay_calc_end.php:32` | **활성 (라이브 매월 1일 cron)** | v3 식 + 트랜잭션 + GET_LOCK + 포인트 차감 + p_end='Y' + calc_flag='Y' |
| F3 | `set_con_account_v3($mb_id, $month='')` | `sample/lib/common.lib.php` | 4860 | `cron/month_pay_end_test.php:31` (특정월 일괄 재계산용) | **반활성 (사후 보정)** | v3 식만, 포인트 차감 없음, 결과 테이블만 갱신 |
| F4 | `month_pay_execute()` | `sample/lib/common.lib.php` | 5702 | `sample/common.php:991` (전체 사이트 공통 include — 모든 페이지 로드 시 실행) | **활성** | 매월 1일에 한해 g5_point_end에 해당 월 row가 0건이면 mb_level=5 전수 v1(`set_con_account`) 호출 → "안전망" 역할이지만 v1이라 의미 있는 동작 안 함 |

### 1-1. v1 SQL 버그 재확인

```php
// common.lib.php:5019
$sql = "select sum(po_point) as price from g5_point
        where  and mb_id='".$mb_id."' ...";
//             ^^^ 'where' 직후 'and' — syntax error
```

이 SQL은 `mysqli`에서 fail이지만 `set_con_account()`에는 try/catch가 없어서 `sql_fetch()`가 false 반환 → `$row["price"]`가 NULL → `(int)NULL = 0`. 따라서 `$price=0`, `$p_price=0`, INSERT는 진행되어 `g5_point_end (mb_id, month, price=0, ...)` row가 생성됨. 단 v3 컬럼(price_free 등)은 INSERT 컬럼 리스트 자체에 없으므로 NULL.

### 1-2. v2 (라이브 활성 함수)의 정확한 동작 시퀀스

`set_con_account_v2($mb_id)` (인자 1개, test_only=false, month='' 기본값):

1. `GET_LOCK("SETTLE_{mb_id}", 5)` 획득 — 같은 상담사 동시 실행 차단
2. `START TRANSACTION`
3. **기간 산출**: `$bmonth = date("Y-m",strtotime("-1 month"))` → 전달 (예: cron이 2026-04-01 실행 시 `2026-03`)
4. `$startday = "{$bmonth}-01 00:00:00"`, `$endday = 다음달-01 00:00:00` (반열린 구간)
5. **이미 정산된 달 체크**: `g5_point_end where mb_id and month` count → `$already_exists`
6. **포인트 합계 계산** (4671): `SUM(po_point) FROM g5_point WHERE po_content NOT IN (수동 보정 2건) AND mb_id AND po_datetime [start,end)` → `$price`
7. **로열티 기반 v3 식 정확 계산**: amt_free / amt_pro 합산(환불 제외 + g5_point.c_no 매칭 EXISTS 조건) → price_free/paid/other/tot/vat/wht/reply_fee/p_price
8. **INSERT or UPDATE g5_point_end** — `$already_exists`면 UPDATE, 아니면 INSERT (v3 컬럼 모두 채움)
9. **포인트 차감** (`$test_only=false && $price>0`인 경우만):
   - `$point = -1 * $price`
   - `point_base_date = '2026-03-01 00:00:00'`
   - 현재 보유 포인트 조회: `SELECT IFNULL(SUM(po_point),0) FROM g5_point WHERE mb_id AND po_datetime >= '2026-03-01'`
   - g5_point에 음수 row INSERT (`po_datetime = bmonth-말일 23:59:59`)
   - `insert_use_point()` 호출 (사용 포인트 매칭)
   - **`UPDATE g5_member SET mb_point = po_mb_point WHERE mb_id`** ← 잔액 0 리셋의 실체
10. **g5_point.p_end='Y'** 일괄 표시: 해당 기간 이 상담사의 모든 g5_point row
11. **platform_consulting.calc_flag='Y'** 일괄 표시: 해당 기간 DISCONNECT/END_CHAT 상담
12. `COMMIT`, 실패 시 catch에서 `ROLLBACK`
13. `RELEASE_LOCK`

`$test_only=true` 인자로 호출하면 7번까지만 (g5_point_end만 갱신, 포인트/플래그 변경 없음) — 단 라이브 cron에서는 `$test_only` 인자 없이 호출하므로 항상 false.

---

## 2. 정산 트리거 진입점

### 2-1. 매월 1일 cron 자동 실행 (라이브 메인 경로) — 신뢰 ★★★

**`sample/cron/month_pay_end.php`** (라이브로 추정, 시스템 crontab 등록).

```php
// month_pay_end.php (전문)
$cronLock = fopen(__DIR__."/month_pay_end.lock","c");
if(!flock($cronLock, LOCK_EX | LOCK_NB)) die("LOCK FAIL");

include_once($DOCUMENT_ROOT."/common.php");
include_once("./_common.php");

$nowday = (int)date("d");
if ($nowday === 1) {
    $sql = "select * from g5_member where mb_leave_date='' and mb_level='5'";
    $result = sql_query($sql);
    while($row = sql_fetch_array($result)){
        set_con_account_v2($row["mb_id"]);   // ← v2 호출
    }
}
```

- **시스템 cron**(/etc/crontab 또는 cron.d)이 이 파일을 매일 또는 매시간 호출.
- 파일 자체에 `if ($nowday === 1)` 가드 → 매월 1일에만 실제 동작.
- flock 기반 단일 실행 보장.
- 매월 1일 자정 즉시 mb_level=5 전체 상담사 루프 → `set_con_account_v2()`.
- 스크립트 안의 cpid 등 환경 변수는 `$DOCUMENT_ROOT="/data/wwwroot/sajumoon.co.kr"`로 하드코딩.

`month_pay_calc_end.php`는 같은 내용 + 주석에 demonster1 테스트 분기 — 백업 또는 dev용. 실제 라이브 cron은 `month_pay_end.php`가 등록되어 있을 가능성이 가장 높음(파일명도 lock 파일명도 동일).

### 2-2. 특정 과거월 v3 일괄 재계산 — `cron/month_pay_end_test.php`

```php
// 'if($nowday === 1)' 가드 없음 — 호출하면 즉시 실행
while($row = sql_fetch_array($result)){
    set_con_account_v3($row["mb_id"], '2026-02');
}
echo "2026-02 정산 업데이트 완료";
```

- **cron 자동 등록 X** (수동 트리거).
- 운영자가 "2월 정산 가격이 잘못 들어갔다, 다시 계산하자" 같은 상황에서 cron 디렉터리 직접 실행.
- v3 → 포인트 차감 없음, g5_point_end 컬럼만 update/insert. **사후 보정 전용**.

### 2-3. 비활성/사용 안 되는 진입점 (보존만 됨)

| 위치 | 호출 함수 | 상태 | 비고 |
|---|---|---|---|
| `sample/adm/pay_month.php:18` | `set_con_account()` (v1) | 메뉴/UI에서 더 이상 안 부름 | settlement_list.php의 "월정산하기" 버튼 onclick → `pay_month()` JS → `window.open('./pay_month.php')` 팝업. 권한 350500/d 통과 시 mb_level=5 전수 v1 호출. 그러나 cron이 이미 v2로 처리하므로 운영상 거의 안 누름 |
| `sample/my/account_pay_end.php:16` | `set_con_account()` (v1) | 거의 비활성 | mb_level=5 본인이 자기 정산을 임의로 트리거하는 페이지. `/shop/mypage.php`의 onclick은 **주석 처리**되어 있고(line 694), 실제 활성 버튼은 `/my/counselor_settlement.php`(상담사 자기 정산 내역 조회 페이지)로 옮겨짐. 따라서 직접 URL 입력 외엔 호출 경로 없음 |
| `sample/cron/account_pay_end.php` | `set_con_account()` (v1) | **전체 PHP 블록 주석처리** (line 7–29) | dead code. 과거에는 매월 말일에 v1 호출했던 흔적 |
| `sample/lib/common.lib.php::month_pay_execute()` (line 5702) | `set_con_account()` (v1) | 활성이지만 효과 거의 없음 | `sample/common.php:991`에서 호출 — **모든 페이지 로드 시 실행**. 매월 1일 + g5_point_end의 해당 월 row 0건일 때만 mb_level=5 전수 v1 호출. cron(`month_pay_end.php`)이 자정에 이미 v2로 row를 만들기 때문에, 정상 운영 시 `count <= 0` 조건이 깨져 실행되지 않음. **cron 실패 시 안전망**으로 동작하지만 v1이라 가치는 거의 없음 |
| `sample/cron/month_pay_end_test.php` | `set_con_account_v3()` | 수동 트리거 | 위 §2-2 |

### 2-4. 관리자 메뉴 등록 현황 — `sample/adm/admin.menu350.php`

```php
array('350450', '정산 이력', '/settlement_list.php', 'settlement_list', 1),
array('350599', '기타',     '/settlement_list.php', 'settlement_list', 1),
```

- `settlement_list.php`만 메뉴에 노출.
- `settlement_list_v2.php`/`settlement_list_20250102.php`/`settlement_list_backup.php`는 메뉴 미등록 → **운영 화면에서 닿을 수 없음**.

### 2-5. 결론 (정산 트리거 그림)

```
매월 1일 00:xx (시스템 cron)
   │
   ▼
sample/cron/month_pay_end.php
   │  flock 획득
   │  공통 include
   │  if(date('d')==1)
   ▼
mb_level=5 전체 루프
   │
   ▼
set_con_account_v2($mb_id)   ◄─── 라이브의 진짜 정산 함수
   │
   ├── g5_point_end UPSERT  (price_free, price_paid, price_other,
   │                         price_tot, vat_amount, withholding_tax,
   │                         reply_fee, price 모두 정상 채움)
   ├── g5_point INSERT (음수 정산 row, po_datetime = 전달 말일 23:59:59)
   ├── UPDATE g5_member SET mb_point = po_mb_point      ◄── 잔액 리셋
   ├── UPDATE g5_point  SET p_end='Y' WHERE 기간       ◄── 정산완료 표시
   └── UPDATE platform_consulting SET calc_flag='Y'    ◄── 상담완료 표시
```

추가 안전망:
- `month_pay_execute()`이 매 페이지 로드 시 동작하지만 보통은 no-op.
- 운영자 수동 보정 시 `cron/month_pay_end_test.php` 직접 실행으로 v3 재계산.

수동 버튼:
- `adm/settlement_list.php`의 "월정산하기" 버튼이 있지만 v1 경유 → 실용 가치 낮고, cron 결과를 다시 v1로 덮어쓰면 위험. 실 운영에서는 거의 누르지 않을 것으로 보이며 메뉴 단계의 보호장치(권한 350500/d)도 약함.

---

## 3. 포인트 적립 흐름 (상담 → 상담사 포인트)

상담 종료 webhook 수신 진입점 = **`sample/mtonet/mtonet_rcv.php`** (M2NET/AG9 → 사주문 서버 push).

### 3-1. platform_consulting INSERT (line 269-273)

```sql
INSERT INTO platform_consulting
  (mb_id, cpid, csrid, dtmfno, start, end, from, to, reason, telno,
   usetm, amt, amt_free, amt_pro, preflag, eventtm, wr_datetime,
   membid, p_gubun, mrtn, roomid, skip_charge)
VALUES (...)
```

- `mb_id`: 상담사 mb_id (csrid → g5_member.mb_1 → mb_id)
- `membid`: m2net 회원 ID (g5_member.mb_1과 같은 키 공간)
- `reason`: `DISCONNECT` (전화) / `END_CHAT` (채팅)
- `amt`: 청구 금액 (= 사용시간 × 단가)
- `amt_free` / `amt_pro`: 회원이 결제한 포인트 중 무료(쿠폰)/유료 분리량을 종료 시점에 쿠폰 잔액 추적으로 계산 (line 245-267)
- `preflag`: 'Y'=070 선불 / ''=060 후불
- `p_gubun`: 같은 의미 (Y/N)

### 3-2. 회원 → 차감 (line 317-332)

```php
if ($amtInt > 0 && !$refund_eligible && !$is_postpaid && !empty($membid)) {
    $charge_action = $no.'@상담코인 차감@'.$arr_proc['eventtm'];
    insert_point(
        $m_id, (-1)*$amtInt, '[전화]상담코인 차감',
        '@platform_consulting', $m_id, $charge_action
    );
}
```

회원 포인트 음수로 차감 (후불은 제외).

### 3-3. 상담사 → 적립 (line 339-346) ★ 정산 데이터 소스

```php
if ($amtInt > 0 && !empty($csrid) && !empty($minfo["mb_id"])) {
    insert_point(
        $minfo["mb_id"],          // 상담사 mb_id
        $amtInt,                  // amt 양수
        $svc_type.'상담코인 증가',
        '@platform_consulting',
        $minfo["mb_id"],
        $no.'@상담코인 증가@'.$arr_proc['eventtm']  // rel_action
    );
}
```

- `insert_point()` (`common.lib.php:982`)이 g5_point에 INSERT하면서:
  - `po_rel_table = '@platform_consulting'`
  - `po_rel_id = 상담사 mb_id`
  - `po_rel_action = "{c_no}@상담코인 증가@{eventtm}"`
  - **`c_no = ims[0]`** = `$no` (platform_consulting.no 즉 상담 번호) — `rel_action`을 `@`로 split해서 `$ims[0]`을 c_no 컬럼에 직접 저장 (line 1042-1046)
  - `p_gubun = ims[2]` = eventtm — 의도와 다른 값. 코드 버그지만 정산 식엔 영향 적음
  - `po_use_point = 0`, `po_expired = 0`, `po_expire_date = 9999-12-31` (양수 적립이므로)
  - `po_mb_point = mb_point + point` (현재 잔액 + 적립액)
- 마지막에 `UPDATE g5_member SET mb_point = po_mb_point WHERE mb_id`. **상담사도 회원과 똑같이 mb_point 컬럼에 누적**.
- m2net memb-mgr PUT은 mb_level=2(일반회원)에만 적용 — 상담사는 외부 동기화 X.

### 3-4. 회원 차감과 상담사 적립의 트랜잭션

**같은 트랜잭션이 아님.** `insert_point()` 안에서 `START TRANSACTION` 호출 없음. 두 INSERT는 독립적으로 실행 → 한쪽만 성공할 가능성 존재.

### 3-5. dedupe (중복 방지)

`insert_point()` 1010-1021은 (po_rel_table, po_rel_id, po_rel_action) 조합 unique 검사 → 같은 상담의 webhook이 두 번 와도 두 번째는 -1 리턴 후 무시. 단 unique constraint는 없고 select-then-insert 패턴이라 race 가능성 있음 (실제 영향은 극소).

---

## 4. 정산 후 잔액 0 리셋 메커니즘

라이브에서 잔액 0이 되는 메커니즘은 **세 가지가 결합**되어 작동한다.

### 4-1. 음수 row INSERT — `set_con_account_v2()` (common.lib.php:4786-4799)

```php
$point = (-1) * $price;      // $price는 g5_point 합계, 음수로 변환
INSERT INTO g5_point
  SET mb_id, po_datetime='{전달말일} 23:59:59',
      po_content='2026-03월 정산',
      po_point='{음수}',
      po_mb_point='{음수 반영 후 잔액}',
      po_expired=1, po_expire_date='{오늘}',
      po_rel_table='@member',
      po_rel_id='{mb_id}',
      po_rel_action='2026-03월 정기정산'
```

이 row 자체로 g5_point의 SUM이 0(또는 그에 가까운 값)이 됨.

### 4-2. mb_point UPDATE — `set_con_account_v2()` (common.lib.php:4805-4809)

```php
$po_mb_point = $mb_point + $point;   // 양수 - $price → 0(또는 음수)
UPDATE g5_member SET mb_point = '$po_mb_point' WHERE mb_id = '$mb_id';
```

g5_member.mb_point도 0으로 리셋. 이건 캐시 컬럼이라 g5_point SUM과 일치해야 함.

### 4-3. point_base_date '하한' — `get_point_sum()` (common.lib.php:1271-1278)

```php
if($mb_check['mb_level'] == '5'){
    $sql = " select IFNULL(sum(po_point),0) as sum_po_point
                from {$g5['point_table']}
                where mb_id = '$mb_id'
                  and po_datetime >= '2026-03-01 00:00:00' ";
}
```

상담사(mb_level=5) 한정으로, **2026-03-01 이전의 모든 포인트 내역을 합계에서 제외**. 이 정책 변경(주석에는 "2026-03-01 신규 정산 시작")으로 인해 잔액 계산이 단순화됨.

또한 `set_con_account_v2()`도 같은 base_date를 사용:

```php
// common.lib.php:4781
$r_mb = sql_fetch("SELECT IFNULL(SUM(po_point),0) as s
                   FROM g5_point
                   WHERE mb_id='{$mb_id}'
                     AND po_datetime >= '{$point_base_date}'");
$mb_point = (int)$r_mb['s'];
$po_mb_point = $mb_point + $point;
```

### 4-4. p_end='Y' 표시 — `set_con_account_v2()` (4816-4822)

```sql
UPDATE g5_point
SET p_end='Y'
WHERE mb_id='{$mb_id}'
  AND po_datetime >= '{$startday}'
  AND po_datetime <  '{$endday}';
```

해당 월 모든 g5_point row를 정산완료로 마킹. **p_end는 보고 표시용/감사 흔적**일 뿐 잔액 계산에는 영향 X (get_point_sum이 p_end를 보지 않음).

### 4-5. 종합 — "0 리셋"의 실제 의미

라이브에서 정산 후 잔액이 0이 되는 흐름:

1. 한 달간 `insert_point()`로 양수 row가 누적되어 `mb_point` 양수.
2. 매월 1일 cron → v2 → 음수 row 1건 INSERT (`po_point = -전달합계`, `po_rel_table='@member'`).
3. `mb_point`도 같은 트랜잭션에서 `mb_point - 전달합계 = 0`으로 UPDATE.
4. 해당 월 row들에 p_end='Y'.
5. 다음 달엔 또 양수 row가 누적되며 mb_point가 양수로 증가.
6. 그 다음 1일에 v2가 또 -전달합계로 0으로 만듦.

따라서 사용자가 본 "정산 후 0원 → 한 달간 누적 → 또 정산" 사이클이 정확히 코드에 구현되어 있다.

⚠️ **중요한 미스매치**: 음수 row의 `po_point` 값은 `g5_point의 단순 SUM`이지 `g5_point_end.price` (실제 지급액)가 **아니다**. v2 코드 4671-4681:

```php
$row = sql_fetch("
    SELECT SUM(po_point) price
    FROM g5_point
    WHERE po_content != '[수동] 11월 정산 중복'
      AND po_content != '[수동]정산 시스템 오류로인한 미지급건'
      AND mb_id='{$mb_id}'
      AND po_datetime >= '{$startday}'
      AND po_datetime < '{$endday}'
");
$price = (int)$row['price'];
```

이 `$price`는 **그 달 동안 g5_point에 들어온 모든 포인트(상담코인 증가 + 기타)의 합**이다. 한편 `g5_point_end.price`(컬럼명 `price`)는 로열티/세금 적용 후 **실제 지급액**으로 별도 컬럼에 저장된다.

즉 g5_point는 "한 달 매출 총액(차감 전)"을 0으로 리셋, g5_point_end.price는 "지급할 금액(차감 후)"을 보유. 두 값은 다른 의미. 코드가 의도적인 것으로 보임 (포인트 원장은 매출, 정산 결과는 지급).

---

## 5. g5_point_end 스키마와 데이터 패턴

### 5-1. 스키마 (라이브 DB 덤프 `sajumoon_db_2026-04-24.sql:4608-4625`)

```sql
CREATE TABLE `g5_point_end` (
  `no`              int(11)      NOT NULL AUTO_INCREMENT,
  `mb_id`           varchar(255) NOT NULL COMMENT '아이디',
  `month`           varchar(100) NOT NULL,                        -- 'YYYY-MM'
  `price`           int(11)      NOT NULL DEFAULT '0',            -- 최종 지급액
  `price_free`      int(11)      DEFAULT NULL,                     -- 무료 매출 × 무료R%
  `price_paid`      int(11)      DEFAULT NULL,                     -- 유료 매출 × 유료R%
  `price_other`     int(11)      DEFAULT NULL,                     -- 기타 포인트 × 유료R% + 음수
  `price_tot`       int(11)      DEFAULT NULL,                     -- price_free + price_paid + price_other (VAT 포함)
  `vat_amount`      int(11)      DEFAULT NULL,                     -- price_tot - floor(price_tot/1.1)
  `withholding_tax` int(11)      DEFAULT NULL,                     -- floor(supply * 0.033)
  `reply_fee`       int(11)      DEFAULT NULL,                     -- price_tot >= 50000 ? 20000 : 0
  `amb_id`          varchar(255) NOT NULL,                          -- 처리한 관리자 (또는 'system')
  `wr_datetime`     datetime     NOT NULL DEFAULT '0000-00-00 00:00:00',
  `up_datetime`     datetime     NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`no`),
  KEY `m_id` (`mb_id`,`month`)                                     -- UNIQUE 아님
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

### 5-2. UNIQUE 제약 부재

`(mb_id, month)`가 KEY는 있지만 UNIQUE가 아니다. → 같은 (mb_id, month) 중복 INSERT 가능. v2/v3는 UPDATE 분기로 멱등성을 코드 레벨에서 보장하지만, v1과 month_pay_execute가 동시에 돌면 중복이 만들어질 수 있다. 라이브에 `[수동] 11월 정산 중복` 라벨이 있는 것이 그 흔적.

### 5-3. 채워지는 데이터 패턴 (시기별)

| 시기 | 호출 함수 | price | price_free/paid/other/tot | vat_amount/withholding_tax/reply_fee | amb_id |
|---|---|---|---|---|---|
| 2025-XX 이전 | 주로 v1(`set_con_account`) | 항상 0 (SQL 버그) | NULL (INSERT 컬럼 없음) | NULL | 관리자 mb_id (또는 'system') |
| 2026-03 ~ | 주로 v2(`set_con_account_v2`) | 정상 (지급액) | 정상 | 정상 | 'system' (cron) |
| 사후 보정월 | v3(`set_con_account_v3` via `month_pay_end_test.php`) | 정상 | 정상 | 정상 | 기존 row 그대로 (UPDATE는 amb_id 갱신 안 함) 또는 INSERT 시 'system' |

라이브에서 settlement_list.php가 `price_free` 등을 표시하지만 2026-03 이전 데이터는 NULL → number_format((int)NULL)=0 → 0원으로 보임. **이전 분석의 "70% 0원" 묘사는 과거 데이터에 대해선 사실, 2026-03 이후 데이터는 정상**.

---

## 6. 사용자 질문에 대한 결론

### Q1. 정산 데이터 소스가 g5_point(point_history)인가?

**부분적으로 그렇다. 정확히는 "이중 소스".**

- **잔액 차감 금액**(`set_con_account_v2` line 4671의 `$price`)은 g5_point에서 직접 SUM. 이게 음수 row의 `po_point`로 들어감.
- **g5_point_end.price**(실제 지급액)는 v3 식으로 계산하며, 입력은:
  - `platform_consulting.amt_free`/`amt_pro` (상담 매출, c_no 매칭된 g5_point가 EXISTS인 건만)
  - `g5_point.po_point` 중 `po_rel_table NOT IN ('@member','@platform_consulting')`인 건 (기타 포인트)
  - `member.mb_19`/`mb_20` (로열티%)

즉, 매출 계산은 platform_consulting 기준, 잔액 0 리셋은 g5_point 기준.

### Q2. 잔액 0 리셋은 어떻게 일어나는가?

**3중 메커니즘**:

1. **g5_point에 음수 row INSERT** (`po_rel_table='@member'`, `po_rel_action='YYYY-MM월 정기정산'`).
2. **`UPDATE g5_member SET mb_point = mb_point - 전달합계`** — 같은 트랜잭션에서.
3. **상담사 한정 잔액 합산은 `po_datetime >= 2026-03-01`** 만 — `get_point_sum()`에서 강제. 정산 후 음수 row가 추가되면 SUM이 0이 됨.

UPDATE 방식 + INSERT 음수 row 방식이 **둘 다 사용**된다 (UPDATE는 mb_point 캐시 컬럼, INSERT는 원장).

### Q3. 매월 정산은 수동인가 자동인가?

**자동 (cron)**.

- 시스템 crontab에 `sample/cron/month_pay_end.php`가 등록되어 있다고 가정 (파일이 cron 디렉터리에 있고 flock 패턴이 있음 → cron 등록 확실).
- 매월 1일에만 실제 동작 (`if(date('d')==1)`).
- 안전망으로 `common.php:991::month_pay_execute()`가 매 페이지 로드 시 보조 체크 — 단 v1을 부르므로 효과 미미.
- 관리자 수동 버튼(`pay_month.php`)도 있지만 v1이라 위험. 라이브에선 거의 누르지 않을 것.
- 사후 특정월 재계산은 `cron/month_pay_end_test.php` 직접 실행 (v3).

### Q4. v1/v2/v3 중 실제 동작은 무엇인가?

| | 정의 | 호출처 활성? | 실제 영향 |
|---|---|---|---|
| **v1** `set_con_account` | 있음 (버그 SQL) | `pay_month.php` 버튼/UI는 닿지만 거의 안 누름, `my/account_pay_end.php` 거의 안 씀, `month_pay_execute()`는 무력화 | **현실적으로 거의 동작 안 함**. 2026-03 이전 g5_point_end 일부 row는 v1 산출 결과 (price=0, v3 컬럼 NULL) |
| **v2** `set_con_account_v2` | 있음 (정상) | **`cron/month_pay_end.php`** 매월 1일 자동 | **이게 라이브 메인 정산 함수**. 2026-03-01 이후 데이터의 실질 작성자 |
| **v3** `set_con_account_v3` | 있음 (정상, 차감 없음) | `cron/month_pay_end_test.php` 수동 | 사후 보정 (특정월 재계산) |

이전 분석 문서(`domain-03-counselor-settlement.md`)의 "v1만 호출되고 v2/v3는 dead code"는 **부정확**. 정정되어야 한다.

---

## 7. 신규 설계 권장

### 7-1. point_history.is_settled vs settlement_monthly 분리 — 둘 다 필요

라이브 흐름이 g5_point(원장) + g5_point_end(집계)를 분리해 사용하므로, 신규도 동일 구조 권장:

| 신규 테이블 | 역할 | 라이브 대응 |
|---|---|---|
| `point_history` | 모든 포인트 변동 (적립/차감/정산-) | g5_point |
| `point_history.is_settled` | 정산 완료 마킹 | g5_point.p_end='Y' |
| `point_history.consultation_no` | 상담 매칭 | g5_point.c_no |
| `settlement_monthly` (신규) | 월별 정산 결과 (immutable) | g5_point_end |
| `consultation.is_settled` (또는 `calc_flag`) | 상담 단위 정산 마킹 | platform_consulting.calc_flag |

기존 `domain-03-counselor-settlement.md`의 0013 마이그레이션 설계는 **타당**. 단 다음을 보강:

1. **`UNIQUE (member_id, month)` 추가** — 라이브가 KEY로만 두어 중복이 만들어진 사고를 신규에서 차단.
2. **잔액 0 리셋의 "음수 row" 방식 vs "settled_at + carryover_balance" 방식 결정**. 라이브는 음수 row + mb_point UPDATE 이중을 쓰는데, 신규는 둘 중 하나로 단일화 권장.
   - **음수 row 방식**: `point_history`에 type='settlement_deduct' row 추가. 잔액 SUM이 자동 0. 원장 일관성 강함.
   - **`point.balance` 캐시 방식**: 매번 SUM 안 하고 캐시. 정산 시 `balance=0`으로 SET + history는 별도 audit row.
   - 권장: **음수 row 방식**. 단순. point_base_date 같은 커트오프 없이도 동작. 계산 일관.
3. **기간 산출**: v2 방식 그대로 — 반열린 구간 `[YYYY-MM-01, 다음달-01)`, KST 명시.

### 7-2. cron 트리거 → NestJS 스케줄러

```typescript
// api/src/admin/settlements/settlement.cron.ts
@Cron('0 0 1 * *', { timeZone: 'Asia/Seoul' })
async runMonthlySettlement() {
  const month = dayjs().tz('Asia/Seoul').subtract(1, 'month').format('YYYY-MM');
  const job = await this.createJob(month, /* triggered_by */ 'cron');
  // BullMQ enqueue: each counselor → calculateMonthlyForCounselor()
}
```

라이브의 flock + GET_LOCK은 신규에서 (a) `settlement_job` row 단일성 + (b) `pg_try_advisory_xact_lock(member_id, month_hash)`로 대체.

### 7-3. 안전망(`month_pay_execute`) 제거 권장

매 페이지 로드 시 cron 안전망을 도는 패턴은 N+1 부담. NestJS는 cron 신뢰성이 높으므로 안전망 제거 + 모니터링/알림으로 대체.

### 7-4. v1 SQL 버그/`my/account_pay_end.php`/`adm/pay_month.php` 진입점 모두 제거

신규 admin UI는:
- "월정산 실행" 버튼 = `POST /admin/settlements/run` (super only, 비동기 잡 등록).
- "월정산 재계산" = `POST /admin/settlements/{id}/recalc` (v3 동등 — 포인트 차감 없이 `settlement_monthly` 갱신만).
- "지급 처리" = `POST /admin/settlements/{id}/mark-paid` (실제 송금 완료 기록 + 음수 row INSERT).
- 사용자(상담사) 본인이 자신의 정산을 트리거하는 버튼은 **없애기**(라이브에서도 사실상 비활성).

---

## 8. 추가 확인이 필요한 부분 (코드만으로 결론 못 내는 항목)

1. **시스템 cron 등록 여부 확인 필요**
   - `/etc/cron.d/`, `/etc/crontab`, 또는 `crontab -l`에 `month_pay_end.php`가 등록되어 있는지 운영팀 확인.
   - 등록 주기 (매시간? 매일 자정?). PHP 코드는 `if(date('d')==1)`로 가드만 하므로 빈도가 잘못 등록돼도 lock으로 안전하지만 부하 차원 확인 필요.

2. **v1을 부르는 진입점이 운영 중 실제 사용되는지**
   - `adm/pay_month.php` "월정산하기" 버튼이 cron 이후에도 가끔 눌리면 v1으로 덮어쓰기 → price=0으로 회귀할 수 있음. 운영자에게 사용 여부 확인.
   - `my/account_pay_end.php`로 직접 URL을 친 케이스가 있는지 access log 확인.

3. **g5_point_end의 `(mb_id, month)` 중복 row 존재 여부**
   - SELECT mb_id, month, count(*) GROUP BY ... HAVING count>1 → 중복 row 확인. 있으면 ETL 시 어느 row를 정본으로 할지 정책 필요.

4. **2026-03-01 이전 데이터의 의미**
   - `get_point_sum()`이 mb_level=5에 한해 `po_datetime >= '2026-03-01'` 강제 → 그 이전 g5_point row들이 어떤 상태인지(이미 정산되어 잔액 의미 없는지, 별도 정리됐는지) 확인.
   - 신규 ETL이 이 cutoff를 어떻게 다룰지 결정 필요 (그대로 가져가되 carry-over=0 처리, 또는 cutoff 이전 row는 archive 테이블로 이동).

5. **`amt_free` / `amt_pro` 분리의 정확성**
   - mtonet_rcv.php line 245-267의 쿠폰 잔액 추적 로직이 매번 정확히 동작하는지 — 2026-03 이전 platform_consulting row의 `amt_free`/`amt_pro`가 비어 있으면 v2 정산 시 매출이 0으로 잡힘. 라이브 데이터 검증 필요.

6. **`p_gubun`이 깨지는 이유**
   - `insert_point()` line 1042-1046에서 `rel_action`을 `@`로 split해 `p_gubun = ims[2]`로 저장하지만, 상담코인 적립의 rel_action은 `"{c_no}@상담코인 증가@{eventtm}"` 패턴이라 `ims[2]=eventtm`. 이는 의도한 값(Y/N)이 아님. 운영팀에 p_gubun을 어떻게 사용하는지 확인 (정산 식엔 직접 영향 없음).

7. **회원(mb_level=2) 정산도 cron이 있는가?**
   - 현 cron은 mb_level='5'만 루프. 일반 회원에게 정산 개념이 있다면 다른 경로 확인 필요. 일반 회원 mb_point는 `insert_point()` 안에서 m2net `memb-mgr` PUT으로 외부 동기화만 일어남 — 정산 개념 없음으로 보임.

8. **음수 row의 `po_datetime`이 `bmonth-말일 23:59:59`인 이유**
   - 그 시점의 mb_point가 곧 그 달 마감 잔액으로 보이게 하는 의도 (audit). 신규 설계에서 동일 패턴 따를지 결정 — 또는 정산 시점(다음달 1일 00:00:00)으로 정직하게 기록할지.

---

## 부록: 추적된 핵심 파일과 라인 (절대경로)

| 항목 | 파일 | 핵심 라인 |
|---|---|---|
| v1 정의 | /Users/jin-yubi/dwork/AI/사주문1/sample/lib/common.lib.php | 4997-5164 (SQL 버그 5019) |
| v2 정의 | /Users/jin-yubi/dwork/AI/사주문1/sample/lib/common.lib.php | 4611-4848 |
| v3 정의 | /Users/jin-yubi/dwork/AI/사주문1/sample/lib/common.lib.php | 4860-4991 |
| month_pay_execute | /Users/jin-yubi/dwork/AI/사주문1/sample/lib/common.lib.php | 5702-5724 |
| month_pay_execute 호출 | /Users/jin-yubi/dwork/AI/사주문1/sample/common.php | 991 |
| insert_point | /Users/jin-yubi/dwork/AI/사주문1/sample/lib/common.lib.php | 982-1088 |
| get_point_sum (cutoff) | /Users/jin-yubi/dwork/AI/사주문1/sample/lib/common.lib.php | 1271-1286 |
| cron v2 | /Users/jin-yubi/dwork/AI/사주문1/sample/cron/month_pay_end.php | 26-34 |
| cron v3 (사후) | /Users/jin-yubi/dwork/AI/사주문1/sample/cron/month_pay_end_test.php | 27-33 |
| cron v1 (dead) | /Users/jin-yubi/dwork/AI/사주문1/sample/cron/account_pay_end.php | 7-29 (전체 주석) |
| 상담 종료 webhook | /Users/jin-yubi/dwork/AI/사주문1/sample/mtonet/mtonet_rcv.php | 269-273 (consult INSERT), 317-332 (회원 차감), 339-346 (상담사 적립) |
| 관리자 수동 v1 | /Users/jin-yubi/dwork/AI/사주문1/sample/adm/pay_month.php | 18 |
| 사용자 수동 v1 | /Users/jin-yubi/dwork/AI/사주문1/sample/my/account_pay_end.php | 16 |
| 사용자 화면 비활성 | /Users/jin-yubi/dwork/AI/사주문1/sample/mobile/shop/mypage.php | 694 (주석), 696 (대체 링크) |
| settlement_list (메뉴 노출) | /Users/jin-yubi/dwork/AI/사주문1/sample/adm/settlement_list.php | 165 (form action), 226-236 (출력 컬럼) |
| settlement_list_v2 (미완성) | /Users/jin-yubi/dwork/AI/사주문1/sample/adm/settlement_list_v2.php | 228-236 (빈 td) |
| settlement_list_delete (버그) | /Users/jin-yubi/dwork/AI/사주문1/sample/adm/settlement_list_delete.php | 17-19 ($no Array bug) |
| 메뉴 등록 | /Users/jin-yubi/dwork/AI/사주문1/sample/adm/admin.menu350.php | 26, 39 |
| g5_point_end 스키마 | /Users/jin-yubi/dwork/AI/사주문1/sajumoon_db_2026-04-24.sql | 4608-4625 |
