# 도메인 04: 게시판/콘텐츠

> **분석 범위**: `sample/adm/`의 게시판·게시판그룹·콘텐츠·FAQ·투표·서비스·기타(history_list, write_count, tour_link) 관련 PHP 39개 (백업 제외).
> **분석 원칙**: read-only. sample 코드는 읽기만 함. 결과는 `web/mng` 신규 빌드를 위한 설계 입력.
> **참고**: 신규 DB 스키마 [`api/db/migrations/0002_board_post.sql`](../api/db/migrations/0002_board_post.sql), 라이브 DB 덤프 `sajumoon_db_2026-04-24.sql`.

---

## 개요

사주플랜1의 라이브 관리자(`sample/adm`)는 그누보드5(영카트5) 표준 구조를 그대로 사용한다. 게시판 관리는 **모든 게시판의 메타정보를 단일 테이블 `g5_board`(95개 컬럼)에 저장**, 글은 **게시판 슬러그별 별도 물리 테이블 `g5_write_<bo_table>`을 동적으로 CREATE/DROP**하는 모델이다.

신규 mng는 이 구조를 그대로 베끼지 않고:
1. **게시판은 슬림화** — `board` 테이블 ~20컬럼만 유지. skin/include_head 등 그누보드 전용 옵션 90% 제거.
2. **글 테이블은 그대로 도메인별 분리** — `post_counselor`, `post_fortune`, ... `post_qa` (총 18~19개). 동적 CREATE TABLE 폐기, 마이그레이션으로 정의된 정적 스키마.
3. **wr_1~wr_10 의미 미상 컬럼은 JSONB(`extras`)로** 보존 — 일부 의미 매핑된 것(specialty/traits/bio 등)만 정규 컬럼화.
4. **댓글/첨부/좋아요/신고/스크랩은 polymorphic** `(board_slug, post_id)` 페어로 단일 테이블화.
5. **그누보드의 "테이블 동적 ALTER로 자가 마이그레이션" 패턴 전면 폐기** — sample/adm 곳곳에 박혀 있는 `if (!isset($board['bo_xxx'])) { ALTER TABLE ... }`은 데이터베이스 신뢰성과 멀티 인스턴스 운영에 치명적임.

---

## 게시판 구조 (사주플랜의 18~19개 독립 게시판)

라이브 DB의 `g5_board.bo_table` 실제 슬러그 (덤프 추출):

| bo_table (legacy) | board.slug (신규) | 신규 post_* 테이블 | 용도 |
|---|---|---|---|
| `counselor` | `counselor` | `post_counselor` | 상담사 프로필 ★핵심 |
| `fortune` | `fortune` | `post_fortune` | 운세 콘텐츠 |
| `charm` | `charm` | `post_charm` | 부적/부신 |
| `wish` | `wish` | `post_wish` | 소원 |
| `wish_event` | `wish_event` | `post_wish_event` | 소원 이벤트 |
| `column` | `column` | `post_column` | 컬럼/조언 |
| `notice` | `notice` | `post_notice` | 공지사항 (사용자) |
| `event` | `event` | `post_event` | 이벤트 |
| `review` | `review` | `post_review` | 후기/리뷰 |
| `qa` | `qa` | `post_qa` | Q&A |
| `apply` | `apply` | `post_apply` | 상담사 신청 |
| `chat_room` | `chat_room` | `post_chat_room` | 채팅방 소개 |
| `c_benefits` | `c_benefits` | `post_benefit`* | 상담사 혜택 안내 |
| `c_history` | `c_history` | `post_history`* | 상담사 활동 이력 |
| `c_tip` | `c_tip` | `post_tip`* | 상담사 팁 |
| `c_notice` | `c_notice` | `post_c_notice` | 상담사 공지 |
| `c_faq` | `c_faq` | `post_c_faq` | 상담사 FAQ |
| `new` | `new` | `post_new` | 새글 모음(?) — 의미 재검토 필요 |
| `way` | `way` | (미정의) | "way" 용도 불명. 신규 마이그레이션에 누락 |
| `revew` *(오타)* | — | — | 라이브 오타. 폐기 후보 |

> **\* 마이그레이션 0002의 명명 불일치 확인 필요**: `post_benefit` vs g5 `c_benefits`, `post_history` vs `c_history`, `post_tip` vs `c_tip`. ETL 시 슬러그 매핑 표 명시할 것.
> **way 게시판 누락**: `0002_board_post.sql`에 `post_way` 정의가 없다. 라이브 운영에서 'way' 용도 확인 후 추가하거나 컷 결정 필요.
> **`revew`**: 'review'의 오타로 추정. ETL 단계에서 review로 합치거나 제거.

---

## DB 테이블 인벤토리 (sample/adm 코드가 건드리는 g5 테이블)

| g5 테이블 | 용도 | 신규 매핑 |
|---|---|---|
| `g5_board` | 게시판 메타 (95컬럼) | `board` (슬림 ~20컬럼) |
| `g5_group` | 게시판 그룹 | `board_group` |
| `g5_group_member` | 그룹 접근가능 회원 | `board_group_member` |
| `g5_write_<bo_table>` (동적) | 글+댓글 (wr_is_comment 플래그 혼재) | `post_<slug>` + `post_comment` |
| `g5_board_file` | 첨부파일 (polymorphic by bo_table) | `post_file` |
| `g5_board_good` | 좋아요/싫어요 | `post_like` |
| `g5_board_singo` | 신고 | `post_report` |
| `g5_board_new` | 새글 인덱스(전체 검색용 캐시) | (제거) — 인덱스+쿼리로 대체 |
| `g5_scrap` | 스크랩 | `post_scrap` |
| `g5_autosave` | 자동저장 | `post_autosave` |
| `g5_content` | CMS 페이지(회사소개·약관 등) | (별도 도메인 — 0005 cms?) |
| `g5_faq_master` | FAQ 카테고리 | (CMS와 통합 검토) |
| `g5_faq` | FAQ 항목 | (CMS와 통합 검토) |
| `g5_poll` | 투표 | (제거 권장 — 미사용) |
| `g5_poll_etc` | 투표 기타의견 | (제거 권장) |

---

## 파일별 분석

### A. 게시판 본체 (board)

#### A-1. `board_list.php` (237줄)

