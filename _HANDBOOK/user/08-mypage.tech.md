# [AI 전용] B-8 마이페이지 전체 탭 — 기술 상세

> 회원⇄상담사 모드 라우팅·인디케이터는 [member/04-dual-account.tech](../member/04-dual-account.tech). 여기선 **회원 마이페이지(`/mypage/*`) 라우트 트리 · API · 보호 라우트 가드**만 박제한다.

## 검증된 사실 (2026-06-11 코드 점검)

소스: `web/user/src/App.tsx`, `pages/MyPageEntry.tsx`, `pages/MemberMyPage.tsx`, `pages/MyPage.tsx`, `data/memberProfile.ts`, `pages/{MemberEdit,Coupons,Payments,Points,Charge,AppSettings}.tsx`, `api/src/user/points/points.controller.ts`, `api/src/user/charge/charge.controller.ts`

## 진입점 분기 — `MyPageEntry`

`web/user/src/pages/MyPageEntry.tsx`:
```ts
const { member, loading } = useAuth()
if (loading) return <스켈레톤/>
if (!member)  return <MyPage />        // 비로그인 = 환영 화면 (리다이렉트 아님)
return <MemberMyPage />                // 회원·상담사 모두 회원 화면 기본
```

- **중요**: 비로그인 `/mypage` 는 `/login` 으로 **리다이렉트하지 않는다**. 그냥 환영 컴포넌트(`MyPage`)를 렌더한다. (`_MyPageRedirect` 라는 Navigate 분기 함수가 같은 파일에 있으나 **사용 안 함** — 참고용.)
- 상담사도 `MemberMyPage` 가 기본. 전환은 `member.role === 'counselor'` 일 때만 뜨는 `상담사 메뉴` 칩(`Link to=/counselor/mypage`).

## 라우트 트리 (`App.tsx`)

모두 `BrowserRouter basename="/"`. 회원 영역 `/mypage/*`:

| 라우트 | 컴포넌트 | 비고 |
|---|---|---|
| `/mypage` | `MyPageEntry` | 로그인 여부 분기 |
| `/mypage/member` | `MemberMyPage` | 비로그인 시 `Navigate /login?redirect=/mypage` |
| `/mypage/member/edit` | `MemberEdit` | 회원 정보 수정 |
| `/mypage/app-settings` | `AppSettings` | 비로그인 시 `Navigate /login?redirect=/mypage/app-settings` |
| `/mypage/calls` | `MyCalls` | 전화 상담 내역 |
| `/mypage/chats` | `MyChats` | 채팅 상담 내역 |
| `/mypage/history` | `MyHistory` | 통합 상담 내역 |
| `/mypage/my-reviews`·`/new`·`/:id`·`/:id/edit` | `MyReviews` 외 | 내 후기 CRUD |
| `/mypage/my-qnas`·`/:id` | `MyQnas`/`MyQnaDetail` | 내 상담문의 |
| `/mypage/coupons` | `Coupons` | 쿠폰함 |
| `/mypage/payments` | `Payments` | 결제내역 |
| `/mypage/points` | `Points` | 코인 내역 |
| `/mypage/charge` | `Charge` | 코인 충전 |
| `/mypage/charge/card-register` | `ChargeCardRegister` | 사주플랜페이 카드 등록 |
| `/charge/complete` · `/charge/vbank-info` | `ChargeComplete`/`ChargeVbankInfo` | PG 콜백 착지 (※ `/mypage` 밖) |
| `/mypage/events`·`/:id` | `Events`/`EventDetail` | 공개 |
| `/mypage/notices`·`/:id` | `Notices`/`NoticeDetail` | 공개 |
| `/mypage/help` | `Help` | 공개 (이용안내) |
| `/mypage/new-counselors` | `NewCounselors` | 공개 |
| `/mypage/counselor-apply`·`/new`·`/done`·`/:id` | `CounselorApply` 외 | 공개 진입 |

- 정산 내역(`SettlementHistory`)은 회원 영역 아님 → `/counselor/mypage/settlement/history` 로 이동, 옛 `/mypage/settlement/history` 는 `Navigate` redirect 로만 보존.
- 미정의 경로(`*`)는 `Navigate to="/" replace`.

## 메뉴 데이터 출처

`web/user/src/data/memberProfile.ts`:
- `MEMBER_MAIN_MENU` = 쿠폰 / **코인 내역**(`/mypage/points`) / 상담 내역 / 나의 상담후기 / 나의 상담문의
- `MEMBER_EXTRA_MENU` = 이벤트 / 이용안내 / 공지사항 / 신규상담사 / 상담사 신청
- `MOCK_MEMBER` 는 mock (실데이터는 `useAuth().member`). `point` 필드만 회원 메인 박스에 실제 사용됨.

## 보호 라우트 — 두 가지 가드 패턴

