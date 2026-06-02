# 도메인 09: 시스템/설정 + 운영 콘텐츠

> **분석 범위**: `sample/adm/` 중 시스템 설정·운영 콘텐츠 관련 PHP 19개 (백업 `_2024xxxx`/`_2025xxxx` 제외).
> **분석 원칙**: read-only. sample 코드는 **수정 금지, 참고만**. 결과는 `web/mng` **신규 클린 빌드**의 설계 입력.
> **참고**: 신규 DB 스키마 [`api/db/migrations/0005_cms_system.sql`](../api/db/migrations/0005_cms_system.sql), [`0007_shop.sql`](../api/db/migrations/0007_shop.sql), [`0009_popup_settings.sql`](../api/db/migrations/0009_popup_settings.sql), [`0002_board_post.sql`](../api/db/migrations/0002_board_post.sql). 라이브 덤프 `sajumoon_db_2026-04-24.sql`. 기존 mng: [`web/mng/src/pages/Settings.tsx`](../web/mng/src/pages/Settings.tsx), [`PopupLayerList.tsx`](../web/mng/src/pages/PopupLayerList.tsx), [`PopupLayerForm.tsx`](../web/mng/src/pages/PopupLayerForm.tsx).

---

## 개요

이 도메인은 사주플랜1 관리자(sample/adm)의 **사이트 운영 환경 + 정적 운영 콘텐츠** 영역을 다룬다. 그누보드5 표준 시스템(`g5_config`, `g5_menu`, `g5_new_win`, `g5_qa_config`, `g5_shop_banner`) 위에 사주플랜 자체 비즈니스 설정 1개(`saju_config`)와 도메인 특화 콘텐츠 1개(`g5_write_wish` — 소원다락방)가 얹혀 있다.

핵심 관찰:

1. **`g5_config`은 1행짜리 거대 테이블**(140+ 컬럼). 현재 라이브 운영 중이다(`INSERT INTO g5_config` 1행이 있음). 신규에서는 **`setting(namespace, key, value)` EAV 패턴**으로 통합 — 이미 [`0009_popup_settings.sql`](../api/db/migrations/0009_popup_settings.sql)에 시드되어 있고 [`Settings.tsx`](../web/mng/src/pages/Settings.tsx)가 4개 탭(site/member/social/security)으로 구현되어 있음. 즉, **기본 환경설정은 90% 완료 상태**. 남은 일은 mail/cert/qa/saju namespace 추가.
2. **`g5_menu`는 6개 row만 사용 중**(홈/이용안내/공지/고객문의/앱설정 — 라이브 데이터 확인). me_code prefix-2 + suffix-2 의 36진수 트리 구조가 그누보드 식. 신규는 [`site_menu`](../api/db/migrations/0005_cms_system.sql)로 슬림화되어 있으나 **트리 깊이 1이상의 메뉴 관리 UI는 mng에 미구현**.
3. **`g5_new_win`(팝업레이어)** 는 사주플랜 라이브에서 0건 추정(덤프에 INSERT 없음). 그러나 [`PopupLayerList.tsx`](../web/mng/src/pages/PopupLayerList.tsx) + [`PopupLayerForm.tsx`](../web/mng/src/pages/PopupLayerForm.tsx)가 이미 신규 스키마([`popup_notice`](../api/db/migrations/0009_popup_settings.sql))로 작성됨. **누락 필드 거의 없음 — 사주플랜 sample/adm/newwinform.php가 이미 left/top/width/height를 hidden으로 숨겨놓고 image_url/link_url 사용 패턴이라 신규 mng가 사실상 동일 모델**.
4. **`g5_shop_banner`(배너)** 가 이 사이트의 핵심 운영 도구. 라이브에 데이터 있음. **17개 위치(`bn_position`) 한국어 enum**으로 운영 중(메인-비주얼, 메인-상단띠배너, 소원다락방-상단, 사주플랜의길 등). 신규에 [`shop_banner`](../api/db/migrations/0007_shop.sql)가 정의되어 있으나 **mng에 페이지 미구현**. 도메인 09에서 새 React 페이지가 필요.
5. **`saju_config`은 단 3컬럼짜리 사이비-테이블**(cf_now_add, cf_con_num, cf_1) — 메인페이지에 표시될 "가짜 숫자"(접속중 상담사 수 + 보정값)를 저장. 비즈니스적으로 필수 같지만 신규 DB에 별도 테이블/매핑이 **없음**. 클린 빌드 시 `setting` 테이블의 `namespace='saju'`로 흡수 권장.
6. **`g5_qa_config`은 36개 컬럼의 1:1문의 설정 테이블**. 라이브 1행 운영 중. 신규에 별도 매핑 없음. **`setting` 테이블 `namespace='qa'`로 흡수**.
7. **소원다락방(`g5_write_wish`)** 는 게시판이지만 sample/adm에서 **wr_subject/wr_1/wr_2를 "기도기간/진행상태/적립포인트"로 의미를 redefine해서 운영**. 신규 [`post_wish`](../api/db/migrations/0002_board_post.sql)는 표준 게시판 컬럼 + `extras JSONB`로 정의됨 — wr_1/wr_2 의미는 ETL 시 `extras.prayer_total_days`/`extras.prayer_progress_days`/`extras.reward_points`로 매핑 필요. **도메인 04와 중복되므로 도메인 04의 wish 항목 보강만**.

---

## DB 테이블 인벤토리

### 라이브(sample/adm)에서 읽고 쓰는 테이블

| 라이브 테이블 | 행 수 (실제) | 용도 | 신규 매핑 |
|---|---|---|---|
| `g5_config` | 1 | 사이트 전역 환경설정 (140+ 컬럼) | `setting`(namespace+key) — 0005/0009 |
| `g5_menu` | 6 | 사이트 상단 메뉴 정의 | `site_menu` — 0005 |
| `g5_new_win` | 0 (추정) | 팝업레이어 | `popup_notice` — 0005/0009 |
| `g5_shop_banner` | 2+ | 메인/이벤트/상담사 페이지 배너 | `shop_banner` — 0007 (재활용 OK) |
| `g5_qa_config` | 1 | 1:1문의 카테고리/스킨/SMS 설정 | `setting`(namespace='qa') 권장, **신규 미매핑** |
| `saju_config` | 1 | 메인페이지 표시 보정값(접속자/상담건수) | `setting`(namespace='saju') 권장, **신규 미매핑** |
| `g5_write_wish` | n | 소원다락방 게시글 | `post_wish` — 0002 (도메인 04에서 다룸) |
| `g5_member` | r/o | qa_config 저장 시 cf_admin 검증 | `member` |
| `g5_uniqid` / `g5_autosave` / `g5_visit` / `g5_cert_history` | side | config_form.php가 자가-마이그레이션으로 생성 | (이관 불필요 — 신규 DB는 처음부터 정의) |

