# [AI 전용] 상담사 마이페이지 — 기술 상세

## 진입/가드

- 진입 컴포넌트: `web/user/src/pages/CounselorMyPage.tsx`
  - 비로그인: `<Navigate to="/login?redirect=/mypage" replace />`
  - role!=='counselor' 회원이면 회원 마이페이지로 유도(우상단 칩 전환은 [member/04-dual-account]).
- 대부분의 상담사 페이지는 **라우트 래퍼 가드가 없고** 각 페이지가 self-guard 하거나 **API가 401 반환 시 `/login` 으로 보내는 패턴**을 쓴다(이게 콜드로드 안전한 정석).
  - 안전 패턴 예: `CounselorMyCalls/Chats/ConsultMemo` — `.catch(e => e.status===401 && navigate('/login'))`.

## 탭 ↔ 라우트 ↔ API

| 화면 | 컴포넌트 | API |
|---|---|---|
| 홈 | `CounselorMyPage.tsx` | `/user/counselor-mypage/grade`(등급/진행), availability 토글 `setMyAvailability` |
| 메모장 | `CounselorMyMemo.tsx` | `GET/PUT /api/user/counselor-mypage/memo` (UPSERT) |
| 상담 통계 | `CounselorMyConsultStats.tsx` | 기간별 집계 API |
| 받은 후기 | `CounselorReviews`/`CounselorMyProductReviews` | `GET /api/user/counselor-mypage/reviews`, 답변 `POST/PATCH/DELETE .../reviews/:id/reply` |
| 고객 문의 | `CounselorCustomerQnas` | `/api/user/counselor-mypage/...qna` |
| 수신 대기 | `CounselorIncomingList.tsx` | incoming 채팅 폴링 ([chat/05-incoming]) |
| 등급/단가 | — | `GET /api/user/counselor-mypage/grade`, `GET .../grade/progress`, `POST .../grade/unit-cost` |
| 선지급 | `CounselorPayout*` | `GET .../payout/available`, `GET .../payout/history`, `POST .../payout/request`, `POST .../payout/:id/cancel`, `POST .../payout/bank` |
| 정산 이력 | `SettlementHistory.tsx` | 정산 조회 |

> 백엔드 컨트롤러는 `@Controller('user/counselor-mypage/...')` + 전역 prefix `api` → 실제 경로는 항상 **`/api/user/counselor-mypage/...`**.

## 2026-06-12 버그 수정 (3순위 정밀검증)

### 🔴 메모장 2중 버그 (`CounselorMyMemo.tsx`)
1. **자체 API_BASE 오류** — 표준 `runtime-env`의 `API_BASE`(=`https://api.sajuplan.com/api`)를 import 안 하고
   `window.__SAJUMOON_CONFIG.env==='prod' ? 'https://api.sajuplan.com' : 'https://api.sajumoon.kr'` 로 직접 정의.
   → `/api` 가 빠져 `https://api.sajuplan.com/user/counselor-mypage/memo` 호출 → 404. (폐기서버 fallback도 위험)
   → **수정**: `import { API_BASE } from '../lib/runtime-env'`.
2. **인증 로딩 가드 레이스** — auth-context는 `member=null, loading=true`로 시작하는데, useEffect가
   `loading`을 안 보고 `!isCounselor`로 단정 → 마운트 즉시 `/login` 으로 navigate → 메모 fetch 자체가 안 됨(요청 0건).
   콜드로드/새로고침/딥링크에서만 재현(앱 내부 이동은 auth 이미 로드돼 회피됨).
   → **수정**: `const { ..., loading: authLoading } = useAuth(); if (authLoading) return;` + deps에 authLoading 추가.
- 회귀 spec: `e2e/tests/64-counselor-3rd-priority.spec.ts` — memo 응답이 `/api` 포함 200 + textarea 노출.

### 🟡 상담 통계 가로 오버플로우 (`CounselorMyConsultStats.tsx`)
- `preset==='custom'` 날짜 input 2개가 `flex-1`만 있고 `min-w-0` 없어 native date 최소폭으로 375px 초과(scrollWidth 400).
- **수정**: 두 date input에 `min-w-0`, 검색 버튼에 `shrink-0`. (SettlementHistory의 B-1 수정과 동일 패턴)
- 회귀 spec: 64 — custom 모드 진입 후 scrollWidth ≤ 375.

### 🟡 후기 안내 용어 누수
- `Reviews.tsx`, `CounselorReviews.tsx`, `CounselorMyProductReviews.tsx` 정적 문구 "후기 작성 시 포인트 지급!" → "코인 지급!".

## 함정
- 상담사 마이페이지는 페이지마다 가드 방식이 제각각(self-guard vs API-401). **새 페이지 추가 시 마운트 시점 `!isCounselor` 즉시 redirect 금지** — 반드시 `loading` 확인 후 판단(메모장 레이스 재발 방지).
- 자체 도메인 상수 정의 금지 — 반드시 `runtime-env`의 `API_BASE`/`FILE_BASE` import (메모장 404 재발 방지).

## 관련 문서
- [counselor/06-mypage](./06-mypage) (운영자용)
- [system/10-auth-guard-hardening](../system/10-auth-guard-hardening) (JWT sub 정규화)
- [system/08-e2e-verification](../system/08-e2e-verification) (3순위 검증 결과)