1. **역할**: g5_board 게시판 목록 조회 + 인라인 일괄 수정 폼.
2. **HTTP**: GET (조회). POST → `board_list_update.php`.
3. **DB 읽기**: `g5_board a`, `g5_group b` (super 아닐 시 join).
4. **입력**: `sfl`(검색컬럼), `stx`(검색어), `sst`/`sod`(정렬), `page`.
5. **출력**: 게시판 행. 각 행 인라인 입력(스킨/포인트/순서 등).
6. **흐름**: 권한별 super는 모든 게시판, 그룹 관리자는 본인 그룹만 → 페이징 SELECT → 행마다 `board_form.php?w=u` 링크와 `board_copy.php` 팝업 링크.
7. **외부 의존**: `auth_check_menu`, `get_group_select`, `get_skin_select`, `get_mobile_skin_select`.
8. **이슈**:
   - **SQL 인젝션**: `$sfl`/`$stx`를 그대로 LIKE에 보간 (이스케이프 없음).
   - **권한 체크**: `auth_check_menu($auth, $sub_menu, 'r')` 1번만. 검색 파라미터 검증 없음.
   - 인라인 일괄 수정으로 1요청 N개 게시판 update — 부분 실패 시 트랜잭션 없음.
9. **운영 사용 추정**: 사용. 게시판 권한·포인트 일괄 조정의 표준 진입점.
10. **이관**: `GET /admin/boards`. 인라인 수정은 나란히 `PATCH /admin/boards/:slug` 멀티 호출 또는 `PATCH /admin/boards/bulk`로 단일 트랜잭션화.

#### A-2. `board_form.php` (1491줄, 78KB)

1. **역할**: 게시판 1개 생성/수정 거대 폼. 6 섹션(기본/권한/기능/디자인/포인트/여분필드).
2. **HTTP**: GET. action=`board_form_update.php`.
3. **DB**: `g5_board`, `g5_group`. 페이지 진입 시 **수십 개의 `if (!isset($board['bo_xxx'])) ALTER TABLE ...`** 자가 스키마 마이그레이션을 매 요청마다 시도(line 21~85).
4. **입력**: `w`(빈/`u`), `bo_table`, `gr_id` 등 100+개.
5. **흐름**: 신규(`w=''`)는 기본값 채움 + bo_count_* 1로 셋. 수정(`w='u'`)은 select. group 관리자는 본인 그룹만.
6. **이슈**:
   - **자가 ALTER TABLE 수십 개** — 성능, 멀티 인스턴스, 마이그레이션 추적성에 치명적.
   - **78KB 모놀리식 폼** — 95컬럼 영카트 옵션 대부분(skin, include_head, sideview, RSS, 공지, captcha 등) 사주플랜에선 미사용.
   - 본인확인(`bo_use_cert`), SNS 공유(`bo_use_sns`), 캡차 (`bo_use_captcha`) 등 사주플랜 운영에서 안 쓰는 옵션 다수.
7. **운영 사용 추정**: 부분 사용. 게시판 추가/제목 수정/포인트 수정 등 상위 5~10개 옵션만 실사용 추정. 디자인 옵션(스킨/갤러리/list_view/include_head)은 사주플랜 SSR 페이지엔 무관.
8. **이관**:
   - 신규 mng는 **단일 페이지 분해** → 4 섹션 카드: 기본/권한/카테고리/포인트.
   - 신규 board 테이블 컬럼 한정(0002 마이그레이션의 ~20개)으로 입력 폼 축소.
   - 자가 ALTER 코드 0건(스키마 변경은 마이그레이션으로만).

#### A-3. `board_form_update.php` (534줄)

1. **역할**: board_form.php 폼 처리 (insert/update + 그룹/전체 일괄 적용).
2. **HTTP**: POST.
3. **DB**: `g5_board` insert/update. 신규는 `sql_write.sql` 템플릿 읽어 **`CREATE TABLE g5_write_<bo_table>` 동적 생성**(line 276~287).
4. **입력**: 100여 개 컬럼. extras `bo_1`~`bo_10` 포함.
5. **흐름**:
   - 권한 체크 + CSRF 토큰.
   - bo_include_head/tail 확장자/경로 제한 검증.
   - sql_common 거대 문자열 조립 → insert/update.
   - **글 카운트 보정**: `proc_count` 체크 시 wr_comment 재계산.
   - **그룹 적용/전체 적용** (`chk_grp_*`/`chk_all_*` 체크박스 → 60+ 필드 일괄 update).
   - **공지글 실재 검증**: bo_notice 콤마 분리 후 각 wr_id 존재 여부 select(N+1 쿼리).
6. **이슈**:
   - **거대 SQL 문자열 보간** — 모든 입력값 `{$bo_xxx}`로 직접 삽입. 일부만 sql_real_escape_string. **SQL 인젝션 가능성 다수**.
   - 동적 `CREATE TABLE` — 신규 mng는 게시판 추가 ≠ 새 테이블 생성. 마이그레이션으로만 게시판 추가.
   - 트랜잭션 없음 — board insert 성공 후 g5_write_* 생성 실패 시 정합성 깨짐.
   - "그룹 적용/전체 적용" 60+ chk_* 분기는 운영 UX 가치 대비 코드 복잡도 과다.
7. **운영 사용 추정**: 일부 사용. 게시판 추가는 **이미 18~19개로 고정되어 신규 추가가 잦지 않음**. 전체적용/그룹적용 체크박스는 거의 안 누름 추정.
8. **이관**: `POST /admin/boards`, `PATCH /admin/boards/:slug`. 신규 게시판은 마이그레이션이 우선이고 mng UI에선 비활성화 또는 "기존 18개만 수정 가능" UX. "그룹 적용/전체 적용"은 컷.

#### A-4. `board_list_update.php` (96줄)

1. **역할**: board_list.php의 인라인 일괄 수정/삭제 처리.
2. **DB**: `g5_board` update; 삭제 시 `board_delete.inc.php` include.
3. **이슈**:
   - 권한 체크는 super인지만 보고 super 아니면 그룹 관리자인지 SELECT로 확인 — 문자열 보간 SQL.
   - sql_real_escape_string 일부만 적용.
   - 삭제는 super만 가능 (정책 OK).
4. **운영**: 사용.
5. **이관**: `PATCH /admin/boards/bulk`, `DELETE /admin/boards/bulk` 단일 트랜잭션.

#### A-5. `board_delete.inc.php` (34줄)

1. **역할**: 게시판 1개 삭제 (글·댓글 테이블 DROP 포함). `_BOARD_DELETE_` 상수로 직접 호출 차단.
2. **DB**: g5_board, g5_board_new, g5_scrap, g5_board_file, **`DROP TABLE g5_write_<bo_table>`**, g5_board_good 모두 delete.
3. **추가**: `rm_rf(G5_DATA_PATH/file/<bo_table>)` 게시판 첨부 파일 폴더 삭제.
4. **이슈**:
   - **DROP TABLE은 회복 불가** — 신규는 soft delete(`board.is_active=false`) + 별도 아카이브 절차 권장.
   - 트랜잭션 없음. DROP 실패 시 다른 delete만 적용되는 부분 실패.
