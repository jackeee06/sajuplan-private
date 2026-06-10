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

## 정렬 (list)

state set: `IDLE/ABSE/CONN/RESV/CRDY/RDCH/RDVC/CNCH`

`statePriority` (전체·인기·신규 탭):
```
0 → CONN/CNCH AND updated_at >= now()-5min   (상담중)
1 → use_phone = true                          (대기 전화ON)
2 → else                                      (대기 채팅전용)
3 → ABSE/RESV                                 (부재)
```
`statePriorityChat` (채팅 탭): 0=상담중 / 2=부재 / 1=그 외.

orderBy:
- `popular`: `is_rising DESC, statePriority, updated_at DESC, id DESC`
- `chat`: `statePriorityChat, updated_at DESC, id DESC`
- `new`: `created_at DESC, id DESC`
- `all`: `is_recommended DESC, statePriority, updated_at DESC, id DESC`

tabWhere: 전체/인기/신규는 `state IN (IDLE,RDCH,RDVC,CRDY,CONN,CNCH,ABSE,RESV)` + (`use_phone OR use_chat`). 채팅은 `use_chat=true AND state IN (IDLE,RDCH,RDVC,CNCH,ABSE,RESV)`. 신규는 추가로 `created_at >= now()-90d`.

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

## DB 참조 테이블

`member`(role, state, counselor_category, use_phone/chat, call_*/chat_* 단가), `post_counselor`(headline, specialty, hashtag1/2, intro, bio, traits, event_*, is_exclusive), `member_file`(kind=profile/wide), `member_favorite_counselor`, `counselor_request_alert`, `counselor_block`, `post_review`(rating), `search_log`, `search_keyword_pin`.
