# 도메인 08: 인증/권한 (Authentication & Authorization)

> **분석 범위:** `sample/adm/auth_list.php`, `sample/adm/auth_update.php`, `sample/adm/auth_list_delete.php`, `sample/adm/manager_list.php`, `sample/adm/admin.lib.php`, `sample/adm/_common.php`, `sample/common.php`, `sample/lib/common.lib.php` (`is_admin`/`sql_password`/`check_password`)
>
> **작업 성격:** sample/adm을 *참고만* 하고 web/mng + api/src/admin은 처음부터 클린 빌드. 라이브 g5_auth/g5_member 데이터는 ETL로만 옮김. **라이브 코드 수정 금지.**

---

## 개요

라이브의 인증/권한은 다음 4계층으로 구성된다:

1. **로그인 인증** — `bbs/login.php`(프론트와 공통). 세션 기반.
2. **관리자 식별** — `is_admin($mb_id)` (lib/common.lib.php:889) — `g5_config.cf_admin == mb_id`이면 `'super'`, 그룹/게시판 전용 관리자는 `'group'`/`'board'`. 그 외는 빈 문자열.
3. **메뉴 권한 (RBAC-ish)** — `g5_auth(mb_id, au_menu, au_auth='r,w,d')` 테이블. super가 아닌 admin은 메뉴별로 r/w/d 비트셋 부여.
4. **IP 화이트리스트** — `_common.php` 최상단 하드코딩 4개 IP만 admin에 진입 가능 + `g5_config.cf_possible_ip` 추가 차단.

요점: **사실상 super 1명 + IP 화이트리스트** 구조다. g5_auth는 기능적으로 살아있지만 운영상 사용도가 낮은 것으로 보이며(메뉴 등록 페이지 `100200`이 `admin.menu100.php`에서 *주석처리*), super 외에 일반 admin이 거의 없다는 정황.

```
[브라우저] →(쿠키, mb_id 세션)→ [adm/_common.php]
   │ IP 화이트리스트 1차 차단 (104.64.128.103, 115.93.39.5, 118.235.2.169, 223.39.85.92)
   ├── common.php → is_admin() 으로 'super'/''  결정
   ├── _common.php → admin.lib.php 로딩 (말미에서 g5_auth 조회 → $auth 배열)
   ├── 각 페이지 → $sub_menu 변수 선언 → auth_check_menu($auth, $sub_menu, 'r'|'w'|'d')
   └── 권한 없으면 alert() 후 종료
```

---

## 라이브 권한 모델

### g5_auth 테이블 스키마

```sql
-- sample/install/gnuboard5.sql:7-13
CREATE TABLE g5_auth (
  mb_id    varchar(20) NOT NULL DEFAULT '',
  au_menu  varchar(20) NOT NULL DEFAULT '',     -- 메뉴 코드 (e.g. '300100')
  au_auth  set('r','w','d') NOT NULL DEFAULT '', -- MySQL SET 타입
  PRIMARY KEY (mb_id, au_menu)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
```

특징:
- **MyISAM** — 트랜잭션/외래키 없음. 회원 삭제 시 g5_auth row가 dangling.
- `au_auth`는 `SET('r','w','d')` — 콤마 분리 비트맵. 코드에서는 문자열 `"r,w,d"`로 저장(auth_update.php:29).
- PK가 (mb_id, au_menu) — 한 회원이 한 메뉴에 1행, 단순 권한.
- **정원·상위 관리자·만료 개념 없음**. 단순 mb_id별 grant.
- 신규 가입 시 자동 생성되는 row 없음 → super가 아닌 한 어디에도 권한이 없으므로 admin.lib.php:548에서 `alert('최고관리자 또는 관리권한이 있는 회원만 접근 가능합니다.')`로 차단.

### 메뉴-권한 매핑 (admin.menu*.php 의 메뉴 코드 ↔ g5_auth.au_menu)

각 admin 페이지 상단에 `$sub_menu = "350120";` 같은 6자리 메뉴 코드를 둔다. 이 값이 `g5_auth.au_menu`와 1:1 매칭되는 키다.

메뉴 코드 체계 (admin.menu*.php에서 추출):

| menu 그룹 | 100~999 | 의미 | 대표 sub_menu |
|---|---|---|---|
| menu100 | 환경설정 | cf_basic, 팝업레이어 | 100200=관리권한설정(주석처리됨), 100310=팝업레이어 |
| menu300 | 회원관리 (g5 표준) | mb_list, mb_mail, mb_search | 300100=회원목록, 300200=메일, 300810=접속자검색 |
| menu350 | **사주문 핵심** | counselor, 매출, 포인트, 정산, 상담후기, 쿠폰, 배너, 사주메인, 소원다락방 | 350100=customer/매니저, 350120=상담사, 350410=상담내역, 350420=결제내역, 350430=포인트, 350450=정산, 350510=쿠폰 |
| menu400/500 | 영카트 쇼핑 | scf_* (대부분 미사용) | - |
| menu700 | 게시판/그룹 | bbs_* | - |
| menu900 | 디자인/스킨 | - | - |
| menu999 | 엑셀/일괄 | board_excel, member_xls | 999000=엑셀업로드, 999200=회원일괄등록 |

