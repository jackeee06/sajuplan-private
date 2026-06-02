# 도메인 05: 알림(메일/푸시/알림톡)

> read-only 분석. `sample/adm` 코드는 미수정.
> 분석 시점: 2026-04-29.
> 담당 파일:
> - **메일**: `mail_form.php`, `mail_list.php`, `mail_preview.php`, `mail_select_form.php`, `mail_select_list.php`, `mail_select_update.php`, `mail_test.php`, `mail_update.php`, `mail_delete.php`
> - **푸시**: `push_list.php`, `push_update.php`, `push_delete.php`
> - **알림톡**: `alimtalk/_common.php`, `alimtalk/tpl_msg_form.php`, `alimtalk/tpl_msg_form_update.php`, `alimtalk/tpl_msg_list.php`, `alimtalk/tpl_msg_list_delete.php`, `alimtalk/tpl_msg_list_update.php`
> 보조 분석: `lib/mailer.lib.php`, `android_push/send_fcm.php`, `plugin/wz_alimtalk_bizm/{config.php, bizmsg.class.php}`, 그리고 `bbs/register_form_update.php`, `bbs/password_lost2.php`, `bbs/ajax_send.php`, `cron/aligo_send_all.php`, `cron/counselor_abse.php` 등 호출 측.
> ⚠️ `sample/adm/sms_admin/` 폴더는 라이브 미사용으로 확인되어 분석에서 제외.

---

## 개요

알림 도메인은 **사용자에게 메시지를 도달시키는 3가지 채널**을 모은 영역이다.

1. **회원메일** — 그누보드 표준 메일발송. 관리자가 HTML 본문을 작성해 회원 필터(권한·메일링동의·게시판그룹)에 매칭되는 사람들에게 PHPMailer로 일괄 발송. 운영 가치는 매우 낮음(이벤트 메일 정도).
2. **푸시 알림** — Firebase FCM(V1 API). 안드로이드/iOS 앱 회원에게 토픽(`chl_all`, `chl_2`, `chl_5`) 단위로 발송. 관리자 화면은 "전체공지/일반회원/상담사" 3종 푸시를 보내는 구조. 라이브에서 적극 사용.
3. **알림톡** — 카카오 비즈엠(BizM, alimtalk-api.bizmsg.kr) 사업자 통해 발송. 관리자는 템플릿 마스터를 직접 등록하지 않고(이미 비즈엠에 등록·검수 완료된 템플릿 코드를 입력만), 시스템 이벤트(`회원가입 축하`/`회원정보찾기`/`회원가입 인증`/`상담사 접속 알림`/`입금계좌 안내`/`입금확인`/`상담사 자동 부재중 전환`/`채팅 상담방 개설`)에 어떤 템플릿을 묶을지를 정하는 **이벤트→템플릿 바인딩**이 본질. 라이브에서 적극 사용 중(특히 회원가입 인증·비밀번호 찾기·부재중 전환).

핵심 위험은 다음 3가지.

- **푸시 발송 엔드포인트(`push_update.php`)에 `check_admin_token()`이 주석 처리됨** — CSRF 토큰 미검증 상태로 운영 중. 또한 `$_REQUEST` 사용으로 GET 변수까지 받아 수십초 안에 모든 회원 단말에 임의 푸시를 쏠 수 있는 취약점이 노출되어 있다.
- **메일 발송 흐름이 동기/단일 프로세스** — `mail_select_update.php`가 회원 N명을 즉시 for문으로 SMTP 호출하며 화면에 progress를 출력. usleep 200μs 사이로 cnt별로 반복. 1만건이면 브라우저가 수십분간 매달려있어야 한다.
- **알림톡 템플릿 등록 화면의 SQL이 escape 없음** — `tpl_msg_form_update.php`의 `at_button_name[]`/`at_button_url_1[]` 등 배열 입력값을 그대로 SQL 문자열에 합치고 있어 SQL injection 가능.

---

## 외부 시스템 연동

### 메일 — PHPMailer + SMTP

- 라이브러리: `lib/mailer.lib.php` (`mailer()` 함수)
- 백엔드: `G5_SMTP` 정의 시 SMTP, 미정의 시 PHP `mail()`
- 발신자: `cf_admin_email_name`/`cf_admin_email` (관리자 환경설정 값)
- 수신거부 링크: `bbs/email_stop.php?mb_id={mb_id}&mb_md5=md5(mb_id+mb_email+mb_datetime)` 자동 첨부
- **사업자 정보 없음** (자체 SMTP 서버 또는 호스팅 메일 사용 추정)

### 푸시 — Firebase Cloud Messaging V1

- 엔드포인트: `https://fcm.googleapis.com/v1/projects/sajummon-5a4c0/messages:send`
- 프로젝트 ID: `sajummon-5a4c0`
- 인증: 서비스 계정 JSON `lib/sajummon_push_key.json` + Google API Client Library (`google/apiclient`)를 통한 Bearer 토큰
- 함수: `send_noti_token($token, ...)` (1:1) / `send_noti_topic($topic, ...)` (1:N) — `android_push/send_fcm.php`
- 토픽 매핑 (관리자 발송 시): `gubun=10 → chl_all`, `gubun=2 → chl_2`(일반회원), `gubun=5 → chl_5`(상담사)
- 토큰 저장: 라이브는 `tbl_android_phone(t_android_id, t_phone, t_mb_id, gubun)` (gubun=1 안드로이드, 2 iOS)
- 호환: 라이브에 V1과 함께 구버전 `sendPushNotification()`이 남아있지만 push_update.php는 V1 토픽 방식만 사용