5. **이관**: `DELETE /admin/boards/:slug`는 `is_active=false`로. 진짜 영구 삭제는 별도 운영 도구.

#### A-6. `board_copy.php` (84줄) + `board_copy_update.php` (223줄)

1. **역할**: 기존 게시판을 다른 슬러그로 복제 (구조만 / 구조+데이터).
2. **DB**: `get_table_define()` SHOW CREATE → 새 테이블 생성, g5_board 행 복사, file 폴더 복사, 글·첨부 select-insert.
3. **이슈**:
   - **`addslashes`만 일부 사용** — 안전하지 않음.
   - 같은 데이터베이스 안에서만 동작하는 SHOW CREATE TABLE 의존 — Postgres 이관 시 그대로 못 씀.
   - 트랜잭션 없음. 글 복사 중 실패 시 partial.
   - 디렉토리 복사가 파일 시스템 의존.
4. **운영**: **거의 미사용 추정**. 사주플랜 운영팀이 게시판을 복제하는 시나리오는 사실상 없음(슬러그 18개 고정).
5. **이관**: **컷 권장**. 신규 mng에서 제공하지 않음. 필요 시 운영 DBA가 직접 SQL.

#### A-7. `board_excel.php` / `board_excel_form.php` / `board_excel_update.php` (85+62+175줄)

1. **역할**: 엑셀(.xls 97-2003)로 게시판 글 일괄 업로드. 운세(`fortune_sample.xls`), 후기(`review_sample.xls`) 샘플 제공.
2. **DB**: g5_write_<bo_table> 행마다 insert + g5_board_new insert + bo_count_write +1.
3. **흐름**: 엑셀 row 3부터 시작, 빈 줄 skip. 컬럼 27개 매핑(ca_name, wr_subject, wr_content, mb_id, ..., wr_1~wr_10).
4. **이슈**:
   - **wr_2 비어있으면 12~15분 사이 랜덤 시간으로 자동 채움**(line 80~83) — 오늘의운세/후기 데이터의 "재생시간" 컬럼을 가짜로 채우는 트릭. 운영 의도된 동작이지만 불투명.
   - **`addslashes`만 사용** — 안전성 낮음.
   - sql_insert_id() 후 부모 wr_id 업데이트 분리 — 트랜잭션 없음.
   - `wr_reply` 미정의 변수, `$secret`, `$mail` 미정의 — 실행 시 NOTICE/널 가능.
   - `error_reporting(E_ALL ^ E_NOTICE)` 깔고 들어감.
5. **운영 사용 추정**: **사용 중 추정** — 운세/후기 콘텐츠를 엑셀로 일괄 업로드하는 작업은 사주플랜에서 자주 일어나는 작업으로 보임 (sample 파일 2개를 둔 것으로 추정 가능).
6. **이관**: `POST /admin/posts/:slug/import` (xlsx 또는 csv). NestJS에서 `xlsx` 패키지 사용. 트랜잭션 단위로 row 처리, 실패 row만 수집 리포트 반환. wr_2 자동 채움은 명시적 옵션으로(`autoFillDuration: true`).

#### A-8. `board_singo.php` / `board_singo_update.php` (207+38줄)

1. **역할**: 게시글 신고 관리. `g5_board_singo` 처리중(`imsi=0`)/처리완료(`imsi=1`).
2. **DB**: `g5_board_singo` 조회/수정/삭제.
3. **이슈**:
   - SQL 인젝션 (`$sfl`/`$stx`/`$bo_status` 그대로 보간).
   - 컬럼명 `imsi`(임시) — 의미 모호. 신규는 `status` enum.
   - debug `echo $sql`/`exit` 흔적이 주석으로만 — 디버그 코드 잔존(line 53~56).
4. **운영**: 사용 추정 (라이브에 신고 기능 살아있음).
5. **이관**: `GET /admin/post-reports?status=...`, `PATCH /admin/post-reports/bulk` (resolve/delete).

#### A-9. `board_thumbnail_delete.php` (50줄)

1. **역할**: 게시판별 첨부 디렉토리에서 `thumb-*` 파일 일괄 삭제(썸네일 캐시 reset).
2. **이슈**: 파일 시스템 직접 접근. 신규는 S3 또는 로컬 통합 스토리지.
3. **운영**: 거의 미사용 추정. 게시판 form에서 버튼으로만 노출.
4. **이관**: 우선순위 낮음. 필요 시 `POST /admin/boards/:slug/thumbnails/regenerate`.

---

### B. 게시판 그룹 (board group)

#### B-1. `boardgroup_list.php` (209줄)

- **역할**: 그룹 목록 + 인라인 수정.
- **DB**: `g5_group`, `g5_board`(게시판 수 카운트), `g5_group_member`(접근회원수).
- **이슈**: SQL 인젝션, 매 행마다 N+1 카운트 쿼리.
- **운영**: 사용 (사주플랜은 그룹이 거의 1~2개).
- **이관**: `GET /admin/board-groups` with eager count.

#### B-2. `boardgroup_form.php` (157줄) + `boardgroup_form_update.php` (94줄)

- **역할**: 그룹 1개 생성/수정. gr_1~gr_10 여분필드 포함.
- **이슈**: SQL 인젝션, 자가 ALTER TABLE(`gr_device`).
- **운영**: 거의 미사용 추정 (그룹 자체가 적음).
- **이관**: `POST /admin/board-groups`, `PATCH /admin/board-groups/:id`. gr_1~gr_10은 `extras JSONB`.

#### B-3. `boardgroup_list_update.php` (57줄)

- 일괄 수정/삭제. 게시판이 남아있으면 그룹 삭제 차단(좋은 정책).
- **이관**: `PATCH /admin/board-groups/bulk`, `DELETE /admin/board-groups/:id` (board.group_id IS NULL 검증).

#### B-4. `boardgroupmember_list.php` (154줄) + `boardgroupmember_form.php` (132줄) + `boardgroupmember_update.php` (68줄)

- **역할**: 그룹 접근권한 회원 관리 (`g5_group_member`). 회원별로 어떤 그룹에 접근 가능한지.
- **DB**: g5_group, g5_group_member, g5_member.
- **이슈**: SQL 인젝션, 자가 ALTER TABLE.
- **운영**: **거의 미사용 추정** — 사주플랜은 회원 차별 접근 게시판이 없을 가능성 큼. `gr_use_access=1` 그룹이 운영에 있는지 확인 필요.
- **이관**: 라이브 사용 여부 확인 후 결정. 안 쓰면 컷.

---

### C. 콘텐츠/페이지 (content)

#### C-1. `contentlist.php` (96줄)

