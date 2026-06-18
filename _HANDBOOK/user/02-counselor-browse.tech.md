# [AI 전용] 상담사 목록/필터/검색 — 기술 상세

## API 엔드포인트 (모두 `/api/user/counselors`)

| 메서드 | 경로 | 인증 | 용도 |
|---|---|---|---|
| GET | `/user/counselors` | Optional | 메인/리스트 (탭·카테고리·이벤트·limit) |
| GET | `/user/counselors/event` | 없음 | 활성 이벤트 상담사 (최대 3명) |
| GET | `/user/counselors/filter-options` | 없음 | 분야(해시태그) 동적 옵션 |
| GET | `/user/counselors/search` | Optional | 상담사 검색 |
| GET | `/user/counselors/popular-keywords` | 없음 | 인기 검색어 |
| GET | `/user/counselors/:id` | Optional | 상세 |
| POST | `/user/counselors/:id/like` / DELETE | UserAuth | 단골 등록/해제 |
| POST | `/user/counselors/:id/request-consult` | UserAuth | 부재 상담사 호출 알림 |

> ⚠️ 라우트 우선순위: `event` / `filter-options` / `search` / `popular-keywords` / `favorites` / `me/*` 가 모두 `:id` 매칭보다 **먼저** 등록되어야 함 (controller 순서 의존).

## 쿼리 파라미터

### GET `/user/counselors`
| 파라미터 | 값 | 기본 | 비고 |
|---|---|---|---|
| `tab` | `all` `popular` `chat` `new` | `all` | 그 외 값은 무시(`parseTab` → undefined → all) |
| `category` | `사주` `타로` `신점` `심리` `전체` | — | `전체`/빈값은 필터 안 함 |
| `limit` | 1~300 | 13 | 컨트롤러에서 `Math.min(300, ...)` clamp |
| `event` | `1` `true` | — | 활성 이벤트 상담사만 (`eventOnly`) |

### GET `/user/counselors/search`
| 파라미터 | 값 | 기본 |
|---|---|---|
| `q` | 검색어 (trim) | 빈 q → 빈 결과 |
| `limit` | 1~50 | 30 |

### GET `/user/counselors/popular-keywords`
| 파라미터 | 값 | 기본 |
|---|---|---|
| `limit` | 1~20 | 6 |

## 핵심 코드 위치

- 컨트롤러: `api/src/user/counselors/counselors.controller.ts`
- 서비스: `api/src/user/counselors/counselors.service.ts`
  - `list()` — 리스트/탭/카테고리/이벤트 (L497~)
  - `search()` — relevance 정렬 검색 (L974~)
  - `popularKeywords()` — 검색로그+해시태그+핀 머지 (L807~)
  - `getFilterOptions()` — 해시태그 distinct (L766~)
  - `listEvent()` — 이벤트 상담사 3명 (L1505~)
  - `requestConsult()` — 부재 호출 알림 (L146~)
- 프론트:
  - `web/user/src/pages/CounselorList.tsx` — 리스트 + 칩 필터 + 더보기
  - `web/user/src/pages/Search.tsx` — 인기 검색어
  - `web/user/src/pages/SearchResult.tsx` — 검색 결과 (`/search/result?q=`)
  - `web/user/src/components/FilterDropdown.tsx` — filter_select 칩 드롭다운
  - `web/user/src/components/CounselorCard.tsx` — 카드
  - `web/user/src/components/Pagination.tsx` — (현재 리스트는 누적 더보기로 대체)
  - API 래퍼: `web/user/src/lib/api.ts` → `counselorsApi`
  - 매퍼: `web/user/src/lib/counselor-mapper.ts` → `mapPublicCounselorToCard`

## 상담사 번호 칩 (dtmfno + 150, 2026-06-11)

- 백엔드 `list()` 응답에 `csrid`(m2net 상담사ID) + `dtmfno`(상담사연결번호) 이미 포함 (counselors.service.ts **L737-738**). 백엔드 수정 불필요.
- 매퍼 `mapPublicCounselorToCard` (counselor-mapper.ts):
  ```ts
  const dno = c.dtmfno != null ? Number(c.dtmfno) : NaN
  // 원본 1~999(정상 순번)만 표시 + 150. 90001~ 더미/미등록은 null(미표시).
  const counselorNo = Number.isFinite(dno) && dno > 0 && dno < 1000 ? dno + 150 : null
  // 연동용 code 는 원본 dtmfno 유지: code: c.dtmfno || c.csrid || String(id).padStart(6,'0')
  ```