**관찰:**
- menu350이 사주문1 운영에서 가장 활발하게 사용되는 영역. menu400/500/700/900은 대부분 dead code.
- `admin.menu350.php`를 보면 **같은 sub_menu 코드 (350599, 350001, 350002)가 여러 번 중복 등록**되어 있음 → 라이브에서 권한 분리가 사실상 의미 없게 망가져 있다.
- 메뉴 코드 6자리 중 끝 3자리 `000` 은 그룹 헤더(권한 지정 불가), 그 외만 권한 지정 가능 (`auth_list.php:203`).

### super vs 일반 admin 구분

`is_admin()` 함수 (lib/common.lib.php:889-906):
```php
if ($config['cf_admin'] == $mb_id) $is_authority = 'super';
else if ($group['gr_admin'] == $mb_id) $is_authority = 'group';   // 게시판 그룹별
else if ($board['bo_admin'] == $mb_id) $is_authority = 'board';   // 게시판별
return $is_authority;  // 그 외 ''(빈 문자열)
```

- `g5_config.cf_admin` 컬럼에 **단일 mb_id 문자열** 저장 (콤마로 다중 가능하나 실제 운영은 1명) → 그 회원만 super.
- super는 `auth_check()` 검사를 모두 우회 (admin.lib.php:246: `if ($is_admin == 'super') return;`).
- **'group'/'board'는 admin 화면 진입과 직접 관계 없음** (게시판 권한 판단용). admin 화면에는 super 또는 g5_auth 등록 회원만 진입.

### auth_check 권한 검사 흐름 (의사코드)

```pseudo
function auth_check_menu($auth, $sub_menu, $attr):
    return auth_check($auth[$sub_menu] ?? '', $attr)

function auth_check($auth_str, $attr):       # $attr ∈ {'r', 'w', 'd'}
    if $is_admin == 'super': return          # super 무조건 통과
    if trim($auth_str) is empty:
        alert('이 메뉴에는 접근 권한이 없습니다.')   # 페이지 종료
    if $attr not in $auth_str:
        if 'r': alert('읽을 권한이 없습니다.')
        if 'w': alert('입력, 추가, 생성, 수정 권한이 없습니다.')
        if 'd': alert('삭제 권한이 없습니다.')
```

`r`/`w`/`d` 의미 (auth_list.php:177-178에 명시):
- **r = 읽기** (목록/상세 조회 페이지)
- **w = 쓰기** (추가/수정/입력)
- **d = 삭제**

페이지가 자기 자신을 어떤 attr로 검사할지는 **개발자가 페이지마다 직접 선언** — 패턴은 일관:
- `*_list.php` → `auth_check_menu($auth, $sub_menu, 'r')`
- `*_form.php` → `auth_check_menu($auth, $sub_menu, 'w')`
- `*_form_update.php` → `auth_check_menu($auth, $sub_menu, 'w')`
- `*_delete.php` / `*_list_update.php` (선택삭제 처리) → `auth_check_menu($auth, $sub_menu, 'd')` 또는 `'w'` (혼재)

**문제:** 권한 검사 누락된 페이지가 있을 가능성 (개발자 실수). 신규에서는 **Guard로 강제** 한다.

### auth 배열 부트스트랩 (admin.lib.php:534-571)

```php
if (!$member['mb_id'])
    alert('로그인 하십시오.', .../login.php?url=...);
else if ($is_admin != 'super') {
    $auth = [];
    foreach (sql " select au_menu, au_auth from g5_auth where mb_id = ? ") {
        $auth[$row['au_menu']] = $row['au_auth'];
    }
    if (!$i) alert('최고관리자 또는 관리권한이 있는 회원만 접근 가능합니다.');
}

# 세션 위조 방지: mb_datetime + IP + UserAgent로 키 생성
$admin_key = md5($member['mb_datetime'] . get_real_client_ip() . $_SERVER['HTTP_USER_AGENT']);
if (get_session('ss_mb_key') !== $admin_key) {
    session_destroy();
    mailer(...);  # XSS 공격 알림 메일
    alert_close('정상적으로 로그인하여 접근하시기 바랍니다.');
}
```

`$auth`는 super일 경우 빈 배열로 시작하며 그 자체로 통과. 일반 admin은 g5_auth에 row 한 개도 없으면 진입 자체가 차단.

---

## 관리자 계정 관리

