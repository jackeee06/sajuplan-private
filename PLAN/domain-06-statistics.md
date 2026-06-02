# 도메인 06: 통계 / 방문 / 매출

> **Phase F (통계/대시보드 강화)** 의 사전 분석.
> 분석 대상: `sample/adm/visit_*.php` (12), `revenue_list_*.php` (2), `pay_month.php` (1), `popular_list.php`/`popular_rank.php` (2), 공통 sub 2개 — 총 **17개 PHP 파일**.
> 핵심 인사이트: **매출/월정산 페이지는 모두 더미 HTML**(라이브에서 동작 안 함). **방문통계 12개는 g5_visit raw에 N+1/풀스캔 매번 수행**으로 데이터 양 늘면 위험. **인기 검색어는 IP단위 row 누적**으로 DB 비대화 진행 중.

---

## 0. 개요

| 카테고리 | 파일 수 | 핵심 데이터 소스 | 운영 사용 | 비고 |
|---|---|---|---|---|
| 방문자 통계 | 12 | `g5_visit` (raw), `g5_visit_sum` (일집계) | 일부만 사용 추정 | UI는 안 들어감, GA4가 실제 분석 채널 |
| 매출 통계 | 3 | `g5_point_end` (월정산) **+ 더미 HTML** | **사용 안 함** | revenue_list_day/month는 100% 더미, pay_month는 정산 트리거(매출 보기 X) |
| 인기 검색어 | 2 | `g5_popular` (IP단위 raw 누적) | 거의 안 씀 | 사주플랜 검색은 메인 사용성 X |

---

## 1. DB 테이블 인벤토리

### 1.1 라이브 (g5_*)

| 테이블 | 컬럼 | 용도 | 행 수 (DB 덤프) |
|---|---|---|---|
| `g5_visit` | `vi_id`(PK), `vi_ip`, `vi_date`, `vi_time`, `vi_referer`, `vi_agent`, `vi_browser`, `vi_os`, `vi_device` + `UNIQUE(vi_ip,vi_date)` + `KEY(vi_date)` | 일별 IP별 raw 1행 | 점진 증가, 봇 다수 (GPTBot, Applebot) |
| `g5_visit_sum` | `vs_date`(PK), `vs_count` + `KEY(vs_count)` | 일별 방문수 집계 | 작음 (일별 1행) |
| `g5_popular` | `pp_id`(PK), `pp_word(50)`, `pp_date`, `pp_ip(50)` + `UNIQUE(pp_date,pp_word,pp_ip)` | **(date, word, ip)** 단위 row → 검색 1회 = 1 row 누적 | 317863+ (덤프 기준) — IP 분리 보존하느라 row 폭증 |
| `g5_point_end` | `no`(PK), `mb_id`, `month`(YYYY-MM), `price`/`price_free`/`price_paid`/`price_other`/`price_tot`, `vat_amount`, `withholding_tax`, `reply_fee`, `amb_id`, `wr_datetime`, `up_datetime` + `KEY(mb_id,month)` | 월별 상담사 정산 결과 (정산이지 매출 집계 아님) | 상담사×월 |

### 1.2 신규 (api/db/migrations/0005_cms_system.sql)

| 테이블 | 매핑 | 비고 |
|---|---|---|
| `visit_log` | `g5_visit` | `visit_ip INET`, `UNIQUE(visit_ip, visit_date)`, `idx_visit_log_date` — 라이브 동일 키 구조 유지 |
| `visit_summary` | `g5_visit_sum` | `(visit_date PK, visit_count)` + `idx_visit_summary_count` |
| `search_log` | **신규** | raw 검색 로그(회원/IP/result_count/created_at) — g5_popular 보완용 |
| `search_popular_daily` | `g5_popular` 통합 | `UNIQUE(log_date, word)`, `search_count` 필드 — IP단위 row 폐기 |

> 참고: `g5_point_end`의 신규 테이블 매핑은 도메인 03 (정산) 소관. 매출 대시보드는 **`payment.amount`(충전매출) + `consultation.amt`(상담매출)** 으로 새로 산출(이미 `dashboard.service.ts`에 일부 구현).

---

## 2. 파일별 분석

### 2.1 방문자 통계 (visit_*.php)

#### 공통 패턴

- **Auth**: `auth_check_menu($auth, '350900', 'r')` — read 권한 체크
- **입력**: `fr_date` / `to_date` — `preg_replace('/[^0-9 :\-]/', '', ...)` + `visit.sub.php`에서 `^YYYY-MM-DD$` 정규식. 기본값 `G5_TIME_YMD`(오늘)
- **출력**: HTML 테이블 + 막대 그래프 (`<div class="visit_bar"><span style="width:N%"></span></div>`)
- **Sub 메뉴**: `visit.sub.php`가 모든 visit 페이지 상단에 `접속자/도메인/브라우저/OS/접속기기/시간/요일/일/월/년` 10개 anchor 노출

---

