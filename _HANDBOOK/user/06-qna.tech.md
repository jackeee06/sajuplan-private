# [AI 전용] 문의(QnA) 시스템 — 기술 상세

## DB

```
counselor_qna (상담사 1:1 문의)
- id, counselor_id (대상 상담사 member.id), member_id (작성자)
- title, content, is_secret BOOL (항상 TRUE 저장)
- is_hidden BOOL (신고 3건 누적 시 TRUE)
- created_at

counselor_qna_reply (상담사 답변 — 1문의당 1답변)
- id, qna_id (FK counselor_qna.id), counselor_id, content, created_at

post_report (신고 통합 테이블, board_slug='counselor_qna')
- board_slug, post_id (=qna_id), reporter_id, target_member_id, reason, status, created_at
```

> 후기는 `post_review`, 문의는 `counselor_qna` — **별도 테이블**이다. `posts` 통합 테이블이 아님에 주의.

## 라우트 맵

| 메서드 | 경로 | 가드 | 서비스 |
|---|---|---|---|
| GET | `/api/user/counselors/:id/qna` | OptionalUser | `listByCounselor` |
| GET | `/api/user/counselors/:id/qna/:qnaId` | OptionalUser | `getOne` |
| POST | `/api/user/counselors/:id/qna` | UserAuth | `create` |
| PATCH | `/api/user/counselors/:id/qna/:qnaId` | UserAuth | `updateQna` |
| DELETE | `/api/user/counselors/:id/qna/:qnaId` | UserAuth | `deleteQna` |
| POST | `/api/user/counselors/:id/qna/:qnaId/report` | UserAuth | `reportQna` |
| GET | `/api/user/my-qnas` | UserAuth | `listByMember` |
| GET | `/api/user/my-qnas/:id` | UserAuth | `getOneByMember` |
| GET | `/api/user/counselor/customer-qnas` | UserAuth(counselor) | `listForCounselor` |
| GET | `/api/user/counselor/customer-qnas/:id` | UserAuth(counselor) | `getOneForCounselor` |
| POST | `/api/user/counselor/customer-qnas/:id/reply` | UserAuth(counselor) | `createReply` |
| PATCH | `/api/user/counselor/customer-qnas/:id/reply` | UserAuth(counselor) | `updateReply` |
| DELETE | `/api/user/counselor/customer-qnas/:id/reply` | UserAuth(counselor) | `deleteReply` |

- 컨트롤러: `qna.controller.ts`(공개+작성/수정/삭제/신고), `my-qna.controller.ts`(내 문의), `counselor-qna.controller.ts`(상담사 답변).
- 상담사 라우트는 `assertCounselor()` 로 `req.user.role === 'counselor'` 강제.

## create — 검증 순서 (qna.service.ts `create`)

```typescript
// 1. 대상이 상담사인지 (role='counselor' AND left_at IS NULL)
if (count === 0) throw NotFoundException('상담사를 찾을 수 없습니다.');     // 404

// 2. 본인 페이지 문의 금지 — [2026-06-11 버그수정]
if (Number(memberId) === Number(counselorId))
  throw ForbiddenException('본인 페이지에는 문의할 수 없습니다.');           // 403

// 3. 하루 5개 제한 — CURRENT_DATE ~ CURRENT_DATE+1 범위 카운트
if (todayCount >= 5)
  throw BadRequestException('같은 상담사에게 하루 최대 5개까지 ...');         // 400
```

> 제목/내용 빈값·255자 초과 검증은 **컨트롤러**(`qna.controller.ts`)에서 먼저 처리됨. `is_secret`은 body 값과 무관하게 프론트가 항상 `true` 전송(`CounselorQnaNew.tsx`).

## 조회 비공개 로직 (`listByCounselor` / `getOne`)

```typescript
const isOwner     = requesterId != null && Number(member_id)   === Number(requesterId);
const isCounselor = requesterId != null && Number(requesterId) === Number(counselorId);
const canSeeContent = isOwner || isCounselor;  // 정책: 문의는 제3자에게 항상 비밀
return { ..., content: canSeeContent ? content : '' };
```

- `getOne` 추가 규칙: `is_hidden && !isOwner && !isCounselor` → `NotFoundException`(존재 자체 은닉).
- 목록/단건 모두 `requesterId = req.user?.sub` (OptionalUserGuard 라 비로그인은 undefined → 본문 가림).

## 소유권 검증 (모두 `Number()` 정규화)

| 함수 | 검사 | 실패 |
|---|---|---|
| `updateQna` | `Number(member_id) !== Number(memberId)` | 403 "본인이 작성한 문의만 수정..." |
| `updateQna` | 답변 존재 시 | 403 "답변이 달린 문의는 수정할 수 없습니다." |
| `deleteQna` | `Number(member_id) !== Number(memberId)` | 403 |
| `deleteQna` | 답변 존재 시 | 403 "답변이 달린 문의는 삭제할 수 없습니다." |
| `getOneByMember` | `Number(member_id) !== Number(memberId)` | 403 |
| `createReply` | `Number(counselor_id) !== Number(counselorId)` | 403 + 중복 답변 시 409 |