### sample/adm가 자가-마이그레이션으로 만드는 테이블

`config_form.php`는 1~700+행 동안 `if (!isset($config['cf_xxx'])) { ALTER TABLE g5_config ADD ... }` 패턴이 **수십 개** 박혀있다. 이는 그누보드 표준이지만 **신규는 마이그레이션 파일로 정의 완료, 더 이상 자가 ALTER 금지**.

---

## 파일별 분석

### 1) 기본 환경설정 (`config_form.php`, `config_form_update.php`)

**역할**: 사이트 전역 환경설정 단일 폼. 회원가입 옵션, 본인확인, SMS, 소셜로그인, 메일, 보안 IP, 캡챠, 추가 스크립트 등 **전 영역을 1폼에 우겨넣음**.

**읽는 테이블**: `g5_config` (단일 행 SELECT, `$config` 글로벌로 전체 페이지에서 사용)
**쓰는 테이블**: `g5_config` UPDATE 1건 (140+ 컬럼 동시 갱신)

**입력 파라미터** (`config_form_update.php` 기준 — 발췌):
- `cf_title`, `cf_admin`, `cf_admin_email`, `cf_admin_email_name`
- `cf_add_script`, `cf_add_meta`, `cf_analytics`
- `cf_use_point`, `cf_login_point`, `cf_register_point`, `cf_recommend_point`
- 본인확인: `cf_cert_use`, `cf_cert_ipin`, `cf_cert_hp`, `cf_cert_kcb_cd`, `cf_cert_kcp_cd`, `cf_lg_mid`, `cf_lg_mert_key`
- SMS: `cf_sms_use`, `cf_sms_type`, `cf_icode_id`, `cf_icode_pw`, `cf_icode_server_ip`, `cf_icode_server_port`
- 소셜: `cf_social_login_use`, `cf_naver_clientid`, `cf_naver_secret`, `cf_google_clientid/secret`, `cf_kakao_rest_key`, `cf_kakao_client_secret`, `cf_facebook_appid/secret`, `cf_payco_clientid/secret`, `cf_kakao_js_apikey`
- 캡챠: `cf_captcha`, `cf_recaptcha_site_key`, `cf_recaptcha_secret_key`
- IP 통제: `cf_possible_ip`, `cf_intercept_ip`
- 회원 옵션: `cf_use_homepage/req_homepage`, `cf_use_tel/req_tel`, `cf_use_hp/req_hp`, `cf_use_addr/req_addr`, `cf_register_level`, `cf_leave_day`, `cf_use_recommend`, `cf_nick_modify`
- 메일: `cf_email_use`, `cf_email_wr_*`, `cf_email_mb_*`, `cf_email_po_super_admin`
- 여분필드: `cf_1_subj`~`cf_10_subj`, `cf_1`~`cf_10`
- 사주플랜 추가: `cf_auth_hp`

**검증/권한**:
- `auth_check($auth[$sub_menu], 'w')` — 메뉴 권한
- `if ($is_admin != 'super') alert(...)` — **최고관리자만**
- `check_admin_token()` — CSRF
- `if ($_POST['cf_cert_use'] && !$_POST['cf_cert_ipin'] && !$_POST['cf_cert_hp']) alert(...)` — 본인확인 사용 시 방식 1개 이상 필수

**비즈니스 로직 흐름**:
1. 권한 검사 → CSRF 검사
2. cf_admin(최고관리자 아이디)이 실재 회원인지 검증
3. 본인확인 사용 시 ipin/hp 중 1개 이상
4. cf_social_servicelist 배열 → comma 문자열 변환
5. **140컬럼 단일 UPDATE 쿼리** 실행 — **모든 값 직접 보간(SQL 인젝션 가능)**
6. `goto_url('./config_form.php')`

**외부 의존성**: `_common.php`(전역 부트), `admin.head/tail.php`, `editor` 라이브러리, `get_member()`, KCB/KCP/LG U+ 본인확인 SDK 메타.

**발견된 이슈** (Critical):
- **SQL Injection**: `cf_title='{$_POST['cf_title']}'` 등 모든 컬럼이 `_POST`를 직접 보간. `sql_real_escape_string()` 미적용.
- **자가-마이그레이션**: `config_form.php`가 페이지 로드 시 `g5_config` 스키마를 동적으로 ALTER (cf_admin_email 없으면 ADD, cf_cert_use 없으면 ADD …). 멀티 인스턴스 운영 시 race condition.
- **자가-마이그레이션이 다른 테이블도 손댐**: `g5_member.mb_certify`, `g5_uniqid`, `g5_autosave`, `g5_cert_history`, `g5_visit.vi_browser/vi_os/vi_device` — 페이지 진입만으로 ALTER가 발생.
- **단일 폼에 도메인 7~8개가 섞여**: 한 번의 저장으로 회원/메일/소셜/SMS/IP/스크립트가 동시에 갱신 → 일부만 변경하려는데 다른 컬럼이 빈 값으로 덮어쓸 위험.
- **여분필드 cf_1_subj ~ cf_10_subj** 의미 미상. 라이브 덤프에서도 빈 값.
- **비밀키 평문 노출**: cf_naver_secret, cf_google_secret, cf_kakao_client_secret 등 모든 OAuth secret이 평문 SELECT되어 admin 페이지 HTML에 출력됨.

**운영 사용 여부 추정**: **사용 중 (필수)**. 라이브 덤프에 1행 INSERT 있음. cf_title='사주플랜', cf_admin='admin' 등 실제 값. 단, 다수 옵션은 디폴트 0/공백 — 즉 **실제 사용되는 키는 50% 이하**일 가능성.

