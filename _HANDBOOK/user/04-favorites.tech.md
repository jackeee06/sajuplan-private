# [AI 전용] B-4 단골(즐겨찾기) 사용자 흐름 — 기술 상세

> DB 스키마·운영 SQL·인기 상담사 통계는 [member/05-favorites.tech](../member/05-favorites.tech) 에 정리. 중복을 피하려 여기선 **사용자 흐름의 검증된 사실(API·멱등·차단·E2E)** 만 박제한다.

## 검증된 사실 (2026-06-11 코드 점검)

소스: `api/src/user/counselors/counselors.service.ts`, `counselors.controller.ts`, `web/user/src/lib/like-context.tsx`, `web/user/src/pages/Favorites.tsx`

### API (실제 라우트)

| 동작 | 메서드 · 경로 | 가드 | 응답 |
|---|---|---|---|
| 단골 추가 | `POST /api/user/counselors/:id/like` | UserAuthGuard | `{ is_liked:true, fan_count }` |
| 단골 해제 | `DELETE /api/user/counselors/:id/like` | UserAuthGuard | `{ is_liked:false, fan_count }` |
| 단골 목록 | `GET /api/user/counselors/favorites?category=&limit=` | UserAuthGuard | `{ items: PublicCounselor[] }` |
| 접속중 단골 | `GET /api/user/counselors/favorites/online` | UserAuthGuard | `{ online[], totalFavorites }` |

- 전용 favorites 컨트롤러/서비스는 **없음** — `user/counselors` 에 통합. (옛 문서가 적은 `POST /user/favorites/{id}` 나 `favorites.service.ts` 는 **존재하지 않음** — 오기였음.)
- 목록 정렬: `member_favorite_counselor.created_at DESC` (등록 최신순).
- 목록은 떠난 상담사 제외: `m.role='counselor' AND m.left_at IS NULL`.

### 멱등성

- 추가: `INSERT INTO member_favorite_counselor (...) ON CONFLICT (member_id, counselor_id) DO NOTHING`.
  → 이미 단골이어도 200, 새 row 안 생김. **409 안 던짐** (멱등 = 재시도 안전).
- 해제: 단순 `DELETE` — 없는 row 삭제해도 에러 없음.
- UNIQUE 제약 `(member_id, counselor_id)` 이 중복 방지의 근거.

### 비로그인 401

- 추가/해제/목록 전부 `UserAuthGuard` → 토큰 없으면 **401**.
- 프론트 `like-context.tsx::toggleLike` 가 `ApiError.status===401` 을 잡아 `showLoginPrompt()` (로그인 안내 모달) 호출, 라우팅 state.from 보존.

### 본인 단골 등록 차단 (403) — 2026-06-11 버그수정

```ts
// addFavorite() 첫 줄
if (Number(memberId) === Number(counselorId)) {
  throw new ForbiddenException('본인을 단골 등록할 수 없습니다.');
}
```

- **버그**: JWT `sub` 가 런타임 문자열로 들어와 `===` 직접 비교가 `'42' === 42 → false` 로 무력화. 듀얼계정 사용자가 본인을 단골 등록 가능했음.
- **수정**: `Number()` 정규화 후 비교.
- 주의: 상담사 리스트/검색 SQL 의 `selfExclude` 는 빈 fragment (본인 카드 노출 허용 정책, 2026-05-22). 차단은 **단골 등록 액션에만** 적용.

### fan_count

- 상담사 상세(`getDetail`)·추가/해제 응답의 `fan_count` 는 `SELECT COUNT(*) FROM member_favorite_counselor WHERE counselor_id=:id` 로 **실시간 집계**. `post_counselor.fan_count` 캐시 컬럼은 상세에서 무시.

## 관련 E2E spec

- `e2e/tests/36-favorites.spec.ts` — 단골 추가/조회/제거 + 멱등 회귀
- `e2e/tests/56-qna-edge.spec.ts` — **본인 단골 등록 403 차단** 케이스 포함

## 코드 위치 (요약)

- 서비스: `api/src/user/counselors/counselors.service.ts` (`addFavorite`/`removeFavorite`/`listFavorites`/`listFavoritesOnline`)
- 컨트롤러: `api/src/user/counselors/counselors.controller.ts`
- 프론트: `web/user/src/pages/Favorites.tsx`, `web/user/src/lib/like-context.tsx`