- `CounselorCard.tsx`: prop `Counselor.counselorNo?: number|null`. 이름 옆(이름 → **번호칩** → NEW 순):
  ```tsx
  {counselorNo != null && (
    <span className="border border-[#ec4899]/35 rounded-full px-2 py-[2px] inline-flex items-baseline gap-px">
      <span className="text-[15px] font-extrabold text-[#111827]">{counselorNo}</span>
      <span className="text-[10px] font-bold text-[#9ca3af]">번</span>
    </span>
  )}
  ```
- ⚠️ **표시(+150)와 연동(원본 dtmfno)을 분리**: `counselorNo`=화면표시용, `code`=m2net 통화/채팅 연결용. +150 은 절대 연동에 쓰지 말 것(연결 깨짐).
- 디자인 변천(사장님 피드백 누적): 연보라 칩 → 진보라 배경(눈시림) → 배경제거 핑크숫자 → **얇은 핑크 테두리 + 검은 숫자(크게) + 연한 "번"** 확정.
- m2net 매핑: 화면 `153번` = m2net 상담사연결번호 `3번` (−150). 운영자 조회 시 −150.

## 정렬 (list) — 2026-06-12 재확정 (가용 폭 기준)

state set: `IDLE/ABSE/CONN/RESV/CRDY/RDCH/RDVC/CNCH`

`statePriority` (전체·인기·신규 탭) — counselors.service.ts L572~:
```
0 → CONN/CNCH                                   (상담중 — 시간제한 폐지, 상담 내내)
4 → ABSE/RESV                                   (부재)            ← 부재를 상담중 다음에 먼저 판정
1 → last_consult_ended_at >= now()-30min        (방금끝남, 대기상태)
2 → use_phone = true AND use_chat = true        (대기 + 전화·채팅 둘 다 가능)
3 → else                                        (대기 + 둘 중 하나만 가능)
```
> WHEN 순서 주의: 상담중(0) → 부재(4) → 방금끝남(1) → 둘다(2) → 하나만(3). 부재를 방금끝남보다 먼저 판정해야 "끝나자마자 휴식(ABSE) 전환"이 1순위로 안 뜸.
>
> **변경 이력**: 이전엔 `use_phone=true` 면 채팅 여부 무관 2점이라, **전화만 켠 상담사가 전화·채팅 둘 다 켠 상담사와 같은 칸에 섞여** 헷갈렸다(채팅 오프라인인데 위에 뜸). → "둘 다 가능"을 "하나만 가능"보다 위로 올려 가용 폭이 넓은 상담사를 우대(2026-06-12).

`statePriorityChat` (채팅 탭) — 전체 탭과 동일 철학:
```
0 → CONN/CNCH                                   (상담중)
4 → ABSE/RESV                                   (부재)
1 → last_consult_ended_at >= now()-30min        (방금끝남)
2 → use_phone = true AND use_chat = true        (전화도 같이 가능)
3 → else                                        (채팅만 가능)
```

### 동점자(같은 statePriority) — updated_at DESC + 어뷰징 가드 (2026-06-12)
- 같은 점수 그룹은 `updated_at DESC, id DESC` 로 정렬 → **가장 최근 상태 갱신자가 그룹 맨 위**.
- ⚠️ `setMyAvailability`(counselors.service.ts L306~)에 **no-op 가드** 추가: `use_phone/use_chat/state` 가 기존과 완전히 동일하면 UPDATE 자체를 건너뛴다(`updated_at` 미갱신). 값을 바꾸지 않고 "저장"만 연타해 순위 새치기하는 걸 차단.

orderBy:
- `popular`: `is_rising DESC, statePriority, updated_at DESC, id DESC`
- `chat`: `statePriorityChat, updated_at DESC, id DESC`
- `new`: `created_at DESC, id DESC`
- `all`: `is_recommended DESC, statePriority, updated_at DESC, id DESC` (추천핀=0순위)

### `last_consult_ended_at` (방금끝남 2순위 근거) — 2026-06-12
- 컬럼: `member.last_consult_ended_at timestamptz` + `idx_member_last_consult_ended_at` (migration `20260612000000_add_last_consult_ended_at.sql`).
- 기록 지점: `api/src/pg-callbacks/m2net-push.service.ts` L489~ — 상담 종료(통화 `DISCONNECT` / 채팅 `END_CHAT`) 시 `state=readyState, last_consult_ended_at=now()`. **`NO_ANSWER_CSR`(미응답)은 제외**(실제 상담 아님).
- 30분 경과하면 자동으로 3·4순위(일반 대기)로 내려감(별도 cron 불필요 — 조회 시점 `now()-30min` 비교).