#### 2.1.1 `visit_list.php` — 전체 방문 목록 (페이징)

| 항목 | 내용 |
|---|---|
| **역할** | 일별 raw 방문 row 페이지네이션 표 |
| **HTTP** | `GET /adm/visit_list.php?fr_date=&to_date=&domain=&page=` |
| **읽는 테이블** | `g5_visit` |
| **쓰는 테이블** | 없음 |
| **출력** | IP / 접속경로 / 브라우저 / OS / 기기 / 일시 페이지표 |
| **로직** | `WHERE vi_date BETWEEN $fr AND $to [AND vi_referer LIKE '%domain%']` → COUNT → `ORDER BY vi_id DESC LIMIT` |
| **외부 의존** | `get_brow($vi_agent)`, `get_os($vi_agent)` (visit.lib.php) — 브라우저/OS가 빈 row에서 UA 파싱 |
| **이슈** | (a) `$domain`을 `LIKE '%...%'` 직접 삽입 → SQL injection 가능 — `domain=`은 GET 파라미터로 들어옴(`isset($domain)` 체크는 register_globals 가정). (b) `$qstr`에 `&amp;` 그대로 `?qstr=` 들어감 → 페이징 깨짐 가능. (c) `vi_referer` 길이 제한 없음 (TEXT) — 출력에서 `cut_str(...,255)`로 자름 |
| **운영 사용** | 가끔. raw 방문 list는 운영자가 거의 안 봄 (GA4가 더 풍부) |

#### 2.1.2 `visit_date.php` — 일별 (visit_summary 사용)

- 쿼리: `SELECT vs_date, vs_count FROM g5_visit_sum WHERE vs_date BETWEEN $fr AND $to`
- **이미 집계 테이블이라 빠름**. 가장 먼저 옮길만한 페이지.

#### 2.1.3 `visit_hour.php` — 시간대별 ⚠ 풀스캔

```sql
SELECT SUBSTRING(vi_time,1,2) AS vi_hour, COUNT(vi_id) AS cnt
  FROM g5_visit
 WHERE vi_date BETWEEN '$fr' AND '$to'
 GROUP BY vi_hour;
```

- raw `g5_visit`을 매번 풀 스캔 → 기간 길어지면 비용 폭증
- 24시간 슬롯 모두 출력

#### 2.1.4 `visit_week.php` — 요일별

```sql
SELECT WEEKDAY(vs_date) AS weekday_date, SUM(vs_count) AS cnt
  FROM g5_visit_sum
 WHERE vs_date BETWEEN '$fr' AND '$to'
 GROUP BY weekday_date;
```

- 집계 테이블 사용. 빠름. 7행 고정.

#### 2.1.5 `visit_month.php` — 월별, 2.1.6 `visit_year.php` — 년별

- 둘 다 `g5_visit_sum`에 `SUBSTRING(vs_date,1,7)` / `SUBSTRING(vs_date,1,4)` GROUP BY
- 빠름. **PG에서는 `to_char(visit_date,'YYYY-MM')`로 변경**

#### 2.1.7 `visit_browser.php` ⚠⚠ 매우 비효율

```php
$sql = "SELECT * FROM g5_visit WHERE vi_date BETWEEN '$fr' AND '$to'";
$result = sql_query($sql);
while ($row = sql_fetch_array($result)) {
    $s = $row['vi_browser'] ?: get_brow($row['vi_agent']);  // PHP에서 카운트
    $arr[$s]++;
}
```

- **DB GROUP BY 안 쓰고 PHP에서 row 단위 카운트** → 기간이 1년이면 수십만 row를 PHP로 끌어옴
- DB 인덱스 무관, 메모리/네트워크 대역 낭비
- `vi_browser`가 비어있으면 PHP 함수 `get_brow($vi_agent)`로 매 row 정규식 매칭 → **CPU도 비싸짐**

#### 2.1.8 `visit_device.php`, 2.1.9 `visit_os.php` — 동일 패턴

- `visit_browser.php`와 동일 패턴 (전체 row 끌어와 PHP로 카운트). 같은 이슈.
- `visit_os.php`는 `vi_os` 비면 `get_os($vi_agent)` 또 정규식.

#### 2.1.10 `visit_domain.php` — 유입 도메인별

- `vi_referer` 전 row 끌어와 PHP `preg_match("/^http[s]*:\/\/(...)\//", ...)`로 도메인 추출
- 추가로 `www\.|search\.|...` 제거 정규식
- **모든 카운팅이 PHP**. 같은 패턴.

#### 2.1.11 `visit_search.php` — 접속자 검색

| 항목 | 내용 |
|---|---|
| **역할** | sfl/stx 기반 raw 방문 검색 (ip/referer/date) |
| **읽는 테이블** | `g5_visit` |
| **쓰는 테이블** | 없음 |
| **이슈** | (a) `where $sfl like '$stx%'` — `$sfl`은 화이트리스트 체크 OK지만 **$stx는 escape 없음** → SQL injection. (b) sub_menu가 `visit_list.php`와 동일 권한 — 굳이 별 페이지 분리 필요 X (Phase F에서는 `visit_list`에 검색 폼 통합) |
| **운영 사용** | 거의 안 봄 (GA4 검색이 더 강력) |