---

### 2) 배너 (`bannerform.php`, `bannerlist.php`)

**역할**: 메인/이벤트/상담사 페이지의 운영 배너 등록·수정·목록·삭제. 사주플랜1의 **시각적 운영의 핵심**.

**읽는 테이블**: `g5_shop_banner`
**쓰는 테이블**: `g5_shop_banner` (INSERT/UPDATE/DELETE — 별도 `bannerformupdate.php`. 코드는 본 분석 대상 외)
**파일 시스템**: `G5_DATA_PATH/banner/{bn_id}` — 이미지가 bn_id를 파일명으로 저장(확장자 없음).

**입력 파라미터**:
- `bn_id` (정수, regex `[^0-9]` 제거)
- `bn_alt`, `bn_url`(default `http://`), `bn_position`(enum 17개), `bn_begin_time`, `bn_end_time`, `bn_order`
- `bn_bimg` (file upload), `bn_bimg_del` (삭제 토글)
- `bn_device` (덤프 보면 빈 값 — 사실상 미사용)
- `bn_border`, `bn_new_win` — 폼에 없으나 컬럼 존재

**bn_position enum (17종, 한국어 — 사주플랜 핵심 비즈니스)**:
```
회원가입완료, 메인-비주얼, 메인-상단띠배너, 메인-중앙배너,
로그인-상단띠배너, 마이페이지, 일반-상담후기, 일반-이용안내,
일반-상담사신청, 상담사-코인내역, 상담사-공지사항,
이벤트1, 이벤트2, 이벤트3, 오늘의운세,
소원다락방-상단, 소원다락방-하단, 사주플랜의길
```

각 위치별 권장 이미지 크기는 `bannerform.php` line 81~96에 한국어 help 텍스트로 박혀있음 (예: 메인-비주얼 1000×520, 메인-상단띠배너 1000×80, 사주플랜의길 1000×1100).

**검증/권한**:
- `auth_check_menu($auth, $sub_menu, "w"|"r")` — 그누보드 권한 (sub_menu='350600')
- check_admin_token 등 — bannerformupdate.php에서 (확인 필요. 본 분석 대상 외)
- bn_position을 `in_array` 화이트리스트 체크 (목록 페이지 검색에서)

**비즈니스 로직 흐름** (form):
1. 권한 검사
2. `w='u'`면 SELECT, 아니면 빈 양식
3. **자가-마이그레이션**: `bn_device` 컬럼 없으면 ALTER ADD (line 36-40)
4. 폼 출력. 이미지 미리보기(width 750 cap)

**비즈니스 로직 흐름** (list):
1. GET 파라미터 화이트리스트(`bn_position`, `bn_device`, `bn_time`)
2. count → paging
3. `order by bn_order, bn_id desc`
4. 각 행에 이미지 thumbnail (width 800 cap)

**외부 의존성**: `G5_DATA_PATH/banner/`, `getimagesize()`.

**발견된 이슈**:
- **bn_position이 한국어 문자열 enum** — 데이터베이스 레벨 제약 없음, 코드 곳곳에 같은 17개 한국어 문자열이 중복 산재. 신규는 enum/lookup 테이블 권장.
- **bn_device 자가-마이그레이션** — bn_device 컬럼이 없으면 ALTER 후 `update set bn_device='pc'`로 일괄 셋팅. 라이브 덤프 보면 bn_device=''. **사실상 미사용**.
- **bn_border, bn_new_win 컬럼은 폼에 없음** — list 페이지에서만 표시용. 의미 미상.
- **이미지가 bn_id 파일명**: `/data/banner/124` (확장자 없음). MIME sniff로 처리. 신규는 **확장자 + 객체 스토리지 URL** 권장.

**운영 사용 여부 추정**: **사용 중 (핵심)**. 라이브 덤프에 2행. 하지만 모두 `bn_url='http://'`, `bn_alt=''`로 빈 껍데기 — 실제 운영은 다른 위치에서 이미지 업로드/관리되거나 최근 정리됨. 그래도 위치 매핑 17종은 사주플랜 사이트 IA의 핵심.

---

### 3) 팝업레이어 (`newwinform.php`, `newwinformupdate.php`, `newwinlist.php`)

**역할**: 초기화면 자동 노출 팝업. 그누보드 표준.

**읽는/쓰는 테이블**: `g5_new_win`
- 컬럼: nw_id, nw_division('comm'/'shop'/'both'), nw_device('pc'/'mobile'/'both'), nw_begin_time, nw_end_time, nw_disable_hours, nw_left, nw_top, nw_width, nw_height, nw_subject, nw_content, nw_content_html

**입력 파라미터** (newwinformupdate.php):
- `w` (''/u/d), `nw_id`, `token`
- `check_keys` 화이트리스트로 받음 (clean_xss_tags / int / text 분기)

**검증/권한**:
- `auth_check_menu($auth, $sub_menu, "w"|"r"|"d")`
- `check_demo()`, `check_admin_token()`
- `clean_xss_attributes()` + `strip_tags()` for nw_subject

**비즈니스 로직 흐름**:
1. w='' → INSERT
2. w='u' → UPDATE
3. w='d' → DELETE
4. 자가-마이그레이션: `g5_new_win` 테이블 없으면 CREATE, `g5_shop_new_win`이 있으면 RENAME, `nw_division` 컬럼 ADD

**발견된 이슈**:
- **사주플랜 운영 패턴이 그누보드 기본과 다름**: form에서 `nw_left/nw_top/nw_width/nw_height`를 hidden으로 숨김 + `nw_division`도 hidden. 즉, **위치/크기는 고정, 분류 미사용**. 신규 mng의 [`PopupLayerForm.tsx`](../web/mng/src/pages/PopupLayerForm.tsx)는 위치/크기를 폼에 노출해놨음 → **사주플랜 운영자가 안 쓰는 필드라 단순화 가능**.
- nw_subject는 strip_tags + clean_xss_attributes, 본문은 html_purifier — **본문은 HTML 허용**.

**운영 사용 여부 추정**: **현재 사용 안 함** (라이브 덤프에 INSERT 0건). 그러나 메인 페이지 마케팅 도구로 언제든 살아날 수 있는 기능.