tabWhere: 전체/인기/신규는 `state IN (IDLE,RDCH,RDVC,CRDY,CONN,CNCH,ABSE,RESV)` + (`use_phone OR use_chat`). 채팅은 `use_chat=true AND state IN (IDLE,RDCH,RDVC,CNCH,ABSE,RESV)`. 신규는 추가로 `created_at >= now()-90d`.

### E2E 테스트 계정 비노출 (2026-06-12)
list/search 공통 WHERE 에 `AND COALESCE(m.mb_id,'') NOT LIKE 'e2e%'` — `e2e_dual`("E2E듀얼", id 141, 0원) 등 자동테스트 계정이 사용자 목록/검색에 안 뜨게 함(상태 무관). 테스트는 계정 그대로 사용.

### 데모 상담사(dummy_*) = 부재(ABSE) 고정 (2026-06-12)
`dummy_*`(id 102·104~111, 9명)는 **m2net 미등록(csrid 빈값)** 이라 실제 상담 불가 → **state='ABSE'(부재)로 고정**. 목록엔 계속 보이되 카드가 "상담요청하기"(isOffline)로 떠 헛클릭(전화 연결실패 / 채팅 3분대기 자동취소) 방지. `use_phone/use_chat` 은 유지해야 목록 노출(WHERE `use_phone OR use_chat`). **정식 오픈 시 실제 상담사로 교체/제거.** (m2net 등록된 실 상담사는 15명 — csrid 있음, 정상 연결.) ⚠️ 이건 코드가 아니라 **DB 데이터 상태** — 다시 가용으로 풀리면 헛클릭 재발(데모는 ABSE 유지 권장).

### stuck 상태 자동복구
`list()` 진입 시 `CNCH/CONN` 인데 진행 중 `chat_room`(STAY/CNCH) 도 `consultation`(ended_at NULL, 2h 내)도 없으면 `use_phone/use_chat` 조합으로 ready state(RDVC/IDLE/RDCH/ABSE) 강제 복귀 (DB만, m2net은 별도 동기화).

## 카테고리 필터 (2026-06-02 fix)

진실원 = `member.counselor_category`. fallback = NULL일 때만 `pc.specialty/hashtag1/hashtag2` ILIKE.
```sql
AND (
  m.counselor_category = ${cat}
  OR (m.counselor_category IS NULL AND (
    specialty ILIKE %cat% OR hashtag1 ILIKE %cat% OR hashtag2 ILIKE %cat%
  ))
)
```
이전 specialty/hashtag ILIKE 만 쓰던 방식은 입력 미스로 누락 다수(월아신녀 신점 케이스) → counselor_category 정확매칭으로 전환.

## 단가 source of truth

```
unit_seconds = COALESCE(m.call_unit_seconds, m.chat_unit_seconds, pc.unit_seconds)
unit_cost    = COALESCE(NULLIF(m.call_070_unit_cost,0), NULLIF(m.chat_unit_cost,0), pc.unit_cost)
```
`member.*` 가 진실원 (관리자폼·m2net·정산 모두 사용). `post_counselor.unit_cost` 는 g5_write_5 레거시.

## is_liked / is_requested 계산

응답 후처리에서 로그인 회원(`requesterId`)이면:
- `member_favorite_counselor` 에서 `counselor_id = ANY(ids)` → `is_liked`
- `counselor_request_alert` 에서 24h 내 신청 → `is_requested`

postgres.js 가 BIGINT 를 string 으로 줄 수 있어 비교는 항상 `Number()` 정규화.

## 차단 필터 (blockExclude)

로그인 회원이면 `NOT EXISTS (counselor_block WHERE counselor_id=m.id AND member_id=requesterId)`.

## 검색 relevance (search)

```
0: name/nickname ILIKE term  (정확)
1: hashtag1/2 ILIKE (#term | term)  (# 유무 모두)
2: name/nickname ILIKE %term%
3: hashtag1/2 ILIKE %term%
4: specialty/headline ILIKE %term%
5: 그 외 (intro/bio)
```
WHERE 매칭 대상: name, nickname, headline, specialty, hashtag1/2, intro, bio (ILIKE %term%).
ORDER: `relevance ASC, review_count DESC NULLS LAST, id DESC`.

## 인기 검색어 (popularKeywords)

