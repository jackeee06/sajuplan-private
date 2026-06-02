# 도메인 07: 인프라/공통 (관리자 뼈대)

## 개요

이 도메인은 **개별 비즈니스 화면**이 아니라, sample/adm 라이브 관리자 페이지 **전체를 떠받치는 뼈대**다:
- 진입 검증 (IP 화이트리스트 → 그누보드 공통 → 관리자 공통)
- 메뉴 트리 정의 (`admin.menu*.php` — 6개 묶음, foreach로 합쳐 사이드바 렌더)
- 권한/세션 검증 (`admin.lib.php` — 약 140줄의 공통 함수 + 검사 블록)
- CSRF 토큰 / Captcha 토글 / M2NET 연동 ajax 3종
- 운영 도구 (browscap, theme, *_file_delete, dbupgrade, sendmail_test, phpinfo)

신규 빌드는 **거의 전부 폐기 또는 완전 재설계** 대상이다.
- React + NestJS는 이미 JWT(httpOnly 쿠키) + bcrypt + AdminAuthGuard + Sidebar.tsx 구조를 갖췄으므로 그누보드 권한 시스템(`auth_table`, `is_admin == 'super'`, `auth_check_menu`)을 이식할 필요가 없음
- 메뉴 트리는 React 컴포넌트로 정적 정의(현재 구현됨)
- CSRF 토큰 / IP 화이트리스트 / browscap / theme / *_file_delete / dbupgrade / phpinfo는 **모두 폐기**
- ajax.csr_mgr.php (M2NET 상담사 연동)만 비즈니스 로직 보존 대상이지만 도메인 03(상담사) 영역으로 이관

본 문서는 라이브 뼈대를 인벤토리화해 신규 mng 사이드바/가드/엔드포인트 구조에 어떻게 매핑할지 결론을 정리한다.

---

## 라이브 관리자 진입 흐름 (의사코드)

```
HTTP GET /adm/index.php (또는 다른 adm/*.php)
  ↓
include_once('./_common.php')
  │  define('G5_IS_ADMIN', true)
  │  $allowed_ips = ['104.64.128.103','115.93.39.5','118.235.2.169','223.39.85.92']  ★하드코딩
  │  if (!in_array($_SERVER['REMOTE_ADDR'], $allowed_ips))  → 403 exit
  │  include_once('../common.php')                          ← 그누보드 부트
  │     │  세션 시작 (ss_mb_id), 회원 조회 → $member
  │     │  is_admin($member['mb_id']) → $is_admin ('super'|'group'|'')
  │  include_once(G5_ADMIN_PATH.'/admin.lib.php')
  │     │  if (!$member['mb_id']) → alert('로그인 하십시오.', login.php)
  │     │  elseif ($is_admin != 'super')
  │     │      SELECT au_menu, au_auth FROM g5_auth WHERE mb_id = ?  → $auth[]
  │     │      if (!행수) → alert('관리권한 없음', G5_URL)
  │     │  $admin_key = md5(mb_datetime + real_client_ip + USER_AGENT)
  │     │  if (get_session('ss_mb_key') !== $admin_key) {
  │     │      session_destroy();
  │     │      mailer(... 'XSS 공격 알림' ...);            ★IP 변경시마다 메일
  │     │      alert_close('정상적으로 로그인하여...');
  │     │  }
  │     │  scandir(G5_ADMIN_PATH) → admin.menu*.php 전부 include
  │     │  $amenu = run_replace('admin_amenu', $amenu)
  │     │  if ($_REQUEST) admin_referer_check() && admin_check_xss_params()
  │  if (isset($token)) $token = htmlspecialchars(strip_tags($token), ENT_QUOTES)
  │  run_event('admin_common')
  ↓
페이지 본문 (예: index.php)
  $sub_menu = '350000'
  include_once('./safe_check.php')   ← social_log_file_delete() 정의
  include_once('./admin.head.php')   ← <header>, <nav>, sidebar 렌더
  ... 비즈니스 로직 ...
  include_once('./admin.tail.php')   ← <footer>, jQuery anchorScroll 등
```

### 핵심 결함
1. **IP 화이트리스트가 _common.php에 하드코딩** — 관리자 PC IP가 바뀌면 코드 배포로만 갱신 가능. 모바일/외부 접근 불가.
2. **"XSS 공격 알림" 메일** — IP/UA가 세션 등록 시점과 다르면 메일 발송 + 세션 파괴. 모바일에서 PC로 갈아탈 때마다 강제 로그아웃 + 메일 폭탄.
3. **CSRF 보호 코드 주석처리** — admin.lib.php 4-10행 "효과가 없어 주석처리 함" 주석. 실효성 없는 토큰만 ajax.token.php로 발급.
4. **g5_auth 권한 테이블** — 메뉴별 read/write/delete 비트(`au_auth`) 관리. 신규는 `member.role/level`만 쓰므로 폐기.

---

## 라이브 메뉴 트리 (admin.menu*.php 파싱)

`admin.lib.php` 577-590행이 `glob('admin.menu[0-9]{3}*.php')`로 6개 파일을 자동 include하여 `$menu` 배열에 누적시킨다. 각 항목은 `[code, label, url, auth_key, group_flag?]` 5-tuple.

### menu100 (환경설정) — admin.menu100.php
| 코드 | 항목명 | 링크 | 라이브 사용 추정 | 신규 mng |
|---|---|---|---|---|
| 100000 | 환경설정 (그룹) | config_form.php | ✓ | 환경설정 그룹 헤더 |
| 100100 | 기본환경설정 | config_form.php | ✓ | `/settings` (구현됨) |
| ~~100200~~ | ~~관리권한설정~~ | auth_list.php | 주석 | 폐기 (g5_auth 미사용) |
| ~~100280~~ | ~~테마설정~~ | theme.php | 주석 | 폐기 (Tailwind 다크모드) |
| ~~100290~~ | ~~메뉴설정~~ | menu_list.php | 주석 | 폐기 (정적 React 정의) |
| ~~100300~~ | ~~메일 테스트~~ | sendmail_test.php | 주석 | 폐기 (NestJS health check로 대체) |
| 100310 | 팝업레이어관리 | newwinlist.php | ✓ | `/popup-layers` (구현됨) |
| ~~100500~~ | ~~phpinfo()~~ | phpinfo.php | 주석 | **금지** (보안) |
| ~~100510~~ | ~~Browscap 업데이트~~ | browscap.php | 주석 | 폐기 |
| ~~100520~~ | ~~접속로그 변환~~ | browscap_convert.php | 주석 | 폐기 |
| ~~100410~~ | ~~DB업그레이드~~ | dbupgrade.php | 주석 | 폐기 (npm run db:migrate) |
| ~~100800~~ | ~~세션파일 일괄삭제~~ | session_file_delete.php | 주석 | 폐기 (Redis/JWT로 대체) |
| ~~100900~~ | ~~캐시파일 일괄삭제~~ | cache_file_delete.php | 주석 | 폐기 (캐시 미사용) |
| ~~100910~~ | ~~캡챠파일 일괄삭제~~ | captcha_file_delete.php | 주석 | 폐기 |
| ~~100920~~ | ~~썸네일파일 일괄삭제~~ | thumbnail_file_delete.php | 주석 | 폐기 |