### manager_list.php 분석

**`/Users/jin-yubi/dwork/AI/사주문1/sample/adm/manager_list.php`** — 파일명만 "관리자 목록"이지 **실제로는 매니저(test02/03/04 같은 가상 매니저)의 월별 세차 건수 통계** 화면이다(상담사를 매니저로 쓰는 듯). 데이터는 **하드코딩된 더미** (62, 78, 61... 라인 137~166).

- 라인 2: `$sub_menu = "350300";` (admin.menu350.php에 350300 메뉴 정의 없음 — orphan)
- 라인 5: `auth_check_menu($auth, $sub_menu, 'r');` — 호출은 함
- 라인 30-31: `$is_admin != 'super'` 분기 — 검색에 자기 mb_level 이하 필터
- 라인 64: `g5_member` 전체 조회하지만, 화면에는 **하드코딩된 3행만 출력**. 조회 결과를 사용 안 함 → **dead/playground 코드**.

**결론:** manager_list.php는 신규 mng에서 **재현 대상 아님**. 매니저별 통계가 필요하면 도메인 06(통계)으로 흡수.

### 관리자 등록/수정 흐름

**별도의 관리자 등록 페이지는 없다.** 관리자도 일반 회원과 동일하게 `member_form.php`로 등록·수정하고, 다음 두 경로 중 하나로 권한이 부여된다:

1. **super로 만들기**: DB의 `g5_config.cf_admin` 컬럼에 mb_id 직접 박는다(설치 시 1회). UI에서 변경 불가.
2. **일반 admin으로 만들기**: super 로그인 후 `auth_list.php`에서 mb_id + au_menu + r/w/d 체크 → `auth_update.php`로 INSERT/UPDATE.

추가로 **`mb_level` 정수**가 있다 (1~10). `auth_check_menu`와는 별도의 회원 등급 시스템:
- `member_form.php:579`: `get_member_level_select('mb_level', 1, $member['mb_level'], ...)` — 자기 mb_level까지만 선택 가능
- `member_form.php:149`: `if ($is_admin != 'super' && $mb['mb_level'] >= $member['mb_level']) alert(...)` — super가 아니면 자기보다 같거나 높은 회원 수정 불가
- `counselor_list_update.php:74`: `mb_level = '... post_level ...'` — 일괄저장에서 mb_level 변경 가능. **`auth_check_menu($auth, $sub_menu, 'w')`만 통과하면 누구나 임의 mb_level로 다른 회원을 변경 가능** (자기 레벨 초과 검증 누락) — *권한 우회 결함*.

### 비밀번호 해싱 방식

`sample/lib/common.lib.php`:
- `sql_password($value)` (1740): MySQL 내장 `PASSWORD()` 함수 호출. **MySQL 8.0에서는 deprecated/제거**, 현재 라이브가 5.x/MariaDB일 것으로 추정.
- `get_encrypt_string($str)` (3349): `G5_STRING_ENCRYPT_FUNCTION` 정의 시 `create_hash`(PHPass), 아니면 `sql_password`.
- `check_password()` / `login_password_check()` (3361, 3373): create_hash 우선, 매칭 시 점진적 마이그레이션(legacy 16/41byte → PHPass).
- 관리자 전용 해싱 없음 — 일반 회원과 동일.

> **신규에서 결정 사항:** bcrypt만. AdminAuthService는 이미 bcrypt 외 거부 (auth.service.ts:67-74). ETL에서 g5_member.mb_password 값은 그대로 옮기고, 첫 로그인 시 bcrypt로 재해시 (또는 강제 비번 변경 정책).

---

## 파일별 분석

### `sample/adm/auth_list.php` (관리권한 목록 + 추가 폼)

```pseudo
$sub_menu = "100200"
include _common.php   # IP 차단 + admin.lib.php 의 super/auth 배열 빌드

if $is_admin != 'super': alert('최고관리자만 접근 가능합니다.')   # 라인 5

# 검색
$sql_search = "where 1"
if $stx: $sql_search .= " and ($sfl like '%$stx%')"   # ★ SQL injection
sort = $sst, $sod (사용자 지정)                          # ★ SQL injection

# 페이징, count, list
sql " select * from g5_auth a left join g5_member b on (a.mb_id=b.mb_id) ..."

# rendering 중 self-cleanup:
foreach row:
    if row.mb_id == '' and row.mb_nick == '':
        sql " delete from g5_auth where au_menu = ? "    # ★ 페이지 로드 시 부수효과
    if !isset $auth_menu[row.au_menu]:                    # 메뉴 코드가 admin.menu*.php에 없으면
        sql " delete from g5_auth where au_menu = ? "    # ★ 자동 삭제 (메뉴번호 변경 시 권한 휘발)

# 추가 폼
form action="auth_update.php":
    mb_id, au_menu (select에서 끝3자리 '000' 제외), r/w/d 체크박스, captcha
```