#### 2.1.12 `visit_delete.php` + `visit_delete_update.php` — 로그 삭제

- 폼: 년/월 + 방법(`before`/`specific`) + 관리자 비밀번호 입력
- update.php: super admin only, `check_password()` 검증 후 `DELETE FROM g5_visit WHERE SUBSTRING(vi_date,1,7) < $del_date`
- **이슈**: 
  - SQL: 인덱스(`vi_date`) 있어 OK지만 `SUBSTRING(...)` 사용 → **인덱스 무력화**. `WHERE vi_date < '$del_date-01'` 형태가 정답
  - DELETE 한 번에 수십만 row → MyISAM 락 길어질 수 있음
  - `g5_visit_sum`은 안 지움 (집계만 남음 — 운영 의도일 수도 / 버그일 수도)
  - **CSRF 토큰 없음**
- **운영 사용**: 옛날에 1번 정도 쓴 후 거의 안 씀. PG로 가면 `visit_log` 파티션(월별)으로 자르고 DROP PARTITION이 더 깨끗함.

---

### 2.2 매출 통계 (revenue_*, pay_month)

#### 2.2.1 `revenue_list_day.php` — 일별 매출 ⚠ **100% 더미**

| 항목 | 내용 |
|---|---|
| **역할** | "타로/신점/사주/심리 × (건수, 금액, 비율)" 일별 매출 표 — **그러나 HTML이 하드코딩됨** |
| **읽는 테이블** | 표면적으로 `g5_point_end`. 실제로 `$row` 안 씀 |
| **이슈 (치명)** | 1. `$sql_common = " from g5_point_end "` 셋업 후 `for ($i=0; $row=sql_fetch_array($result); $i++) { ... }` 루프 안에서 **`$row`를 한 번도 참조 안 하고 하드코딩 `2024-08-26(월) / 0,000 / 123,000 / 10.5` 출력**. 즉 `g5_point_end`에 1+ row 있으면 그 횟수만큼 같은 더미 행 반복 출력.  2. 검색폼은 `kind` switch가 있는데 g5_point_end에 `kind` 컬럼 없음 → SQL 에러 가능.  3. `fr_date`/`to_date` 실제 미적용. |
| **운영 사용** | 의미 없음 |

#### 2.2.2 `revenue_list_month.php` — 월별 매출 ⚠ **100% 더미**

- 더 심함: `<select>` 연도 옵션이 `<option>2024</option><option>2025</option>...<option>2029</option>` 하드코딩
- 데이터 출력 12행 모두 `2024-01 ~ 2024-12` 하드코딩, 모두 `0,000 / 123,000 / 10.5` 같은 값
- 이관 시 **버리고 새로 설계**

#### 2.2.3 `pay_month.php` — 월별 정산 트리거 (매출 통계 아님)

| 항목 | 내용 |
|---|---|
| **역할** | 직전월 상담사 전체에 대해 `set_con_account($mb_id)` 호출 → `g5_point_end`에 INSERT (월정산 일괄 실행) |
| **HTTP** | `GET /adm/pay_month.php` — 페이지 열기만 하면 즉시 실행 |
| **이슈 (치명)** | 1. **GET으로 정산 트리거** — 한 번 클릭하면 모든 5레벨 회원(상담사) 정산. CSRF/멱등성 없음.  2. `set_con_account()`는 세션 키 `executing_$mb_id`로 더블체크하지만 **세션이 페이지 단위로 분리되면 무효**.  3. `set_con_account()` 내부 SQL에 **buggy** `where  and mb_id=...` (앞에 조건 없는데 `and`로 시작) — 라이브에서 이 함수가 정상 호출되었는지 의심됨. 도메인 03(정산)에서 별도 분석 필요.  4. `mb_level='5'` 하드코딩 → 신규 RBAC와 어긋남.  5. mb_leave_date='' 비교 → 신규는 `left_at IS NULL` |
| **운영 사용** | 매월 1일 크론 또는 운영자가 직접 클릭. **이 화면은 매출 보기가 아니라 액션 페이지**. 도메인 03 정산 구현으로 흡수. |

---

### 2.3 인기 컨텐츠 (popular_*)

#### 2.3.1 `popular_list.php` — 검색어 raw 목록 (관리)

| 항목 | 내용 |
|---|---|
| **역할** | `g5_popular` row 목록 + 선택 삭제 (super admin 만 보임) |
| **HTTP** | `GET/POST /adm/popular_list.php?sfl=&stx=&page=` |
| **읽는 테이블** | `g5_popular` |
| **쓰는 테이블** | `g5_popular` (DELETE) |
| **이슈** | 1. `$pp_id = (int) $_POST['chk'][$i]` 후 `delete ... where pp_id = '$pp_id'` — int 캐스팅으로 안전.  2. `$stx`는 escape 없음. `pp_word` LIKE/EQ 분기.  3. **CSRF 토큰 hidden 있지만 검증 안 함** (`isset($token) ? $token : ''`).  4. UI에 등록IP 노출 — 개인정보. |
| **운영 사용** | 매우 드묾 |