- **역할**: g5_content (회사소개/약관/개인정보처리방침 등 정적 페이지) 목록.
- **DB**: `g5_content`. 페이지 진입 시 **테이블 없으면 자가 CREATE + 기본 3행 INSERT**(company/privacy/provision).
- **이슈**: 자가 스키마 마이그레이션. SQL 인젝션은 적음(co_id만 받음).
- **운영**: 사용. SSR 페이지에서 `/content/<co_id>` 렌더링 추정.
- **이관**: `GET /admin/contents`. 신규는 별도 cms 도메인(`0005_cms_system.sql`)에 통합 검토.

#### C-2. `contentform.php` (297줄)

- **역할**: 콘텐츠 1개 생성/수정. CKEditor로 PC/모바일 본문 + 상하단 이미지 + 스킨 선택 + include_head/tail 파일 경로.
- **이슈**: 자가 ALTER TABLE 4건(co_include_head/tail, co_tag_filter_use, co_mobile_content, co_skin/co_mobile_skin). 캡챠 보안 분기(파일경로 변경 시).
- **운영**: 사용. 약관 등 수정 시 진입.
- **이관**: `PUT /admin/contents/:id`. include_head/tail 폐기(SSR이라 의미 없음). 스킨도 폐기. PC/모바일 본문만 유지.

#### C-3. `contentformupdate.php` (156줄)

- **역할**: 폼 처리 (insert/update/delete). 이미지 업로드 처리.
- **이슈**: SQL 보간(`$co_subject`, `$co_content` 등 직접 삽입), `is_include_path_check`로 디렉토리 트래버설 차단 시도(KVE-2018-2089 대응).
- **이관**: 표준 NestJS service + class-validator.

---

### D. FAQ

#### D-1. `faqmasterlist.php` (126줄)

- **역할**: FAQ 분류(faq_master) 목록.
- **DB**: g5_faq_master, g5_faq. 자가 CREATE TABLE 포함(없으면).
- **운영**: 사용.

#### D-2. `faqmasterform.php` (166줄) + `faqmasterformupdate.php` (82줄)

- **역할**: FAQ 분류 1개. 상하단 HTML, PC/모바일 이미지, 모바일 상하단 HTML.
- **이슈**: `$fm_subject`/`$fm_head_html`/`$fm_tail_html` 직접 보간(XSS/SQL 모두 위험. 단 fm_subject만 strip_tags).
- **운영**: 사용.

#### D-3. `faqlist.php` (98줄)

- **역할**: 특정 fm_id의 FAQ 항목 목록.
- **운영**: 사용.

#### D-4. `faqform.php` (101줄) + `faqformupdate.php` (49줄)

- **역할**: FAQ 항목 1개 (질문/답변). CKEditor.
- **이슈**: **fa_subject/fa_content 검증 0** — strip_tags조차 없음. 그대로 SQL에 보간(line 21~22 of faqformupdate.php). XSS·SQL 인젝션 양쪽 다 위험.
- **운영**: 사용.

**FAQ 이관**: `GET/POST/PATCH /admin/faq-categories`, `GET/POST/PATCH /admin/faqs`. CKEditor 콘텐츠는 server-side sanitize(예: dompurify-isomorphic). 신규는 cms 도메인(0005)에 통합.

---

### E. 투표/설문 (poll)

#### E-1. `poll_list.php` (164줄)

- **역할**: g5_poll 목록. po_subject 검색.
- **DB**: g5_poll. 행마다 9개 cnt 합계 N+1.
- **이슈**: SQL 인젝션.

#### E-2. `poll_form.php` (120줄)

- **역할**: 투표 1개 생성/수정. 항목 9개 + 기타의견(po_etc) + 권한(po_level) + 포인트(po_point) + 참가IP/회원 readonly 표시.

#### E-3. `poll_form_update.php` (101줄)

- **역할**: insert/update/delete. 마지막에 max(po_id)를 g5_config.cf_max_po_id에 저장(미사용일 시 가장 큰 투표).
- **이슈**: `$_POST['po_subject']` 등 모두 strip_tags + clean_xss_attributes만 거치고 SQL에 직접 보간. SQL 인젝션 가능.

#### E-4. `poll_delete.php` (25줄)

- **역할**: 일괄 삭제 (g5_poll + g5_poll_etc).

**투표 운영 사용 추정**: **거의 미사용** — 사주플랜은 콘텐츠 사이트로 투표 기능이 핵심 UX가 아님. 라이브에 폼은 살아있어도 실제 운영 활용은 제로에 가까움. 그누보드 기본 기능 잔존물.
**이관**: **컷 권장**. 신규 mng로 옮기지 않음. 필요해지면 그때 추가.

---

### F. 서비스/자료 (service*)

#### F-1. `service.php` (48줄)

- **역할**: "부가서비스" 안내 페이지(KCP/이니시스/SMS 등 외부 PG 광고 링크). **그누보드/영카트 기본 마케팅 페이지**.
- **운영**: **미사용**. 사주플랜은 PG가 이미 연동돼 있어 신규 신청 안내 페이지가 의미 없음.
- **이관**: **컷**.

#### F-2. `service_list.php` (285줄)

- **역할**: 코드 헤더는 `정기세차신청` — 자동차 정기 세차 서비스 관리 화면. **사주플랜과 무관한 다른 사이트의 잔존 코드**.
- **DB**: g5_member 검색만. 본문은 모두 **하드코딩 더미 데이터**(티구안/모닝/홍길동/이현우/매니저 등).
- **운영**: **명백히 미사용** (placeholder 더미). 라이브에 메뉴가 노출돼 있어도 데이터 없음.
- **이관**: **완전 컷**.

#### F-3. `service_form.php` (279줄)

- **역할**: 서비스 1건 폼. 본문은 `정기세차신청 관리` 더미 데이터(차종/매니저/세차장소 하드코딩).
- **운영**: 미사용.
- **이관**: **완전 컷**.

#### F-4. `view.php` (27줄)

- **역할**: `?call=` 파라미터로 admin 메뉴 동적 렌더 (run_event hook 호출). 그누보드 플러그인 시스템.
- **운영**: 외부 플러그인 연동용. 현재 사주플랜에서 등록된 plugin이 있는지 확인 필요. 일반적으로 미사용.
- **이관**: 컷 (NestJS는 명시적 라우트만).

---

### G. 기타 (history_list, write_count, tour_link)

#### G-1. `history_list.php` (292줄)

- **역할**: 코드 헤더는 `정기세차내역` — F-2와 짝. 자동차 세차 이력 더미 화면. **포인트 history와 무관**.
- **DB**: g5_member 검색만. 본문은 더미 하드코딩(3월 8회 / 베이전 등).
- **운영**: **미사용** (placeholder).
- **이관**: **완전 컷**. (포인트 이력은 `point_list.php`/Phase A에서 처리.)