**기존 mng 구현과의 비교**:
- ✅ 신규 [`PopupLayerForm.tsx`](../web/mng/src/pages/PopupLayerForm.tsx)는 **사주플랜 라이브가 안 쓰는 필드까지 다 들어있음** (left/top/width/height, is_html). 추가 누락 필드 없음.
- ✅ image_url, link_url은 신규 신설 필드 (raw 그누보드엔 없음). 사주플랜 운영에 더 적합.
- ⚠️ **Division (comm/shop/both) 필드는 신규 popup_notice에 있으나 mng 폼에 미노출** — 사주플랜 라이브에서도 hidden이라 **불필요. 폼에서 영구 제거 권장**.
- ⚠️ disable_hours 24시간 default OK.

---

### 4) 메뉴 관리 (`menu_form.php`, `menu_form_search.php`, `menu_list.php`, `menu_list_update.php`)

**역할**: 사이트 상단 GNB 메뉴(2depth) 관리.

**읽는/쓰는 테이블**: `g5_menu`
- me_id, me_code(2~4자 36진수, 1depth=2자/2depth=4자), me_name, me_link, me_target('self'/'blank'), me_order, me_use, me_mobile_use

**라이브 데이터** (덤프 6행):
```
홈, 이용안내, 공지사항, 고객문의, 앱설정 (모두 1depth)
```
`me_code` 모두 2자리(10/20/30/40/50) → **현재 2depth 미사용**.

**입력 파라미터/흐름**:
- `menu_form.php`: 새 창 popup. `me_type`(빈/group/board/content) 선택 → AJAX로 `menu_form_search.php` 결과 로드 → 게시판/그룹/콘텐츠 목록에서 클릭 → opener 윈도우의 메뉴 테이블에 row 추가.
- `menu_form_search.php`: type별 SELECT (g5_group/g5_board/g5_content)
- `menu_list.php`: 트리 표시. 1depth 선택 시 "추가" 버튼으로 2depth 추가.
- `menu_list_update.php`: **DELETE 전체 → INSERT 전체**. me_code는 36진수로 자동 부여(MAX+36 후 변환).

**검증/권한**:
- `if ($is_admin != 'super')` — 최고관리자만
- `check_admin_token`
- me_link `javascript:` regex 차단 (XSS)
- `clean_xss_attributes`, `html_purifier`

**발견된 이슈**:
- **DELETE-then-INSERT 전체 갱신** — 동시성 약함. 한 명이 저장 중일 때 다른 사람이 메뉴 보면 빈 페이지.
- **36진수 me_code 트리 인코딩** — 가독성 낮음. 신규 [`site_menu`](../api/db/migrations/0005_cms_system.sql)는 단순 code+display_order 구조라 트리 표현하려면 **parent_id 컬럼 추가가 필요할 수도**(현재 schema에 parent FK 없음).
- **링크가 절대 URL로 박힘**: `http://oiso.ired.gethompy.com/sub/about.php` — 도메인 변경 시 전수 수정 필요.

**운영 사용 여부 추정**: **사용 중 (낮은 빈도)**. 6행 운영 중. 기능적으로는 1~2년에 한 번 건드릴 수준.

---

### 5) 1:1 문의 설정 (`qa_config.php`, `qa_config_update.php`)

**역할**: `g5_write_qa` 게시판의 카테고리/스킨/SMS/이미지 크기/업로드 사이즈 등 운영 옵션.

**읽는/쓰는 테이블**: `g5_qa_config` (1행), `g5_qa_content`(자가-마이그레이션 시 CREATE 만)
- 36개 컬럼. qa_title, qa_category(`이용안내|상담|정산|서비스 상품` — `|` 구분), qa_skin/mobile_skin, qa_use_email/req_email, qa_use_hp/req_hp, qa_use_sms, qa_send_number, qa_admin_hp, qa_admin_email, qa_use_editor, qa_subject_len/mobile_subject_len, qa_page_rows/mobile_page_rows, qa_image_width, qa_upload_size, qa_insert_content(글쓰기 기본 내용), qa_include_head/tail (파일 경로 — 보안 검증 있음), qa_content_head/tail/mobile_*, qa_1_subj~5_subj, qa_1~5

**검증/권한**:
- `auth_check_menu`
- `check_admin_token`
- include_head/tail 변경 시 캡챠(이중 검증)
- `is_include_path_check` — `/data/file/`, `/data/editor/` 차단
- 확장자 php/htm/html만 허용
- qa_category에서 `& =` → 2바이트 변환, 특수문자 제거

**발견된 이슈**:
- **SQLi 가능성**: 마지막 UPDATE 쿼리에서 `_POST` 직접 보간 (qa_title, qa_skin, qa_admin_hp 등). qa_category만 추가 sanitize.
- **include_head/tail 파일 인클루드**: 비록 확장자/경로 화이트리스트가 있으나 **여전히 위험**. PHP 파일을 admin이 임의 경로에서 include 하도록 만드는 패턴 자체가 RCE 표면.
- **qa_subject_len, qa_page_rows 등 숫자 컬럼도 strip_tags만 거치고 SQL 보간** — 정수 캐스팅 미적용.
- **DHTML editor + html_purifier 호출** — 본문은 일정 수준 정화.

**운영 사용 여부 추정**: **사용 중 (저빈도)**. 라이브 덤프에 1행. qa_title='문의하기', qa_category='이용안내|상담|정산|서비스 상품'. SMS/관리자 hp는 비어있음 → **알림 미사용**.

---

### 6) 사주 메인 설정 (`saju_config.php`, `saju_config_update.php`) ★사주플랜1 특화

**역할**: 메인 페이지 표시될 **가상 카운터**(접속중 상담사 수, 일주일 상담건수, 라이브 숫자) 보정값.

**읽는/쓰는 테이블**: `saju_config` (3컬럼, 1행)
- `cf_now_add` (int) — 접속중 상담사 보정값
- `cf_con_num` (int) — 일주일 상담건수 보정값
- `cf_1` (int(2)) — 라이브 숫자 (의미 미상, 임의 필드)

**라이브 값** (덤프): `(100, 257851, 10)`

