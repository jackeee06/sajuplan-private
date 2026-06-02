# 비즈니스 룰: 문의글(QnA) & 후기글(Review)

> **작성**: 2026-06-02  
> **상태**: ✅ 전체 구현 + prod 배포 완료  
> **관련 코드**:
> - `api/src/user/qna/qna.service.ts` — 문의 서비스
> - `api/src/user/qna/qna.controller.ts` — 문의 컨트롤러
> - `api/src/user/reviews/reviews.service.ts` — 후기 서비스
> - `api/src/user/reviews/reviews.controller.ts` — 후기 컨트롤러
> - `api/src/user/counselor-reviews/counselor-reviews.service.ts` — 상담사 후기답변 서비스

---

## 1. 문의글 (QnA)

### 1-1. 작성 제한

| 규칙 | 상세 |
|---|---|
| 하루 5개 제한 | **고객당 × 상담사당** 하루 최대 5개. 다른 상담사에겐 별도 5개 허용. 여러 고객이 같은 상담사에게 쓰면 상담사 기준 총 개수는 제한 없음. |
| 본인 페이지 금지 | 상담사 본인이 자기 페이지에 문의 작성 불가 (403) |
| 상담사 존재 확인 | `role='counselor'` + `left_at IS NULL` 검증 |

**구현 위치** — `qna.service.ts create()`:
```typescript
// 하루 5개 제한
const todayCount = await this.sql`
  SELECT COUNT(*)::text AS count FROM counselor_qna
   WHERE member_id = ${memberId}
     AND counselor_id = ${counselorId}
     AND created_at >= CURRENT_DATE::timestamptz
     AND created_at <  (CURRENT_DATE + 1)::timestamptz
`;
if (Number(todayCount[0]?.count ?? 0) >= 5) {
  throw new BadRequestException('같은 상담사에게 하루 최대 5개까지 문의할 수 있습니다.');
}
```

---

### 1-2. 문의 수정 (PATCH /api/user/counselors/:id/qna/:qnaId)

| 조건 | 결과 |
|---|---|
| 본인 소유가 아닌 경우 | 403 Forbidden |
| 상담사 답변이 이미 달린 경우 | 403 Forbidden (`"답변이 달린 문의는 수정할 수 없습니다."`) |
| 위 조건 통과 | 수정 허용 |

**수정 가능 필드**: 제목(`title`) + 내용(`content`) **만**  
**수정 불가 필드**: 비밀글 설정 (문의는 **무조건 비공개**, 변경 불가)

**구현 위치** — `qna.service.ts updateQna()`:
```typescript
// 답변 유무 확인
const reply = await this.sql`SELECT id FROM counselor_qna_reply WHERE qna_id = ${qnaId} LIMIT 1`;
if (reply.length > 0) throw new ForbiddenException('답변이 달린 문의는 수정할 수 없습니다.');
// 제목·내용만 UPDATE
UPDATE counselor_qna SET title = ${title}, content = ${content} WHERE id = ${qnaId}
```

---

### 1-3. 문의 삭제 (DELETE /api/user/counselors/:id/qna/:qnaId)

| 조건 | 결과 |
|---|---|
| 본인 소유가 아닌 경우 | 403 Forbidden |
| 상담사 답변이 이미 달린 경우 | 403 Forbidden (`"답변이 달린 문의는 삭제할 수 없습니다."`) |
| 위 조건 통과 | hard delete |

**구현 위치** — `qna.service.ts deleteQna()`

---

### 1-4. 상담사 답변 수정·삭제

| 기능 | 조건 | 구현 |
|---|---|---|
| 답변 수정 | 본인이 작성한 답변만 | `updateReply()` — 소유 검증 후 content 갱신 |
| 답변 삭제 | 본인이 작성한 답변만 | `deleteReply()` — 소유 검증 후 hard delete |

> 이유: 상담사가 급하게 작성하다 오타를 내는 경우 수정이 필요하기 때문.

---

## 2. 후기글 (Review)

### 2-1. 작성 조건

| 규칙 | 상세 | 에러 메시지 |
|---|---|---|
| consultation_id 필수 | 실제 상담 내역 없이 작성 불가 | `"상담 내역이 있어야 후기를 작성할 수 있습니다."` |
| 5분(300초) 이상 상담 | `consultation.usetm < 300` 이면 거절 | `"5분 이상 상담을 진행한 경우에만 후기 작성이 가능합니다."` |
| 상담 종료 후 7일 이내 | `consultation.ended_at` 기준 7일 초과 시 거절 | `"상담 종료 후 7일 이내에만 후기를 작성할 수 있습니다."` |
| 1상담 1후기 | 동일 `consultation_id`로 중복 후기 차단 | `"이미 후기를 작성한 상담입니다."` |
| 종료된 상담만 | `ended_at IS NULL`이면 거절 | `"종료된 상담에만 후기 작성이 가능합니다."` |
| 본인 상담만 | `consultation.member_id !== memberId` 이면 거절 | `"본인의 상담만 후기를 작성할 수 있습니다."` |

**구현 위치** — `reviews.service.ts createMine()` (line ~500)

```typescript
// 5분 이상 검증
if (sec < 300) throw new BadRequestException('5분 이상 상담을 진행한 경우에만...');

// 7일 이내 검증
const daysSinceEnd = (Date.now() - endedAt.getTime()) / (1000 * 60 * 60 * 24);
if (daysSinceEnd > 7) throw new BadRequestException('상담 종료 후 7일 이내에만...');
```

