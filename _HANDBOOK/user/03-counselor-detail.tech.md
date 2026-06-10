# [AI 전용] 상담사 상세 — 기술 상세

## 라우트 / 컴포넌트

| 역할 | 파일 |
|---|---|
| 페이지 (소개 탭 기본) | `web/user/src/pages/CounselorDetail.tsx` |
| 공통 레이아웃 (헤더·프로필·탭·하단CTA) | `web/user/src/components/CounselorDetailLayout.tsx` |
| 후기 탭 본문 | `web/user/src/pages/CounselorReviewsTab.tsx` |
| 문의 탭 본문 | `web/user/src/pages/CounselorQnaTab.tsx` |
| 데이터 어댑터 타입 | `web/user/src/data/counselorDetails.ts` (`CounselorDetailData`, `Badge`, `BADGE_BG`) |

라우트: `/counselors/:id` (소개) · `/counselors/:id?tab=reviews` · `/counselors/:id?tab=qna`

탭 상태는 컴포넌트 state 가 아니라 **URL query(`?tab=`)가 단일 진실원천**. `useSearchParams` 로 읽어 `activeTab` 결정. 탭 버튼은 `navigate(to, { replace: true })` (히스토리 미적재).

## API

```
GET /api/user/counselors/:id            상세 (OptionalUserGuard — 로그인 시 is_liked 포함)
GET /api/user/counselors/:id/reviews    후기 페이지네이션 (limit/offset, 비인증)
POST   /api/user/counselors/:id/like    단골 등록 (UserAuthGuard)
DELETE /api/user/counselors/:id/like    단골 해제 (UserAuthGuard)
```

- 컨트롤러: `api/src/user/counselors/counselors.controller.ts`
- 서비스: `api/src/user/counselors/counselors.service.ts` → `getDetail(id, requesterId?)`
- 후기는 `UserReviewsService.byCounselor()` 위임. `reviews` limit 기본 20 / 최대 50.

### ⚠️ 라우트 우선순위 주의
`:id` 가 `ParseIntPipe` 라 `/event`, `/search`, `/favorites`, `/filter-options`, `/popular-keywords`, `/me/*` 같은 정적 서브패스는 **반드시 `@Get(':id')` 위에 선언**돼야 한다. (컨트롤러에 그렇게 배치됨)

## getDetail 쿼리 핵심 (`counselors.service.ts:1305~`)

- `member m LEFT JOIN post_counselor pc ON pc.member_id = m.id`
- 필터: `m.id = :id AND m.role = 'counselor' AND m.left_at IS NULL`
- **0건 → `NotFoundException('상담사를 찾을 수 없습니다.')`** → HTTP 404.
- 추가 서브쿼리:
  - `qna_count` = `counselor_qna` COUNT
  - `fan_count` = `member_favorite_counselor` 실시간 COUNT (pc 캐시 안 씀)
  - `is_liked` = requesterId 있을 때만 `member_favorite_counselor` 조회
  - 이미지: `member_file` kind=`profile` / kind=`wide` 의 최신 `stored_name(_webp)`. hero 없으면 profile 로 폴백.