**입력 파라미터/검증**:
- `_REQUEST` 사용 (POST/GET 무차별)
- `check_demo()`, `check_admin_token()`
- 권한 `w`
- **타입 검증 없음** — 문자열도 그대로 SQL 보간

**비즈니스 로직**:
```php
if ($cf_now_add || $cf_con_num) {
  UPDATE saju_config SET cf_now_add='...', cf_con_num='...', cf_1='...';
}
```

**발견된 이슈** (Critical):
- **SQLi 가능**: `_REQUEST` 직접 보간. 정수 캐스팅 없음.
- **WHERE 절 없는 UPDATE**: 1행 가정이지만, 만약 행이 0건이면 아무 동작 없음(saju_config가 INSERT 로직 부재 — 초기 INSERT는 어디서? **수동 INSERT 의존**).
- **PRIMARY KEY 없음**: `KEY cf_now_add(cf_now_add, cf_con_num)` 인덱스만 있음. 행이 여러 개로 늘어날 가능성.
- **메인 페이지가 가짜 숫자를 표시**: `실건수 + 입력값`이 메인에 표시 — 이는 **운영적 결정**이지만 신규 빌드에서도 동일 정책 유지할지 비즈니스 의사결정 필요.

**운영 사용 여부 추정**: **사용 중 (필수)**. 라이브 덤프 (100, 257851, 10) — 메인 페이지에 즉시 표시되는 값이라 빈도 높음.

---

### 7) 소원다락방 (`wish_list.php`, `wish_list_delete.php`, `wish_list_excel.php`)

**역할**: `g5_write_wish` 게시판의 관리자 측 모니터링/삭제/엑셀 다운로드. 일반 게시판과 분리된 별도 메뉴.

**읽는/쓰는 테이블**: `g5_write_wish`
- wr_id, mb_id, wr_subject, wr_content, wr_datetime, wr_1, wr_2 (이하 wr_3~wr_10 존재하나 미사용 추정)
- **컬럼 의미 redefine** (sample/adm 코드 분석):
  - `wr_subject` → "기도기간(일)" (정수 문자열) — 디폴트 1
  - `wr_1` → "진행상태(일)" (현재까지 경과한 기도 일수)
  - `wr_2` → "적립포인트"

**입력 파라미터** (`wish_list.php`):
- `sfl=mb_id` (회원아이디 검색만 노출), `stx`
- `fr_date`, `to_date` (regex YYYY-MM-DD)
- 정렬 default: `wr_datetime desc`

**검증/권한**:
- `auth_check_menu($auth, $sub_menu, 'r')` (sub_menu='350999')
- delete: `'d'`, excel: `'r'`
- `check_admin_token` (delete만)

**비즈니스 로직 흐름**:
- list: 검색 → 페이징 → 회원이름 join (`get_member`) → 표시
- delete: chk[] 배열 → wr_id별 DELETE
- excel: list 동일 쿼리, header로 xls download

**발견된 이슈**:
- **SQLi**: `$sfl`, `$stx`가 _common.php 글로벌. `$sql_search .= " ({$sfl} like '%{$stx}%') "` — `$sfl`은 default(mb_id)만 polymorphic하게 처리하지만 폼에서 다른 값을 보낼 수 있음 (변수 오염).
- **콜럼 의미가 코드 주석 외에 어디에도 정의되지 않음** — `wr_subject = "기도기간"` 같은 도메인 의미는 PHP 코드 안 if 분기로만 추론 가능. 신규 클린 빌드 시 **`extras` JSONB의 키 명세화 필수**.
- **excel_form은 없고 즉시 다운로드** — sub_menu auth='r'만 체크.

**운영 사용 여부 추정**: **사용 중**. wr_subject/wr_1/wr_2 의미가 사주플랜 비즈니스 로직(소원 기도 카운트다운)에 결합됨. **도메인 04에서 이미 wr_1~10을 extras로 보존하기로 결정**되어 있으므로 ETL 시 의미 매핑 필요.

---

## 발견된 이슈 (종합)

### 보안 Critical
1. **SQL Injection이 거의 모든 update/list 파일에 존재** — `_POST['cf_xxx']` 직접 보간. 특히 `config_form_update.php`, `qa_config_update.php`, `saju_config_update.php`. 신규 NestJS는 ORM/Prepared Statement 강제로 자연 해결.
2. **자가-마이그레이션 ALTER TABLE이 페이지 진입 시 실행** — 멀티 인스턴스/동시 접속 시 race condition. 신규는 마이그레이션 파일로 일괄 관리.
3. **OAuth secret/SMS 비밀번호/KCP 사이트키가 admin 페이지 HTML에 평문 노출** — 신규는 password 타입 input + 서버측 마스킹 응답 권장.
4. **qa_config의 include_head/tail이 임의 PHP 파일 include를 허용** — 신규 빌드 시 **이 기능 자체를 폐기** 권장.

### 운영 Major
5. **`g5_config` 단일 거대 폼이 6+ 도메인을 한 화면에 우겨넣음** — 신규는 이미 [`Settings.tsx`](../web/mng/src/pages/Settings.tsx) 4개 탭으로 분리 (site/member/social/security). **mail/cert/qa/saju/sms namespace 탭 추가 필요**.
6. **`g5_menu`의 36진수 me_code 트리** — 신규 `site_menu`에 parent_id 컬럼 미정의. 2depth 메뉴를 만들려면 스키마 보강 필요. 단, 라이브가 1depth만 운영 중이라 **현재 우선순위 낮음**.
7. **bn_position 한국어 enum 17개**가 PHP 코드/HTML에 하드코딩 산재 — 신규는 lookup 테이블 또는 backend constant 권장.
8. **소원다락방 wr_1/wr_2 컬럼 의미가 비공식 컨벤션** — `extras` JSONB 키 명세 문서화 필수.

### 데이터 Minor
9. **`saju_config`에 PRIMARY KEY 없음** + WHERE 없는 UPDATE — 신규는 `setting` 테이블에 흡수되며 자동 해결.
10. **`g5_shop_banner.bn_device`, `bn_border`, `bn_new_win`이 사실상 미사용** — 신규 `shop_banner.extras`로 이전 또는 컷.

---