### 알림톡 — 비즈엠(BizM)

- 사업자: **(주)비즈엠** (https://www.bizmsg.kr) — 카카오 알림톡/친구톡 통합 발송 게이트웨이
- 엔드포인트: `https://alimtalk-api.bizmsg.kr/v2/sender/send` (POST, JSON 배열)
- 인증: HTTP 헤더 `userId: {WZ_ALIMT_USERID}` + body `profile: {WZ_ALIMT_PROFILE_KEY}`
- **라이브 자격증명** (`plugin/wz_alimtalk_bizm/config.php`):
  - `WZ_ALIMT_USERID = 'sajumoon9'`
  - `WZ_ALIMT_PROFILE_KEY = 'b3df311d547feab530438c34276c9c9d15025df3'` (옐로아이디 발신 프로필 키)
  - 이전 키 `thesaju` / `3c5c7d8ee78eed6fbd4d7dd9b5d7433cb6230cb4`는 주석 처리되어 보존됨
- 발송 클래스: `bizmsg.class.php` (294줄)
  - 템플릿 ID는 비즈엠에서 사전 검수된 코드만 사용 가능
  - 발송 실패 시 자동 SMS/LMS 전환 가능 (smsKind, msgSms, smsSender, smsLmsTit)
  - 메서드: `send()` (단건), `send_muti(array $list)` (대량 100건/회 배치)
  - 호출 패턴: `$at_type` 문자열로 이벤트를 지정하면 내부에서 `g5_alimtalk_tplsel`→`g5_alimtalk_tplmsg` 순으로 조회해 템플릿 코드/메시지/버튼을 채움
- 치환 변수: `#{이름}`, `#{택배회사}`, `#{운송장번호}`, `#{입금액}`, `#{입금계좌}`, `#{주문번호}`, `#{주문금액}` 외 클래스 내 `csr_name`, `allow_num`, `im_password`, `con_name` 등 다수
- 버튼 타입(최대 5개): DS(배송조회), WL(웹링크), AL(앱링크), BK(봇키워드), MD(메시지전달)

### 알림톡 cron 발송

- `cron/aligo_send_all.php`: `aligo_send_all_t` 테이블에 set_type='1', send_status='N' 작업을 100건씩 잘라 `bizmsg::send_muti()`로 대량 발송. 매니저가 사전에 적재한 알림 작업을 큐 식으로 처리.
- `cron/counselor_abse.php`: 일정시간 응답없는 상담사를 자동 부재중 전환하면서 본인에게 `'상담사 자동 부재중 전환'` 알림톡 발송.

---

## DB 테이블 인벤토리

### 라이브 (g5/legacy)

| 테이블 | 역할 | 주요 컬럼 |
|---|---|---|
| `g5_mail` | 메일 본문 마스터 (관리자가 작성한 템플릿) | ma_id, ma_subject, ma_content, ma_time, ma_ip, ma_last_option (수신자 선택 옵션 저장 — `key=value\|\|key=value` 직렬화) |
| `g5_member` | 메일 수신자 풀 (mb_email, mb_mailling, mb_level, mb_leave_date, mb_intercept_date) | — |
| `g5_group_member` | 게시판 그룹 회원 필터에 사용 | gr_id, mb_id |
| `member_push` | 푸시 발송 이력 (1행/발송) — **이름이 헷갈리지만 토큰이 아닌 발송 히스토리** | idx, title, id (대상 mb_id 또는 'all'), url, content, code, reg_ip, gubun, regdate |
| `tbl_android_phone` | 디바이스 토큰 저장 — FCM 직접 발송 시 사용 | t_phone, t_android_id (FCM 토큰), t_mb_id, gubun(1=AND/2=iOS), t_status, t_wdate |
| `g5_alimtalk_tplmsg` | 알림톡 템플릿 마스터 (비즈엠 등록된 코드 매핑) | at_id, at_tplcode, at_subject, at_msg, at_btn_name, at_btn_url, at_button1~5_{name,type,url_1,url_2} |
| `g5_alimtalk_tplsel` | 이벤트→템플릿 바인딩 | as_id, at_id (FK), at_type (이벤트 한국어 라벨) |
| `aligo_send_all_t` | 알림톡 대량발송 큐 (cron 처리) | idx, aligo_subject(=at_type), aligo_data(json: 수신자 배열), set_type, send_status, send_wdate |

### 신규 (이미 마이그레이션 정의됨)

| 신규 테이블 | 출처 | 비고 |
|---|---|---|
| `email_send_log` (0005_cms_system.sql) | `g5_mail` | ma_last_option은 `options JSONB`로 정규화. 단, **현 라이브에서 g5_mail은 "발송 이력"이 아니라 "메일 본문 마스터"** 임. 마이그레이션 주석은 정정 필요. |
| `member_push_token` (0001_member.sql) | `tbl_android_phone` | platform(android/ios/web), token, member_id FK |
| `notification_log` (0001_member.sql) | `member_push` | viewed_by JSONB(`is_view` 콤마구분 → 배열), category(=gubun), code(=code) |
| `alimtalk_template` (0006) | `g5_alimtalk_tplmsg` | at_button1~5의 25개 컬럼을 `buttons JSONB`로 정규화 |
| `alimtalk_event_binding` (0006) | `g5_alimtalk_tplsel` | event_type(=at_type) |

### 누락 — **신규 마이그레이션 필요**

| 신규 테이블 (제안) | 출처 | 비고 |
|---|---|---|
| `email_template` | `g5_mail` (본문) | 0005의 `email_send_log`는 발송 이력 모델이지만 **g5_mail은 본문 마스터** 다. 본문 보관용 별도 테이블 필요. |
| `email_recipient_filter_log` | `ma_last_option` | 마지막 발송 필터 보관용 (선택 — 본문 테이블 한 컬럼 JSONB로 처리해도 됨) |
| `alimtalk_send_queue` | `aligo_send_all_t` | 대량발송 큐 (cron 처리) |
| `alimtalk_send_log` | (신규) | 라이브에는 없음 — 비즈엠 응답·실패 이력 보관 권장 |

---

## 파일별 분석

### 메일

#### 1) `mail_form.php` (메일 본문 작성/수정 폼)

- **역할**: 메일 본문 마스터(g5_mail) 1건의 작성·수정 화면
- **HTTP/엔드포인트**: GET `mail_form.php?w=u&ma_id=N` (수정) / `mail_form.php` (신규)
- **읽기**: `g5_mail (where ma_id=$ma_id)`
- **쓰기**: 없음 (POST는 `mail_update.php`)
- **입력**: ma_id (int)
- **출력**: ma_subject, ma_content (HTML editor), 치환변수 도움말(`{이름}`, `{닉네임}`, `{회원아이디}`, `{이메일}`)
- **로직**: w=u이면 row 로드 후 표시, 아니면 빈 폼
- **이슈**: 없음(상대적으로 안전)

#### 2) `mail_list.php` (메일 본문 목록)

- **역할**: 작성된 메일 목록과 액션 링크(테스트/보내기/미리보기/삭제)
- **HTTP**: GET `mail_list.php`
- **읽기**: `g5_mail order by ma_id desc` (전체 — **페이지네이션 없음**)
- **출력**: ma_id, ma_subject, ma_time, 액션 링크 5종
- **이슈**:
  - 페이지네이션 없음. 메일이 누적되면 1페이지에 다 뿌림.
  - "수신자가 동의하지 않은 대량 메일 발송에는 적합하지 않습니다. 수십건 단위로 발송해 주십시오." 라는 경고 — 자체 시스템 한계 인정

#### 3) `mail_preview.php` (메일 미리보기)

- **역할**: ma_id의 본문을 HTML로 그대로 렌더링
- **HTTP**: GET/POST `mail_preview.php?ma_id=N` (`$_REQUEST`)
- **읽기**: `g5_mail where ma_id=$ma_id`
- **로직**: `conv_content()`로 텍스트 변환 + 수신거부 안내 더미 링크
- **이슈**: ma_id는 (int) 캐스팅됨 — 안전

#### 4) `mail_select_form.php` (수신자 필터 선택 폼)

- **역할**: 발송 대상 회원 필터 입력 화면
- **HTTP**: GET `mail_select_form.php?ma_id=N`
- **읽기**:
  - `g5_member` 전체수 / 탈퇴대기수
  - `g5_group` (게시판 그룹 옵션)
  - `g5_mail.ma_last_option` 파싱(이전 발송 옵션 복원)
- **입력 필터**: mb_id 구간(전체/구간), mb_email 부분일치, mb_mailling(수신동의여부), mb_level 구간, gr_id(게시판그룹)
- **이슈**:
  - `ma_last_option`을 **`extract`처럼 `$$var = $option[1]`로 동적변수 생성** — `extract()` 류 위험성. 임의 PHP 변수 오버라이드 가능. 단, 옵션값을 관리자 본인이 등록하므로 자체 공격 시나리오만.
  - `cf_email_use` 미체크 시 alert로 차단 — OK

#### 5) `mail_select_list.php` (필터된 수신자 미리보기)

- **역할**: 필터 결과 미리보기 + ma_list(파이프 구분 문자열) 생성해 hidden textarea로 발송 화면에 전달
- **HTTP**: POST `mail_select_form.php` → `mail_select_list.php`
- **읽기**: `g5_member` (필터 SQL)
- **쓰기**: `g5_mail.ma_last_option` 업데이트(다음번 폼 prefill용)
- **출력**: 수신자 표 + textarea name="ma_list" (각 줄 `email||mb_id||name||nick||mb_datetime`)
- **이슈**:
  - **SQL injection 명백** — `$mb_id1_from`, `$mb_id1_to`, `$mb_email`, `$gr_id`, `$mb_level_from/to`, `$mb_mailling` 모두 escape 없이 SQL에 합쳐짐. (form_input은 `clean_xss_tags`만 수행 — XSS는 막아도 SQL은 안 막음.)
  - `ma_last_option`도 같은 값으로 update 문에 직삽입.

#### 6) `mail_select_update.php` (실제 메일 발송)

- **역할**: ma_list로 받은 수신자에게 1명씩 SMTP 발송
- **HTTP**: POST `mail_select_list.php` → `mail_select_update.php`
- **로직 (의사코드)**:
  ```
  ma_list = explode("\n", $_POST['ma_list'])
  ma = select g5_mail where ma_id=$ma_id
  for each member in ma_list:
    parse "email||mb_id||name||nick||datetime"
    if email regex match:
      content = ma_content with {이름}/{닉네임}/{회원아이디}/{이메일} 치환
      content += 수신거부 링크 (md5 token)
      mailer($cf_admin_email_name, $cf_admin_email, $email, $subject, $content, html=1)
      echo cnt 진행상황 (브라우저 progress 출력)
      usleep(200μs)
  ```
- **이슈**:
  - **동기 발송 + 브라우저 progress** — 1만건 발송 시 수십분 hang. 중단되면 어디까지 보냈는지 추적 불가.
  - **send_log 미저장** — 누구에게 갔는지 DB에 안 남음.
  - SMTP 실패 처리 없음. mailer() 반환값 확인 안 함.
  - `ma_list`를 클라이언트가 보유 후 POST → 클라이언트가 임의 이메일 추가 가능(XSS/관리자권한 우회 시 임의 발송 도구로 악용 가능).

#### 7) `mail_test.php` (관리자 본인에게 테스트 발송)

- **역할**: 로그인한 관리자 이메일로 즉시 테스트 발송
- **HTTP**: GET/POST `mail_test.php?ma_id=N`
- **로직**: g5_mail 본문 + 관리자 본인 정보로 치환 → mailer() 1회 호출 → alert
- **이슈**: 관리자 정보가 `$member` 글로벌이라 단일 발송이라 비교적 안전

#### 8) `mail_update.php` (저장/수정/삭제 처리)

- **역할**: w=''/u/d 분기 — insert/update/delete to g5_mail
- **HTTP**: POST `mail_update.php`
- **이슈**:
  - **HTML purifier가 없는 raw insert** — `ma_content = '{$ma_content}'`. SQL injection 가능. 또한 ma_subject도 `strip_tags(clean_xss_attributes())`만 수행 후 quote 없이 삽입.
  - check_admin_token()/check_demo() OK.

#### 9) `mail_delete.php` (다중 삭제)

- **역할**: chk[]로 여러 ma_id 일괄 삭제
- **HTTP**: POST `mail_delete.php`
- **이슈**: $ma_id (int) 캐스팅됨 — 상대적으로 안전

### 푸시

#### 10) `push_list.php` (푸시 발송 이력 + 작성 폼)

- **역할**: `member_push` 이력 페이징 조회 + 새 푸시 작성 폼 (전체공지/일반회원/상담사 3종)
- **HTTP**: GET `push_list.php?gubun=10|2|5&sfl=&stx=`
- **읽기**: `member_push` 검색·페이징
- **출력**: 일시/제목/대상id/url 표 + 입력 폼
- **이슈**:
  - **SQL injection** — `$sfl`, `$stx`, `$gubun`, `$sst`, `$sod` 모두 escape 없이 합쳐짐.
  - HTTPS 분기로 다음맵 JS 로드(주소검색용 — 푸시 화면엔 불필요한 잔재).

#### 11) `push_update.php` (FCM 토픽 발송 + 이력 저장)

- **역할**: 폼 입력 받아 FCM 토픽으로 푸시 + member_push에 1행 insert
- **HTTP**: POST `push_update.php` (현재는 `$_REQUEST`라 GET도 동작)
- **로직**:
  ```
  title = $_REQUEST["title"]
  url   = $_REQUEST["url"]
  gubun = $_REQUEST["gubun"] ?: '10'
  topic = {10:'chl_all', 5:'chl_5', 2:'chl_2'}[gubun]
  send_noti_topic(topic, title, message, 'alim_notice', '', '', url)  // FCM V1
  insert into member_push(title, id='all', url, content, code='alim_notice', reg_ip, gubun, regdate=now())
  redirect to push_list.php
  ```
- **🚨 심각한 이슈**:
  - `auth_check($auth[$sub_menu], 'w')` **주석 처리됨**. is_admin='super' 만 검증.
  - `check_admin_token()` **주석 처리됨** — **CSRF 무방비**.
  - `$_REQUEST` 사용 — GET 링크 한 줄로 전체 회원에게 푸시 발송 가능.
  - title/url **escape 없음** → SQL injection.
  - send_noti_topic 결과를 var_dump으로 출력 (디버그 코드 잔재 — `send_fcm.php` 279줄).

#### 12) `push_delete.php` (이력 다중 삭제)

- **역할**: chk[]로 idx 받아 member_push 다중 삭제
- **HTTP**: POST `push_delete.php`
- **이슈**: $idx (int) 캐스팅 OK. $kind는 사용 안 됨에도 sql_real_escape 적용.

### 알림톡

#### 13) `alimtalk/_common.php`

- **역할**: 공통 부트스트랩. plugin/wz_alimtalk_bizm/config.php 로드해 USERID/PROFILE_KEY 정의
- **이슈**: 자격증명을 PHP 상수로 코드에 하드코딩. 환경변수/시크릿 매니저 미사용.

#### 14) `tpl_msg_form.php` (템플릿 등록·수정 폼)

- **역할**: g5_alimtalk_tplmsg 1건 입력 화면. 비즈엠에 사전 등록된 템플릿 코드를 입력하면 시스템에서도 그 코드로 발송하도록 함
- **HTTP**: GET `tpl_msg_form.php?w=u&at_id=N`
- **읽기**: `g5_alimtalk_tplmsg where at_id=$at_id` (수정 시)
- **출력**: at_tplcode, at_subject, at_msg, 버튼 5개 (DS/WL/AL/BK/MD)
- **이슈**: `$at_id`가 GET에서 그대로 SQL에 들어감 (register_globals 의존). `(int)` 캐스팅 없음.

#### 15) `tpl_msg_form_update.php` (템플릿 저장 처리)

- **역할**: w='' insert / w='u' update — at_button1~5 25개 컬럼을 한 줄로 동적 생성
- **HTTP**: POST `tpl_msg_form_update.php`
- **로직**:
  ```
  loop button rows ($_POST['at_button_type']):
    sql_common .= ", at_button{j}_name='{name}', at_button{j}_type='{type}', at_button{j}_url_1='{url1}', at_button{j}_url_2='{url2}'"
  if w='':
    insert ... at_tplcode='$at_tplcode', at_subject, at_msg {sql_common}
  if w='u':
    update tplmsg set at_button1~5 = '' where at_id  (먼저 초기화)
    update set at_tplcode='$at_tplcode', ... {sql_common} where at_id
  ```
- **🚨 이슈**:
  - **SQL injection 명백** — `$_POST['at_button_name'][$z]`, `$_POST['at_button_url_1'][$z]`, `$_POST['at_button_url_2'][$z]`, `$at_tplcode`, `$at_subject`, `$at_msg` 모두 escape 없이 SQL 문자열에 합쳐짐.
  - `$at_button_type` 값 검증 없음(허용된 5종 외 값 들어가도 그대로 저장).
  - update 시 두 번 쿼리(초기화 + 갱신) — 트랜잭션 미사용.
  - `at_btn_name`, `at_btn_url`(legacy 단일 버튼)은 폼에 input이 없는데 update SQL엔 넣고 있음 — 미정의 변수 → "" 저장.

#### 16) `tpl_msg_list.php` (템플릿 목록 + 이벤트 바인딩)

- **역할**: 두 가지를 한 화면에서 처리.
  1. 템플릿 검색·목록 표시 + 등록/삭제 링크
  2. **이벤트→템플릿 바인딩 폼** (회원가입 축하/회원정보찾기/회원가입 인증/상담사 접속 알림/입금계좌 안내/입금확인/상담사 자동 부재중 전환/채팅 상담방 개설 8종)
- **HTTP**: GET `tpl_msg_list.php`
- **DB 자가 마이그레이션 (DDL on 첫 접속!)**: `if(!sql_query("DESCRIBE..."))` 패턴으로 테이블 자동 생성 + 시드 5건 + ALTER 25개 컬럼 추가. **운영 코드에서 DDL을 실행** — 라이브 위험.
- **이슈**:
  - `$stx`/`$sfl`/`$sst`/`$sod` SQL injection.
  - 이벤트 라벨이 한글 문자열 비교라 트랜잭션 없으면 race condition.
  - 8개 select 박스를 위해 `$cnt_sel`개 옵션 × 8회 nested loop로 select 쿼리를 매번 재실행 — N×8 쿼리.

#### 17) `tpl_msg_list_delete.php` (템플릿 다중 삭제)

- **역할**: chk[]로 at_id 다중 삭제
- **이슈**: `$_POST['at_id'][$k]`를 escape 없이 SQL에 — SQL injection 가능. 관련 g5_alimtalk_tplsel는 ON DELETE CASCADE 미설정으로 고아 row 남음.

#### 18) `tpl_msg_list_update.php` (이벤트 바인딩 적용)

- **역할**: 8개 이벤트 라벨에 대해 select된 at_id를 g5_alimtalk_tplsel에 upsert
- **로직**: 각 이벤트 라벨마다 select→insert/update 분기 (8개 동일 패턴 반복) — DRY 위반
- **이슈**: SQL injection. 이벤트 라벨 하드코딩 → 새 이벤트 추가 시 PHP 코드 수정 필요(현재 2025-07-29에 2개 추가된 흔적).

---

## 발견된 이슈 (전체)

### 보안

1. **푸시 발송 인증/CSRF 무방비** (`push_update.php`) — `auth_check`, `check_admin_token` 모두 주석. is_admin='super' 검증만. **GET 한 줄로 전체 회원 푸시 발송 가능.** 💀
2. **SQL injection 광범위** — mail_select_list, mail_update, push_list, push_update, tpl_msg_form, tpl_msg_form_update, tpl_msg_list, tpl_msg_list_delete, tpl_msg_list_update 모두 escape 누락.
3. **알림톡 비즈엠 자격증명 하드코딩** — `plugin/wz_alimtalk_bizm/config.php`에 평문 저장. 시크릿 매니저로 이동 필요.
4. **이전 자격증명이 주석 처리만 됨** (`thesaju` 키) — 키 회전 정책 부재.
5. **메일 수신자 ma_list가 클라이언트 hidden textarea를 통해 POST** — 임의 이메일 추가 가능.
6. **`mail_select_form.php`의 동적변수 생성** (`$$var = $option[1]`) — extract 류 위험.

### 안정성·성능

7. **메일 발송이 동기 + 브라우저 progress** — 대량 발송 시 hang/중단 위험. 큐/워커로 분리 필요.
8. **메일 발송 로그 미저장** — 누구에게 갔는지 추적 불가.
9. **`tpl_msg_list.php`의 자가 DDL** — 운영 코드가 ALTER/CREATE 실행. 라이브 위험.
10. **`tpl_msg_list.php`의 N×8 쿼리** — 8개 select option마다 sql_fetch 반복.
11. **알림톡 cron 큐(`aligo_send_all_t`)에 status 인덱스 없음** — 행수 늘면 풀 스캔.
12. **FCM 발송 결과 `var_dump`** (`send_fcm.php:279`) — 디버그 코드 운영 잔재.
13. **g5_mail 페이지네이션 없음** (`mail_list.php`) — 행수 누적 시 메모리 압박.

### 코드 품질

14. `mail_select_update.php`의 인라인 `<script>` document.all 사용 — IE 시절 코드. 모바일/현대 브라우저에서는 동작 불확실.
15. 이벤트 바인딩 라벨이 한글 문자열로 직접 비교됨 — 다국어/오타 위험. (회원가입 축하/회원가입 인증 같이 띄어쓰기 차이만 있는 키 다수)
16. `bizmsg.class.php`의 public 속성 60+개 — 매개변수 전달 인터페이스가 평면적이고 타입 미정의.
17. push 화면에 daum 주소 JS 로드 같은 잔재.

### 데이터 무결성

18. `g5_alimtalk_tplmsg` ↔ `g5_alimtalk_tplsel` FK 없음 (CASCADE 없음). 템플릿 삭제 시 바인딩 고아.
19. `member_push.is_view` longtext 콤마 구분 (확인 mb_id 누적) — 0001_member.sql JSONB로 정규화 예정.
20. `tbl_android_phone`의 t_status='Y/N'과 gubun(1/2)이 별개 — 토큰 무효 처리 정책 명확치 않음.

---

## 운영 사용 여부 추정 — 이관 우선순위

| 메뉴 | 라이브 사용 추정 | 신규 mng 이관 권장 | 근거 |
|---|---|---|---|
| **메일 — 본문 마스터(g5_mail)** | 가끔 | **보류 (Lite 이관)** | 화면은 있으나 운영팀이 알림톡으로 이관해 사용 빈도 낮음 추정. `mail_list.php`의 페이지네이션 미존재 + 100% 동기 발송이 사실상 마비된 상태 시사. 단 이벤트 메일/뉴스레터 차원에서 보존 필요. |
| **메일 — 대량 발송(mail_select_*)** | 거의 미사용 | **컷 또는 큐 기반으로 재설계** | 동기 발송 + 진행 progress + 미보존 → 라이브에서 적극 사용했다면 이미 사고가 났을 패턴. 큐 기반 새 설계 권장. |
| **푸시 — 발송 폼(push_list/update)** | **적극 사용** | **이관 필수** (보안 수정과 함께) | gubun=10/2/5 토픽 발송이 사주플랜 운영에서 공지/이벤트 푸시의 핵심. 라이브 코드에 'alim_notice' 코드까지 박혀있음. **CSRF/인증 결손은 즉시 보완**. |
| **푸시 — 이력 조회** | 적극 사용 | 이관 필수 | 같은 화면에서 발송과 이력 함께. |
| **알림톡 — 템플릿 관리** | **적극 사용** | **이관 필수** | bizmsg 자격증명이 라이브, `register_form_update.php`/`password_lost2.php`/`ajax_send.php`/`counselor_abse.php`/`aligo_send_all.php` 등 5개 이상 호출 지점 확인. 회원가입/상담사 부재중/대량발송 모두 운영 중. |
| **알림톡 — 이벤트 바인딩** | **적극 사용** | **이관 필수** | 8개 이벤트 라벨 매핑이 핵심. 2025-07-29에도 신규 라벨 2개 추가된 흔적. |

> **결론**: sms_admin과 달리 **알림톡과 푸시는 적극 사용 중**. 메일은 미온적. **이관 우선순위 = 푸시(보안 수정) > 알림톡 > 메일(Lite)**.

---

## web/mng 이관 설계

### NestJS API 설계

#### 모듈 구조

```
api/src/admin/notification/
├── notification.module.ts
├── email/
│   ├── email-template.controller.ts
│   ├── email-template.service.ts
│   ├── email-send.controller.ts            # 큐 기반 발송 트리거만
│   ├── email-send.service.ts
│   └── dto/
├── push/
│   ├── push.controller.ts
│   ├── push.service.ts                     # FcmService 의존
│   └── dto/
└── alimtalk/
    ├── alimtalk-template.controller.ts
    ├── alimtalk-template.service.ts
    ├── alimtalk-binding.controller.ts      # 이벤트→템플릿 바인딩
    ├── alimtalk-binding.service.ts
    └── dto/
```

#### 공통 인프라

```
api/src/shared/
├── fcm/
│   ├── fcm.service.ts                      # send_noti_topic / send_noti_token 대응
│   └── fcm.config.ts                       # service-account JSON 경로 환경변수
├── bizmsg/
│   ├── bizmsg.service.ts                   # bizmsg.class.php 대응 — 단건/대량
│   ├── bizmsg.types.ts                     # button DS/WL/AL/BK/MD 유니온
│   └── bizmsg.config.ts                    # USERID, PROFILE_KEY 환경변수
└── mailer/
    ├── mailer.service.ts                   # nodemailer or @nestjs-modules/mailer
    └── mailer.config.ts
```

비즈엠/FCM 자격증명은 `.env` + `ConfigService`로 옮기고, secrets 회전 가능한 구조로.

#### 엔드포인트 설계 (전부 `AdminAuthGuard` 부착)

##### 메일

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/admin/notification/email/templates` | 템플릿 목록 (페이징) |
| GET | `/admin/notification/email/templates/:id` | 템플릿 상세 |
| POST | `/admin/notification/email/templates` | 신규 |
| PUT | `/admin/notification/email/templates/:id` | 수정 |
| DELETE | `/admin/notification/email/templates` | 다중 삭제 (`{ids: number[]}`) |
| POST | `/admin/notification/email/templates/:id/test` | 관리자 본인에게 테스트 발송 |
| POST | `/admin/notification/email/templates/:id/preview` | 본문 HTML 반환 |
| POST | `/admin/notification/email/send` | 대량 발송 큐잉 (`{templateId, filter}`). **동기 발송 폐지**. BullMQ/RabbitMQ 워커로 위임 |
| GET | `/admin/notification/email/send/jobs` | 큐 상태 조회 |
| GET | `/admin/notification/email/logs` | 발송 이력 |

##### 푸시

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/admin/notification/push/logs` | 발송 이력(검색·페이징·gubun 필터) |
| POST | `/admin/notification/push/send` | 토픽 발송 (`{audience: 'all'\|'general'\|'counselor', title, url}`) |
| DELETE | `/admin/notification/push/logs` | 이력 다중 삭제 |

##### 알림톡

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/admin/notification/alimtalk/templates` | 목록(페이징) |
| GET | `/admin/notification/alimtalk/templates/:id` | 상세 |
| POST | `/admin/notification/alimtalk/templates` | 신규 (template_code 유니크 검증) |
| PUT | `/admin/notification/alimtalk/templates/:id` | 수정 (buttons JSONB) |
| DELETE | `/admin/notification/alimtalk/templates` | 다중 삭제 |
| GET | `/admin/notification/alimtalk/bindings` | 이벤트→템플릿 매핑 전체 조회 |
| PUT | `/admin/notification/alimtalk/bindings` | 이벤트별 매핑 일괄 저장 (`{bindings: [{eventType, templateId}]}`) |
| GET | `/admin/notification/alimtalk/event-types` | 사용 가능 이벤트 라벨 목록 (DB 또는 enum 상수) |

#### 전송 내부 흐름

- **메일**: `EmailSendController.send` → BullMQ `email-send` 큐로 enqueue → 워커가 PHPMailer 대신 `MailerService`로 회원 1명씩 transactional 발송 → `email_send_log`에 행 누적
- **푸시**: `PushController.send` → `FcmService.sendTopic(topic)` → 응답 받자마자 `notification_log` 1행 insert. 비동기 대용량 푸시는 토픽 단위라 별도 큐 불필요(FCM이 fan-out 담당).
- **알림톡**: `BizmsgService.send(eventType, recipientPhone, vars)`가 호출되면 `alimtalk_event_binding`에서 `template_id` 조회 → `alimtalk_template`에서 `template_code/message/buttons` 조회 → 비즈엠 v2 API POST. 결과는 `alimtalk_send_log` (신규 테이블)에 기록.
- **알림톡 대량(cron)**: `aligo_send_all_t` 큐 테이블을 `alimtalk_send_queue`로 옮기고 NestJS의 `@Cron` 또는 BullMQ scheduled job으로 처리.

### React 페이지 설계

```
web/mng/src/pages/notification/
├── EmailTemplateList.tsx
├── EmailTemplateForm.tsx           # SunEditor or TipTap (HTML editor)
├── EmailSendPage.tsx               # 필터 → 미리보기 → 큐잉 → 진행상황 polling
├── EmailSendJobs.tsx
├── EmailLogList.tsx
│
├── PushList.tsx                    # 이력 + 작성 폼 한 화면 (라이브 UX 유지)
├── PushHistoryFilter.tsx
│
├── AlimtalkTemplateList.tsx
├── AlimtalkTemplateForm.tsx        # buttons row repeater (max 5)
├── AlimtalkBindingPage.tsx         # 8 + N개 이벤트 라벨 select 박스
└── AlimtalkSendLogList.tsx         # 신규 (라이브엔 없는 기능)
```

UI 가이드:
- 메일 발송 화면은 **즉시 발송 버튼을 제거하고 "발송 예약" 버튼 1개만**. 큐잉 후 별도 모달로 작업 ID 안내.
- 푸시는 audience `select` + `title` + `url` 3필드 — 라이브와 동일한 단순한 UX 유지.
- 알림톡 buttons는 `useFieldArray`로 동적 행 추가/삭제. type별 url1/url2 라벨이 동적으로 바뀜.

### 신규 DB 마이그레이션 필요 여부

| 항목 | 마이그레이션 |
|---|---|
| `alimtalk_template`, `alimtalk_event_binding` | **이미 존재** (0006). 사용. |
| `notification_log` | **이미 존재** (0001). 푸시 이력에 사용. |
| `member_push_token` | **이미 존재** (0001). 토큰 저장에 사용. |
| `email_send_log` | **이미 존재** (0005). 단, 주석상 "발송 이력"이지만 실제 g5_mail은 "본문 마스터" — 이름과 컬럼 재정리 필요. |
| `email_template` | **신규 필요** — g5_mail의 본문 측면 보존. `email_send_log`와 분리. |
| `alimtalk_send_queue` | **신규 필요** — `aligo_send_all_t` 대응. 컬럼: `id, event_type, recipients JSONB, status, scheduled_at, started_at, finished_at, error_text` |
| `alimtalk_send_log` | **신규 권장** — bizmsg 응답/실패 추적용. 컬럼: `id, template_id, event_type, recipient_phone, mb_id, member_id, status, response_code, response_body, sent_at` |

→ **새 마이그레이션 0013(또는 후속)이 필요**. `email_template`, `alimtalk_send_queue`, `alimtalk_send_log` 추가.

---

## ETL 매핑

### 메일

| 라이브 컬럼 | 신규 컬럼 | 변환 |
|---|---|---|
| `g5_mail.ma_id` | `email_template.legacy_ma_id` (또는 `email_send_log.ma_id`) | 그대로 |
| `g5_mail.ma_subject` | `email_template.subject` | 그대로 |
| `g5_mail.ma_content` | `email_template.body_html` | HTML 검사·정화 후 보존. `{이름}/{닉네임}/{회원아이디}/{이메일}` 토큰은 그대로 유지(런타임 치환). |
| `g5_mail.ma_time` | `email_template.created_at` | as-is |
| `g5_mail.ma_ip` | `email_template.created_ip` | TEXT → INET |
| `g5_mail.ma_last_option` | `email_template.last_filter JSONB` | `key=value\|\|key=value` 문자열 → JSONB 객체로 파싱 |

> 신규 `email_template` 테이블이 추가되면 위처럼. `email_send_log`(0005)는 본문 마스터 → 발송 이력으로 재정의 필요.

### 푸시

| 라이브 컬럼 | 신규 컬럼 | 변환 |
|---|---|---|
| `member_push.idx` | `notification_log.id` 또는 legacy 컬럼 | as-is |
| `member_push.title` | `notification_log.title` | |
| `member_push.id` (mb_id) | `notification_log.mb_id` + `notification_log.member_id` | 'all' 이면 NULL, 그 외엔 mb_id 매칭 후 member.id로 join |
| `member_push.url` | `notification_log.link_url` | 'none' → NULL |
| `member_push.content` | `notification_log.content` | |
| `member_push.code` | `notification_log.code` | 'alim_notice' 등 |
| `member_push.gubun` | `notification_log.category` | 10→'all', 2→'general', 5→'counselor' (문자열 권장) |
| `member_push.reg_ip` | `notification_log.reg_ip` | INET |
| `member_push.regdate` | `notification_log.created_at` | |
| `member_push.is_view` (longtext, 콤마구분) | `notification_log.viewed_by` JSONB | `explode(',')` → JSON array |
| `tbl_android_phone.t_phone` | `member_push_token.device_phone` | 그대로 |
| `tbl_android_phone.t_android_id` | `member_push_token.token` | FCM 토큰 그대로 |
| `tbl_android_phone.t_mb_id` | `member_push_token.mb_id` (legacy) + `member_id` | mb_id 매칭 |
| `tbl_android_phone.gubun` | `member_push_token.platform` | 1→'android', 2→'ios' |
| `tbl_android_phone.t_status` | `member_push_token.is_active` | Y/N → boolean |
| `tbl_android_phone.t_wdate` | `member_push_token.created_at` | |

### 알림톡

| 라이브 컬럼 | 신규 컬럼 | 변환 |
|---|---|---|
| `g5_alimtalk_tplmsg.at_id` | `alimtalk_template.at_id` (legacy) + `id` (BIGSERIAL) | |
| `at_tplcode` | `template_code` | UNIQUE 검증 |
| `at_subject` | `subject` | |
| `at_msg` | `message` | `#{이름}` 등 토큰 보존 |
| `at_btn_name` | `primary_btn_name` | |
| `at_btn_url` | `primary_btn_url` | |
| `at_button1~5_*` (25컬럼) | `buttons JSONB` | `[{name,type,url1,url2}, ...]`로 압축. 빈 행 제외 |
| `g5_alimtalk_tplsel.as_id` | `alimtalk_event_binding.as_id` (legacy) | |
| `g5_alimtalk_tplsel.at_id` | `alimtalk_event_binding.template_id` | FK lookup |
| `g5_alimtalk_tplsel.at_type` (한글 라벨) | `alimtalk_event_binding.event_type` | 한글 그대로 보존하거나 enum 코드로 변환 (`signup`/`find_password`/`signup_auth`/`counselor_login`/`bank_info`/`payment_done`/`counselor_auto_absent`/`chatroom_open`) |
| `aligo_send_all_t.aligo_subject` | `alimtalk_send_queue.event_type` | 한글 → enum |
| `aligo_send_all_t.aligo_data` | `alimtalk_send_queue.recipients` | JSON parse |
| `aligo_send_all_t.set_type` | (제거 가능) | 항상 '1'만 사용됨 |
| `aligo_send_all_t.send_status` | `alimtalk_send_queue.status` | N/Y → 'pending'/'done' |
| `aligo_send_all_t.send_wdate` | `alimtalk_send_queue.finished_at` | |

### 운영 설정

- 비즈엠 자격증명(WZ_ALIMT_USERID, WZ_ALIMT_PROFILE_KEY): `.env`로 이동 → `BIZMSG_USER_ID`, `BIZMSG_PROFILE_KEY`
- FCM 서비스계정 JSON 경로: `lib/sajummon_push_key.json` → `FCM_SERVICE_ACCOUNT_PATH` 또는 JSON content를 `FCM_SERVICE_ACCOUNT_JSON`(base64)로
- SMTP 호스트/포트/계정: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`

---

## 우선순위 요약

1. **즉시(보안)**: `push_update.php` 인증/CSRF 결손 — 라이브 핫픽스 또는 mng 이관 시 최우선.
2. **단기(이관)**: 푸시(전체 이관) → 알림톡(전체 이관) → 메일(Lite 이관).
3. **중기(설계)**: 메일 발송 큐 분리, 알림톡 send_log 신규 테이블, 이벤트 라벨 enum화.
4. **장기**: 비즈엠 키 회전 정책, 발송 메트릭 대시보드, 푸시 토큰 무효화 자동 처리.