→ menu100에서 **현재 라이브에 노출되는 메뉴는 단 2개**: 기본환경설정, 팝업레이어관리.

### menu300 (회원관리) — admin.menu300.php
| 코드 | 항목명 | 링크 | 라이브 사용 추정 | 신규 mng |
|---|---|---|---|---|
| 300000 | 회원관리 (그룹) | member_list.php | 일부 | 회원현황 그룹으로 흡수 (menu350) |
| 300100 | 회원관리 | member_list.php | ✓ | 도메인 01에서 처리 |
| ~~300110~~ | ~~고객리스트~~ | member_list_customer.php | 주석 | menu350으로 이동 |
| ~~300120~~ | ~~상담사 리스트~~ | counselor_list.php | 주석 | menu350으로 이동 |
| 300200 | 회원메일발송 | mail_list.php | ✓ | 도메인 05(알림)로 흡수 |
| 300810 | 접속자검색 | visit_search.php | ✓ | 도메인 06(통계)로 흡수 |
| 300820 | 접속자로그삭제 | visit_delete.php | ✓ | 도메인 06으로 흡수 또는 폐기(GA4 위임) |
| ~~300830~~ | ~~포인트관리~~ | point_list.php | 주석 | menu350으로 이동 |
| 300900 | 투표관리 | poll_list.php | ✓ | **컷** (사용 안 함 결정) |

### menu350 (사주플랜 관리 — **메인 메뉴**) — admin.menu350.php
라이브에서 실질적으로 모든 비즈니스가 모인 메뉴. 47줄로 가장 길다.

| 코드 | 항목명 | 링크 | 신규 mng |
|---|---|---|---|
| 350000 | 사주플랜 관리 (그룹 헤더) | counselor_list.php | 그룹 헤더 |
| **회원현황** | | | |
| 350100 | 회원현황 (서브그룹) | member_list_customer.php | 회원현황 그룹 |
| 350110 | 고객 리스트 | member_list_customer.php | `/members/customers` (구현됨) |
| 350120 | 상담사 리스트 | counselor_list.php | `/members/counselors` (구현됨) |
| 350900 | 접속자집계 | visit_date.php (★URL에 token 하드코딩) | 도메인 06으로 |
| **매출현황** | | | |
| 350400 | 매출현황 (서브그룹) | coin_counsel_history.php | 매출현황 그룹 |
| 350410 | 사용(상담) 내역 | coin_counsel_history.php | 도메인 03(정산) |
| 350460 | 충전금액 설정 | coin_pay_form.php | 도메인 02(결제) |
| 350420 | 결제 내역 | coin_pay_history.php | 도메인 02 |
| ~~350440~~ | ~~누적 매출~~ | revenue_list_day.php | 주석 → 도메인 06 통계로 |
| 350430 | 포인트 관리 | point_list.php | 도메인 01 (이력 기반 조정) |
| 350450 | 정산 이력 | settlement_list.php | 도메인 03 |
| **상담관리** | | | |
| 350599 | 상담관리 (서브그룹) | board.php?bo_table=review | 상담관리 그룹 |
| 350001 | 상담후기 관리 (★중복 코드) | board.php?bo_table=review | 도메인 04 |
| 350002 | 채팅내역 리스트 | my/chat_record.php | 도메인 03 또는 신규 페이지 |
| **쿠폰** | | | |
| 350500 | 쿠폰 (서브그룹) | shop_admin/couponlist.php | 쿠폰 그룹 (도메인 02 또는 별도) |
| 350510 | 쿠폰관리 | shop_admin/couponlist.php | 신규 페이지 필요 |
| 350520 | 쿠폰존관리 | shop_admin/couponzonelist.php | 신규 페이지 필요 |
| **기타** | | | |
| 350599 | 기타 (서브그룹, ★코드 중복) | settlement_list.php | 기타 그룹 |
| 350600 | 배너관리 | shop_admin/bannerlist.php | 신규 페이지 |
| 350700 | 팝업레이어관리 | newwinlist.php | `/popup-layers` (구현됨, menu100과 중복) |
| 350800 | 사주메인관리 | saju_config.php | 신규 페이지 |
| 350999 | 소원다락방 | wish_list.php | 신규 페이지 |
| 350002 | 소원다락방 EVENT (★코드 중복) | board.php?bo_table=wish_event | 도메인 04 |
| 350001 | 상담문의 (★코드 중복) | board.php?bo_table=qa | 도메인 04 |
| 350001 | 1:1문의(상담사) (★코드 중복) | bbs/qalist.php | 도메인 04 |

#### menu350의 정합성 결함 (라이브 그대로의 모습)
- **메뉴 코드 중복**: `350001`이 4번, `350002`가 2번, `350599`가 3번 사용됨. `auth_check_menu($auth, $sub_menu, ...)`는 첫 번째 매칭만 평가하므로 권한 검사가 의도와 다르게 동작할 가능성.
- **HTML 인젝션**: 라벨에 `<span class="gnb_2da_dot">` 등을 직접 삽입. label과 markup이 데이터에 섞여 있음.
- **링크에 query string + target=blank 깨진 인용**: `G5_URL.'/bbs/board.php?bo_table=review" target="blank"'` — URL 끝에 `"` 닫는 따옴표가 들어가 link 안에 target 속성이 들어감 (정상이긴 하지만 데이터 모델로는 망가진 형태).
- **URL에 token 하드코딩**: 350900은 `visit_date.php?token=26a3190ecaa59bdaa3e6daee0e667264&...`. CSRF 토큰을 정적으로 박아 무력화.