#### 2.3.2 `popular_rank.php` — 검색어 순위

| 항목 | 내용 |
|---|---|
| **역할** | 기간 내 검색어 GROUP BY 카운트 순위표 |
| **읽는 테이블** | `g5_popular` |
| **쿼리** | `SELECT pp_word, COUNT(*) AS cnt FROM g5_popular WHERE pp_date BETWEEN $fr AND $to GROUP BY pp_word ORDER BY cnt DESC LIMIT $page` |
| **이슈** | 1. `total_count`를 위해 GROUP BY 결과 row 수를 `sql_num_rows()`로 받음 → 모든 row를 fetch 한 번 더 (중복 비효율).  2. `g5_popular`가 `(date, word, ip)` 단위라 `COUNT(*)` = (해당 기간 word 검색 IP 수) ≠ 실제 검색 횟수(같은 IP가 여러번 검색해도 INSERT IGNORE는 UNIQUE에 막혀 1로 처리). **실제로는 "유니크 검색자(IP) 수"를 보고 있음**.  3. `trim(pp_word) <> ''` 조건 OK |
| **운영 사용** | 가끔. 신규에서는 `search_popular_daily`로 통합 후 더 정확하게 |

---

## 3. 발견된 이슈 (전체 카테고리)

### 3.1 보안

| 파일 | 이슈 |
|---|---|
| `visit_list.php` | `$domain` GET 파라미터를 `LIKE '%{$domain}%'`로 직접 삽입 → SQLi |
| `visit_search.php` | `$stx` escape 없이 `LIKE '$stx%'` / `LIKE '%$stx%'` → SQLi |
| `popular_list.php` | `$stx` escape 없음 (sfl은 화이트리스트 OK) |
| `revenue_list_day/month.php` | `$stx` escape 없음 (코드 자체가 더미라 실효 없지만 패턴 위험) |
| `visit_delete_update.php` | CSRF 토큰 없음. POST이긴 함. 그러나 `check_password(super)` 추가 검증으로 1차 방어 |
| `pay_month.php` | **GET 트리거**, CSRF 없음, 멱등성 부족 |
| `visit_list.php` | `$row['vi_referer']`를 `<a href="...">`로 출력 (`get_text` 처리는 있으나 `target="_blank"` + 외부 URL → reverse-tabnabbing). `rel="noopener"` 없음 |
| 모든 visit_*.php | `is_admin == 'super'`만 풀 IP, 나머지는 `G5_IP_DISPLAY`로 마스킹 — 신규는 RBAC 권한으로 분리 |

### 3.2 성능

| 파일 | 이슈 | 개선 방향 |
|---|---|---|
| `visit_browser/device/os/domain.php` | **raw 전체 SELECT * 후 PHP에서 카운트** (DB GROUP BY 미사용) | DB 단에서 GROUP BY + 인덱스 |
| `visit_hour.php` | `g5_visit` raw 풀스캔 (기간 무한대) | `vi_date` 인덱스는 있음. 그러나 raw 누적되면 1년 GROUP BY는 비싸짐. **시간별 집계 테이블 추가** 고려 |
| `visit_delete_update.php` | `WHERE SUBSTRING(vi_date,1,7) < '$del_date'` — 인덱스 무력화 | `WHERE vi_date < $first_day_of_target` |
| `popular_rank.php` | `total_count` 계산용으로 group result를 두 번 쿼리 | `COUNT(*) OVER ()` 또는 단일 쿼리 |

### 3.3 데이터 정합성/UX

- `visit_*.php`에서 `vi_browser`/`vi_os`가 빈 row → 매 요청 `get_brow($vi_agent)` PHP 정규식 → INSERT 시점에 미리 채우면 해결 (수집기 책임으로 이동)
- `g5_visit_sum.vs_date` PK여서 멱등 OK. `g5_visit`은 `(vi_ip, vi_date)` UNIQUE — 같은 IP 같은 날 두 번째 방문은 무시되므로 **세션 단위 PV가 아니라 일별 UV**. 신규 `visit_log`도 동일 정책 유지.
- `revenue_list_day/month.php` 더미 = 라이브에 매출 대시보드 없음. 운영자는 **GA4와 PG사 어드민**으로 매출 확인했다고 추정.
- `g5_popular`의 `pp_ip` 보존은 GDPR/개보법 관점에서 부적절. 신규에선 일별 집계만 남김.

### 3.4 UX

- 12개 visit_* 페이지가 모두 anchor에 노출되지만 실제 구분력은 적음(특히 brow/os/device는 사실상 같은 정보 다른 컬럼). 4개 정도로 통합 권장.