이슈:
- `$sfl`, `$stx`, `$sst`, `$sod` SQL injection (변수 직접 보간).
- **GET 페이지 로드 시 DELETE 발생** — orphan 정리 명목이지만 멱등성 깨지고 race 가능.
- 검색 폼이 `name="sfl" value="a.mb_id"` hidden + `<input name="stx">` — 사실상 mb_id 검색 only.
- captcha 사용. CSRF token은 hidden field로 발행하나 이 화면 자체는 GET이라 의미 없음.

### `sample/adm/auth_update.php` (권한 INSERT/UPDATE)

```pseudo
$sub_menu = "100200"
include _common.php

# 입력 정제 (제법 빡빡)
$au_menu = preg_replace('/[^0-9a-z_]/i', '', POST.au_menu)   # ✓
$post_r = preg_replace(..., POST.r)                            # ✓
$post_w = ..., $post_d = ...                                   # ✓ (그러나 mb_id는 정제 없음)

if $is_admin != 'super': alert('최고관리자만 접근 가능합니다.')

$mb = get_member($mb_id)
if !$mb: alert('존재하는 회원아이디가 아닙니다.')

check_admin_token()    # ✓ CSRF token (서버 발급-1회용 세션 토큰)
chk_captcha()          # ✓ captcha

# UPSERT 패턴 (Postgres ON CONFLICT 흉내)
$sql = "insert into g5_auth set mb_id=?, au_menu=?, au_auth='$post_r,$post_w,$post_d'"
if (!sql_query($sql, FALSE)):    # 실패하면 (PK 충돌이면)
    sql " update g5_auth set au_auth=? where mb_id=? and au_menu=? "

# 메일 알림 (하루 1회로 throttle)
if today != session 'adm_auth_update':
    mailer(admin@..., '관리권한설정 알림', body)
    set_session('adm_auth_update', today)

run_event('adm_auth_update', $mb)
goto_url('./auth_list.php?'.qstr)
```

이슈:
- `$mb_id` 정제 없음 (검색 시점에 `get_member`로 검증되긴 함).
- UPSERT 패턴이 INSERT 실패 → UPDATE — race condition 가능.
- 권한 변경 자체에 대한 **감사로그 없음** (메일은 가지만 단순 알림).

### `sample/adm/auth_list_delete.php` (권한 일괄 삭제)

```pseudo
$sub_menu = "100200"
include _common.php
check_demo()                          # 데모 모드 차단
if $is_admin != 'super': alert(...)
check_admin_token()

if !count($_POST['chk']): alert(...)
if !is_array(POST.mb_id) or !is_array(POST.au_menu): alert('잘못된 요청입니다.')

foreach chk:
    $k = (int) chk[$i]
    $mb_id   = preg_replace('/[^a-zA-Z0-9_]/', '', POST.mb_id[$k])     # ✓
    $au_menu = preg_replace('/[^a-zA-Z0-9_]/', '', POST.au_menu[$k])   # ✓
    sql " delete from g5_auth where mb_id=? and au_menu=? "
    run_event('adm_auth_delete_member', $mb_id, $au_menu)

goto_url('./auth_list.php?'.qstr)
```

이슈:
- 입력 정제는 정상.
- super-only 게이트도 있음.
- **삭제 이력 없음** — run_event 외 외부 시스템이 받지 않으면 기록 0.

### `sample/adm/manager_list.php` (매니저 통계, dead-ish)

위에서 분석한 대로 dummy.

---

## 발견된 이슈

