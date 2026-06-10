# [AI 전용] 후기(리뷰) CRUD — 기술 상세

## 코드 위치

- 컨트롤러: `api/src/user/reviews/reviews.controller.ts`
- 서비스: `api/src/user/reviews/reviews.service.ts`
- 프론트: `web/user/src/pages/MyReviews.tsx`, `MyReviewNew.tsx`, `MyReviewEdit.tsx`, `web/user/src/components/CounselorReviewsTab.tsx`
- DB 테이블: `post_review`, `post_review_reply`, `post_review_report`

## DB

```
post_review
- id, member_id, mb_id, counselor_id
- title, content, rating (1~5 / NULL)
- is_secret (항상 false 강제), has_file
- extras JSONB { consultation_id, photo_url, photo_url_webp, consult_type, consult_duration }
- is_best, best_at                 (상담사 선정)
- is_admin_best, admin_best_at      (관리자 선정 — 상위 노출)
- created_at, updated_at

post_review_reply (review_id) — 상담사 답변. 존재 시 수정·삭제 차단
post_review_report (review_id, reporter_member_id, reason_category, reason)
  - UNIQUE(review_id, reporter_member_id) → 중복 신고 23505 → 409
```

## 엔드포인트 요약

| 메서드 | 경로 | 가드 | 동작 |
|---|---|---|---|
| GET | `/user/reviews/recent` | — | 메인 후기 탭 최근 N건 |
| GET | `/user/reviews/mine` | UserAuth | 내가 쓴 후기 목록(페이지네이션, photo_only) |
| GET | `/user/reviews/:id` | UserAuth | 본인 후기 단건(수정 prefill). 남이면 403 |
| POST | `/user/reviews` | UserAuth | 작성 (`createMine`) |
| POST | `/user/reviews/upload-image` | UserAuth | 사진 업로드 → `{ url, url_webp }` |
| PATCH | `/user/reviews/:id` | UserAuth | 수정 (`updateMine`) |
| DELETE | `/user/reviews/:id` | UserAuth | 삭제 (`deleteMine`, hard delete) |
| PATCH | `/user/reviews/:id/best` | UserAuth | 상담사 본인 베스트 토글 (`toggleBest`) |
| POST | `/user/reviews/:id/report` | UserAuth | 신고 (`reportReview`) |

## createMine — 작성 검증 순서 (reviews.service.ts)

1. title/content trim 비면 400. `counselor_id` 없으면 400.
2. `consultation_id` 없으면 → **400** "상담 내역이 있어야 후기를 작성할 수 있습니다".
3. `consultation` 조회:
   - 없음(가짜/남의 id) → **404** "상담 내역을 찾을 수 없습니다".
   - `member_id !== memberId` → **403** "본인의 상담만…".
   - `ended_at` NULL → 400 "종료된 상담에만…".
   - `usetm < 300` → 400 "5분 이상…".
   - 종료 후 7일 초과 → 400 "상담 종료 후 7일 이내에만…".
4. **resolvedCounselorId = `consultation.counselor_id`** (프론트가 보낸 `input.counselor_id`보다 우선 — 정답 source of truth).
   - 그 멤버 role 검증: 없으면 404, `role!=='counselor'` → 400 "후기 작성 대상이 아닙니다".
   - ⚠️ role 검증이 consultation 확정 **이후**에 있는 게 핵심(2026-06-10 듀얼역할자 버그 픽스). `input.counselor_id`로 먼저 검증하면 안 됨.
5. 중복 차단: 같은 `member_id` + 같은 `extras.consultation_id` 있으면 400 "이미 후기를 작성한 상담입니다".
   - extras 이중 인코딩 레거시 호환 쿼리(`jsonb_typeof='string'` + `(extras #>> '{}')::jsonb`) 사용.
6. `is_secret`는 항상 false. `is_secret`/별점/사진 무관하게 공개.
7. INSERT 시 `extras`는 **`this.sql.json(extras)`** 로 저장(정상 jsonb object). `${JSON.stringify}::jsonb` 금지 — 이중 인코딩 → 중복 차단 무력화 + 코인 이중 지급 버그의 원인.
8. `maybeCreditReviewPoint` (코인) + `notifyCounselorOfReview` (알림톡) 둘 다 best-effort(실패해도 후기 성공).

## updateMine — 수정 가드

- owner `member_id !== memberId` → 403.
- `(now - created_at) > 300s` → 403 "후기 작성 후 5분이 지나면 수정할 수 없습니다".
- `post_review_reply` 존재 → 403 "상담사가 답변한 후기는 수정할 수 없습니다".
- 제목 빈 문자열 → 400. **제목·내용만** UPDATE(별점·사진·공개여부 불변).

## deleteMine — 삭제 + 코인 회수

- owner 검증(403) → 5분 초과(403) → 상담사 답변(403) 가드는 update와 동일.
- `point_history WHERE rel_action='review:{id}'` 의 earn_point 만큼 회수:
  `point.free_balance`/`total_earned`/`member.point` 차감 + `review_deleted:{id}` 기록 INSERT.