---

## 4. 운영 사용 여부 추정 — 이관 우선순위

| 메뉴 | 사용 추정 | 이관 권장 | 사유 |
|---|---|---|---|
| `visit_list` | 가끔 | △ (기본 제공) | raw 행 보기 — Dashboard 보조용 |
| `visit_date` | 자주 | **O** | 일별 추이 = Dashboard 핵심 차트 (이미 `visitorTrend` 구현됨) |
| `visit_hour` | 가끔 | △ | 운영시간 안내 결정에 도움 — Dashboard 카드 1장 |
| `visit_week` | 가끔 | △ | 운영시간 안내 결정 |
| `visit_month` | 자주 | **O** | 월간 추이 — KPI |
| `visit_year` | 거의 안 봄 | △ | 연 1~2회 |
| `visit_browser` | 거의 안 봄 | **컷** | GA4가 훨씬 풍부 |
| `visit_device` | 거의 안 봄 | **컷** | GA4 |
| `visit_os` | 거의 안 봄 | **컷** | GA4 |
| `visit_domain` | 가끔 | △ | 유입 채널 (네이버/구글) — GA4 우위 |
| `visit_search` | 거의 안 봄 | **컷** | `visit_list` 검색폼으로 흡수 |
| `visit_delete` | 가끔(1년 1회) | △ | **파티션 + DROP PARTITION**으로 대체 권장 |
| `revenue_list_day` | **사용 안 함**(더미) | **O** (재설계) | 매출 KPI 핵심. **payment + consultation 기반 새 설계** |
| `revenue_list_month` | **사용 안 함**(더미) | **O** (재설계) | 매출 KPI 월별 |
| `pay_month` | 도메인 03 | (도메인 03) | 정산 트리거. 통계가 아님 |
| `popular_list` | 거의 안 봄 | △ | super only — 신규는 검색어 일별 집계로 |
| `popular_rank` | 가끔 | △ (Dashboard 카드) | 인기 검색어 TOP10 카드 |

### 권장 이관 범위 (Phase F)

**필수**:
1. `Dashboard.tsx` 더미 fallback 제거 → 실 데이터 연결
2. `/admin/stats/visit` 페이지 — 일별/월별 추이 차트 (visit_date + visit_month 통합)
3. `/admin/stats/revenue` 페이지 — 일별/월별 매출 (payment + consultation 합산, kind별 분해)
4. Dashboard 카드 추가: 인기 검색어 TOP10 (`search_popular_daily`)

**선택**:
5. 시간대/요일별 히트맵 한 화면 (visit_hour + visit_week 통합)
6. 유입 도메인 TOP10 (visit_domain 단일 화면)

**컷 (이관 X)**:
- visit_browser / visit_device / visit_os / visit_search
- popular_list (관리는 search_popular_daily 자동 + 운영자 수동 삭제 필요시 GET 검색폼 정도)

---

## 5. web/mng 이관 설계

### 5.1 NestJS API 설계

기존 `DashboardModule` 확장 + 신규 `StatsModule` 추가.

#### 5.1.1 Dashboard 보강 (이미 있는 것 + 보강)

| Endpoint | 현재 | 변경 |
|---|---|---|
| `GET /admin/dashboard/summary` | OK | 추가 카드: 오늘 방문자(visit_summary), 인기검색어 TOP3 |
| `GET /admin/dashboard/sales-trend?days=N` | OK (call_070/060/chat/charge) | **변경 없음**. 단 `kind`별 분해 추가 옵션(`?byKind=1`) |
| `GET /admin/dashboard/visitor-trend?days=N` | OK | OK |
| `GET /admin/dashboard/popular-keywords?days=7&limit=10` | **신규** | `search_popular_daily` GROUP BY |

#### 5.1.2 StatsModule 신규 (`/admin/stats/*`)

```
api/src/admin/stats/
├── stats.module.ts
├── stats.controller.ts
└── stats.service.ts
```