| # | 이슈 | 위치 | 영향 | 신규 대응 |
|---|---|---|---|---|
| 1 | **CSRF 토큰 보호 자체가 주석처리** | admin.lib.php:5-10 ("CSRF 방지를 위해 코드를 작성했으나 효과가 없어 주석처리 함") | 일부 페이지만 `check_admin_token()` 적용, 나머지는 무방비 | NestJS는 SameSite=Strict 쿠키 + JWT + Origin 체크. CSRF 토큰은 mutation 라우트 일괄 적용 또는 쿠키 SameSite로 충분 |
| 2 | **IP 화이트리스트가 인증의 주축** | _common.php:4-14 (4개 IP 하드코딩) + common.php:758-794 | IP만 맞으면 admin 진입 자체가 가능 (그 다음 단계로). 코드에 IP 박혀 있어 출장/원격 작업 시마다 코드 수정 | 인증은 JWT + bcrypt에 일임. IP 차단은 *옵션*으로 환경변수/DB 설정. 코드에 박지 않음 |
| 3 | **super 단일 의존** — cf_admin 컬럼에 1명. 그 회원이 모든 admin 권한 | common.lib.php:889 + g5_config.cf_admin | 사고 시 단일 장애. g5_auth는 운영상 거의 미사용 | 신규는 `member.role = 'admin'` 다수 + `admin_permission` 메뉴별 r/w/d. super 별도 컬럼 또는 `is_super BOOLEAN` |
| 4 | **권한 검사 누락 페이지 가능** — 개발자가 `$sub_menu` + `auth_check_menu` 호출을 잊으면 무방비 | 모든 admin 페이지 | 누락된 페이지는 sample 내에서 검출 어려움 | NestJS Guard를 controller-level로 강제 + Decorator로 메뉴/액션 명시 |
| 5 | **mb_level 우회 변경 가능** | counselor_list_update.php:74 — mb_level POST값을 검증 없이 UPDATE | super 아닌 admin도 자기보다 높은 mb_level로 회원/상담사를 변경 가능 | 신규는 `member.role` + `member.level` 변경에 별도 권한(`admin.member.level.write`) + 자기 레벨 이하만 변경 가능 정책 강제 |
| 6 | **auth_list.php가 GET에서 DELETE 발생** | auth_list.php:99, 106 — orphan 정리 | GET이 부수효과 있음, race 가능 | 신규는 별도 cron 또는 명시적 cleanup endpoint |
| 7 | **g5_auth가 MyISAM** | gnuboard5.sql:13 | 트랜잭션/FK 없음. 회원 hard-delete 시 권한 row dangling | Postgres + ON DELETE CASCADE (admin_permission에 이미 정의됨, 0005:437) |
| 8 | **권한 변경 감사로그 부재** | auth_update.php / auth_list_delete.php | 누가 언제 누구에게 무슨 권한을 줬는지 메일 알림 외 기록 없음 | `admin_audit_log` 테이블 신규 마이그레이션 (아래 설계) |
| 9 | **SET('r','w','d') 콤마 문자열** | g5_auth.au_auth | 정렬/검색/추가 권한 확장 어려움 | 신규는 `can_read/can_write/can_delete` BOOLEAN 3컬럼 (이미 admin_permission에 정의됨, 0005:440-442) |
| 10 | **세션 위조 방지가 mb_datetime+IP+UA 해시** | admin.lib.php:555 | IP 변경 시 자동 강제 로그아웃 — 모바일 데이터 ↔ Wi-Fi 전환에서도 끊김. 사용성 ↓ | JWT는 발급-검증만. 세션 무효화는 토큰 로테이션 + DB last_login 비교로 대체 |
| 11 | **password() MySQL 내장 함수 사용** | common.lib.php:1740 | MySQL 8 호환성 ✕, 약한 해시 | bcrypt만 (이미 적용). 마이그레이션 시 강제 비번 재설정 정책 |
| 12 | **`auth_list.php` SQL injection** | auth_list.php:15-25 — sfl/stx/sst/sod 직접 보간 | 검색폼에서 mb_id를 SQL에 직접 — super 한정 페이지지만 super 계정 탈취 시 추가 피벗 | NestJS `postgres` tagged template + DTO 화이트리스트 |
| 13 | **menu350의 sub_menu 중복 키** | admin.menu350.php — 350001/350002/350599 여러 번 | 같은 권한 키가 여러 메뉴에 묶여 권한 분리 의미 상실 | 신규 메뉴 코드 체계 재정의 (아래) |
| 14 | **manager_list.php가 하드코딩 더미** | manager_list.php:135-181 | 실제 통계가 아니라 sample 데이터 | 신규에서 미재현. 매니저 통계는 도메인 06으로 |

---

## 신규 클린 빌드 설계

### 권장: **하이브리드 — role 3등급 + resource별 r/w/d**

세밀한 메뉴별 r/w/d만 가져가면 사주문1 운영 규모에서 과한 오버헤드(메뉴 추가/변경 때마다 N명에게 grant 필요). super-only만 두면 위임 불가.

타협점:

```
member.role = 'user' | 'counselor' | 'admin'    (이미 0001 스키마에 있음)
member.is_super BOOLEAN                          (★ 신규 추가 권장 — 마이그레이션)

if is_super:        모든 권한 통과 (g5의 super 동등)
else if role='admin':
    admin_permission 테이블에서 (member_id, resource) 조회
    can_read / can_write / can_delete 비트로 게이트
else:
    admin 라우트 자체 차단
```

세부 등급은 결국 **admin_permission의 grant 패턴**으로 표현 (super는 wildcard).

### 신규 admin 메뉴 코드 체계 (resource 키 재정의)

g5의 6자리 숫자를 버리고, 도메인.action 점-표기로:

| resource | 의미 | sample 대응 |
|---|---|---|
| `members.customers` | 고객 회원 | 350110, 300100 |
| `members.counselors` | 상담사 | 350120 |
| `members.level` | 회원 등급 변경 | (별도 분리) |
| `points.history` | 포인트 이력 조회 | 350430 |
| `points.adjust` | 포인트 가감 | (Phase A 신규) |
| `consultation.history` | 상담 내역 | 350410 |
| `payment.history` | 결제 내역 | 350420 |
| `settlement.list` | 정산 | 350450 |
| `coupon.manage` | 쿠폰 | 350510 |
| `coupon.zone` | 쿠폰존 | 350520 |
| `popup.manage` | 팝업 | 100310 / 350700 |
| `banner.manage` | 배너 | 350600 |
| `saju.config` | 사주메인 설정 | 350800 |
| `wish.manage` | 소원다락방 | 350999 |
| `board.review` | 상담후기 | 350001 |
| `board.qa` | 상담문의 | (qa) |
| `chat.records` | 채팅내역 | 350002 |
| `stats.access` | 접속자 | 300810, 350900 |
| `stats.manager` | 매니저 통계 | (350300 대체) |
| `system.permissions` | 권한 관리 자체 | 100200 (super only 또는 admin_permission으로) |

각 resource에 r/w/d 비트로 권한 부여. ETL 시 g5_auth 의 au_menu 6자리 → 위 테이블로 매핑하는 코드 테이블이 필요.

### admin_permission 테이블 활용 (이미 정의됨)

`/Users/jin-yubi/dwork/AI/사주문1/api/db/migrations/0005_cms_system.sql:435-446`:

```sql
CREATE TABLE admin_permission (
  id              BIGSERIAL PRIMARY KEY,
  member_id       BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  mb_id    VARCHAR(20),                    -- 레거시 추적용
  resource        VARCHAR(40) NOT NULL,    -- 'members.customers' 등
  can_read        BOOLEAN NOT NULL DEFAULT FALSE,
  can_write       BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete      BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by_id   BIGINT REFERENCES member(id),
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_admin_permission UNIQUE (member_id, resource)
);
```

이미 잘 설계됨. 다만 다음 컬럼을 **추가 마이그레이션**으로 권장:

```sql
-- 0014_admin_super_and_audit.sql (가칭)
ALTER TABLE member ADD COLUMN is_super BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN member.is_super IS 'super admin 플래그. 모든 admin_permission을 우회';

-- 한 번에 한 명만 super를 강제하지 않음 (멀티 super 허용 — 단일 장애 회피)
CREATE INDEX idx_member_is_super ON member (is_super) WHERE is_super = TRUE;

ALTER TABLE admin_permission
  ADD COLUMN expires_at TIMESTAMPTZ NULL,        -- 권한 만료 (선택)
  ADD COLUMN note       TEXT NULL;                -- 부여 사유 메모
```

### admin_audit_log 신규 마이그레이션 (감사로그 통일)

```sql
-- 0014_admin_super_and_audit.sql
CREATE TABLE admin_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        BIGINT NOT NULL REFERENCES member(id),
  actor_login_id  VARCHAR(80) NOT NULL,            -- 디스플레이용 (member 변경에도 추적 가능)
  actor_ip        INET NULL,
  action          VARCHAR(40) NOT NULL,            -- 'permission.grant', 'permission.revoke', 'member.level.change', 'point.adjust', 'login.success', 'login.fail'
  resource        VARCHAR(40) NULL,                -- 영향받은 resource
  target_type     VARCHAR(40) NULL,                -- 'member', 'admin_permission', 'point', ...
  target_id       BIGINT NULL,                     -- 영향받은 row id
  before_value    JSONB NULL,                      -- 변경 전 상태
  after_value     JSONB NULL,                      -- 변경 후 상태
  message         TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_audit_actor ON admin_audit_log (actor_id, created_at DESC);
CREATE INDEX idx_admin_audit_target ON admin_audit_log (target_type, target_id);
CREATE INDEX idx_admin_audit_action ON admin_audit_log (action, created_at DESC);

COMMENT ON TABLE admin_audit_log IS '관리자 감사로그 (권한 변경, 회원 등급 변경, 포인트 조정, 로그인 시도 등 통합)';
```

이 테이블은 **포인트 조정 이력(Phase A)** 과는 별개로, **메타 행동** 을 모은다. 포인트 이력은 도메인 04의 `point_history`(actor_admin_id 컬럼 포함, 0013 마이그레이션)가 담당하고, `admin_audit_log`는 권한·로그인·설정 변경 같은 메타 액션.

### NestJS RBAC 패턴 (Guard + Decorator)

기존 `AdminAuthGuard`는 JWT 검증까지만 한다. 그 위에 권한 가드를 얹는 구조:

```ts
// api/src/admin/auth/permissions.decorator.ts
export interface RequiredPermission {
  resource: string;             // 'members.counselors'
  action: 'r' | 'w' | 'd';
}
export const REQUIRE_PERMISSION = 'require_permission';
export const RequirePermission = (resource: string, action: 'r' | 'w' | 'd') =>
  SetMetadata(REQUIRE_PERMISSION, { resource, action } as RequiredPermission);

// api/src/admin/auth/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(SQL) private sql: Sql,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission>(
      REQUIRE_PERMISSION, ctx.getHandler()
    );
    if (!required) return true;     // 데코레이터 없으면 통과 (단, AdminAuthGuard는 거치게 controller에 강제)

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const adminId = req.admin.sub;

    // is_super 우선
    const [me] = await this.sql`SELECT is_super FROM member WHERE id = ${adminId} LIMIT 1`;
    if (me?.is_super) return true;

    const col = required.action === 'r' ? 'can_read'
              : required.action === 'w' ? 'can_write'
              : 'can_delete';
    const rows = await this.sql`
      SELECT ${this.sql(col)} AS allowed FROM admin_permission
       WHERE member_id = ${adminId}
         AND resource = ${required.resource}
       LIMIT 1
    `;
    if (!rows[0]?.allowed) {
      throw new ForbiddenException(`권한이 없습니다: ${required.resource}/${required.action}`);
    }
    return true;
  }
}

// 사용
@UseGuards(AdminAuthGuard, PermissionGuard)
@Controller('admin/counselors')
export class CounselorController {
  @Get()
  @RequirePermission('members.counselors', 'r')
  list() { ... }

  @Patch(':id/level')
  @RequirePermission('members.level', 'w')
  changeLevel() { ... }
}
```

**자기 mb_level 이하만 변경** 같은 정책은 PermissionGuard 외 추가 도메인 가드/서비스 검증으로 분리.

### React 권한 분기 (RequireAuth + RequireRole/Permission)

`AdminUser`에 `is_super`, `permissions: { resource: { r,w,d } }` 추가:

```ts
// web/mng/src/lib/auth.tsx
export interface AdminUser {
  id: number | string
  login_id: string
  role: 'admin'
  level: number
  is_super: boolean                                        // ★ 추가
  permissions: Record<string, { r: boolean; w: boolean; d: boolean }>  // ★ 추가
}

// web/mng/src/components/RequirePermission.tsx
export function RequirePermission({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: string
  action: 'r' | 'w' | 'd'
  children: ReactNode
  fallback?: ReactNode
}) {
  const { admin } = useAuth()
  if (!admin) return null
  if (admin.is_super) return <>{children}</>
  const p = admin.permissions[resource]
  if (!p?.[action]) return <>{fallback}</>
  return <>{children}</>
}

// 라우트 가드
export function RequireRoleAdmin() {
  const { admin, status } = useAuth()
  if (status === 'loading') return <Loader />
  if (status !== 'authed' || admin?.role !== 'admin') return <Navigate to="/login" replace />
  return <Outlet />
}
```

`/admin/auth/me` 응답에 `is_super` + `permissions` 포함하여 boot 시 한 번에 받는다.

UI 측에선:
- 라우트 단: `<Route element={<RequireAuth />}><Route element={<RequireRoleAdmin />}>...</Route></Route>`
- 액션 버튼/메뉴: `<RequirePermission resource="members.level" action="w"><Button>등급변경</Button></RequirePermission>`

### 보안 강화 (sample 대비)

| 강화 항목 | 구현 |
|---|---|
| CSRF | SameSite=Strict 쿠키 + Origin 헤더 검증 미들웨어 (mutation 라우트). 별도 토큰 발행 X |
| Rate limit | 이미 `@Throttle({ login: { limit: 30, ttl: 60_000 } })` 적용 (auth.controller.ts:29). 추가로 권한 변경/포인트 조정에도 적용 권장 |
| Helmet | 이미 적용 (project_사주문1_admin_auth memory 참조) |
| IP 차단 | DB 설정 테이블 또는 환경변수로. 코드에 박지 않음. 옵션 |
| Brute-force | 로그인 실패 시 admin_audit_log에 'login.fail' 기록 + 5회 실패 시 계정 일시 잠금 (Phase 별 결정) |
| 비밀번호 정책 | bcrypt cost=12 이상. 최소 길이/복잡도 검증 (DTO) |
| 세션 무효화 | 비번 변경/권한 변경 시 해당 admin의 JWT 무효화. JTI/issued_at 기반 블랙리스트 또는 password_changed_at 비교 |

---

## ETL 매핑 (g5_auth → admin_permission)