- `DELETE FROM post_review` (hard) → `post_counselor.review_count` 재집계.

## maybeCreditReviewPoint — 코인 적립 (`setting namespace='review'`)

| setting key | 현재값 | 의미 |
|---|---|---|
| `payout_enabled` | '1' | 꺼져 있으면 적립 안 함 |
| `payout_amount` | 500 | 기본 적립 |
| `payout_photo_bonus` | 500 | 사진 첨부 시 추가 → 합 1,000 |
| `payout_min_used` | — | `consultation.amt`가 이 값 이상이어야 지급 |

- 적립 흐름: tx 안에서 `point_history` INSERT(`rel_action='review:{reviewId}'`, actor_type='system') → `point.free_balance`/`total_earned` + `member.point` UPDATE → 커밋 후 `syncM2netForMember`(`m2net.addMemberCoin`) 동기화.
- expire_date는 `setting member.point_term` 기반.

## 사진 업로드 (reviews.controller.ts)

- `REVIEW_IMG_MAX_BYTES = 30 * 1024 * 1024` (5MB→30MB, 2026-06-10. 모바일 원본 413 차단 해소).
- 허용 확장자 `.jpg/.jpeg/.png/.gif/.webp`, 아니면 400.
- `convertImageToWebp(file.path, { maxDimension: 1024, quality: 80 })` → `{ url, url_webp }` 반환. 프론트 `<picture>`로 webp 우선.
- 프론트 `MyReviewNew.tsx`의 `resizeImage(1024)`는 업로드 전 클라 1차 축소(실패해도 원본 폴백).

## toggleBest (상담사 베스트) vs adminToggleBest (관리자 베스트)

- `toggleBest(reviewId, counselorId, isBest)`: `counselor_id !== counselorId` → 403. `is_best=true` 시 상담사당 5개 초과면 **409**. `is_best`/`best_at` 갱신.
- `adminToggleBest(reviewId, isBest)`: 선정 시 작성자에게 **10,000코인 1회**.
  멱등 보장 = `point_history` UNIQUE(`member_id`, `rel_action LIKE 'review_best:%'`) + `ON CONFLICT DO NOTHING` → inserted.length=0 이면 tx 롤백(이중 지급 원천 차단). 해제 시 코인 환수 없음.

## reportReview (신고)

- 카테고리 화이트리스트 `abuse|false|ad|privacy|other` (그 외 → other).
- 후기 없음 → 404. 본인 후기(`member_id===reporterId`) → **400** "본인이 작성한 후기는 신고할 수 없습니다".
- `post_review_report` INSERT 시 UNIQUE 위반(23505) → **409** "이미 신고하신 후기입니다".
- **자동 숨김 없음** — 운영자 검토 처리.

## 알림톡

- 작성 시 상담사에게 `review_for_counselor_v2` (변수: 상담사명, url=`counselor-mypage/reviews/{reviewId}`). BizM 미등록 시 자동 실패하고 후기 자체는 성공.

## E2E 검증 spec (e2e/tests/)

| spec | 커버 |
|---|---|
| `20-review-five-min-policy.spec.ts` | 5분 미만 작성 차단 |
| `25-review-crud.spec.ts` | 작성/수정/삭제 + 5분·답변 가드 |
| `34-review-coin-realcheck.spec.ts` | 코인 실지급 확인 |
| `49-review-coin-strict.spec.ts` | 코인 이중 지급/회수 엄격검증 |
| `50-review-photo-upload.spec.ts` | 30MB 사진 + webp 변환 |
| `55-review-edge.spec.ts` | 가짜/남의 consultation_id, 중복, 엣지 |
| `31-review-system.spec.ts`, `32-best-review-idempotency.spec.ts`, `46-review-load-more.spec.ts` | 시스템/베스트 멱등/더보기 |

## 2026-06-10 버그 픽스 3건 (요약)

1. **extras 이중 인코딩 → 코인 이중 지급**: `${JSON.stringify(extras)}::jsonb` → `this.sql.json(extras)`. 중복 차단 쿼리 양쪽 호환. 레거시 데이터 마이그레이션.
2. **사진 5MB→30MB + webp 1024 축소**: 모바일 원본 413 해소.
3. **듀얼역할자 "상담사가 아닙니다"**: role 검증을 `consultation.counselor_id` 확정 이후로 이동 + 프론트 `role:'member'` 명시.

## 운영 SQL

```sql
-- extras 이중 인코딩 잔존 점검 (있으면 안 됨)
SELECT id, member_id, extras FROM post_review WHERE jsonb_typeof(extras) = 'string';

-- 같은 상담 후기 중복(코인 이중 지급 흔적)
SELECT (extras ->> 'consultation_id') AS cid, COUNT(*)
FROM post_review WHERE (extras ->> 'consultation_id') IS NOT NULL
GROUP BY 1 HAVING COUNT(*) > 1;

-- 베스트 후기 코인 지급 이력
SELECT * FROM point_history WHERE rel_action LIKE 'review_best:%';
```