### 1) 프론트 `<Navigate>` 가드 (컴포넌트 마운트 시)

```ts
// Charge.tsx / AppSettings.tsx / MemberMyPage.tsx
if (authLoading) return <불러오는 중>
if (!member) return <Navigate to="/login?redirect=/mypage/charge" replace />
```
- `Charge.tsx` 는 `authLoading || !member` 일 때 **데이터 API 호출 자체를 막는다** (useEffect early return) → 비로그인 깜빡임 방지.

### 2) 서버 `UserAuthGuard` (쿠키 검증 + 401)

```ts
@Controller('user/points')
@UseGuards(UserAuthGuard)   // sjm_user 쿠키 없으면 401
```
- 프론트는 `ApiError.status === 401` 을 잡아 `navigate('/login', { state:{from} })` 또는 로그인 프롬프트.
- 예: `Coupons.tsx::fetchList` 가 401 → `navigate('/login', { state:{from:'/mypage/coupons'} })`.

## 탭별 API (실제 라우트)

| 화면 | 메서드 · 경로 | 가드 |
|---|---|---|
| 코인 내역 보유 | `GET /api/user/points/balance` | UserAuthGuard |
| 코인 내역 리스트 | `GET /api/user/points/history?page=&limit=` | UserAuthGuard · 본인(`req.user.sub`)만 |
| 쿠폰 목록 | `GET /api/user/coupons?status=available\|used` | UserAuthGuard |
| 쿠폰 사용 | `POST /api/user/coupons/:id/use` | UserAuthGuard |
| 쿠폰코드 등록 | `POST /api/user/coupons/redeem {code}` | UserAuthGuard |
| 쿠폰 숨김 | `DELETE /api/user/coupons/:id` | UserAuthGuard |
| 충전 패키지 | `GET /api/user/charge/packages` | UserAuthGuard |
| 결제수단 조회 | `GET /api/user/charge/methods` | UserAuthGuard |
| 일반결제 준비 | `POST /api/user/charge/prepare` | UserAuthGuard |
| 사주플랜페이 카드 등록 | `POST /api/user/charge/autopay-register` | UserAuthGuard |
| 카드 삭제 | `DELETE /api/user/charge/autopay-card` | UserAuthGuard |
| 사주플랜페이 결제 | `POST /api/user/charge/autopay-charge` | UserAuthGuard |
| 자동충전 설정 | `PUT /api/user/charge/auto-config` | UserAuthGuard |
| 결제내역 | `GET /api/user/charge/payments` | UserAuthGuard |
| 회원 프로필 | `GET/PATCH /api/user/auth/me/profile` | UserAuthGuard |
| 비밀번호 변경 | `POST /api/user/auth/me/password` | UserAuthGuard |
| 회원탈퇴 | `DELETE /api/user/auth/me` | UserAuthGuard |
| 푸시 토글 | `PATCH /api/user/auth/me/push` | UserAuthGuard |

- `points.history` 서버 클램프: `page` 1~10000, `limit` 1~100(기본 30). 프론트는 `limit=20`.
- `points.controller` 주석의 URL `sajumoon.kr` 은 옛 표기 — 실제는 `sajuplan.com`.

## 용어 (코인 단위) — 코드상 확인

- 회원 화면 라벨은 전부 **"코인"** (`MemberMyPage` 의 `보유 코인`/`코인 충전`, `Points`/`Charge` 의 `코인`).
- DB·API 필드명은 그대로 `member.point` / `point.*_balance`. UI 라벨에서만 매핑.
- `Points.tsx::shortPointTitle` — 백엔드 content `"상담코인 차감"` → `"코인차감"` 으로 표시 단축.

## 결제내역 표시 규칙 (`Payments.tsx`)

- `status==='completed'` 건만 메인 노출. `awaiting_deposit` 은 vbank 계좌 있고 24h 이내일 때만 상단 옅은 알림.
- 원화 결제금액·합계·잔액은 메인 리스트에 **표시 안 함**(돈 자각 자극 최소화 정책, 2026-05-25). 영수증/상세에서만.

## 관련 E2E spec

- `e2e/tests/14-member-area.spec.ts` — 마이페이지 회원 영역 진입/메뉴
- `e2e/tests/37-mypage-full.spec.ts` — 마이페이지 전체 탭 회귀

## 코드 위치 (요약)

- 진입 분기: `web/user/src/pages/MyPageEntry.tsx`
- 라우트: `web/user/src/App.tsx` (`/mypage/*`)
- 회원 메인: `web/user/src/pages/MemberMyPage.tsx` / 비회원: `MyPage.tsx`
- 메뉴 데이터: `web/user/src/data/memberProfile.ts`
- 탭 페이지: `pages/{Coupons,Payments,Points,Charge,AppSettings,MemberEdit}.tsx`
- API: `api/src/user/points/points.controller.ts`, `api/src/user/charge/charge.controller.ts`