#### G-2. `write_count.php` (212줄)

- **역할**: 게시판 글/댓글 통계 그래프 (jqplot, 시간/일/주/월/년 단위).
- **DB**: g5_board_new (전체 글/댓글 인덱스). g5_board(게시판 SELECT 옵션).
- **이슈**: SQL 인젝션($bo_table 직접 보간), `check_demo()` 호출 — 데모 모드 차단(읽기 화면인데 데모 차단? 의문).
- **운영**: 사용 가능 (관리자 통계 메뉴). 다만 그래프 라이브러리 jqplot은 IE 시대 유물.
- **이관**: Dashboard(Phase F) 통계와 통합. `GET /admin/stats/posts?period=...` + Recharts.

#### G-3. `tour_link.php` (31줄)

- **역할**: "관광지/지역홍보 바로가기" 정적 placeholder 4개 아이콘만. 링크 미설정.
- **운영**: **미사용** (그누보드 다른 사이트 잔존물).
- **이관**: **완전 컷**.

---

## 발견된 이슈 (전체)

### 보안
1. **SQL 인젝션 만연** — board_list/board_form_update/board_singo/poll_*/faq_* 거의 모든 파일에서 `$sfl`/`$stx`/$_POST 변수를 직접 SQL 문자열에 보간. 부분적으로 `sql_real_escape_string`/`strip_tags`/`clean_xss_attributes`만 적용.
2. **CSRF**: `check_admin_token()` 호출은 update 경로 대부분에 들어있음(OK). 단 token 변수가 `<input value=""` 빈 채로 시작하는 경우 다수.
3. **파일 경로 트래버설 시도 차단**: `is_include_path_check` 함수로 일부 차단(KVE-2018-2089 대응됨). 하지만 입력 검증 일관성 부족.
4. **권한 체크 일관성**: `auth_check($auth[$sub_menu], 'r')` vs `auth_check_menu($auth, $sub_menu, 'r')` 두 형태 혼재.

### 데이터 정합성
5. **트랜잭션 부재** — board insert + g5_write_* CREATE, board copy 시 board+write+file insert, board delete 시 다섯 테이블 delete + DROP. 모두 트랜잭션 없이 순차. 부분 실패 시 데이터 정합성 깨짐.
6. **자가 ALTER TABLE 도배** — board_form.php 21~85, boardgroup_form.php 32, contentform.php 11~36, contentlist.php 11~31, faqmasterform.php 30~34, faqmasterlist.php 13~45, member_cert_history 등. 매 페이지 진입마다 `if (!isset(...)) ALTER TABLE`. 멀티 인스턴스, 슬레이브, 마이그레이션 추적성 모두 망가뜨림.
7. **N+1 쿼리** — board list, boardgroup list, faq list, poll list 모든 목록 화면에서 행마다 카운트 SELECT.

### 디버그/잔존 코드
8. **debug 잔존** — board_singo.php 53~56줄 `// echo $sql; // exit;` 주석. 다수 파일 위쪽에 `print_r2`/`exit` 주석.
9. **빈 변수 선언** — board_excel_update.php의 `$wr_reply`/`$secret`/`$mail` 미정의 사용.
10. **error_reporting 강제 변경** — board_excel_update.php line 34 `error_reporting(E_ALL ^ E_NOTICE)` (NOTICE 숨김).

### 사주플랜 무관 더미 코드
11. **service_list.php / service_form.php / history_list.php / tour_link.php** — 자동차 세차/관광지 holdover. **완전히 다른 도메인**의 admin 템플릿 잔존. 라이브에 메뉴가 살아있어도 데이터 없는 placeholder.
12. **service.php** — 그누보드/영카트 기본 PG/SMS 가입 안내 광고 페이지. 사주플랜 운영 무관.

### 그누보드 표준이지만 사주플랜에선 안 쓰는 기능
13. **board_copy** — 게시판이 18개로 고정되어 복제 시나리오 거의 없음.
14. **board_excel** — 단, fortune/review만은 실사용 가능성. 그 외 슬러그용 엑셀 업로드는 의미 적음.
15. **poll_*** — 투표 기능. 사주플랜 운영에서 활용 사례 없음.
16. **boardgroupmember_*** — 그룹별 회원 접근권한. 사주플랜 정책상 거의 무용.
17. **board_form의 95+옵션** — skin/include_head/use_sns/use_cert/use_captcha/use_signature/use_email/use_sideview 등 60+개 옵션은 SSR 페이지 구조에선 의미 없음.

---

## 운영 사용 여부 추정 — 이관 우선순위

| 메뉴 | 라이브 사용 추정 | 신규 mng 이관 권장 | 비고 |
|---|---|---|---|
| board_list | 사용 | **O** | 핵심. 18개 게시판 인라인 관리. |
| board_form | 부분 사용 | **O (대폭 분해)** | 1491줄 → 4개 카드 섹션. 옵션 80% 컷. |
| board_form_update | 사용 | **O** | 트랜잭션 + 마이그레이션 분리 필수. |
| board_list_update | 사용 | **O** | 일괄 수정/삭제. 트랜잭션화. |
| board_delete.inc.php | (위에 통합) | **O (soft delete)** | DROP TABLE 폐기. is_active=false. |
| board_copy / board_copy_update | 미사용 추정 | **컷 권장** | 18개 고정. 필요 시 DBA 직수행. |
| board_excel(_form/_update) | 부분 사용 (fortune/review) | **O (단순화)** | xlsx 패키지로 재구현. fortune/review만. |
| board_singo / board_singo_update | 사용 | **O** | post_report 테이블로 이관. |
| board_thumbnail_delete | 거의 미사용 | 우선순위 낮음 | Phase E 후반. |
| boardgroup_list / list_update | 사용(그룹 1~2개) | **O (단순화)** | 빠른 이관. |
| boardgroup_form / form_update | 거의 미사용 | **O (간소화)** 또는 컷 | 그룹 추가 빈도 낮음. |
| boardgroupmember_* (3개) | **미사용 추정** | **컷 권장** | gr_use_access=1 그룹 존재 여부 라이브 확인 후 확정. |
| contentlist | 사용 | **O** | 약관/회사소개 등. cms 도메인 통합. |
| contentform / contentformupdate | 사용 | **O** | include_head/skin/captcha 폐기. |
| faqmasterlist | 사용 | **O** | cms 도메인 통합. |
| faqmasterform / formupdate | 사용 | **O** | 모바일 상하단/이미지 유지. |
| faqlist | 사용 | **O** | |
| faqform / faqformupdate | 사용 | **O (sanitize 강화)** | dompurify 필수. |
| poll_list / poll_form / poll_form_update / poll_delete | **미사용 추정** | **컷 권장** | 핵심 UX 아님. 추후 필요해지면 추가. |
| service.php | 미사용 | **컷** | PG 광고 페이지. |
| service_list | **미사용 (더미)** | **완전 컷** | 다른 사이트 잔존물. |
| service_form | **미사용 (더미)** | **완전 컷** | 다른 사이트 잔존물. |
| view.php | 미사용 추정 | **컷** | 그누보드 plugin hook. |
| history_list | **미사용 (더미)** | **완전 컷** | 정기세차 holdover. 포인트와 무관. |
| write_count | 사용 (통계) | **Phase F로 이전** | Dashboard와 통합. |
| tour_link | **미사용** | **완전 컷** | placeholder. |