---

### 2-2. 후기 수정 (PATCH /api/user/reviews/:id)

| 조건 | 결과 |
|---|---|
| 본인 소유가 아닌 경우 | 403 |
| 작성 후 5분(300초) 초과 | 403 (`"후기 작성 후 5분이 지나면 수정할 수 없습니다."`) |
| 상담사 답변이 달린 경우 | 403 (`"상담사가 답변한 후기는 수정할 수 없습니다."`) |
| 위 조건 모두 통과 | 수정 허용 |

**수정 가능 필드**: 제목(`title`) + 내용(`content`) **만**  
**수정 불가 필드**: 별점(`rating`), 비밀글, 사진

> ⚠️ 2026-05-15에 수정 기능이 전면 비활성화(항상 403)됐던 것을 2026-06-02 재활성화.  
> 변경 이유: "5분 이내 수정 가능" 비즈니스 룰 도입.

**구현 위치** — `reviews.service.ts updateMine()`:
```typescript
// 5분 체크
const secsSince = (Date.now() - created.getTime()) / 1000;
if (secsSince > 300) throw new ForbiddenException('후기 작성 후 5분이 지나면 수정할 수 없습니다.');

// 상담사 답변 체크
const reply = await this.sql`SELECT id FROM post_review_reply WHERE review_id = ${id} LIMIT 1`;
if (reply.length > 0) throw new ForbiddenException('상담사가 답변한 후기는 수정할 수 없습니다.');
```

---

### 2-3. 후기 삭제 (DELETE /api/user/reviews/:id)

| 조건 | 결과 |
|---|---|
| 본인 소유가 아닌 경우 | 403 |
| 작성 후 5분(300초) 초과 | 403 (`"후기 작성 후 5분이 지나면 삭제할 수 없습니다."`) |
| 상담사 답변이 달린 경우 | 403 (`"상담사가 답변한 후기는 삭제할 수 없습니다."`) |
| 위 조건 모두 통과 | hard delete |

> 이전: 시간 제한 없이 본인이면 언제든 삭제 가능했음 → 2026-06-02 제한 추가.

**구현 위치** — `reviews.service.ts deleteMine()`

---

### 2-4. 상담사의 후기 답변 (counselor-reviews)

| 기능 | 조건 |
|---|---|
| 답변 작성 | 본인이 받은 후기만. 1후기 1답변 (중복 불가) |
| 답변 수정 | 본인이 작성한 답변만 |
| 답변 삭제 | 본인이 작성한 답변만 |

> 상담사 답변이 달리면 → 고객의 후기 수정·삭제 모두 차단됨 (2-2, 2-3 참조).

---

## 3. 비밀글 정책

| 항목 | 정책 |
|---|---|
| 문의글 | **항상 비공개**. 작성/수정 시 `is_secret = true` 강제. 변경 불가. |
| 후기글 | **항상 공개**. 컨트롤러에서 `is_secret = false` 강제 (`body.is_secret` 무시). |

---

## 4. API 엔드포인트 요약

### 문의 (고객)
| Method | Path | 조건 |
|---|---|---|
| `GET` | `/api/user/counselors/:id/qna` | 목록 (비밀글 본문 마스킹) |
| `GET` | `/api/user/counselors/:id/qna/:qnaId` | 단건 |
| `POST` | `/api/user/counselors/:id/qna` | 작성 (하루 5개 제한) |
| `PATCH` | `/api/user/counselors/:id/qna/:qnaId` | 수정 (답변 없을 때만, 제목·내용) |
| `DELETE` | `/api/user/counselors/:id/qna/:qnaId` | 삭제 (답변 없을 때만) |

### 문의 답변 (상담사)
| Method | Path | 조건 |
|---|---|---|
| `POST` | `/api/user/counselors/:id/qna/:qnaId/reply` | 답변 작성 (1회만) |
| `PATCH` | `/api/user/counselors/:id/qna/:qnaId/reply` | 답변 수정 |
| `DELETE` | `/api/user/counselors/:id/qna/:qnaId/reply` | 답변 삭제 |

### 후기 (고객)
| Method | Path | 조건 |
|---|---|---|
| `POST` | `/api/user/reviews` | 작성 (5분·7일·1상담1후기) |
| `PATCH` | `/api/user/reviews/:id` | 수정 (5분 이내 + 답변 없을 때, 제목·내용) |
| `DELETE` | `/api/user/reviews/:id` | 삭제 (5분 이내 + 답변 없을 때) |

### 후기 답변 (상담사)
| Method | Path | 조건 |
|---|---|---|
| `POST` | `/api/user/counselor-reviews/:reviewId/reply` | 답변 작성 (1회만) |
| `PATCH` | `/api/user/counselor-reviews/:reviewId/reply` | 답변 수정 |
| `DELETE` | `/api/user/counselor-reviews/:reviewId/reply` | 답변 삭제 |

---

## 5. 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-06-02 | 전체 비즈니스 룰 구현. 문의 하루5개·수정·삭제 신설. 후기 7일제한·5분수정삭제·상담사답변차단 추가. 후기 수정 재활성화. |
| 2026-05-15 | 후기 수정 전면 비활성화 (악의적 변조 방지 정책) |
| 2026-05-15 | 5분 이상 상담 조건 추가 (상담사 보호 정책) |
