# [AI 전용] 단골/즐겨찾기 — 기술 상세

> 사용자 흐름(추가/조회/제거 + 본인 차단) 관점 문서는 [user/04-favorites](../user/04-favorites) 참조.
> 이 문서는 DB·API·코드 위치 레퍼런스.

## DB

```
member_favorite_counselor
- id BIGSERIAL
- member_id   INT   (단골을 등록한 회원)
- counselor_id INT  (단골로 등록된 상담사)
- created_at  TIMESTAMPTZ
- UNIQUE (member_id, counselor_id)   ← 멱등성 근거
```

- `fan_count` (상담사 인기/팬 수) 는 이 테이블의 `COUNT(*)` 로 **실시간 계산**.
  `post_counselor.fan_count` 컬럼은 캐시일 뿐 상세 조회 시 무시하고 실시간 카운트 사용.

## API (실제 라우트 — 2026-06-11 점검)

⚠️ 컨트롤러 prefix 는 `user/counselors`. 단골 전용 컨트롤러/서비스는 **없다** (counselors 에 통합).

| 동작 | 메서드 · 경로 | 인증 |
|---|---|---|
| 단골 추가 | `POST /api/user/counselors/:id/like` | UserAuthGuard (로그인 필수) |
| 단골 해제 | `DELETE /api/user/counselors/:id/like` | UserAuthGuard |
| 단골 목록 | `GET /api/user/counselors/favorites?category=&limit=` | UserAuthGuard |
| 접속중 단골 (배너용) | `GET /api/user/counselors/favorites/online` | UserAuthGuard |

- 추가/해제 응답: `{ is_liked: boolean, fan_count: number }`
- 비로그인 호출 → 401 (프론트가 로그인 안내 모달로 전환).
- 라우트 우선순위: `favorites` / `favorites/online` 는 `:id` 매칭보다 **먼저** 선언되어야 함 (NestJS 선언 순서 의존).

## 핵심 코드 위치

- 서비스: `api/src/user/counselors/counselors.service.ts`
  - `addFavorite(memberId, counselorId)` — 본인 차단 → 상담사 존재 확인 → `INSERT ... ON CONFLICT DO NOTHING` → 새 fan_count 반환
  - `removeFavorite(memberId, counselorId)` — `DELETE` → 새 fan_count 반환
  - `listFavorites({ memberId, category, limit })` — `member_favorite_counselor JOIN member`, 등록 최신순 (`mfc.created_at DESC`)
  - `listFavoritesOnline(memberId)` — 단골 중 `state != 'ABSE'` 만 최대 5명 + totalFavorites
- 컨트롤러: `api/src/user/counselors/counselors.controller.ts`
- 프론트:
  - 단골 페이지 `web/user/src/pages/Favorites.tsx`
  - 좋아요 토글 컨텍스트 `web/user/src/lib/like-context.tsx` (`toggleLike` → addLike/removeLike, 401 시 로그인 모달)

## 멱등성 (idempotent)

- **추가 멱등**: `INSERT ... ON CONFLICT (member_id, counselor_id) DO NOTHING`.
  이미 단골이면 새 row 안 만들고 200 (현재 fan_count 그대로 반환). 409 던지지 않음.
- **해제 멱등**: 없는 단골을 `DELETE` 해도 에러 없이 200.
- 결과적으로 하트 더블클릭/네트워크 재시도에 안전.

## 본인 단골 차단 (2026-06-11 버그수정)

```ts
// addFavorite() 첫 줄
if (Number(memberId) === Number(counselorId)) {
  throw new ForbiddenException('본인을 단골 등록할 수 없습니다.');
}
```

- **원인**: JWT `sub` 는 런타임에 문자열로 들어와 `memberId === counselorId` (엄격 비교) 가
  `'42' === 42` → false 가 되어 차단이 무력화됨. 듀얼계정(회원⇄상담사) 사용자가 자기 자신을
  단골 등록할 수 있는 상태였다.
- **수정**: `Number()` 로 양쪽 정규화 후 비교 → 403.
- 상담사 리스트/검색은 본인 카드 노출은 허용(상담사가 자기 카드 미리보기)하지만,
  단골 등록 액션만 이 가드로 차단.

## 알림톡 (참고)

- `counselor_v2` — 단골 상담사 접속 알림 (운영 정책상 옵션). 발송 로직은 본 단골 모듈과 분리.
- 홈 진입 시 "단골 N명 접속중" **인앱 배너**는 `favorites/online` 응답으로 렌더 (푸시 아님).

## 관련 E2E spec

- `e2e/tests/36-favorites.spec.ts` — 추가/조회/제거/멱등 회귀
- `e2e/tests/56-qna-edge.spec.ts` — 본인 단골 등록 403 차단 케이스 포함

## 운영 SQL

```sql
-- 인기 상담사 (단골 수 기준)
SELECT counselor_id, COUNT(*) AS fav_count
FROM member_favorite_counselor
GROUP BY counselor_id
ORDER BY fav_count DESC LIMIT 20;

-- 활발한 단골 회원
SELECT member_id, COUNT(*) AS fav_count
FROM member_favorite_counselor
GROUP BY member_id
ORDER BY fav_count DESC LIMIT 50;

-- 특정 상담사의 실시간 fan_count (상세 페이지가 쓰는 것과 동일)
SELECT COUNT(*) FROM member_favorite_counselor WHERE counselor_id = :id;
```
