# 사주문 — 사용자 프론트엔드 페이지/URL 정리

> `web/user` (React + Vite SPA) 기준. 관리자(`web/mng`)·API는 별도 문서.

## 환경 URL

| 환경 | Base URL |
|---|---|
| 운영 | https://sajumoon.kr |
| 로컬 | http://localhost:5174 |

- 빌드 출력: `web/user/dist/` → 운영 `/data/wwwroot/sajumoon.kr/`
- 배포: `./deploy.sh user`

## 디자인 원본

- Figma: https://www.figma.com/design/v9JT0ZgilboPxdXAnpH4sS/사주문_디자인
- 컬러 정의: `node-id=91-6911`
- 기본 컴포넌트: 버튼 `node-id=6-2225` / 인풋 `node-id=12-1983` / 탭 `node-id=79-4139`

## 핵심 컬러 (Figma 정확값)

| 토큰 | 값 | 용도 |
|---|---|---|
| 브랜드 보라 | `#8259F5` | CTA, 강조, 활성 탭 |
| 브랜드 보조 | `#9B7AF7` | 활성 outline, 체크박스 fill |
| 옅은 보라 bg | `#F3EEFE` | 칩 활성, hover |
| 텍스트 진한 | `#030712` / `#101828` / `#1E2939` | 헤더·이름·값 |
| 텍스트 보통 | `#364153` / `#4A5565` | 라벨·푸터 제목 |
| 텍스트 옅음 | `#6A7282` / `#99A1AF` | 보조·placeholder |
| 회색 라인 | `#F3F4F6` / `#E5E7EB` | 구분선·인풋 border |
| 회색 bg | `#F9FAFB` | 인풋·탭 배경 |
| 강조 빨강 | `#FF6467` | NEW, 사주 뱃지 |
| 청록 | `#00BBA7` | 신점 뱃지 |

## 페이지 라우트 / Figma 매핑

> 상태 범례: ✅ 정밀 퍼블 완료 / 🟡 색상 통일만(미세 정정 필요) / ⬜ 미작업

| # | URL | 페이지 | Figma 노드 | 상태 |
|---|---|---|---|---|
| 1 | [`/`](https://sajumoon.kr/) | Home (메인) | `1:1269` (02홈_메인) | ✅ |
| 2 | [`/login`](https://sajumoon.kr/login) | 로그인 | `6:2246` (01로그인_로그인) | ✅ |
| 3 | [`/signup`](https://sajumoon.kr/signup) | 회원가입 | `13:3112` (01로그인_회원가입) | 🟡 |
| 4 | [`/signup/complete`](https://sajumoon.kr/signup/complete) | 회원가입 완료 | `13:41250` | 🟡 |
| 5 | [`/find`](https://sajumoon.kr/find) | 아이디/비번 찾기 (폰) | `16:44737` | 🟡 |
| 5b | [`/find?type=email`](https://sajumoon.kr/find?type=email) | 아이디/비번 찾기 (이메일) | `16:46028` | 🟡 |
| 6 | [`/find/complete`](https://sajumoon.kr/find/complete) | 찾기 완료 | `69:2609` (폰) / `71:2700` (이메일) | 🟡 |
| 7 | [`/search`](https://sajumoon.kr/search) | 검색 (인기 검색어) | `163:21616` (02홈_검색) | ✅ |
| 8 | [`/search/result?q=...`](https://sajumoon.kr/search/result?q=선녀) | 검색 결과 | `163:22619` | ✅ |
| 8b | `/search/result?q=없음` | 검색 결과 (결과 없음) | `163:22750` | 🟡 |
| 9 | [`/notifications`](https://sajumoon.kr/notifications) | 알림 내역 | `163:23156` | 🟡 |
| 9b | (알림 없음) | 알림 내역 (알림 없음) | `163:27007` | 🟡 |

## 추후 작업 예정 (라우트 미정의)

| 예상 URL | 페이지 | Figma 노드 |
|---|---|---|
| `/today-fortune` | 오늘의 운세 (배너 클릭) | (별도) |
| `/counselors` | 상담사 리스트 | `74:3194` (03전체리스트_전체) |
| `/counselors?type=favorite` | 단골 상담사 | `163:16645` |
| `/counselors/:id` | 상담사 상세 (소개) | `76:4852` |
| `/counselors/:id/reviews` | 상담사 후기 | `84:4721` |
| `/counselors/:id/qna` | 상담사 문의 | `92:4694` |
| `/reviews` | 전체 후기 리스트 | `76:3667` |
| `/reviews/:id` | 후기 상세 | `76:4380` / `76:4712` |
| `/chat/:id` | 채팅방 | `101:5324` |
| `/mypage` | 마이페이지 (메인) | `109:9604` |
| `/mypage/edit` | 회원정보 수정 | `128:16774` |
| `/mypage/history/phone` | 전화상담 내역 | `109:10816` |
| `/mypage/history/chat` | 채팅상담 내역 | `147:12434` |
| `/mypage/coupons` | 쿠폰함 | `118:7460` |
| `/mypage/payments` | 결제내역 | `120:6697` |
| `/mypage/points` | 포인트 내역 | `147:10616` |
| `/point` | 포인트 충전 | `128:19235` (신용카드) / `137:10718` (일반결제) |
| `/notice` | 공지사항 | `147:9973` |
| `/event` | 이벤트 목록 | `118:7272` |
| `/help` | 이용안내 | `118:7447` |
| `/support` | 1:1문의 | `179:15834` (상담사) |

## 공용 컴포넌트

| 컴포넌트 | 위치 | 비고 |
|---|---|---|
| `BottomNav` | `web/user/src/components/BottomNav.tsx` | Figma `4:2774` — 단골/상담사/홈/충전/마이 (358×70 pill, fixed) |
| `CounselorCard` | `web/user/src/components/CounselorCard.tsx` | Figma `1:195` — 카드 한 장 |
| `MobileHeader` | `web/user/src/components/MobileHeader.tsx` | ← + 타이틀 (단순 헤더) |
| `InputField` | `web/user/src/components/InputField.tsx` | h40 pill 인풋 |
| `PrimaryButton` | `web/user/src/components/PrimaryButton.tsx` | h48 pill 보라 CTA |
| `TermsModal` | `web/user/src/components/TermsModal.tsx` | 약관 모달 |

## 인증 / 세션

- 사용자 쿠키: `sjm_user` (env: `USER_COOKIE_NAME`)
- 관리자 쿠키: `sjm_admin` (env: `ADMIN_COOKIE_NAME`) — 별도 도메인으로 동시 로그인 가능
- 소셜 로그인 콜백:
  - 카카오: `https://api.sajumoon.kr/api/user/auth/social/kakao/callback`
  - 네이버: `https://api.sajumoon.kr/api/user/auth/social/naver/callback`

## 진행 메모

- 색상 일괄 치환 완료 (`#9b7af7` → `#8259F5`, `#1f2937` → `#1E2939`, `#6b7280` → `#6A7282`, `#9aa3af` → `#99A1AF`, `#ef4444` → `#FF6467`)
- 정밀 퍼블 미완 페이지(🟡): Signup, SignupComplete, Find, FindComplete, Notifications + 결과/알림 없음 변형
- 다음 우선순위: Notifications → Find → Signup