### menu400 (쇼핑몰 1) / menu500 (쇼핑몰 2) — **컷 결정**
- `if (!defined('G5_USE_SHOP') || !G5_USE_SHOP) return;` 로 가드 — 라이브에서 `G5_USE_SHOP=true`면 노출됨
- 라이브 사용 추정: **불명** (현재 정책상 신규에서는 컷). 항목은 트리 구조 참고용:
  - menu400: 결제관리/주문내역/개인결제/분류/상품/문의/사용후기/재고/유형/옵션재고/배송비/미완료주문/쇼핑몰설정 (13개)
  - menu500: 매출현황/상품판매순위/주문내역출력/재입고SMS/이벤트관리/이벤트일괄/보관함/가격비교 (8개)
- 신규 mng에서는 메뉴 자체가 없음. 단 도메인 02(결제)와 매출 통계는 menu350에 흡수.

### menu700 (게시판) — admin.menu700.php
| 코드 | 항목명 | 링크 | 신규 mng |
|---|---|---|---|
| 700000 | 게시판관리 (그룹) | board_list.php | 게시판 그룹 |
| 700100 | 게시판관리 | board_list.php | 도메인 04 |
| 700200 | 게시판그룹관리 | boardgroup_list.php | 도메인 04 |
| 700300 | 인기검색어관리 | popular_list.php | 도메인 04 또는 폐기 |
| 700400 | 인기검색어순위 | popular_rank.php | 도메인 04 또는 폐기 |
| 700500 | 1:1문의설정 | qa_config.php | 도메인 04 |
| ~~700600~~ | ~~내용관리~~ | contentlist.php | 주석 → 신규 ContentList 구현됨 |
| 700700 | FAQ관리 | faqmasterlist.php | 도메인 04 |
| 700820 | 글,댓글 현황 | write_count.php | 도메인 06 통계 |
| 700900 | 게시판신고관리 | board_singo.php | 도메인 04 |

### menu900 (푸시·알림톡) — admin.menu900.php
| 코드 | 항목명 | 링크 | 신규 mng |
|---|---|---|---|
| 900000 | 푸시·알림톡 (그룹) | sms5/config.php | 알림 그룹 |
| 900050 | 푸시알림 내역 | push_list.php | 도메인 05 |
| 900060 | 알림톡 템플릿 관리 | alimtalk/tpl_msg_list.php | 도메인 05 |
| 900100 | SMS 기본설정 | sms5/config.php | 도메인 05 (정책 확인) |
| 900200 | 회원정보업데이트 | sms5/member_update.php | 폐기 (자동 동기화) |
| 900300 | 문자 보내기 | sms5/sms_write.php | 도메인 05 |
| 900400 | 전송내역-건별 | sms5/history_list.php | 도메인 05 |
| 900410 | 전송내역-번호별 | sms5/history_num.php | 도메인 05 |
| 900500 | 이모티콘 그룹 | sms5/form_group.php | 폐기 (사용도 낮음 추정) |
| 900600 | 이모티콘 관리 | sms5/form_list.php | 폐기 |
| 900700 | 휴대폰번호 그룹 | sms5/num_group.php | 폐기 또는 도메인 05 |
| 900800 | 휴대폰번호 관리 | sms5/num_book.php | 폐기 또는 도메인 05 |
| 900900 | 휴대폰번호 파일 | sms5/num_book_file.php | 폐기 |

### menu999 (엑셀 업로드 / 시스템) — admin.menu999.php
| 코드 | 항목명 | 링크 | 신규 mng |
|---|---|---|---|
| 999000 | 엑셀 업로드 (그룹) | board_excel.php | 시스템 그룹 |
| 999100 | 게시판 엑셀 업로드 | board_excel.php | 도메인 04 |
| 999200 | 회원 일괄등록 | member_xls/member_xls.php | 도메인 01 또는 폐기 |

---

## admin.lib.php 핵심 함수 인벤토리

| 함수명 | 역할 | 신규에서 대체 |
|---|---|---|
| `get_skin_select($skin_gubun, $id, $name, $selected, $event)` | 스킨 디렉토리를 `<select>`로 출력 | 폐기 (스킨 시스템 없음) |
| `get_mobile_skin_select(...)` | 모바일 스킨 동일 | 폐기 |
| `get_skin_dir($skin, $skin_path)` | 스킨 디렉토리 스캔 | 폐기 |
| `get_theme_dir()` | 테마 디렉토리 스캔 (head/tail/index 검사) | 폐기 (Tailwind) |
| `get_theme_info($dir)` | `readme.txt` + `screenshot.png` 파싱 | 폐기 |
| `get_theme_config_value($dir, $key='*')` | `theme.config.php` 읽기 | 폐기 |
| `get_member_level_select($name, $start, $end, $sel)` | 회원레벨 0-10 `<select>` | React `<Select>` 컴포넌트로 자연 대체 |
| `get_member_id_select($name, $level, $sel)` | 회원ID `<select>` | API + React Combobox |
| `auth_check_menu($auth, $sub_menu, $attr, $return)` | 메뉴별 권한 확인 (PHP8 호환 래퍼) | 폐기 (권한 모델 단순화) |
| `auth_check($auth, $attr, $return)` | r/w/d 비트 검사 | 폐기 |
| `icon($act, $link, $target)` | "삽입/수정/삭제" 아이콘 `<img>` | lucide-react Icon 컴포넌트 |
| `rm_rf($file)` | 재귀 디렉토리 삭제 | 폐기 (Node.js fs/promises) |
| `help($help)` | `<span class="frm_info">` 헬프 텍스트 | React Tooltip |
| `order_select($fld, $sel)` | 1-100 정렬 순서 `<select>` | React `<Input type="number">` |
| **`get_admin_token()`** | `md5(uniqid(rand()))` → ss_admin_token 세션 저장 | **폐기** (CSRF는 SameSite 쿠키로) |
| `get_admin_captcha_by($type)` | ss_admin_use_captcha 세션 토글 | 폐기 (관리자에 captcha 불필요) |
| `get_sanitize_input($s, $is_html)` | `strip_tags + htmlspecialchars` | NestJS class-validator + React 자동 escape |
| `check_log_folder($log_path, $is_delete)` | log 폴더에 `.htaccess` + `index.php` 자동 생성 + 30일 지난 파일 삭제 | 폐기 (NGINX location 차단 + 별도 cron) |
| **`check_admin_token()`** | $_REQUEST['token']와 ss_admin_token 비교 | **폐기** (위와 동일 이유) |
| `admin_referer_check($return)` | $_SERVER['HTTP_REFERER'] host/path 검증 | 폐기 (CORS + Origin 헤더 + JWT) |
| `admin_check_xss_params($params)` | 정규식으로 `<script>`, `onload=` 등 거름 | 폐기 (React 자동 escape + Helmet CSP) |
| `admin_menu_find_by($call, $search_key)` | $menu 배열을 `$auth_key` 기반으로 lookup | 폐기 |