| Endpoint | 응답 | 쿼리 (PG) |
|---|---|---|
| `GET /admin/stats/visit/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` | `[{date, count}]` | `SELECT visit_date, visit_count FROM visit_summary WHERE visit_date BETWEEN $1 AND $2 ORDER BY visit_date` |
| `GET /admin/stats/visit/hourly?from=&to=` | `[{hour:'00'..'23', count}]` | `SELECT to_char(visit_time,'HH24') AS h, COUNT(*) FROM visit_log WHERE visit_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1` |
| `GET /admin/stats/visit/weekly?from=&to=` | `[{weekday:0..6, count}]` (월=0) | `SELECT (EXTRACT(ISODOW FROM visit_date)-1)::int, SUM(visit_count) FROM visit_summary WHERE visit_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1` |
| `GET /admin/stats/visit/monthly?from=&to=` | `[{ym, count}]` | `SELECT to_char(visit_date,'YYYY-MM'), SUM(visit_count) FROM visit_summary WHERE visit_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1 DESC` |
| `GET /admin/stats/visit/domain?from=&to=&limit=20` | `[{domain, count, rate}]` | referer URL 파싱은 PG에서 정규식으로(`substring(referer FROM 'https?://([^/]+)/')`) — 기간 짧게(<= 30일) 권장 |
| `GET /admin/stats/visit/list?from=&to=&domain=&page=&pageSize=` | `{items, total, page, pageSize}` | `visit_log` raw 페이징, IP는 권한별 마스킹 |
| `GET /admin/stats/popular?from=&to=&limit=20` | `[{word, count, rate, rank}]` | `SELECT word, SUM(search_count) AS cnt FROM search_popular_daily WHERE log_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 2 DESC LIMIT $3` |
| `GET /admin/stats/revenue/daily?from=&to=` | `[{date, byKind:{타로,신점,사주,심리}, total}]` | consultation JOIN counselor_category + payment LEFT JOIN, 일자별 SUM |
| `GET /admin/stats/revenue/monthly?year=YYYY` | `[{ym, byKind, total}]` | 동일, 월 집계 |
| `DELETE /admin/stats/visit?before=YYYY-MM-DD` (super only) | `{deleted}` | `DELETE FROM visit_log WHERE visit_date < $1` (인덱스 활용). 추후 파티션 도입 시 `DROP PARTITION` |

#### 5.1.3 매출 산출 (revenue_*) — 핵심

라이브 더미를 버리고 신규 정의:

```sql
-- /admin/stats/revenue/daily?from=&to=
WITH dates AS (
  SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS d
), consult AS (
  SELECT c.ended_at::date AS d,
         COALESCE(m.counselor_category, '기타') AS kind,
         SUM(c.amt) AS amt,
         COUNT(*)  AS cnt
    FROM consultation c
    LEFT JOIN member m ON m.id = c.counselor_id
   WHERE c.ended_at::date BETWEEN $1 AND $2
   GROUP BY 1,2
), pay AS (
  SELECT created_at::date AS d, SUM(amount) AS amount
    FROM payment WHERE status='completed' AND created_at::date BETWEEN $1 AND $2
   GROUP BY 1
)
SELECT dates.d AS date,
       COALESCE(SUM(c.amt) FILTER (WHERE c.kind='타로'), 0) AS tarot_amt,
       COALESCE(SUM(c.cnt) FILTER (WHERE c.kind='타로'), 0) AS tarot_cnt,
       COALESCE(SUM(c.amt) FILTER (WHERE c.kind='신점'), 0) AS sinjum_amt,
       COALESCE(SUM(c.cnt) FILTER (WHERE c.kind='신점'), 0) AS sinjum_cnt,
       COALESCE(SUM(c.amt) FILTER (WHERE c.kind='사주'), 0) AS saju_amt,
       COALESCE(SUM(c.cnt) FILTER (WHERE c.kind='사주'), 0) AS saju_cnt,
       COALESCE(SUM(c.amt) FILTER (WHERE c.kind='심리'), 0) AS simri_amt,
       COALESCE(SUM(c.cnt) FILTER (WHERE c.kind='심리'), 0) AS simri_cnt,
       COALESCE(SUM(c.amt), 0)              AS consult_total,
       COALESCE(MAX(p.amount), 0)           AS charge_total,
       COALESCE(SUM(c.amt), 0) + COALESCE(MAX(p.amount), 0) AS grand_total
  FROM dates
  LEFT JOIN consult c ON c.d = dates.d
  LEFT JOIN pay     p ON p.d = dates.d
 GROUP BY dates.d
 ORDER BY dates.d;
```

> 매출 정의:
> - **상담 매출**(`consultation.amt`) = 고객 차감 포인트(=원). kind는 `member.counselor_category` 평탄화 (도메인 03 정의대로)
> - **충전 매출**(`payment.amount`) = 신규 결제 (kind 무관)
> - 라이브 더미 화면의 `타로/신점/사주/심리 × 건수/금액/비율` 포맷은 **상담 매출 한정**으로 표시. 충전 매출은 별도 컬럼/카드.

#### 5.1.4 공통 가드/검증

- `@UseGuards(AdminAuthGuard)` 모듈 단위 적용
- 날짜 검증: `class-validator`의 `@IsDateString()` + `@Matches(/^\d{4}-\d{2}-\d{2}$/)`
- 기간 최대 365일 제한 (raw GROUP BY 페이지는 30일 제한)
- IP 마스킹: 일반 admin은 `192.168.0.*`, super만 풀 IP. 신규 RBAC `resource='stats'`의 가독 권한 단계로 분리.

### 5.2 React 페이지 설계

```
web/mng/src/pages/stats/
├── StatsVisit.tsx       # 일/월/시간/요일 통합 화면 (탭)
├── StatsRevenue.tsx     # 매출 일별/월별 (탭)
├── StatsPopular.tsx     # 인기 검색어 (선택)
└── StatsVisitList.tsx   # raw 방문 row (선택)
```