1. **search_log** (최근 7일, keyword<>'') 빈도 상위 cap개. result_count 무관(그누보드 g5_popular 정책).
2. 부족분만 **해시태그**(hashtag1/2 distinct, 빈도순) 로 보충. 이미 등장 키워드 중복 제외.
3. **search_keyword_pin** (rank, keyword) 머지 — 핀 있는 슬롯은 핀으로 교체, 나머지는 organic.
4. isNew: 로그출신 = MIN(created_at) > now-24h / 해시태그출신 = MAX(가입일) < 30d.

## 검색 로그 적재 (logSearch — fire-and-forget)

정규화: `lowercase + trim + leading # 제거`. reject 조건:
- 빈 keyword / 길이 <2 또는 >200
- 완성형 한글(가-힯)·영숫자 0자 (자모만 `ㅅㅏ` 등) → `!/[가-힯a-z0-9]/i.test` reject

INSERT 실패는 silent catch (검색 응답 지연 방지).

## 프론트 필터 (CounselorList.tsx)

- 백엔드는 `tab=all, category, limit=300, event` 만 보냄 → **분야/상담가능만은 클라이언트 필터**.
  - 분야: `[hashtag1, hashtag2].some(tag => tag.includes(field))`
  - 상담가능만: phoneOk(`use_phone && state∈[IDLE,RDVC,CRDY]`) 또는 chatOk(`use_chat && state∈[IDLE,RDCH,CRDY]`)
- `regularFields`: 현재 카테고리 상담사 해시태그에서 추출, `EXCLUDED_FIELDS`(사주/타로/신점) + `PINNED_NAMES`(재회) 제외, 가나다 정렬.
- `PINNED_FIELDS = [{name:'재회', emoji:'💕'}]` — 강조 줄 고정.
- 30초 폴링 + visibilitychange/pageshow 시 재조회 (showLoading=false).
- 카운트: 전체+무필터+이벤트X+상담가능X 일 때만 `statsApi.main().online_counselors`(boost값) 노출, 그 외엔 실제 `filtered.length`.
- 페이지네이션 → 누적 "더보기" (`INITIAL_VISIBLE=10`, 클릭 시 `visibleCount=filtered.length`).

## 카드 (CounselorCard.tsx)

BADGE_BG: `타로=#ec4899 / 신점=#00BBA7 / 사주=#FF6467 / 심리=#8259F5`. 뱃지 위치 `bottom-2 left-2`.
하트: `like_btn_icon_on/off.svg`, optimistic 토글 + LikeContext(`useLikeAction`), 비로그인이면 res=null → 원복.
부재(isOffline): `상담요청하기` 풀폭 → `counselorsApi.requestConsult(id)`, 401 시 `/login`, 24h중복은 `already:true`.
ContactButton 상태: available(outline pink) / busy(filled #ec4899 + 모달) / offline(회색 disabled).
rating(별점)은 매퍼는 받지만 카드에서 destructure 생략 — 미노출(2026-05-15).

## 이벤트 상담사 (listEvent)

조건: `pc.event_starts_at IS NOT NULL AND <= now() AND (event_ends_at IS NULL OR > now())`, `ORDER BY event_starts_at ASC LIMIT 3`. `event_banner_image_url`, `wide_headline/subcaption`, hero(`kind='wide'`) 포함.

## 관련 E2E spec

| spec | 커버 |
|---|---|
| `e2e/tests/02-user-counselor-list.spec.ts` | 리스트 로드/탭/카드 렌더 |
| `e2e/tests/13-filter-dropdown.spec.ts` | FilterDropdown 토글/선택/외부클릭 |
| `e2e/tests/26-keyword-pin.spec.ts` | 인기검색어 핀 고정 머지 |
| `e2e/tests/63-counselor-ranking.spec.ts` | 랭킹 경계(추천핀 선두·상담중→가용→부재) API 검증 |
| `e2e/tests/64-counselor-ranking-ui.spec.ts` | 랭킹 화면(손가락) — 카드 렌더 순서 검증 |
| `e2e/tests/65-test-account-hidden.spec.ts` | E2E 계정(e2e_*) 목록/검색 비노출 검증 |
| `e2e/tests/66-demo-counselor-absent.spec.ts` | 데모 상담사(dummy_*) 부재(ABSE) 고정 검증 |

## DB 참조 테이블

`member`(role, state, counselor_category, use_phone/chat, call_*/chat_* 단가, **last_consult_ended_at**, is_recommended, is_rising), `post_counselor`(headline, specialty, hashtag1/2, intro, bio, traits, event_*, is_exclusive), `member_file`(kind=profile/wide), `member_favorite_counselor`, `counselor_request_alert`, `counselor_block`, `post_review`(rating), `search_log`, `search_keyword_pin`.