### 실행 시점에 즉시 동작하는 보호 블록 (admin.lib.php 533-609행)
1. **로그인 체크**: `if (!$member['mb_id']) alert('로그인 하십시오.', login.php?url=...)`
2. **super 아닌 경우 권한 로딩**: `SELECT au_menu, au_auth FROM g5_auth WHERE mb_id=?`. 행이 없으면 alert + redirect.
3. **세션 키 검증** (admin_key): `md5(mb_datetime + real_ip + UA)`이 `ss_mb_key`와 다르면 → 세션 파괴 + 메일 알림 + alert_close
4. **메뉴 자동 로딩**: `glob('admin.menu*.php')` → 전부 include → `$amenu`/`$menu` 구성
5. **공통 검사**: $_REQUEST 있으면 referer + xss 파라미터 검사

→ 신규는 1, 2, 3, 5번을 **AdminAuthGuard 1개로 대체** (이미 구현됨). 4번은 React `<Sidebar>` 정적 정의로.

---

## CSRF 토큰 발급/검증 흐름 (라이브)

```
[브라우저] form 제출 또는 ajax 시작
   ↓
admin.js (line 84) get_ajax_token()
   ↓ POST /adm/ajax.token.php (jQuery, async:false ★동기 차단)
[서버] ajax.token.php
   include _common.php
   admin_referer_check(true)  → 실패시 {error, url} 반환
   set_session('ss_admin_token', '')   ← 직전 토큰 무효화
   $token = md5(uniqid(rand(), true))
   set_session('ss_admin_token', $token)
   echo {error:'', token, url:''}
   ↓
[브라우저] form에 <input name="token" value=token> 주입 후 submit
   ↓
[서버] 대상 페이지 (예: counselor_list_update.php)
   check_admin_token()
     $sess = get_session('ss_admin_token')
     set_session('ss_admin_token', '')  ← one-time
     if !$sess || !$_REQUEST['token'] || $sess != $_REQUEST['token']
        alert('올바른 방법으로 이용해 주십시오.', G5_URL)
```

**문제점**:
- admin.lib.php 4-10행에 "081022 : CSRF 방지를 위해 코드를 작성했으나 효과가 없어 주석처리 함" 주석 — 즉 추가 보호 코드는 존재하지 않음.
- get_ajax_token이 jQuery `async:false`로 매 form 제출마다 서버 왕복 — UX 지연 + 차단 호출.
- admin.menu350.php 350900 항목처럼 **URL에 token 하드코딩**하는 메뉴가 있음 → 검증 우회 가능.
- ajax.use_captcha.php는 **검증 없이 POST만으로 captcha 사용 토글** (`set_session('ss_admin_use_captcha', true)`).

→ **신규 mng는 CSRF 토큰 시스템 자체를 폐기**. JWT(httpOnly + SameSite=Lax) 쿠키 + Origin 헤더 검증으로 대체.

---

## 파일별 분석

### 진입/공통

#### sample/adm/_common.php (22줄)
- `define('G5_IS_ADMIN', true)` — 그누보드에 관리자 컨텍스트 신호
- **IP 화이트리스트 4개 하드코딩** (104.64.128.103, 115.93.39.5, 118.235.2.169, 223.39.85.92) — 통과 못 하면 즉시 403 exit
- `include_once('../common.php')` — 그누보드 부트스트랩
- `include_once(G5_ADMIN_PATH.'/admin.lib.php')` — 관리자 공통 함수 + 권한 검사
- `run_event('admin_common')` — 그누보드 이벤트 훅

→ **폐기**. 신규는 NestJS 라우트 + AdminAuthGuard. IP 차단이 필요하면 nginx allow/deny 또는 WAF.

#### sample/adm/admin.head.php (216줄)
- 관리자 페이지 공통 `<header>` + `<nav>` + 컨테이너 시작
- `glob(G5_ADMIN_PATH.'/css/admin_extend_*')` — 확장 CSS 자동 인클루드
- `print_menu1()`/`print_menu2()` — `$menu`를 `<ul><li>` HTML로 렌더 (`is_admin == 'super' || in_array($auth_key, $auth)` 체크)
- 헤더에 "관리자정보 / 로그아웃" tnb_li
- `$amenu` foreach로 1차 메뉴 버튼 + `print_menu1()` 호출로 2차 메뉴 출력
- 쿠키 `g5_admin_btn_gnb`로 사이드바 접힘 상태 보존
- 인라인 jQuery로 메뉴 토글

→ **폐기 (전부)**. 신규는 React `<AdminLayout>` + `<Sidebar>` + `<Header>`로 대체 (이미 구현).

#### sample/adm/admin.head_index.php (224줄)
- admin.head.php의 변형 — index.php(대시보드)에서만 사용
- 차이: `<h1>Dashboard <today>YYYY-MM-DD ?요일</today></h1>` 추가
- xeicon CSS 로컬 경로(G5_THEME_CSS_URL) 대신 jsdelivr CDN 직접 참조

→ 폐기. 동일 이유.

#### sample/adm/admin.tail.php (155줄)
- `<footer>` + `Copyright © $_SERVER['HTTP_HOST']` (★`HTTP_HOST` 사용 — Host header injection 가능)
- jquery.anchorScroll.js + 메뉴 hover 동작 + font_resize 쿠키 적용
- `tail.sub.php` include

→ 폐기. footer는 React 컴포넌트.

#### sample/adm/admin.lib.php (612줄)
위 "admin.lib.php 핵심 함수 인벤토리" 섹션 참고. **전부 폐기**.