- 파생 필드:
  - `fields` = `pc.specialty` 를 `|` 또는 `,` 로 split
  - `career` = `pc.bio` 를 줄바꿈 split
  - `hashtags` = `pc.hashtag1/2` (#prefix 보정)
  - `notice_content` = `pc.content`, `intro` = `pc.intro`, `notice_date` = `pc.updated_at`
  - `category` = `m.counselor_category` || `inferCategory(specialty, hashtag1, hashtag2)`

## 프론트 404 분기 (`CounselorDetail.tsx`)

```ts
.catch((e) => {
  if (e instanceof ApiError && e.status === 404) setError('해당 상담사를 찾을 수 없습니다.')
  else setError(...)
})
```
→ 에러/데이터 없음 시 "찾을 수 없습니다" + 뒤로가기 버튼 렌더.

## 탭 마운트 전략 (리패치 방지)

`mountedTabs: Set<ActiveTab>` — 한 번 방문한 탭은 **unmount 안 하고 CSS `hidden` 으로 show/hide**. 재방문 시 후기/문의 재요청 없음.

```tsx
<div className={activeTab !== 'reviews' ? 'hidden' : ''}>
  {mountedTabs.has('reviews') && <CounselorReviewsTab counselorId={id!} />}
</div>
```

## 탭 sticky + scroll (CounselorDetailLayout.tsx)

- 탭 바: `sticky top-0 z-20 bg-white` 컨테이너 안. 부모 wrapper 에 `data-testid="counselor-tab-area"`.
- 탭 전환 시 스크롤: `useEffect([activeTab])` 에서 `prevActiveTabRef` 와 비교 후
  ```ts
  const targetY = el.getBoundingClientRect().top + window.scrollY
  window.scrollTo({ top: targetY, behavior: 'smooth' })
  ```
  > `scrollIntoView({behavior:'smooth'})` 는 일부 headless 에서 무시 → `getBoundingClientRect + window.scrollTo` 로 직접 계산.
- 탭 active 스타일: 텍스트 `#f472b6` + `boxShadow: inset 0 -2px 0 0 #f472b6` (밑줄). 비활성 `#6A7282`.

## 공지/소개 HTML 안전 처리 (2026-06-04 버그수정)

버그: `pc.content`(Toast UI 에디터 HTML)를 일반 텍스트로 출력 → `<p><br></p>` 등이 글자로 노출.
수정: `sanitizeIntroHtml()` 통과 후 `dangerouslySetInnerHTML` 로 렌더.

`sanitizeIntroHtml(raw)` (`CounselorDetail.tsx`) 동작:
1. `<script|iframe|object|embed|style>...</>` 통째 제거
2. `<link|meta|base>` 단독 태그 제거
3. `on*=` 이벤트 핸들러 속성 제거
4. `href|src` 의 `javascript:|data:|vbscript:` 스킴 → `#` 치환

> 완전한 sanitizer 아님. 신청단계 운영자 승인 + Toast UI 자체 필터와 결합한 실용적 안전. 빈 값이면 빈 문자열 → 호출처에서 `'아직 등록된 공지가 없습니다.'` / `'상담사 소개가 준비 중입니다.'` 폴백.

- 소개 본문 렌더: `CounselorDetail.tsx` 의 `dangerouslySetInnerHTML={{ __html: data.introText }}`
- 공지 본문 렌더: `CounselorDetailLayout.tsx` 의 `dangerouslySetInnerHTML={{ __html: data.noticeContent }}`
- 둘 다 `.counselor-intro` 클래스 (CSS 서식 적용 컨테이너).

## 카테고리 뱃지 (BADGE_BG)

`web/user/src/data/counselorDetails.ts` 의 `BADGE_BG` 매핑:

| Badge | 색 |
|---|---|
| 타로 | `#ec4899` |
| 신점 | `#00BBA7` |
| 사주 | `#FF6467` |
| 심리 | `#8259F5` |

- `mapDetail()` 에서 `category === '기타'` → `'사주'` 폴백 (BADGE_BG 키 외 미정의 방어).
- 전속파트너: `is_exclusive` → `<ExclusiveBadge>` (검은 알약 + ⓘ 툴팁, 외부 클릭 닫힘).

## 단골/전화/채팅 버튼

- 하트: `useLikeAction().toggleLike(id, next)` — 401 시 통합 로그인 모달. optimistic 업데이트 후 실패 시 원복.
- **본인 단골 차단**: `addFavorite()` 에서 `Number(memberId) === Number(counselorId)` → `ForbiddenException`.
  > 2026-06-11 버그수정: JWT `sub` 가 런타임 문자열이라 `===` 직접 비교가 타입 불일치로 무력화 → `Number()` 캐스팅으로 수정.
- `addFavorite` 은 `ON CONFLICT DO NOTHING` (idempotent), 상담사 존재 검증 후 INSERT, 새 fan_count 반환.
- 전화/채팅: `BottomFixedBar` → `triggerConsult('phone'|'chat')` → `useConsultModal().openConsult()`.

## 후기 더보기 페이지네이션 (CounselorReviewsTab.tsx)

- `PAGE_SIZE = 20`. 초기 `offset=0` 로드, `hasMore = reviews.length < total`.
- "상담 후기 더보기" → `loadMore()` 가 `offset=reviews.length` 로 추가 fetch, append.
  > 2026-06-08 버그수정: 더보기가 `/reviews`(전체 목록)로 이탈하던 것을 탭 내 추가 로드로 변경.
- 후기 작성 가능 여부: `!member || member.role !== 'counselor'`.

## OG 메타 동적 주입

`CounselorDetail.tsx` useEffect 에서 `og:title/description/image/url` 등을 `document.head` 에 주입 (카카오/페북 카드 미리보기). cleanup 시 생성 태그 제거 + title 복원.

## 관련 E2E spec

| spec | 검증 |
|---|---|
| `e2e/tests/28-counselor-detail-tabs.spec.ts` | 공지 원시 HTML 미노출(`.counselor-intro` textContent 에 태그 없음), 탭 3개 활성 전환 색(`#f472b6`=rgb 244), `window.scrollTo` 가 탭 방향 호출, URL `?tab=` 동기화 |
| `e2e/tests/46-review-load-more.spec.ts` | 후기 25개 더미(counselor 141)에서 더보기 버튼 노출, `/reviews` 이탈 없음, 20→25 추가 로드 후 버튼 사라짐 |

## 운영 SQL

```sql
-- 특정 상담사 공지/소개 원문
SELECT m.id, m.nickname, pc.content AS notice, pc.intro
FROM member m LEFT JOIN post_counselor pc ON pc.member_id = m.id
WHERE m.id = :id;

-- 상담사 후기/문의/단골 건수
SELECT
  (SELECT COUNT(*) FROM counselor_qna WHERE counselor_id = :id) AS qna,
  (SELECT COUNT(*) FROM member_favorite_counselor WHERE counselor_id = :id) AS fans;
```
