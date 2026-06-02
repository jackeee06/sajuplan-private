# 사주플랜 — 사용자 프론트엔드 페이지/URL 정리

> `web/user` (React + Vite SPA) 기준. 관리자(`web/mng`)·API는 별도 문서.

## 환경 URL

| 환경 | Base URL |
|---|---|
| 운영 | https://sajumoon.kr |
| 로컬 | http://localhost:5174 |

- 빌드 출력: `web/user/dist/` → 운영 `/data/wwwroot/sajumoon.kr/`
- 배포: `./deploy.sh user`

## 디자인 원본

- Figma: https://www.figma.com/design/v9JT0ZgilboPxdXAnpH4sS/사주플랜_디자인
- 컬러 정의: `node-id=91-6911`
- 기본 컴포넌트: 버튼 `node-id=6-2225` / 인풋 `node-id=12-1983` / 탭 `node-id=79-4139`
- 시안 PNG: `design/screens/` (카테고리별 정리)

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

---

## 1. 인증 / 진입

| URL | 페이지 | 백엔드 연동 |
|---|---|---|
| [`/login`](https://sajumoon.kr/login) | 로그인 | `POST /user/auth/login`, 카카오/네이버 OAuth |
| [`/signup`](https://sajumoon.kr/signup) | 회원가입 (로컬·소셜 통합) | `POST /user/auth/signup` + SMS 인증 + 캡차 + Daum 우편번호 + m2net + 회원가입 쿠폰 |
| [`/signup/complete`](https://sajumoon.kr/signup/complete) | 회원가입 완료 | — |
| [`/find`](https://sajumoon.kr/find) | 아이디/비번 찾기 (휴대폰/이메일 탭) | `POST /user/auth/find/phone`, `/find/email` (알림톡·메일) |
| [`/find/complete`](https://sajumoon.kr/find/complete) | 찾기 완료 | — |

## 2. 메인 / 검색 / 알림

| URL | 페이지 | 백엔드 연동 |
|---|---|---|
| [`/`](https://sajumoon.kr/) | 홈 (메인) | `/user/banners?position=메인-상단배너`, `/user/stats/main`, `/user/settings/public` |
| [`/search`](https://sajumoon.kr/search) | 검색 (인기 검색어) | — |
| `/search/result?q=...` | 검색 결과 | — |
| [`/notifications`](https://sajumoon.kr/notifications) | 알림 내역 | — |

## 3. 상담사 — 공개 영역

| URL | 페이지 |
|---|---|
| `/counselors` | 상담사 리스트 (전체) |
| `/counselors?type=favorite` | 단골 상담사 |
| `/counselors/:id` | 상담사 상세 (소개 / 가격 / 단골수 / 별점) |
| `/counselors/:id/reviews` | 상담사 후기 리스트 |
| `/counselors/:id/reviews/new` | 상담사 후기 작성 |
| `/counselors/:id/qna` | 상담사 문의 리스트 |
| `/counselors/:id/qna/:qnaId` | 상담사 문의 상세 |
| `/counselors/:id/qna/new` | 상담사 문의 작성 |
| `/favorites` | 단골 상담사 (내 즐겨찾기) |

## 4. 후기 / 채팅

| URL | 페이지 |
|---|---|
| `/reviews` | 전체 후기 리스트 |
| `/reviews/:id` | 후기 상세 |
| `/chat/:id` | 채팅 상담방 |

## 5. 마이페이지 — 회원

| URL | 페이지 |
|---|---|
| `/mypage` | 마이페이지 메인 (역할 분기 진입점) |
| `/mypage/member` | 회원 마이페이지 메인 |
| `/mypage/member/edit` | 회원정보 수정 |
| `/mypage/app-settings` | 앱 설정 |
| `/mypage/calls` | 전화상담 내역 |
| `/mypage/chats` | 채팅상담 내역 |
| `/mypage/my-reviews` | 내가 쓴 후기 |
| `/mypage/my-reviews/new` | 후기 작성 |
| `/mypage/my-reviews/:id` | 내 후기 상세 |
| `/mypage/my-qnas` | 내가 쓴 문의 |
| `/mypage/my-qnas/:id` | 내 문의 상세 |
| `/mypage/coupons` | 쿠폰함 |
| `/mypage/payments` | 결제 내역 |
| `/mypage/points` | 포인트 내역 |
| `/mypage/charge` | 포인트 충전 |

## 6. 마이페이지 — 상담사

| URL | 페이지 |
|---|---|
| `/counselor/mypage` | 상담사 마이페이지 메인 |
| `/counselor/mypage/tips` | 알짜 정보 (사주플랜에서 상담사에게 발신) |
| `/counselor/mypage/tips/:id` | 알짜 정보 상세 |
| `/counselor/mypage/notices` | 공지사항 |
| `/counselor/mypage/notices/:id` | 공지 상세 |
| `/counselor/mypage/qnas` | 내 문의 (상담사 → 사주플랜) |
| `/counselor/mypage/qnas/new` | 문의 작성 |
| `/counselor/mypage/qnas/:id` | 내 문의 상세 |
| `/counselor/mypage/customer-qnas` | 고객 문의 관리 (회원 → 상담사) |
| `/counselor/mypage/customer-qnas/:id` | 고객 문의 상세 |
| `/counselor/mypage/reviews` | 후기 관리 (회원이 나에게 남긴) |
| `/counselor/mypage/reviews/:id` | 후기 상세 (답변 가능) |
| `/counselor/mypage/calls` | 전화 상담 내역 (상담사 입장) |
| `/counselor/mypage/chats` | 채팅 상담 내역 |
| `/counselor/mypage/:type/:id/memo` | 상담 메모 (전화·채팅 공용) |
| `/counselor/mypage/products` | 부가 서비스 상품 리스트 |
| `/counselor/mypage/products/:id/info` | 상품 정보 |
| `/counselor/mypage/products/:id/reviews` | 상품 후기 |
| `/counselor/mypage/products/:id/qna` | 상품 문의 |
| `/counselor/mypage/products/:id/guide` | 상품 안내 |

## 7. 콘텐츠 / 안내

| URL | 페이지 |
|---|---|
| `/mypage/events` | 이벤트 목록 |
| `/mypage/events/:id` | 이벤트 상세 |
| `/mypage/notices` | 공지사항 |
| `/mypage/notices/:id` | 공지 상세 |
| `/mypage/help` | 이용 안내 |
| `/mypage/new-counselors` | 신규 상담사 안내 |
| `/mypage/counselor-apply` | 상담사 신청 진입 |
| `/mypage/counselor-apply/new` | 상담사 신청서 작성 |
| `/mypage/counselor-apply/:id` | 상담사 신청 상세 |

---

## 공용 컴포넌트

| 컴포넌트 | 위치 | 비고 |
|---|---|---|
| `BottomNav` | `components/BottomNav.tsx` | 단골/상담사/홈/충전/마이 (358×70 pill, fixed) |
| `MobileHeader` | `components/MobileHeader.tsx` | ← + 타이틀 (단순 헤더) |
| `CounselorCard` | `components/CounselorCard.tsx` | 카드 한 장 (전화/채팅 버튼 + 해시태그 + 별점) |
| `CounselorDetailLayout` | `components/CounselorDetailLayout.tsx` | 상담사 상세 페이지 공통 레이아웃 |
| `CounselorMyProductDetailLayout` | `components/CounselorMyProductDetailLayout.tsx` | 상담사 상품 상세 공용 |
| `InputField` | `components/InputField.tsx` | h40 pill 인풋 |
| `PrimaryButton` | `components/PrimaryButton.tsx` | h48 pill 보라 CTA |
| `FilterDropdown` | `components/FilterDropdown.tsx` | 칩 토글 + 드롭다운 (CLAUDE.md 패턴) |
| `Pagination` | `components/Pagination.tsx` | 1–5 숫자 페이지네이션 |
| `AlertModal` | `components/AlertModal.tsx` | `window.alert()` 대체 모달 |
| `TermsModal` | `components/TermsModal.tsx` | 약관/개인정보처리방침 모달 |
| `ConfirmModal` | `components/ConfirmModal.tsx` | 확인/취소 모달 |
| `ConsultModal` | `components/ConsultModal.tsx` | 상담 시작 모달 (전화/채팅) |
| `ConsultHistoryCard` | `components/ConsultHistoryCard.tsx` | 상담 내역 카드 |
| `CouponRegisterModal` | `components/CouponRegisterModal.tsx` | 쿠폰 등록 모달 |
| `FloatingActions` | `components/FloatingActions.tsx` | 우측 하단 액션 (위로가기 + 카카오) |
| `icons` | `components/icons.tsx` | 인라인 SVG 아이콘 모음 |

## 라이브러리 / 유틸

| 모듈 | 위치 | 비고 |
|---|---|---|
| `api` | `lib/api.ts` | fetch 래퍼 + 도메인별 호출 (`authApi`, `smsApi`, `captchaApi`, `bannersApi`, `statsApi`, `settingsApi`) |
| `daum-postcode` | `lib/daum-postcode.ts` | Daum 우편번호 동적 로더 (popup + embed 모드) |

---

## 인증 / 세션

- 사용자 쿠키: `sjm_user` (env: `USER_COOKIE_NAME`)
- 관리자 쿠키: `sjm_admin` (env: `ADMIN_COOKIE_NAME`) — 별도 도메인으로 동시 로그인 가능
- 소셜 OAuth 콜백:
  - 카카오: `https://api.sajumoon.kr/api/user/auth/social/kakao/callback`
  - 네이버: `https://api.sajumoon.kr/api/user/auth/social/naver/callback`
- 회원 식별: 모든 가입 경로 `member.mb_id` 단일 컬럼 (`<UID>_K` 카카오 / `<UID>_N` 네이버 / 직접입력 로컬)

## 외부 연동

| 서비스 | 환경변수 | 용도 |
|---|---|---|
| 카카오 비즈엠 (알림톡) | `BIZM_USER_ID`, `BIZM_PROFILE_KEY`, `BIZM_TPL_*` | 회원가입 인증, 비밀번호 찾기 |
| 알리고 SMS | `ALIGO_USER_ID`, `ALIGO_KEY`, `ALIGO_SENDER` | 알림톡 폴백 |
| 네이버 SMTP | `SMTP_HOST/PORT/USER/PASS` | 이메일 비밀번호 찾기 |
| m2net (PassCall) | `M2NET_API_URL/CPID/HEADER_KEY` | 회원/상담사 외부 등록 |
| Daum 우편번호 | (CDN 로드) | 주소 검색 |
| 카카오 1:1 채널 | `setting.site.kakao_channel_url` | 메인 floating + 푸터 버튼 |

## 어드민 → 사용자 노출 흐름

| 어드민 영역 | 사용자 노출 위치 |
|---|---|
| 배너 (`/mng/banners`, position=`메인-상단배너`) | 메인 슬라이드 |
| 회원가입 쿠폰존 (`/mng/coupon-zones`, subject=`회원가입 쿠폰`) | 가입 시 자동 발급 |
| 알림톡 템플릿 (`alimtalk_template`) | 회원가입 인증 / 비밀번호 찾기 |
| 푸터 (`/mng/settings` → footer 탭) | 메인 푸터 회사정보 |
| 카카오 채널 URL (`/mng/settings` → site 탭) | 메인 floating + 푸터 |
| 메인 통계 강제값 (`/mng/settings` → site 탭) | 메인 카드 (최근 상담 건수 / 접속중 상담사) |
| 금지 ID / 금지 이메일 (`/mng/settings` → security 탭) | 회원가입 시 거부 검증 |

## 진행 메모

- 마이페이지 회원·상담사 17+14 페이지 + 카테고리 시안 풀 퍼블 완료 (d8c9fb3a)
- 회원가입 / 비밀번호 찾기 / 메인 (배너·통계·푸터·카카오) 백엔드 연동 완료 (88aeeb5e)
- DB 마이그레이션 0025~0035 적용 (mb_id 통일, sms_auth, 쿠폰존, 알림톡 템플릿, 푸터 시드, 통계 override 등)
- ⚠️ `ReviewDetail.tsx` 의 `customerNameFull` 참조 — `Reviews.tsx`의 `Review` 타입에 미정의 (vite build 통과·동작 OK, 추후 정리)
- 미작업: `/today-fortune` (오늘의 운세) — 배너 클릭 진입처