**요약**: 39개 중 **이관 13~16개**, **컷 8~11개**, **이미 다른 Phase로 이전 1개(write_count)**, 나머지는 통합·간소화. 핵심은 board_list/form, content, faq, board_singo, board_excel 정도.

---

## web/mng 이관 설계

### NestJS API 설계 (post 도메인 통합)

```
api/src/admin/
├── boards/
│   ├── boards.module.ts
│   ├── boards.controller.ts        # GET/POST/PATCH /admin/boards (+/bulk)
│   ├── boards.service.ts
│   └── dto/
│       ├── update-board.dto.ts
│       └── bulk-update-boards.dto.ts
├── board-groups/
│   ├── board-groups.module.ts
│   ├── board-groups.controller.ts  # CRUD
│   └── board-groups.service.ts
├── posts/                          # 18개 게시판 통합 인터페이스
│   ├── posts.module.ts
│   ├── posts.controller.ts         # GET /admin/posts/:slug, /:slug/:id, ...
│   ├── posts.service.ts            # slug → 테이블 라우팅
│   ├── post-import.service.ts      # 엑셀 업로드 (fortune/review)
│   ├── post-comments.controller.ts # /admin/posts/:slug/:id/comments
│   ├── post-files.service.ts       # 첨부 (S3 또는 로컬)
│   └── dto/
├── post-reports/                   # 신고 (board_singo)
│   ├── post-reports.controller.ts  # GET, PATCH /resolve, DELETE
│   └── post-reports.service.ts
├── contents/                       # CMS 페이지 (g5_content 후속)
│   ├── contents.controller.ts
│   └── contents.service.ts
├── faqs/                           # FAQ
│   ├── faq-categories.controller.ts
│   ├── faqs.controller.ts
│   └── faqs.service.ts
└── ...
```

**핵심 설계 결정**:
- `posts.service.ts`는 slug → 신규 18개 테이블 매핑을 **whitelist switch**로 라우팅. 동적 테이블명 SQL 보간 절대 금지.
- 글 본문 (HTML) 저장 전 **server-side dompurify** 통과.
- 엑셀 업로드는 `multer` + `xlsx` + 행 단위 트랜잭션. 실패 행은 응답 JSON으로 반환.
- 모든 mutating endpoint는 `AdminAuthGuard` + `actor_admin_id`/`actor_ip` 자동 기록(common interceptor 활용).

### React 페이지 설계 (ContentList.tsx placeholder를 어떻게 채울지)

현재 `ContentList.tsx`는 빈 placeholder. 사이드바 메뉴 구조에 맞춰 다음 페이지로 분해:

```
web/mng/src/pages/
├── boards/
│   ├── BoardList.tsx          # /mng/boards — 18개 게시판 인라인 관리 표
│   ├── BoardForm.tsx          # /mng/boards/:slug — 4 섹션 카드(기본/권한/카테고리/포인트)
│   └── BoardImport.tsx        # /mng/boards/:slug/import — 엑셀 업로드 (fortune/review만 노출)
├── posts/
│   ├── PostList.tsx           # /mng/posts/:slug — 게시판별 글 목록 (slug 파라미터 분기)
│   ├── PostDetail.tsx         # /mng/posts/:slug/:id — 글+댓글+첨부+이력
│   └── PostReports.tsx        # /mng/posts/reports — 신고 처리(처리중/처리완료 탭)
├── board-groups/
│   ├── BoardGroupList.tsx     # /mng/board-groups — 단순 표 (1~2개라 폼 없이 인라인)
├── contents/
│   ├── ContentList.tsx        # /mng/contents — (현재 placeholder 대체) g5_content 목록
│   └── ContentForm.tsx        # /mng/contents/:id — CKEditor + PC/모바일 분리
└── faqs/
    ├── FaqCategoryList.tsx    # /mng/faqs — 분류 목록
    ├── FaqCategoryForm.tsx
    └── FaqList.tsx            # /mng/faqs/:fmId — 항목 목록
    └── FaqForm.tsx            # /mng/faqs/:fmId/:faId
```

**ContentList.tsx 구체화**:
- 현재 placeholder를 **3개 카드 그룹**으로 갈아끼움:
  1. "콘텐츠 페이지" — `/mng/contents`로 이동 버튼
  2. "FAQ" — `/mng/faqs`
  3. "게시판 관리" — `/mng/boards`
- 또는 "콘텐츠 리스트"를 그대로 `/mng/posts/:slug` 라우트의 `:slug` 셀렉터 페이지로 재활용 (18개 슬러그 카드를 큼직하게 → 클릭 시 PostList로).
  - 이 패턴이 사용자 흐름에 더 부합: 관리자가 "콘텐츠"를 누르면 → 어떤 게시판? → 글 목록 → 글 상세.

### board_form.php 78KB 분해 전략

기존 1491줄 6 섹션을 다음 4 섹션 카드로 축약:

| 신규 섹션 | 기존 섹션 매핑 | 컷한 필드 |
|---|---|---|
| **기본 정보** | 기본 설정 + 분류 | mobile_subject(폐기, 단일), include_head/tail(SSR이라 불필요), bo_count_*(자동계산) |
| **권한** | 권한 설정 | list_level/read_level/write_level/comment_level/upload_level만. reply_level(답글 안 씀), html_level(에디터 sanitize), link_level(미사용) 폐기. |
| **카테고리/공지** | 기능 설정 일부 | category_list, use_category, notice. 나머지(secret/use_dhtml_editor/select_editor/use_rss_view/use_good/use_nogood/use_name/use_signature/use_ip_view/use_list_view/use_list_file/use_list_content/use_email/use_cert/use_sns/use_captcha)는 use_secret/use_good/use_nogood만 유지, 그 외 폐기. |
| **포인트** | 포인트 설정 | read_point/write_point/comment_point/upload_point 4개만. download_point는 첨부 다운 별도 정책 시 추가. |