#### sample/adm/admin.js (129줄)
- `check_all`, `btn_check`, `is_checked`, `delete_confirm`, `delete_confirm2` — 리스트 화면 체크박스 헬퍼
- **`get_ajax_token()`** — jQuery `async:false` 동기 호출로 토큰 받기
- form submit 핸들러 — 모든 form 제출 시 토큰 자동 주입

→ 폐기. React `useState` + 일반 fetch.

#### sample/adm/index.php (대시보드 — 첫 120줄만 확인, 전체 84KB)
- `$sub_menu = '350000'`로 menu350의 사주플랜 관리 그룹 활성화
- `safe_check.php` include + `social_log_file_delete(86400)` 호출 (24시간 전 소셜 로그 삭제)
- `admin.head_index.php` include (대시보드 전용 헤더)
- DEBUG 헬퍼: `$IS_DEBUG = $_SERVER['REMOTE_ADDR'] === '115.93.39.5'` (★IP 기반 디버그 모드)
- 회원/탈퇴/차단/신규 카운트 SQL → 대시보드 위젯
- (이하 비즈니스 로직: 도메인 06 통계 영역으로 분류)

→ 신규는 `web/mng/src/pages/Dashboard.tsx` (이미 구현). 데이터는 `/admin/dashboard/*` API로.

### 메뉴 트리

#### admin.menu100/300/350/400/500/700/900/999.php
위 "라이브 메뉴 트리" 섹션 참고. **글로벌 변수 `$menu['menuXXX']` 배열 정의 외엔 로직 없음.**

→ 폐기. React `<Sidebar>` 정적 정의로 대체.

### Ajax 엔드포인트

#### sample/adm/ajax.token.php (13줄)
```php
include './_common.php';
include G5_LIB_PATH.'/json.lib.php';
set_session('ss_admin_token', '');           // 직전 토큰 폐기
$error = admin_referer_check(true);          // referer 검사
if($error) die(json_encode([error, url:G5_URL]));
$token = get_admin_token();                  // md5(uniqid(rand()))
die(json_encode([error:'', token, url:'']));
```
→ **폐기**.

#### sample/adm/ajax.use_captcha.php (5줄)
```php
include './_common.php';
if(isset($_POST['admin_use_captcha']))
    set_session('ss_admin_use_captcha', true);
```
검증 없음. POST만 오면 toggle.

→ **폐기**. 관리자에 captcha 미사용.

#### sample/adm/ajax.csr_mgr.php (50줄)
M2NET 외부 시스템에 상담사 등록(`csr-mgr` API 호출).
- POST['mb_id']로 회원 조회
- 이미 `mb_1` (M2NET csrid)가 있으면 거부
- mb_name, state, mb_2(sortno), mb_no(dtmfno), mb_3(telno), mb_4(decamt), mb_5(dectm), mb_6(preflag), mb_12(chatdectm), mb_13(chatdecamt) 묶어 JSON으로 send_mjson('csr-mgr', ..., 'POST')
- 응답의 csrid를 `member.mb_1`에 저장

→ **신규 도메인 03(상담사)으로 이관**. NestJS `POST /admin/counselors/:id/sync-m2net` 같은 엔드포인트로.
신규 스키마에서 `mb_1=m2net_csrid`, `mb_2=m2net_sortno` 등 — `0008_align_m2net_keys.sql` 참고.
**보안 이슈**: SQL injection 가능 (`'".$mb_id."'`로 직접 보간). 신규는 prepared statement.

### 브라우저 분석 (browscap)

#### sample/adm/browscap.php (44줄)
- `$is_admin == 'super'` + `G5_BROWSCAP_USE` 검사
- "업데이트" 버튼 → ajax POST → browscap_update.php
- → browscap 라이브러리에 인터넷에서 정의 파일 다운로드

#### sample/adm/browscap_update.php (24줄)
- `phpbrowscap\Browscap::updateCache()` (cURL 방식)
- 외부 sf.net에서 browscap.ini 파일 다운로드 → cache
- `ini_set('memory_limit', '-1')` ★메모리 무제한

#### sample/adm/browscap_convert.php (46줄)
- "변환" 버튼 → ajax GET → browscap_converter.php

#### sample/adm/browscap_converter.php (75줄)
- visit 테이블에서 `vi_browser=''` OR `vi_os=''` 인 행 100개씩 조회
- 각 행에 대해 `Browscap::getBrowser($vi_agent)` → vi_browser/vi_os/vi_device 채움
- ★`memory_limit -1` 사용

→ **전부 폐기**. 신규는 User-Agent 파싱이 필요하면 client에서 ua-parser-js, 또는 통계는 GA4로 위임.
- 라이브에서 메뉴100에 주석처리되어 있음 → 사실상 사용 안 됨.
- 단 `bbs/visit_insert.inc.php`에는 활성 코드(`G5_BROWSCAP_USE`가 true) — 즉 페이지 방문마다 visit 테이블에 ua/browser/os/device를 적재. 이 적재 자체는 사용자측 코드라 본 도메인 범위 외.

### 캐시/세션 청소

#### sample/adm/cache_file_delete.php (60줄)
`unlink(G5_DATA_PATH.'/cache/latest-*'); unlink('/cache/content-*');`. super 권한 필요.
→ 폐기 (캐시 시스템 미사용).

#### sample/adm/captcha_file_delete.php (52줄)
`G5_DATA_PATH/cache/?captcha-*` 1시간 이상 된 파일 unlink.
→ 폐기.

#### sample/adm/session_file_delete.php (60줄)
`G5_DATA_PATH/session/sess_*` 6시간 이상 된 파일 unlink.
→ 폐기. 신규는 JWT 무상태.

#### sample/adm/thumbnail_file_delete.php (71줄)
`G5_DATA_PATH/file/`, `editor/`, (shop이면 `item/`) 안 모든 하위 디렉토리에서 `thumb-*` unlink.
→ 폐기. 썸네일은 sharp 라이브러리가 on-demand로 생성하거나 CDN 위임.

→ menu100에 모두 주석처리되어 있어 라이브 운영자도 거의 사용 안 함. 단 한 개 IP(115.93.39.5)에 한정해 노출시키려던 코드도 주석.

### 테마/UI

