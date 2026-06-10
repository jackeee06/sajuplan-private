# [AI 전용] 게시판 시스템 — 기술 상세

## DB

```
posts (통합 게시판 - 후기·문의·QA)
- id, member_id, board VARCHAR ('review' / 'qa' / 'qa_counselor' / 'counselor_qna')
- title, body, status (active / deleted / hidden)
- report_count INT
- created_at

notices, events, faqs (각각 별도 테이블)
- 운영자 작성, 일반 회원 읽기 전용

post_report (신고)
- id, post_id, reporter_id, reason, created_at

review_report (후기 신고)
- 별도 테이블 (또는 post_report 통합)
```

## 신고 자동 숨김

```typescript
async reportPost(postId, reporterId, reason) {
  await this.sql`INSERT INTO post_report ...`
  const count = await this.sql`SELECT COUNT(*) FROM post_report WHERE post_id=${postId}`
  if (count[0].count >= 5) {
    await this.sql`UPDATE posts SET status='hidden' WHERE id=${postId}`
  }
}
```

## 핵심 코드 위치

- 회원: `api/src/user/qna/qna.service.ts`, `api/src/user/reviews/reviews.service.ts`
- 운영자: `api/src/admin/posts/posts.service.ts`, `board-ops/`, `notices/`, `events/`, `faqs/`

## 알림톡

후기 작성 시:
- `review_for_counselor_v2` (상담사에게)
- `review_req_v2` (회원에게 - 상담 후 후기 요청)

질문/답변:
- `qa_ask_v2` (상담사에게)
- `qa_answer_v2` (회원에게)

## 후기 코인 지급 (setting namespace='review')

`maybeCreditReviewPoint` (reviews.service.ts) 가 후기 작성 시 best-effort 적립.
- `payout_enabled === '1'` 이어야 함
- `payout_amount` (현재 500) — 기본 적립
- `payout_photo_bonus` (현재 500) — 사진 첨부 시 추가 → 합 1,000
- `payout_min_used` — consultation.amt 가 이 값 이상이어야 지급
- 적립 흐름: `point_history` INSERT (`rel_action='review:{reviewId}'`) → `point.free_balance` / `member.point` UPDATE → 커밋 후 `m2net.addMemberCoin` 동기화
- 삭제(5분 이내) 시 `deleteMine` 이 `rel_action='review:{id}'` earn_point 만큼 회수 (`review_deleted:{id}` 기록)
- 베스트 후기(관리자 `adminToggleBest`): 10,000코인 1회, `rel_action='review_best:{reviewId}'` + DB UNIQUE 제약으로 멱등 보장

## 2026-06-10 후기 버그 수정 3건

### 1. extras 이중 인코딩 → 코인 이중 지급 (reviews.service.ts `createMine`)
- **원인**: `post_review.extras` 를 `${JSON.stringify(extras)}::jsonb` 로 저장 → jsonb 안에 JSON **문자열**이 이중 인코딩됨. 결과적으로 `extras ->> 'consultation_id'` 가 항상 빈값이라 중복 차단 쿼리가 무력화 → 같은 상담 후기를 여러 번 써도 매번 코인 지급.
- **수정**:
  - 저장: `${this.sql.json(extras)}` 로 정상화 (정상 jsonb object).
  - 중복 차단 쿼리: 이중 인코딩 / 정상 양쪽 호환.
    ```sql
    WHERE member_id = $1
      AND (
        (extras ->> 'consultation_id') = $2
        OR (
          jsonb_typeof(extras) = 'string'
          AND ((extras #>> '{}')::jsonb ->> 'consultation_id') = $2
        )
      )
    ```
  - 기존 데이터 6건 마이그레이션: `jsonb_typeof(extras)='string'` → 정상 object 로 복구.

### 2. 사진 업로드 5MB → 30MB + webp 축소 (reviews.controller.ts / MyReviewNew.tsx)
- **원인**: multer `limits.fileSize` 가 5MB라 모바일 원본(3~8MB) 거부 → 413 / 업로드 실패. 사진 후기가 사실상 불가.
- **수정**:
  - 서버 `REVIEW_IMG_MAX_BYTES = 30 * 1024 * 1024` (5MB → 30MB).
  - 서버 webp 변환에 `convertImageToWebp(file.path, { maxDimension: 1024, quality: 80 })` — 8.7MB 원본 → 0.33MB webp.
  - 프론트 `MyReviewNew.tsx` `resizeImage(1024)` 업로드 전 클라이언트 리사이즈 (실패해도 원본 업로드 폴백).
  - 표시: `UploadedImage` 가 `photo_url_webp` 우선 노출 (`<picture>`), 기존 적용됨.
- **검증**: 21MB 사진 업로드 성공 + webp 0.33MB 확인.

### 3. 듀얼역할자 후기 "해당 회원은 상담사가 아닙니다" (MyHistory.tsx / reviews.service.ts)
- **원인**: 회원 상담내역(`MyHistory.tsx`)이 `role` 파라미터를 안 보내 → 듀얼역할자(상담사)는 토큰 role 로 폴백 → "상담사 시점" 조회됨 → 본인이 상담해준 건이 회원 상담내역에 노출 + 상대(회원)를 counselor_id 로 보내 role 검증 실패.
- **수정**:
  - `MyHistory.tsx` 가 `role:'member'` 명시.
  - `reviews.service.ts` `createMine`: 상담사 role 검증을 `input.counselor_id` 가 아니라 **`consultation.counselor_id`(정답) 확정 이후**로 이동. 본인 상담(member_id 일치) 확인 후 그 상담의 counselor_id 로 role 검증.

## 운영 SQL

```sql
-- 후기 신고 다수 (검토 우선)
SELECT p.id, p.title, COUNT(pr.id) AS reports
FROM posts p
JOIN post_report pr ON pr.post_id = p.id
WHERE p.board='review'
GROUP BY p.id
HAVING COUNT(pr.id) >= 3
ORDER BY reports DESC;

-- [2026-06-10] extras 이중 인코딩 후기 점검 (남아있으면 안 됨)
SELECT id, member_id, extras
FROM post_review
WHERE jsonb_typeof(extras) = 'string';

-- 같은 상담 후기 중복 점검 (코인 이중 지급 흔적)
SELECT (extras ->> 'consultation_id') AS cid, COUNT(*)
FROM post_review
WHERE (extras ->> 'consultation_id') IS NOT NULL
GROUP BY 1 HAVING COUNT(*) > 1;
```
