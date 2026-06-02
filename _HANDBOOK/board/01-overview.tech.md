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
```