#### 5.2.1 라우팅 (App.tsx)

```
/mng/stats/visit         → StatsVisit
/mng/stats/revenue       → StatsRevenue
/mng/stats/popular       → StatsPopular
```

#### 5.2.2 StatsVisit.tsx

- 상단 날짜 범위 picker (`fr_date`/`to_date`)
- 4개 탭: **일별 / 월별 / 시간대 / 요일**
- 일별: AreaChart (이미 Dashboard에 있음 — 컴포넌트 추출)
- 월별: BarChart
- 시간대: 24슬롯 BarChart
- 요일: 7슬롯 BarChart (월~일)
- 모두 Recharts 재사용

#### 5.2.3 StatsRevenue.tsx

- 날짜 picker
- 2개 탭: **일별 / 월별**
- 메인 차트: Stacked AreaChart (타로/신점/사주/심리/충전 5개 시리즈)
- 메인 표: 라이브 더미 표 디자인 그대로 (헤더 4분야 × 건수/금액/비율 + 합계)
- 엑셀 다운로드 버튼: `GET /admin/stats/revenue/daily.xlsx?...` (`exceljs` 또는 클라이언트 csv-export)

#### 5.2.4 Dashboard.tsx 수정

- `visitor-trend` API 이미 존재 — `dummy fallback` 제거 (운영 데이터 들어오면 자연스럽게 실값)
- KPI 카드 추가: "오늘 방문자" (visit_summary 오늘 row)
- 카드 추가: "인기 검색어 TOP5" (popular API)

#### 5.2.5 Sidebar 메뉴 (Sidebar.tsx 추정 구조)

```
운영 통계
├─ 대시보드 (/mng)
├─ 방문자 통계 (/mng/stats/visit)
├─ 매출 통계 (/mng/stats/revenue)
└─ 인기 검색어 (/mng/stats/popular)
```

---

## 6. ETL 매핑

### 6.1 `g5_visit` → `visit_log`

```sql
INSERT INTO visit_log (vi_id, visit_ip, visit_date, visit_time, referer, user_agent, browser, os, device)
SELECT vi_id,
       NULLIF(vi_ip, '')::INET,
       vi_date,
       NULLIF(vi_time, '00:00:00'),
       NULLIF(vi_referer, ''),
       NULLIF(vi_agent, ''),
       NULLIF(vi_browser, ''),
       NULLIF(vi_os, ''),
       NULLIF(vi_device, '')
  FROM mig_g5_visit
 WHERE vi_date >= '2024-01-01'   -- 2년 보관
ON CONFLICT (visit_ip, visit_date) DO NOTHING;
```

**주의**:
- `vi_ip`에 IPv6/잘못된 형식 row 가능 → `INET` 캐스트 실패 row 별도 사이드 테이블 (`mig_visit_log_invalid`)로 dump
- `'0000-00-00'` 더미 vi_date row 제거
- 라이브 데이터 양에 따라 `WHERE vi_date >= now()-2년` 등으로 컷 (2년 이상은 의미 없음)

### 6.2 `g5_visit_sum` → `visit_summary`

```sql
INSERT INTO visit_summary (visit_date, visit_count)
SELECT vs_date, vs_count
  FROM mig_g5_visit_sum
 WHERE vs_date <> '0000-00-00'
ON CONFLICT (visit_date) DO UPDATE SET visit_count = EXCLUDED.visit_count;
```

### 6.3 `g5_popular` → `search_popular_daily` (IP 폐기)

```sql
INSERT INTO search_popular_daily (word, log_date, search_count)
SELECT pp_word, pp_date, COUNT(*) AS cnt
  FROM mig_g5_popular
 WHERE pp_date <> '0000-00-00' AND TRIM(pp_word) <> ''
 GROUP BY pp_word, pp_date
ON CONFLICT (log_date, word) DO UPDATE SET search_count = EXCLUDED.search_count;
```

> `pp_ip` 컬럼은 ETL에서 **폐기** (개보법 관점). 라이브의 row 폭증 문제도 자연 해결.
> 신규 `search_log`는 ETL 대상 없음 (사용자향 검색 코드에서 새로 INSERT).

### 6.4 `g5_visit` 수집기 변경 (사용자향)

라이브의 영카트 `visit.lib.php`는 페이지 첫 방문 시 INSERT IGNORE.
신규 SSR(web/) 측 미들웨어로 옮길 때:

```ts
// web/src/middleware.ts 또는 별도 visit-tracker
async function trackVisit(req) {
  const ip = req.ip;
  const today = new Date().toISOString().slice(0,10);
  await sql`
    INSERT INTO visit_log (visit_ip, visit_date, visit_time, referer, user_agent, browser, os, device)
    VALUES (${ip}::inet, ${today}::date, CURRENT_TIME, ${req.headers.referer ?? null}, ${ua}, ${parsed.browser}, ${parsed.os}, ${parsed.device})
    ON CONFLICT (visit_ip, visit_date) DO NOTHING
    RETURNING xmax = 0 AS inserted
  `;
  // inserted 면 visit_summary +1 (별도 트랜잭션 또는 트리거)
  await sql`
    INSERT INTO visit_summary (visit_date, visit_count) VALUES (${today}::date, 1)
    ON CONFLICT (visit_date) DO UPDATE SET visit_count = visit_summary.visit_count + 1
  `;
}
```