**여분필드(bo_1~bo_10)**: 신규는 `extras JSONB`로 자유 형태. UI는 "고급 설정" 펼침 버튼 안에 JSON 편집기로 노출.

**그룹/전체 적용 체크박스**: 컷. UX 가치 낮음.

---

## ETL 매핑 (g5_board, g5_write_* → board, post_*)

### 마이그레이션 파일 위치
`api/db/etl/04_board_post.sql` (신규 작성)

### 매핑 테이블

#### 1. board_group ← g5_group
```sql
INSERT INTO board_group (gr_id, title, device, admin_id, use_access, display_order, created_at)
SELECT
  g.gr_id,
  g.gr_subject,
  g.gr_device,
  m.id,                                        -- gr_admin(mb_id) → member.id
  COALESCE(g.gr_use_access::int::bool, false),
  g.gr_order,
  NOW()
FROM g5_group g
LEFT JOIN member m ON m.mb_id = g.gr_admin;
```

#### 2. board ← g5_board
- 95컬럼 중 ~20개만 보존. 나머지 무시.
- slug = bo_table.

```sql
INSERT INTO board (slug, group_id, title, mobile_title, device, admin_id,
                   read_level, write_level, comment_level, upload_level,
                   use_secret, use_good, use_nogood, use_category, category_list,
                   page_rows, upload_size, upload_count, notice, display_order,
                   count_write, count_comment, is_active, created_at, updated_at)
SELECT
  b.bo_table,
  bg.id,
  b.bo_subject,
  NULLIF(b.bo_mobile_subject, ''),
  b.bo_device,
  m.id,
  b.bo_read_level, b.bo_write_level, b.bo_comment_level, b.bo_upload_level,
  b.bo_use_secret::bool, b.bo_use_good::bool, b.bo_use_nogood::bool,
  b.bo_use_category::bool, NULLIF(b.bo_category_list, ''),
  b.bo_page_rows, b.bo_upload_size, b.bo_upload_count,
  NULLIF(b.bo_notice, ''),
  b.bo_order, b.bo_count_write, b.bo_count_comment,
  TRUE, NOW(), NOW()
FROM g5_board b
LEFT JOIN board_group bg ON bg.gr_id = b.gr_id
LEFT JOIN member m ON m.mb_id = b.bo_admin
WHERE b.bo_table NOT IN ('revew');  -- 오타 게시판 제외
```

#### 3. board_group_member ← g5_group_member
```sql
INSERT INTO board_group_member (group_id, member_id, granted_at)
SELECT bg.id, m.id, gm.gm_datetime
FROM g5_group_member gm
JOIN board_group bg ON bg.gr_id = gm.gr_id
JOIN member m ON m.mb_id = gm.mb_id;
```
> 사용 여부 미상. 라이브 데이터 0건이면 ETL skip.

#### 4. post_counselor ← g5_write_counselor (★핵심)
- wr_5 → specialty (전문분야 텍스트)
- wr_6 → traits (구분자 텍스트 → TEXT[])
- wr_7 → bio
- wr_8 → headline
- wr_9 → hashtag1
- wr_10 → hashtag2
- aft → review_count (캐시)
- fat → fan_count (캐시)
- sec → unit_seconds
- amt → unit_cost
- wr_1~wr_4 → extras JSONB (의미 미상)

```sql
INSERT INTO post_counselor (
  wr_id, member_id, mb_id, title, content, specialty, traits,
  bio, headline, hashtag1, hashtag2,
  review_count, fan_count, unit_seconds, unit_cost,
  view_count, like_count, dislike_count, is_secret, has_file, ip,
  extras, created_at, updated_at
)
SELECT
  w.wr_id,
  m.id,
  w.mb_id,
  w.wr_subject,
  w.wr_content,
  NULLIF(w.wr_5, ''),
  CASE WHEN w.wr_6 = '' THEN ARRAY[]::TEXT[]
       ELSE string_to_array(w.wr_6, ',') END,
  NULLIF(w.wr_7, ''),
  NULLIF(w.wr_8, ''),
  NULLIF(w.wr_9, ''),
  NULLIF(w.wr_10, ''),
  COALESCE(w.aft::int, 0),
  COALESCE(w.fat::int, 0),
  NULLIF(w.sec, '')::smallint,
  NULLIF(w.amt, '')::int,
  w.wr_hit, w.wr_good, w.wr_nogood,
  (w.wr_password <> ''),
  (w.wr_file > 0),
  NULLIF(w.wr_ip, '')::inet,
  jsonb_build_object('wr_1', w.wr_1, 'wr_2', w.wr_2, 'wr_3', w.wr_3, 'wr_4', w.wr_4),
  w.wr_datetime,
  COALESCE(NULLIF(w.wr_last, '')::timestamp, w.wr_datetime)
FROM g5_write_counselor w
LEFT JOIN member m ON m.mb_id = w.mb_id
WHERE w.wr_is_comment = 0;
```

#### 5. post_<slug> ← g5_write_<slug> (15~17개 일반 게시판)
공통 템플릿. fortune/charm/wish/wish_event/column/notice/event/review/qa/apply/chat_room/c_benefits/c_history/c_tip/c_notice/c_faq/new 모두 동일 패턴:

```sql
-- 예: post_fortune
INSERT INTO post_fortune (
  wr_id, member_id, mb_id, title, content, category,
  view_count, like_count, dislike_count, is_secret, has_file, ip,
  extras, created_at, updated_at
)
SELECT
  w.wr_id, m.id, w.mb_id, w.wr_subject, w.wr_content,
  NULLIF(w.ca_name, ''),
  w.wr_hit, w.wr_good, w.wr_nogood,
  (w.wr_password <> ''), (w.wr_file > 0), NULLIF(w.wr_ip, '')::inet,
  jsonb_build_object('wr_1', w.wr_1, 'wr_2', w.wr_2, 'wr_3', w.wr_3, 'wr_4', w.wr_4,
                     'wr_5', w.wr_5, 'wr_6', w.wr_6, 'wr_7', w.wr_7, 'wr_8', w.wr_8,
                     'wr_9', w.wr_9, 'wr_10', w.wr_10),
  w.wr_datetime,
  COALESCE(NULLIF(w.wr_last, '')::timestamp, w.wr_datetime)
FROM g5_write_fortune w
LEFT JOIN member m ON m.mb_id = w.mb_id
WHERE w.wr_is_comment = 0;
```

ETL 스크립트는 18개 슬러그를 배열로 돌려 동적 SQL 생성하되, **마이그레이션 파일은 슬러그별 SQL 명시적으로** 풀어 쓸 것 (debugability).