```sql
-- ETL 의사코드 (실제는 NestJS 마이그레이션 스크립트로 작성)

-- 0) au_menu (6자리) → resource 매핑 테이블
CREATE TEMP TABLE _menu_to_resource (au_menu VARCHAR(20) PRIMARY KEY, resource VARCHAR(40));
INSERT INTO _menu_to_resource VALUES
  ('300100', 'members.customers'),
  ('350110', 'members.customers'),
  ('350120', 'members.counselors'),
  ('350410', 'consultation.history'),
  ('350420', 'payment.history'),
  ('350430', 'points.history'),
  ('350450', 'settlement.list'),
  ('350510', 'coupon.manage'),
  ('350520', 'coupon.zone'),
  ('100310', 'popup.manage'),
  ('350700', 'popup.manage'),
  ('350600', 'banner.manage'),
  ('350800', 'saju.config'),
  ('350999', 'wish.manage'),
  ('300810', 'stats.access'),
  ('350900', 'stats.access'),
  ('100200', 'system.permissions');
  -- ... 나머지 admin.menu*.php 의 메뉴 코드들

-- 1) g5_auth → admin_permission
INSERT INTO admin_permission (member_id, mb_id, resource, can_read, can_write, can_delete, granted_at)
SELECT m.id,
       g.mb_id,
       r.resource,
       (g.au_auth LIKE '%r%') AS can_read,
       (g.au_auth LIKE '%w%') AS can_write,
       (g.au_auth LIKE '%d%') AS can_delete,
       now()
  FROM g5_auth g
  JOIN _menu_to_resource r ON r.au_menu = g.au_menu
  JOIN member m ON m.mb_id = g.mb_id
 ON CONFLICT (member_id, resource) DO UPDATE
   SET can_read = admin_permission.can_read OR EXCLUDED.can_read,
       can_write = admin_permission.can_write OR EXCLUDED.can_write,
       can_delete = admin_permission.can_delete OR EXCLUDED.can_delete;

-- 2) g5_config.cf_admin → member.is_super
UPDATE member
   SET is_super = TRUE
 WHERE mb_id = (SELECT cf_admin FROM g5_config LIMIT 1)
   AND role = 'admin';

-- 3) au_menu가 _menu_to_resource에 없는 row → 무시 (legacy/dead 메뉴) + 로그
INSERT INTO admin_audit_log (actor_id, actor_login_id, action, message, created_at)
SELECT NULL, 'etl', 'permission.etl.unknown_menu',
       'g5_auth.au_menu=' || au_menu || ' (mb_id=' || mb_id || ') — 신규 resource 매핑 없음. 폐기',
       now()
  FROM g5_auth WHERE au_menu NOT IN (SELECT au_menu FROM _menu_to_resource);
```

검증 쿼리:
```sql
-- 라이브 g5_auth 와 신규 admin_permission 카운트 비교 (매핑 누락 검출)
SELECT COUNT(*) FROM g5_auth;
SELECT COUNT(*) FROM admin_permission;
-- 비율 차이가 크면 _menu_to_resource 누락 확인

-- super 1명 확인
SELECT COUNT(*) FROM member WHERE is_super = TRUE;
```

---

## 결정 필요 항목 (다음 phase에서 확정)

1. **Multi-super 허용 여부** — 단일 장애 방지를 위해 권장하나 운영팀 의견 필요. 기본은 **허용** (DB 레벨 제한 없음).
2. **권한 만료(`expires_at`) 사용 여부** — 외부 위탁 admin 임시 권한 부여 시 유용. 기본은 NULL (만료 없음).
3. **로그인 실패 잠금 정책** — N회 실패 시 잠금 시간/방식. Throttle만으로 충분할 수도.
4. **`admin_audit_log` 보존 기간** — 1년/3년/영구. 파티셔닝 필요 시 분기별.
5. **현 super 계정 ETL 시점에 비번 강제 재설정 여부** — 라이브 password()/PHPass 해시를 bcrypt로 어떻게 다룰지.

---

## 부록 — sub_menu 코드 인벤토리 (현 라이브 사용분)

`grep -rn '\$sub_menu = ' sample/adm/*.php` 결과 기반:

| sub_menu | 파일 | 용도 | 신규 resource |
|---|---|---|---|
| 100200 | auth_list.php, auth_update.php, auth_list_delete.php | 권한관리 | system.permissions |
| 300100 | member_list.php | 회원목록 | members.customers |
| 350100 | counselor_list_update.php | 상담사 일괄저장 | members.counselors |
| 350110 | member_form.php (관리/등록) | 회원 폼 | members.customers |
| 350120 | counselor_list.php | 상담사 목록 | members.counselors |
| 350300 | manager_list.php | 매니저 통계 (dummy) | (폐기) |
| ... | | | |

(전수는 추가 grep 으로 확정)

---

**문서 종료.** 신규 web/mng + api/src/admin은 이 설계를 기준으로 구현. AdminAuthGuard 는 그대로, PermissionGuard + RequirePermission 데코레이터 + admin_audit_log 마이그레이션이 추가 작업의 시작점.