#### sample/adm/theme.php (78줄)
- 설치된 테마 디렉토리 스캔 → `<ul>` 카드 리스트
- "사용중" / "테마적용" / "사용안함" / "미리보기" / "상세보기" 버튼
- ALTER TABLE으로 `cf_theme` 컬럼 동적 추가 ★

#### sample/adm/theme_config_load.php (185줄)
- 테마의 default 스킨/이미지 사이즈 설정을 `theme.config.php`에서 읽어 ajax로 반환
- 게시판/회원/쇼핑/회원 등 type별 분기

#### sample/adm/theme_detail.php (67줄)
- 테마 상세보기 모달 — readme.txt + screenshot

#### sample/adm/theme_preview.php (202줄)
- 테마 미리보기 (별도 윈도우) — 인덱스/리스트/뷰/쇼핑 모드 전환

#### sample/adm/theme_update.php (96줄)
- POST['theme'] 적용 → `UPDATE g5_config SET cf_theme = ?`
- "기본 스킨도 적용" 옵션 시 모든 cf_*_skin / qa_*_skin / de_*_skin 일괄 업데이트

→ **전부 폐기**. 신규는 React + Tailwind로 다크/라이트 토글만 지원. 다중 테마/스킨 시스템 폐기.
menu100에 주석 처리되어 있어 라이브 운영자도 사용 안 함.

### 기타

#### sample/adm/dbupgrade.php (222줄)
페이지 로드마다 ALTER TABLE을 시도하여 빠진 컬럼 자동 추가:
- `cf_social_login_use`, `cf_google_clientid`, `cf_naver_clientid`, ... `cf_recaptcha_secret_key` 등 14개
- `cf_kakao_client_secret`, `cf_member_img_size/width/height`
- `g5_social_profile` 테이블 자동 생성
- 게시판마다 `g5_write_*.wr_seo_title` 컬럼 추가
- `g5_content.co_seo_title` + 100건 자동 채움
- `g5_memo` 테이블에 me_send_id/me_type/me_send_ip 추가
- `g5_member.mb_memo_cnt`, `mb_scrap_cnt` 추가
- `cf_bbs_rewrite` 추가
- `g5_board_file.bf_fileurl/bf_thumburl/bf_storage` 추가
- shop이면 `g5_shop_post_log` 테이블 생성/수정

→ **폐기**. 신규는 `api/db/migrations/00xx_*.sql` 파일 + `api/db/migrate.ts` 러너 (이미 구축).
**원칙**: 페이지 로드 중 ALTER TABLE 절대 금지. 마이그레이션은 명시적 `npm run db:migrate`로만.

#### sample/adm/safe_check.php (16줄)
`social_log_file_delete($second)` 함수만 정의 — `G5_DATA_PATH/tmp/social_*` 파일 N초 이상 된 것 unlink.
- 버그: 11행 `filemtime($log_file)` — 변수명 오타 (`$social_log_file`이어야 함). PHP에서는 undefined → false 반환.

→ 폐기. 신규는 소셜 로그인 디버그 파일 시스템 자체가 없음.

#### sample/adm/sendmail_test.php (75줄)
super 권한 + cf_email_use 활성화 시 — POST['email']로 콤마 분리 → mailer() 호출 테스트.
→ 폐기. 신규는 NestJS health-check 또는 별도 운영 도구.

#### sample/adm/_rewrite_config_form.php (120줄)
config_form.php 안에 include되는 sub-section. Apache/Nginx 환경 자동 감지, 짧은 URL(`cf_bbs_rewrite`) 설정 → modal로 .htaccess 또는 nginx 코드 표시.
→ 폐기. SSR Next 라우팅(또는 별도 라우터)이 자체 처리. 관리자 UI에서 server config 노출 불필요.

#### sample/adm/phpinfo.php (9줄)
```php
$sub_menu = "100500";
include_once('./_common.php');
check_demo();
auth_check_menu($auth, $sub_menu, 'r');
phpinfo();   // ★ PHP 환경 변수, 절대 경로, DB 비밀번호(Server API 환경에 따라) 노출
```
- super 아니어도 auth에 `cf_phpinfo` 권한 있는 회원은 접근 가능
- `_common.php`의 IP 화이트리스트는 통과해야 하지만, 그 너머 권한 체크가 약함
- **메뉴100에 주석 처리되어 있어 직접 링크 클릭은 불가하지만 URL을 알면 호출 가능** (404가 아니라 phpinfo() 노출).

→ **신규에서 절대 포함 금지**. 보안 위험 1순위.

---

## 발견된 이슈

### 보안

| # | 이슈 | 심각도 | 위치 |
|---|---|---|---|
| 1 | phpinfo.php가 코드상 존재 — URL을 알면 노출. 메뉴 가시화는 차단됐으나 라우팅은 살아있음 | **Critical** | sample/adm/phpinfo.php |
| 2 | IP 화이트리스트 4개 하드코딩 — 코드 배포 없이 갱신 불가 + 모바일 접근 차단 + 외부 협업자 불가 | **High** | sample/adm/_common.php:4-9 |
| 3 | CSRF 보호 코드 주석 처리 ("효과가 없어"라는 주석) | **High** | sample/adm/admin.lib.php:4-10 |
| 4 | menu350의 350900에 token이 URL에 하드코딩 — `?token=26a3190ec...` | **High** | admin.menu350.php:16 |
| 5 | ajax.csr_mgr.php가 `$mb_id`를 직접 SQL 보간 (`where mb_id='".$mb_id."'`) → SQL injection | **High** | ajax.csr_mgr.php:11,24 |
| 6 | $admin_key가 IP+UA 변경에 너무 민감해 모바일↔PC 전환마다 강제 로그아웃 + 메일 발송 | **Medium** | admin.lib.php:555-565 |
| 7 | "XSS 공격 알림" 메일이 IP 변경마다 발송 — 알림 피로 + 공격자가 메일 폭탄 트리거 가능 | **Medium** | admin.lib.php:561-562 |
| 8 | admin.tail.php가 `$_SERVER['HTTP_HOST']`를 직접 출력 → Host header injection 가능 | **Low** | admin.tail.php:19 |
| 9 | ajax.use_captcha.php가 referer 검증 없이 POST만으로 captcha 토글 | **Low** | ajax.use_captcha.php |
| 10 | dbupgrade.php가 페이지 로드마다 ALTER TABLE 시도 — 운영중 스키마 변경 위험 + 권한이 너무 약함 (`auth_check_menu r`만) | **Medium** | dbupgrade.php |
| 11 | get_ajax_token 동기 jQuery (async:false) — UX 차단 + DoS 표면 | **Low** | admin.js:88-105 |
| 12 | safe_check.php의 `filemtime($log_file)` 변수명 오타 — undefined 변수, PHP가 false 반환해 사실상 항상 unlink 동작 안 함 | **Low** | safe_check.php:9 |