## reportQna — 자동 숨김

```typescript
INSERT INTO post_report (board_slug='counselor_qna', post_id=qnaId, ...);
// unique/duplicate 충돌 → ConflictException('이미 신고한 문의입니다.')
const cnt = COUNT(*) FROM post_report WHERE board_slug='counselor_qna' AND post_id=qnaId;
if (cnt >= 3) UPDATE counselor_qna SET is_hidden=TRUE WHERE id=qnaId AND is_hidden=FALSE;
// 작성자에게 FCM 푸시 (fire-and-forget, link='/mypage/my-qnas')
```

## ⚠️ 2026-06-11 근본 버그 — JWT sub 타입 불일치

- **증상**: `create` 의 본인페이지 차단(`memberId === counselorId`)이 무력화되어 **self 문의 5건** 발생.
- **원인**: JWT `sub` 가 런타임에 **문자열**('141')로 들어오는데, 숫자 id(141)와 `===` 직접 비교 시 타입 불일치로 항상 `false`. 차단·소유권 검증이 조용히 통과됨. qna 외 consult/counselors 도 같은 뿌리.
- **수정 1 (근본)**: `user-auth.guard.ts` — `verifyAsync` 직후 `const sub = Number(payload.sub)` 로 정규화, `!Number.isFinite(sub)` 면 `UnauthorizedException`. 이후 모든 라우트의 `req.user.sub` 는 number 보장.
- **수정 2 (국소 이중안전)**: `qna.service.ts` 의 모든 비교를 `Number(...) === Number(...)` 로 통일(create 차단 + update/delete/getOne 소유권).

```typescript
// user-auth.guard.ts
const sub = Number(payload.sub);
if (!Number.isFinite(sub)) throw new UnauthorizedException('세션이 ...');
req.user = { ...payload, sub };
```

## 알림톡 (BizM)

- `qa_ask_v2` — 상담사에게. 변수 `상담사명/고객명/url`(`/counselor/mypage/customer-qnas/:id`). `notifyQaAsk` + FCM topic `chl_5`.
- `qa_answer_v2` — 고객에게. 변수 `고객명/상담사명/문의링크(sajuplan://...)/url`(`/mypage/my-qnas/:id`). 앱 전용 서비스라 웹 URL 금지, `sajuplan://` 앱스킴 통일. `notifyQaAnswer`.
- 모두 fire-and-forget(`void`), 실패해도 본문 작성/답변 저장은 성공.

## 작성자 마스킹 (`displayReviewer`)

- 우선순위: `nickname`(maskName) → `mb_id`(maskMbId) → '익명'. 본명(`name`)은 노출 안 함(2026-05-15).
- `maskName('김민지')='김*지'`, `maskMbId('ubuub1234')='ub***34'`.

## 핵심 코드 위치

- 서비스: `api/src/user/qna/qna.service.ts`
- 컨트롤러: `api/src/user/qna/qna.controller.ts`, `my-qna.controller.ts`, `counselor-qna.controller.ts`
- 가드: `api/src/user/auth/user-auth.guard.ts` (sub 정규화)
- 프론트: `web/user/src/pages/MyQnas.tsx`, `MyQnaDetail.tsx`, `CounselorQnaNew.tsx`, `CounselorQnaDetail.tsx`

## E2E 검증 spec

| spec | 커버리지 |
|---|---|
| `e2e/tests/22-my-qnas.spec.ts` | 마이페이지 내 문의 목록/수정/삭제 |
| `e2e/tests/23-qna-crud.spec.ts` | 문의 작성·수정·삭제 CRUD |
| `e2e/tests/24-counselor-qna.spec.ts` | 상담사 답변 작성·관리 |
| `e2e/tests/56-qna-edge.spec.ts` | 엣지 케이스(본인페이지 차단/하루 5개/비공개) |

## 운영 SQL

```sql
-- self 문의(본인페이지 문의) 잔존 점검 — 2026-06-11 이후 0건이어야 함
SELECT id, counselor_id, member_id, created_at
FROM counselor_qna
WHERE counselor_id = member_id;

-- 같은 상담사 하루 5개 초과 흔적 점검
SELECT member_id, counselor_id, created_at::date AS d, COUNT(*)
FROM counselor_qna
GROUP BY member_id, counselor_id, created_at::date
HAVING COUNT(*) > 5;

-- 신고 누적 숨김 문의
SELECT q.id, q.title, COUNT(pr.id) AS reports, q.is_hidden
FROM counselor_qna q
JOIN post_report pr ON pr.board_slug='counselor_qna' AND pr.post_id=q.id
GROUP BY q.id
HAVING COUNT(pr.id) >= 3;
```