## 운영 사용 여부 추정 — 이관 우선순위

| 영역 | 사용 빈도 | 비즈니스 중요도 | 신규 빌드 우선순위 | 비고 |
|---|---|---|---|---|
| 기본 환경설정 (config_form) | 중 | 높음 | **P1** (이미 ~80% 완료) | site/member/social/security 탭 완료. mail/cert/sms 탭 추가 필요 |
| 배너 (banner) | 높음 | **매우 높음** | **P1** | 17개 위치 enum이 사이트 IA의 핵심. 신규 mng 페이지 신설 필요 |
| 팝업레이어 (newwin) | 낮음(현재 0건) | 중 | **P2** (이미 완료) | mng에 이미 구현. division 필드 제거 권장 |
| 메뉴 관리 (menu) | 매우 낮음 | 중 | **P3** | 6행만 운영. 신규 빌드 시 단순 CRUD UI |
| 1:1문의 설정 (qa_config) | 매우 낮음 | 낮음 | **P3** | 1행. 카테고리·skin·SMS만 setting 테이블로 흡수 |
| 사주 메인 설정 (saju_config) | 중 | 높음 | **P1** | 메인 페이지 표시 직결. setting 테이블의 namespace='saju'로 이관 |
| 소원다락방 (wish) | 중 | 중 | **P2** | 도메인 04와 통합 처리. extras JSONB 매핑 명세화 |

---

## 신규 클린 빌드 설계

### A. 기본 환경설정 → `setting` 테이블 매핑표

[`Settings.tsx`](../web/mng/src/pages/Settings.tsx)에 이미 `site/member/social/security` 4개 탭 구현됨. 누락 namespace 추가 필요:

| g5_config 컬럼 | 신규 namespace.key | value_type | 비고 |
|---|---|---|---|
| `cf_title` | `site.title` | string | ✅ 시드 완료 |
| `cf_admin` | `site.admin_login_id` | string | ✅ |
| `cf_admin_email` | `site.admin_email` | string | ✅ |
| `cf_admin_email_name` | `site.admin_email_name` | string | ✅ |
| `cf_add_script` | `site.add_script` | string | ✅ |
| `cf_add_meta` | `site.add_meta` | string | ✅ |
| `cf_analytics` | `site.analytics` | string | ✅ |
| `cf_register_level` | `member.register_level` | int | ✅ |
| `cf_register_point` | `member.register_point` | int | ✅ |
| `cf_login_point` | `member.login_point` | int | ✅ |
| `cf_use_email_certify` | `member.use_email_certify` | bool | ✅ |
| `cf_cut_name` | `member.cut_name` | int | ✅ |
| `cf_nick_modify` | `member.nick_modify` | int | ✅ |
| `cf_leave_day` | `member.leave_day` | int | ✅ |
| `cf_use_recommend` | `member.use_recommend` | bool | ✅ |
| `cf_recommend_point` | `member.recommend_point` | int | ✅ |
| `cf_use_homepage`/`cf_req_homepage` | `member.use_homepage`/`req_homepage` | bool | ✅ |
| `cf_use_tel`/`cf_req_tel`/`cf_use_hp`/`cf_req_hp`/`cf_use_addr`/`cf_req_addr` | `member.*` | bool | ✅ |
| `cf_cert_use`/`cf_cert_ipin`/`cf_cert_hp` | `cert.use`/`use_ipin`/`use_hp` | bool | ✅ |
| `cf_cert_kcb_cd`/`cf_cert_kcp_cd` | `cert.kcb_cd`/`kcp_cd` | string | ✅ |
| `cf_lg_mid`/`cf_lg_mert_key` | `cert.lg_mid`/`lg_mert_key` | string | ✅ |
| `cf_cert_limit` | `cert.limit_days` | int | ✅ |
| `cf_email_use` | `mail.use` | bool | ✅ |
| `cf_email_wr_super_admin`/`wr_board_admin`/`wr_write`/`wr_comment_all` | `mail.wr_*` | bool | ✅ |
| `cf_email_mb_super_admin`/`mb_member`/`po_super_admin` | `mail.mb_*`/`po_super_admin` | bool | ✅ |
| `cf_social_login_use`/`cf_social_servicelist` | `social.use`/`service_list` | bool/string | ✅ |
| `cf_naver_clientid`/`cf_naver_secret` | `social.naver_client_id`/`naver_secret` | string | ✅ |
| `cf_google_clientid`/`cf_google_secret` | `social.google_client_id`/`google_secret` | string | ✅ |
| `cf_kakao_rest_key`/`cf_kakao_client_secret`/`cf_kakao_js_apikey` | `social.kakao_*` | string | ✅ |
| `cf_facebook_appid`/`cf_facebook_secret`/`cf_payco_clientid`/`cf_payco_secret` | `social.*` | string | ✅ |
| `cf_possible_ip`/`cf_intercept_ip` | `security.possible_ip`/`intercept_ip` | string | ✅ |
| `cf_prohibit_id`/`cf_prohibit_email` | `security.prohibit_id`/`prohibit_email` | string | ✅ |
| `cf_captcha`/`cf_recaptcha_site_key`/`cf_recaptcha_secret_key` | `security.use_captcha`/`recaptcha_site_key`/`recaptcha_secret` | bool/string | ✅ |
| `cf_sms_use`/`cf_sms_type`/`cf_icode_id`/`cf_icode_pw`/`cf_icode_server_ip`/`cf_icode_server_port` | `sms.use`/`type`/`icode_id`/`icode_pw`/`server_ip`/`server_port` | bool/string | ❌ **신규 시드 필요** |
| `cf_use_point`/`cf_point_term` | `point.use`/`expire_days` | bool/int | ❌ 도메인 01과 협의 |
| `cf_1_subj`~`cf_10_subj`, `cf_1`~`cf_10` | (제거 권장 — 미사용) | — | 의미 미상, 0건 |
| `cf_auth_hp` | `cert.auth_hp_required` | bool | ❌ 사주플랜 추가 필드 |
| `cf_new_skin/search_skin/...` | (제거) | — | 그누보드 스킨 시스템 폐기 |
| `cf_image_extension/flash_extension/movie_extension` | `upload.allowed_image_ext` 등 | string | (도메인 04와 협의) |
| `cf_open_modify`, `cf_member_icon_*`, `cf_login_minutes` | (필요 시 추가) | — | 미사용 가능성 |