### 정합성

| # | 이슈 | 위치 |
|---|---|---|
| 13 | menu350에서 메뉴 코드 중복 (350001×4, 350002×2, 350599×3) — auth 검사가 첫 매칭만 평가 | admin.menu350.php |
| 14 | menu100 항목 대부분 주석처리 — 사실상 메뉴는 환경설정 + 팝업레이어 2개뿐 | admin.menu100.php |
| 15 | menu350에서 라벨에 `<span class="gnb_2da_dot">` HTML 직접 박힘 — 데이터/markup 분리 안 됨 | admin.menu350.php |
| 16 | menu350의 일부 링크 끝에 `" target="blank"` 닫는 따옴표가 들어가 잘못된 인용 형태 | admin.menu350.php:29-46 |
| 17 | 팝업레이어관리가 menu100(100310)과 menu350(350700)에 **중복** 노출 | menu100/350 |
| 18 | menu300의 회원 메뉴 일부와 menu350의 회원 메뉴가 중복 (member_list_customer, counselor_list) | menu300/350 |
| 19 | dbupgrade.php가 자가 ALTER TABLE 다수 — 라이브 DB와 코드 사이 스키마 동기화 보장 없음. 컬럼 부재시 첫 어드민 진입한 사람이 ALTER 트리거 | dbupgrade.php |

### 운영 사용 여부 추정

| 영역 | 라이브 실제 호출 | 근거 |
|---|---|---|
| browscap (`browscap*.php`) | **사용 안 함** | menu100에 주석. 단 visit_insert.inc.php는 활성 → 사용자 visit 적재만 동작 |
| theme (`theme*.php`) | **사용 안 함** | menu100에 주석. cf_theme 미설정 추정 |
| *_file_delete | **사용 안 함** | menu100에 주석. 일부 IP 한정 코드도 주석 |
| dbupgrade.php | **거의 사용 안 함** | menu100에 주석. 직접 URL 진입 가능하지만 운영자 의도적 호출 흔적 약함 |
| sendmail_test | **사용 안 함** | menu100에 주석. cf_email_use도 별도 |
| phpinfo.php | **숨김** | menu100에 주석. URL 호출은 가능 |
| _rewrite_config_form.php | **사용** | config_form.php의 짧은URL 섹션에 include됨 |
| ajax.token.php | **사용** | admin.js의 모든 form submit이 호출 |
| ajax.use_captcha.php | **사용** | qa_config/contentform/board_form/shop categoryform이 호출 |
| ajax.csr_mgr.php | **사용** | member_form1.php(상담사 등록 폼)에서 호출 — M2NET 연동 핵심 |

---

## 신규 클린 빌드 매핑

### 폐기 (완전 제거)

| sample 항목 | 폐기 이유 |
|---|---|
| `_common.php`의 IP 화이트리스트 | 운영 유연성 차단. 인프라 레벨(NGINX/WAF)로 이전 |
| `admin.head.php` / `admin.head_index.php` / `admin.tail.php` | React `<AdminLayout>`로 완전 대체 |
| `admin.lib.php` 전체 | 권한/세션/CSRF/XSS 검사 전부 NestJS Guard + class-validator + Helmet으로 대체 |
| `admin.js` | jQuery 의존 + 동기 ajax 폐기. React 패턴으로 |
| `ajax.token.php` | CSRF 토큰 시스템 자체 폐기 (JWT + SameSite로 충분) |
| `ajax.use_captcha.php` | 관리자에 captcha 미사용 |
| `browscap*.php` | UA 파싱 필요시 client ua-parser-js 또는 GA4 |
| `cache_file_delete.php` / `captcha_file_delete.php` / `session_file_delete.php` / `thumbnail_file_delete.php` | 그누보드 파일 캐시/세션 모델 자체 폐기 |
| `theme*.php` | Tailwind 다크모드만 지원 |
| `dbupgrade.php` | `api/db/migrations/` + `npm run db:migrate` |
| `safe_check.php` | 소셜 로그인 디버그 파일 시스템 자체 없음 |
| `sendmail_test.php` | 별도 운영 도구 (메일 발송은 NestJS 모듈에서 health-check) |
| `_rewrite_config_form.php` | 관리자가 server config 만지지 않음. 인프라 영역 |
| **`phpinfo.php`** | 보안 위험 1순위. 신규에 절대 포함 금지 |
| `admin.menu*.php` 6개 | 정적 React `<Sidebar>`로 대체 |
| g5_auth 권한 시스템 (`auth_check_menu`, `auth_check`) | role/level 기반 단일 모델로 단순화 |

### 대체 (동일 기능을 신규 패턴으로)

| sample 기능 | 신규 패턴 |
|---|---|
| _common.php 진입 검증 | `AdminAuthGuard` ([api/src/admin/auth/admin-auth.guard.ts](../api/src/admin/auth/admin-auth.guard.ts)) — JWT 쿠키 검증 후 `req.admin` 주입 |
| `is_admin == 'super'` 검사 | `member.role === 'admin'` + `level` 체크 (관리 작업 단위로 추가 가드 필요시 별도 데코레이터) |
| `$admin_key = md5(mb_datetime + IP + UA)` 세션 검증 | JWT 만료 시간 + 갱신 흐름 (`/admin/auth/me` 부트시 호출 — [auth.tsx](../web/mng/src/lib/auth.tsx)) |
| `get_admin_token()` / `check_admin_token()` | SameSite=Lax 쿠키 + Origin/Referer 헤더 검증 + bcrypt password 흐름 |
| `admin_referer_check()` / `admin_check_xss_params()` | NestJS class-validator + Helmet CSP + React 자동 escape |
| `admin.menu*.php` 트리 | [Sidebar.tsx](../web/mng/src/components/layout/Sidebar.tsx) 정적 정의 |
| `print_menu1/2()` 권한 필터링 | React Sidebar에서 `useAuth().admin.level` 기반 조건부 렌더 |
| `admin.head.php` 헤더 + sidebar 토글 | [AdminLayout.tsx](../web/mng/src/components/layout/AdminLayout.tsx) + [Header.tsx](../web/mng/src/components/layout/Header.tsx) |
| `ajax.csr_mgr.php` (M2NET 연동) | 도메인 03(상담사) `POST /admin/counselors/:id/sync-m2net` (NestJS) |
| `dbupgrade.php` 자가 ALTER TABLE | `api/db/migrations/00xx_*.sql` + `api/db/migrate.ts` |
| `*_file_delete.php` 운영 도구 | 필요시 NestJS Schedule 모듈 cron — 단 캐시/세션은 모델 자체가 없으므로 불필요 |
| `phpinfo()` 진단 | NestJS `/admin/health` 엔드포인트(버전, DB 커넥션, 외부 의존성만) — 환경변수/path 절대 노출 금지 |
| `admin_key` IP/UA 검증 | 폐기 — JWT 만료 + 새 디바이스 로그인시 자연스러운 세션 분리. IP 변경 강제 로그아웃 안 함 |