브라우저/OS/device 파싱: `ua-parser-js` (npm) — PHP `get_brow()`/`get_os()`/browscap.php 대체.

### 6.5 `g5_point_end` (매출 관점)

도메인 03(정산)에서 ETL. **본 도메인의 매출 통계는 `consultation.amt` 합산**으로 산출하므로 별도 ETL 불필요.

---

## 7. 추가 설계 권고

### 7.1 파티셔닝

`visit_log`가 운영 1년 후 1천만 row 넘으면 월별 RANGE PARTITION 권장:

```sql
CREATE TABLE visit_log (...) PARTITION BY RANGE (visit_date);
CREATE TABLE visit_log_2026_04 PARTITION OF visit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

운영자 `visit_delete`는 `DROP PARTITION` SQL 한 줄로 끝.

### 7.2 인덱스 추가

`visit_log` 검색 패턴 보강:
```sql
CREATE INDEX idx_visit_log_ip_date ON visit_log (visit_ip, visit_date DESC);
-- referer 도메인 검색용 (선택)
CREATE INDEX idx_visit_log_referer_substring ON visit_log USING gin (referer gin_trgm_ops);
```

### 7.3 GA4 정책

운영자가 실제로 보는 건 GA4. 신규 mng의 통계는 **운영 KPI(매출/회원/상담사)에 집중**, 트래픽/장비/브라우저는 GA4에 위임. → visit_browser/device/os 컷이 정당화됨.

### 7.4 캐시

매출 통계는 일단위 집계가 무거우면 `MATERIALIZED VIEW`:
```sql
CREATE MATERIALIZED VIEW mv_revenue_daily AS
  SELECT ended_at::date AS d, m.counselor_category AS kind, SUM(c.amt) AS amt, COUNT(*) AS cnt
    FROM consultation c LEFT JOIN member m ON m.id = c.counselor_id
   GROUP BY 1,2;
CREATE UNIQUE INDEX ON mv_revenue_daily (d, kind);
-- pg_cron으로 매일 새벽 REFRESH
```

---

## 8. 작업 체크리스트 (Phase F)

- [ ] `phase-f-stats.md`(본 문서를 단순화한 실작업 plan) 작성
- [ ] `api/src/admin/stats/` 모듈 신규 (`StatsModule`, controller, service)
- [ ] DashboardService에 `popularKeywords` 추가, dummy fallback 제거 옵션
- [ ] `web/mng/src/pages/stats/StatsVisit.tsx`, `StatsRevenue.tsx`, `StatsPopular.tsx`
- [ ] Sidebar 메뉴 항목 추가
- [ ] 차트 공통 컴포넌트 추출 (현재 Dashboard 내부 인라인 — `components/charts/AreaTrend.tsx` 등)
- [ ] ETL `etl/06_visit_log.sql`, `etl/06_visit_summary.sql`, `etl/06_search_popular_daily.sql`
- [ ] 사용자향(SSR) `visit-tracker` 미들웨어 (영카트 visit.lib.php 대체)
- [ ] 검증: 더미 데이터 fallback 제거 후 빈 차트 처리, 365일 초과 차단, IP 마스킹

---

## 9. 컷 확정 정리

이관 안 함 (코드 옮기지 않음, 라이브에 그대로 두지만 신규 mng에는 미구현):

- `visit_browser.php` / `visit_device.php` / `visit_os.php` / `visit_search.php` (GA4 위임)
- `revenue_list_day.php` / `revenue_list_month.php` (더미. **신규 화면으로 처음부터 재설계**)
- `pay_month.php` (도메인 03 정산 트리거로 흡수)
- `popular_list.php` (super only 관리. 신규는 `search_popular_daily`만 운영. 필요 시 `search_log`/`search_popular_daily` 직접 SQL)

이관 함:
- `visit_date` / `visit_month` → StatsVisit.tsx 일별/월별 탭
- `visit_hour` / `visit_week` → StatsVisit.tsx 시간/요일 탭 (선택)
- `visit_year` → 단순 케이스라 monthly와 묶음
- `visit_domain` → StatsVisit.tsx 도메인 탭 또는 별 카드
- `visit_list` → StatsVisitList.tsx (선택, raw row 보기)
- `visit_delete` → 관리 메뉴 안에 한 액션, super-only, 파티션 DROP 권장
- `popular_rank` → Dashboard 카드 + StatsPopular.tsx
- 매출(신규 설계) → StatsRevenue.tsx + Dashboard 매출 카드 강화