**Settings.tsx 보강 작업**:
- `mail` 탭 신설 — 8개 키
- `cert` 탭 신설 — 8개 키 (KCB/KCP/LG U+ 정보 포함, 비밀키 password 타입)
- `sms` 탭 신설 — 6개 키
- 기존 `social` 탭에 `kakao_js_apikey` 누락 여부 확인 — 이미 있음 ✅

### B. 배너 → `shop_banner` 재활용 + 신규 mng 페이지

**DB**: 추가 마이그레이션 불필요. [`shop_banner`](../api/db/migrations/0007_shop.sql) 그대로 사용. 단, 사용 패턴이 "쇼핑 배너"가 아니라 "사이트 운영 배너"이므로 **테이블 이름을 `site_banner`로 alias 또는 rename 검토** 권장(0007 대비 영향도 낮음).

**enum**: `bn_position` 17종을 backend NestJS 상수 또는 lookup 테이블 `banner_position(code, label, recommended_size)` 신설 권장.
```sql
CREATE TABLE banner_position (
  code VARCHAR(40) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  recommended_size VARCHAR(40),  -- '1000x520'
  display_order INT DEFAULT 0
);
```
시드 17행 + recommended_size를 sample/adm 주석에서 추출.

**신규 mng 페이지**:
- `BannerList.tsx` — 위치별 필터, 진행중/종료 필터, 썸네일 + 위치/시작/종료/순서/조회수 표시
- `BannerForm.tsx` — 위치 select(17개), 이미지 업로드(MIME 검증, 5MB 제한), 시작/종료/순서/링크/alt
- API: `GET /admin/banners`, `POST /admin/banners`, `PATCH /:id`, `DELETE /:id`, `POST /:id/image`

**제거할 sample 필드**: bn_device(미사용), bn_border, bn_new_win(미사용 추정).

### C. 팝업레이어 → 이미 구현됨, 정리 작업만

**DB**: [`popup_notice`](../api/db/migrations/0009_popup_settings.sql) 그대로.

**작업 필요사항** (PopupLayerForm.tsx 보강):
- ✅ image_url, link_url, is_active 모두 구현됨
- ⚠️ `division` 필드는 schema에 있으나 폼에 미노출 — **OK, 그대로 두되 default 'both' 강제**
- ⚠️ `is_html` 폼에 노출되어 있으나 사주플랜 라이브가 안 쓴 컬럼 — **그대로 두기**
- ✅ disable_hours, pos_left/top, size_width/height 모두 구현
- 누락 없음.

### D. 메뉴 → `site_menu` 활용

**DB 보강 필요**: 0005의 `site_menu`에 **parent_id 컬럼 추가**(2depth 지원). 또는 me_code prefix 패턴(2자 + 2자) 유지하되 트리 렌더는 `LEFT(code, 2)`로 그룹핑.

```sql
ALTER TABLE site_menu ADD COLUMN parent_id BIGINT REFERENCES site_menu(id) ON DELETE CASCADE;
CREATE INDEX idx_site_menu_parent ON site_menu (parent_id, display_order);
```

**신규 mng 페이지**:
- `MenuList.tsx` — 트리(parent_id 기준), 드래그-앤-드롭 정렬, +서브메뉴 버튼, PC/모바일 토글
- `MenuForm.tsx` — 신규/수정 모달. name/link/target/use_pc/use_mobile/order
- 게시판 선택은 별도 picker 컴포넌트(`board` 테이블에서 select)

**API**: 단일 PUT /admin/menus (전체 트리 트랜잭션 갱신) 또는 row 단위 PATCH 권장. sample의 DELETE-then-INSERT는 폐기.

**라이브 6행 ETL**: `me_code` 2자리 그대로 → `code` 컬럼. parent_id 모두 NULL.

### E. 1:1 문의 설정 → `setting` namespace='qa'

**DB 매핑** (g5_qa_config 36컬럼 → setting):

| g5_qa_config | setting.key (namespace='qa') | value_type |
|---|---|---|
| qa_title | title | string |
| qa_category | category_pipe | string (`이용안내|상담|...` 그대로) |
| qa_use_email/req_email/use_hp/req_hp | use_email/req_email/use_hp/req_hp | bool |
| qa_use_sms | use_sms | bool |
| qa_send_number | sms_send_number | string |
| qa_admin_hp/qa_admin_email | admin_hp/admin_email | string |
| qa_use_editor | use_editor | bool |
| qa_subject_len/mobile_subject_len | subject_len/mobile_subject_len | int |
| qa_page_rows/mobile_page_rows | page_rows/mobile_page_rows | int |
| qa_image_width | image_width | int |
| qa_upload_size | upload_size | int |
| qa_insert_content | insert_content | string |
| qa_content_head/tail/mobile_* | content_head/tail/mobile_head/mobile_tail | string |
| qa_1_subj~5_subj, qa_1~5 | (제거 — 미사용) | — |
| qa_skin/mobile_skin/include_head/include_tail | (제거 — 그누보드 스킨/PHP include 시스템 폐기) | — |

**Settings.tsx에 qa 탭 추가** 또는 별도 `QnaSettings.tsx` 페이지. 별도 페이지가 깔끔.

**확장**: `faq_category`/`faq` 테이블이 별도 도메인. 해당 영역은 도메인 04 또는 별도 정리.

### F. 사주 메인 설정 → `setting` namespace='saju' (★사주플랜 핵심)

**DB 마이그레이션 추가 필요** (0009 또는 별도):
```sql
INSERT INTO setting (namespace, key, value, value_type, description) VALUES
  ('saju', 'main_active_counselor_offset', '100', 'int',  '메인 표시: 접속중 상담사 보정값 (실숫자 + 이 값)'),
  ('saju', 'main_weekly_consult_offset',   '257851', 'int', '메인 표시: 일주일 상담건수 보정값'),
  ('saju', 'main_live_offset',             '10', 'int',  '메인 표시: 라이브 숫자 보정값 (cf_1)')
ON CONFLICT (namespace, key) DO NOTHING;
```