### 유지 / 보강

- **AdminAuthGuard** (`api/src/admin/auth/admin-auth.guard.ts`) — 이미 JWT 쿠키 검증 + role 검사 → 새 admin 라우트는 모두 부착
- **AdminAuthService** (`api/src/admin/auth/auth.service.ts`) — bcrypt 비교 + dummy hash로 timing attack 완화 + last_login_at 갱신
- **AuthProvider/useAuth** (`web/mng/src/lib/auth.tsx`) — 부트 시 `/admin/auth/me`로 세션 복원 + login/logout
- **Sidebar/Header/AdminLayout** — 메뉴 정적 정의. 도메인 신규화에 따라 항목 보강 (아래 트리 제안 참고)

---

## 신규 mng 사이드바 메뉴 트리 제안

라이브 menu100/300/350/700/900/999 분석 + 도메인 1~6 결과를 합쳐 신규 사이드바를 다음과 같이 정리한다. **mn400/500(쇼핑몰)는 컷.**

### 그룹 1: 회원 관리 (대시보드 직속)
- 대시보드 (`/dashboard`) ✓
- 고객 리스트 (`/members/customers`) ✓
- 상담사 리스트 (`/members/counselors`) ✓

### 그룹 2: 매출/정산 (도메인 02, 03)
- 사용(상담) 내역 (`/consultations/usage`) ※도메인 03
- 결제 내역 (`/payments`) ※도메인 02
- 충전금액 설정 (`/payments/charge-config`) ※도메인 02
- 포인트 관리 (`/points`) ※도메인 01 (이력 기반 조정만)
- 정산 이력 (`/settlements`) ※도메인 03

### 그룹 3: 콘텐츠/게시판 (도메인 04)
- 콘텐츠 리스트 (`/contents`) ✓
- 게시판 관리 (`/boards`)
- 게시판 그룹 관리 (`/board-groups`)
- FAQ 관리 (`/faqs`)
- 1:1문의 / Q&A 관리 (`/qa`)
- 상담후기 관리 (`/reviews`)
- 게시판 신고 관리 (`/board-reports`)

### 그룹 4: 알림 (도메인 05)
- 푸시 알림 내역 (`/notifications/push`)
- 알림톡 템플릿 관리 (`/notifications/alimtalk-tpl`)
- SMS 발송 (`/notifications/sms`)
- 알림 발송 내역 (`/notifications/history`)

### 그룹 5: 통계 (도메인 06)
- 매출 통계 (`/stats/revenue`)
- 회원 가입/탈퇴 통계 (`/stats/members`)
- 접속자 집계 (`/stats/visits`)
- 글/댓글 현황 (`/stats/writes`)

### 그룹 6: 콘텐츠 운영
- 사주메인관리 (`/saju-main`)
- 배너관리 (`/banners`)
- 팝업레이어 관리 (`/popup-layers`) ✓
- 쿠폰 관리 (`/coupons`)
- 쿠폰존 관리 (`/coupon-zones`)
- 소원다락방 (`/wishes`)

### 그룹 7: 환경설정
- 기본 환경설정 (`/settings`) ✓
- (관리자 정보 수정은 헤더 우상단 드롭다운으로)

### 그룹 8: 시스템 (super만)
- 회원 일괄 등록 (`/system/member-bulk`)
- 게시판 엑셀 업로드 (`/system/board-excel`)
- 헬스 체크 (`/system/health`)

→ **체크된 ✓는 이미 React 페이지가 구현된 항목.** 나머지는 도메인별 Phase에서 점진 구현.
→ **shop, browscap, theme, *_file_delete, phpinfo, dbupgrade, sendmail_test, captcha 토글은 메뉴 자체 없음.**

---

## ETL 매핑

인프라/공통은 비즈니스 데이터가 아니므로 ETL 대상이 거의 없음. 다만:

| 라이브 데이터 | 신규 처리 |
|---|---|
| `g5_auth` 테이블 (관리자 권한) | **무시**. 신규는 `member.role='admin' + level`만으로 권한 표현. 관리자 본인 외 권한자는 신규에 수동 추가 (운영 정책으로) |
| `g5_config` 일부 (`cf_admin`, `cf_super_admin`) | 신규 `member.role/level`로 매핑. 단 `cf_admin` 관리자 ID 자체는 ETL에서 member 테이블의 admin role로 마크 |
| `g5_session` 파일 | **버림**. 신규는 JWT 무상태 |
| `g5_data/cache/*` | **버림** |
| `g5_data/file/thumb-*` | **버림** (sharp on-demand) |
| 메뉴 트리 데이터 | DB가 아닌 코드 정의이므로 ETL 없음. React Sidebar 정적 정의로 |

→ 인프라 도메인은 **ETL 거의 없음**. 신규 admin 계정 1-2명을 직접 INSERT (bcrypt password) + member.role='admin'으로 부트스트랩.

---

## 결론 (한 문장)

라이브 인프라/공통 영역 약 35개 PHP 파일 중 **신규로 보존되는 비즈니스 로직은 ajax.csr_mgr.php의 M2NET 상담사 연동 단 1건**(이것도 도메인 03으로 이관)뿐이고, 나머지는 모두 폐기 또는 React+NestJS 패턴으로 구조적 재설계 대상이다.