#### 6. post_comment ← g5_write_<slug> WHERE wr_is_comment = 1
모든 게시판 댓글을 단일 테이블로 집결. polymorphic key (board_slug, post_id):

```sql
-- 예: counselor 댓글
INSERT INTO post_comment (board_slug, post_id, wr_id, parent_id, member_id, mb_id, content,
                          like_count, dislike_count, is_secret, ip, created_at)
SELECT
  'counselor',
  pc.id,                          -- post_counselor.id (FK)
  w.wr_id,
  -- parent comment id 매핑은 별도 단계
  NULL,
  m.id,
  w.mb_id,
  w.wr_content,
  w.wr_good, w.wr_nogood,
  (w.wr_password <> ''),
  NULLIF(w.wr_ip, '')::inet,
  w.wr_datetime
FROM g5_write_counselor w
JOIN post_counselor pc ON pc.wr_id = w.wr_parent
LEFT JOIN member m ON m.mb_id = w.mb_id
WHERE w.wr_is_comment = 1;
```
> 슬러그 18개 반복.

#### 7. post_file ← g5_board_file
```sql
INSERT INTO post_file (board_slug, post_id, file_no, source_name, stored_name,
                       download_count, content, file_url, thumb_url, storage,
                       file_size, width, height, mime_type, uploaded_at)
SELECT
  bf.bo_table,
  -- post_id 매핑: bf.wr_id → 해당 슬러그의 post_*.wr_id → post_*.id
  CASE bf.bo_table
    WHEN 'counselor' THEN (SELECT id FROM post_counselor WHERE wr_id = bf.wr_id)
    WHEN 'fortune'   THEN (SELECT id FROM post_fortune   WHERE wr_id = bf.wr_id)
    -- ... 18개 분기
  END,
  bf.bf_no, bf.bf_source, bf.bf_file, bf.bf_download, NULLIF(bf.bf_content,''),
  NULLIF(bf.bf_fileurl,''), NULLIF(bf.bf_thumburl,''), NULLIF(bf.bf_storage,''),
  bf.bf_filesize, bf.bf_width, bf.bf_height, bf.bf_type, bf.bf_datetime
FROM g5_board_file bf;
```
> CASE WHEN 18 분기 또는 별도 매핑 함수 작성. **post_id가 NULL인 행(orphan file)은 어차피 라이브에 깨진 데이터 — ETL에서 제외 또는 로그**.

#### 8. post_like ← g5_board_good
폴리모픽 매핑 같은 방식.

#### 9. post_report ← g5_board_singo
```sql
INSERT INTO post_report (board_slug, post_id, reporter_id, reporter_mb_id,
                         target_member_id, target_mb_id, mode, status, reported_at)
SELECT
  bs.bo_table,
  CASE bs.bo_table /* 18 분기 */ END,
  rm.id,
  bs.mb_id,
  tm.id,
  bs.tmb_id,
  bs.mode,
  CASE bs.imsi WHEN '1' THEN 'resolved' ELSE 'pending' END,
  bs.reg_date
FROM g5_board_singo bs
LEFT JOIN member rm ON rm.mb_id = bs.mb_id
LEFT JOIN member tm ON tm.mb_id = bs.tmb_id;
```

#### 10. post_scrap ← g5_scrap, post_autosave ← g5_autosave
동일 폴리모픽 패턴.

#### 11. CMS / FAQ
- `g5_content` → 0005 cms_system 도메인의 `cms_page` 또는 별도 `content_page` (도메인 05 분석 후 결정).
- `g5_faq_master` / `g5_faq` → `faq_category` / `faq_item` (도메인 05 통합 검토).

#### 12. 컷 대상 (ETL 안 함)
- `g5_poll` / `g5_poll_etc` — 신규 mng에 투표 없음. 데이터도 무가치.
- `g5_board_new` — 인덱스 캐시. 신규는 쿼리로 대체.

### ETL 작업 순서
1. `board_group` (FK 종속 없음)
2. `board` (board_group 참조)
3. `board_group_member` (board_group, member 참조)
4. 18개 `post_<slug>` (member 참조)
5. `post_comment` (post_<slug> 참조)
6. `post_file` (post_<slug> 참조, polymorphic)
7. `post_like`, `post_report`, `post_scrap`, `post_autosave` (polymorphic)
8. 검증: g5_write_*.wr_is_comment=0 카운트 vs post_<slug> 카운트, g5_board_file 카운트 vs post_file 카운트

---

## 부록: 신규 마이그레이션 0002 보완 항목

분석 중 발견한 0002_board_post.sql 보완 사항:

1. **post_way 추가 또는 way 슬러그 폐기 결정** — 라이브 g5_write_way의 데이터 성격 확인 필요.
2. **명명 일관성**: `post_benefit`/`post_history`/`post_tip` → 가능하면 `post_c_benefit`/`post_c_history`/`post_c_tip`으로 슬러그(c_*) 일치. 또는 `board.slug` 컬럼만 'c_benefits' 그대로 두고 테이블명은 신규 명명 유지(매핑은 ETL 변환).
3. **`revew` 슬러그 제거 결정** — 오타. ETL 단계에서 'review'로 통합 또는 폐기.
4. **post_counselor.traits TEXT[]**: g5의 wr_6 구분자가 `,`인지 다른 문자인지 라이브 데이터 샘플 확인 후 split.
5. **post_file의 polymorphic FK**: Postgres에서 polymorphic은 외래키 제약 못 검. trigger로 board_slug → 해당 post_<slug> 존재 검증 권장.

---

## Phase E 작업 체크리스트 (이 도메인 본격 시작 시)

- [ ] 라이브 g5_board 행 18~19개에서 슬러그·운영 활용도 확인 (특히 way, c_*, new)
- [ ] g5_group_member 데이터 0건 확인 → boardgroupmember_* 컷 확정
- [ ] g5_poll 데이터 0건 또는 무가치 확인 → poll_* 컷 확정
- [ ] fortune_sample.xls / review_sample.xls 포맷 확인 → 신규 import 스펙
- [ ] 0002_board_post.sql에 post_way 추가 or 슬러그 매핑 표 확정
- [ ] ETL `04_board_post.sql` 작성 (위 매핑 표 기반)
- [ ] NestJS posts 모듈 구현 (slug 화이트리스트 라우팅)
- [ ] ContentList.tsx → 18개 게시판 셀렉터 또는 카드 페이지로 재구성
- [ ] BoardList/Form, PostList, FAQ, Content 페이지 순차 구현
- [ ] board_form 4 섹션 분해본 검증 (실제 운영 필드 누락 없는지 운영팀 확인)
- [ ] post_singo 처리 흐름 검증 (사용자측 신고 endpoint와 paired)