**신규 mng 페이지**: `SajuMainSettings.tsx` 또는 `Settings.tsx`에 'saju' 탭 추가.
- 3개 input + 안내 문구("실제 카운트 + 보정값이 메인에 표시됩니다. 운영적 결정 사항.")

**API**: `GET/PATCH /admin/settings` 기존 핸들러로 처리 가능.

**ETL**: saju_config 1행 (100, 257851, 10) → setting 3개 row.

### G. 소원다락방 → 도메인 04 통합 (보강만)

[`post_wish`](../api/db/migrations/0002_board_post.sql) 사용. 별도 mng 페이지 `WishList.tsx` 신설(도메인 04에서 정의):

**필수 컬럼 매핑** (sample/adm/wish_list.php의 의미 redefine):
- `wr_subject` → `extras.prayer_total_days` (int) — 기도기간(일)
- `wr_1` → `extras.prayer_progress_days` (int) — 진행상태(일)
- `wr_2` → `extras.reward_points` (int) — 적립포인트
- 나머지 wr_3~wr_10 → 의미 미상, `extras` 그대로 보존

**WishList.tsx 요구사항**:
- 검색: 회원아이디, 작성일 범위
- 컬럼: 작성일/아이디/이름/내용/기도기간/진행상태/적립포인트/이동버튼
- 액션: 다중 선택 삭제, 엑셀 다운로드(server-side stream)

**도메인 04 보강 항목**:
- post_wish 추가 컬럼 또는 extras 키 명세화 문서 추가
- 표준 게시판 list/edit과 별개로 `WishMonitor.tsx` 신설(관리자가 기도 진행률을 모니터링하는 워크플로우)

---

## ETL 매핑 (라이브 → 신규)

| 출처 | 행 수(예상) | 대상 | 변환 규칙 |
|---|---|---|---|
| `g5_config` (1행, 140컬럼) | 1 | `setting` (~70 row) | namespace+key별 row 풀어쓰기. value_type별 포맷팅. NULL 값은 빈 문자열 |
| `g5_menu` (6행) | 6 | `site_menu` | me_id→me_id, me_code→code, 도메인 부분 제거(`http://oiso...`) |
| `g5_new_win` (0행) | 0 | `popup_notice` | n/a |
| `g5_shop_banner` (2+행) | 2+ | `shop_banner` | bn_id 보존, image_url에 `/uploads/banner/{bn_id}` 매핑 후 파일 마이그레이션 |
| `g5_qa_config` (1행) | 1 | `setting` (~20 row, namespace='qa') | qa_xxx → 키 매핑표(E절) |
| `saju_config` (1행) | 1 | `setting` (3 row, namespace='saju') | F절 |
| `g5_write_wish` (n행) | n | `post_wish` | 도메인 04 ETL과 통합. wr_subject/wr_1/wr_2를 extras 키로 변환 |

**파일 시스템 ETL**:
- `/data/banner/{bn_id}` (확장자 없음) → `/uploads/banner/{bn_id}.{ext}` (file 명령어로 MIME 추정 → 확장자 결정)

---

## 새 페이지/엔드포인트 요약

| 페이지 | 경로 | 우선순위 | 신규 여부 |
|---|---|---|---|
| Settings (탭 보강) | `/settings` | P1 | 기존 (mail/cert/sms/qa/saju 탭 추가) |
| BannerList | `/banners` | P1 | **신규** |
| BannerForm | `/banners/:id` | P1 | **신규** |
| PopupLayerList/Form | `/popup-layers` | P2 | 기존 (수정 거의 없음) |
| MenuList | `/menus` | P3 | **신규** |
| WishList (소원다락방) | `/wish` | P2 | **신규** (도메인 04 통합) |
| (선택) QnaSettings | `/settings/qa` | P3 | 신규 또는 Settings 탭 |
| (선택) FaqAdmin | `/faqs`, `/faq-categories` | P3 | 도메인 04에서 |

| API | 메서드 | 우선순위 |
|---|---|---|
| `/admin/settings` (탭별 namespace) | GET/PATCH | P1 (구현됨) |
| `/admin/banners` | GET/POST | P1 |
| `/admin/banners/:id` | PATCH/DELETE | P1 |
| `/admin/banners/:id/image` | POST (multipart) | P1 |
| `/admin/banner-positions` | GET (lookup) | P1 |
| `/admin/popup-layers` | GET/POST/PATCH/DELETE | P2 (구현됨) |
| `/admin/menus` | GET/PUT (트리 일괄) | P3 |
| `/admin/wish` | GET (도메인 04와 통합) | P2 |
| `/admin/wish/excel` | GET | P2 |
| `/admin/wish/:wr_id` | DELETE | P2 |

---

## 마무리 권장사항

1. **배너 페이지 신설을 P1으로 진행** — 라이브 운영 의존도가 가장 높고 mng에 미구현. 17개 위치 lookup 테이블 + Settings.tsx 패턴(namespace 탭) 안 가는 단순 CRUD 페이지로 충분.
2. **Settings.tsx 탭 5개 추가**(mail/cert/sms/qa/saju) — 기존 컴포넌트 재활용. setting 시드 마이그레이션 (예: `0014_settings_seed_extra.sql`) 1개 추가하면 끝.
3. **사주 메인 설정은 setting 흡수 후 비즈니스에 한 번 더 확인**: "실숫자 + 보정값" 노출 정책을 신규에서도 유지할지 결정.
4. **자가-마이그레이션 패턴 전면 폐기**: sample/adm의 `if (!isset($config['cf_xxx'])) { ALTER TABLE ... }`는 신규 NestJS 코드에 절대 들어가면 안 됨. 마이그레이션은 `api/db/migrations/`에서만.
5. **OAuth/SMS 비밀키는 환경변수로 분리 검토**: kakao secret, naver secret 등 운영 비밀은 `setting` 테이블이 아니라 `.env` + `process.env`로 두는 것이 표준. 혹은 setting.value를 어플리케이션 레벨 암호화. 클린 빌드 시점에 결정 필요.
6. **소원다락방 wr_1/wr_2 의미를 README/스키마 주석에 명시**: 신규 `post_wish.extras` JSONB 키 표를 도메인 04 문서에 보강.
