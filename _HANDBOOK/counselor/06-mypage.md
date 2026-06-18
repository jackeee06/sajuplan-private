# 상담사 마이페이지 전체 탭 (C-5)

## 한 줄로 답하면
**상담사는 `/counselor/mypage` 에서 자기 영업을 관리한다 — 등급·정산률 확인, 상담 가능 토글(전화/채팅), 통화·채팅 내역, 상담 통계, 받은 후기 답변, 고객 문의 답변, 공지·소개·스타일 편집, 나만의 메모장, 추천 현황, 선지급 신청, 정산 이력, 정산 계좌. 회원 마이페이지(`/mypage`)와는 별개의 "보라색 모드" 영역이고, 우상단에서 회원 모드로 돌아갈 수 있다.**

> 회원 ⇄ 상담사 모드 전환 규칙은 [member/04-dual-account](../member/04-dual-account). 이 문서는 **상담사 마이페이지의 탭 구성과 각 탭이 하는 일** 관점. 돈 관련 상세는 정산([payment/05-settlement](../payment/05-settlement))·선지급([payment/06-payout](../payment/06-payout))·등급단가([counselor/02-grade-pricing](./02-grade-pricing)) 문서로 갈라진다.

---

## 진입 — `/counselor/mypage`

- **상담사 자격(role='counselor')이 있어야** 들어온다. 비로그인이면 로그인 화면으로 보낸다(`/login?redirect=/mypage`).
- 홈 화면 구성:
  - **프로필 + 등급 뱃지** — 등급(예비~파트너5) 표시. 프로필/소개 수정으로 이동.
  - **회원 모드 전환** — 우상단에서 `/mypage`(회원 모드)로 복귀.
  - **상담 가능 토글** — `전화상담` / `채팅상담` 각각 ON/OFF. 끄면 목록에서 "상담불가"로 보인다. (자동 오프라인 없음 — 수동 토글, [counselor/03-absent](./03-absent) 참조)
  - **빠른 링크** — 통화 내역 · 채팅 내역 · 정산 이력 · 추천 현황.
  - **선지급 카드** · **고객 문의** · **상담 통계** 바로가기.

---

## 전체 탭 지도

> 아래 경로는 2026-06-12 무에러 전수 스캔(375px)으로 실재 확인된 탭이다.

| 탭 | 경로 | 하는 일 |
|---|---|---|
| 홈 | `/counselor/mypage` | 프로필·등급·상담가능 토글·요약 |
| 소개 편집 | `/counselor/mypage/intro` | 본인소개(프로필 노출 글) 편집 |
| 상담 스타일 | `/counselor/mypage/style` | 상담 스타일/분야 칩 설정 |
| 공지 작성 | `/counselor/mypage/notice-edit` · 목록 `/counselor/mypage/notices` | 내 상세페이지 공지사항 |
| 받은 후기 | `/counselor/mypage/reviews` | 받은 후기 조회 + **1:1 답변**(작성/수정/삭제) |
| 상품 후기 | `/counselor/mypage/products` | 상품(후기) 관련 화면 |
| 고객 문의 | `/counselor/mypage/customer-qnas` | 내 페이지에 들어온 1:1 문의 답변 |
| 내 문의 | `/counselor/mypage/qnas` · 작성 `/qnas/new` | 상담사가 운영팀에 남기는 문의 |
| 수신 대기 채팅 | `/counselor/mypage/incoming` | 회원이 보낸 채팅 요청(오래된 순) — [chat/05-incoming](../chat/05-incoming) |
| 통화 내역 | `/counselor/mypage/calls` | 내가 한 전화 상담 내역 |
| 채팅 내역 | `/counselor/mypage/chats` | 내가 한 채팅 상담 내역 |
| 상담 통계 | `/counselor/mypage/consult-stats` | 기간별 상담 건수·시간(프리셋/직접입력) |
| 나만의 메모장 | `/counselor/mypage/memo` | 회원별 특이사항·운영 노트 (본인만, 2초 자동저장) |
| 추천 현황 | `/counselor/mypage/referral` | 내 추천 코드·추천 수익금 현황 — [promotion/02-referral](../promotion/02-referral) |
| 선지급 | `/counselor/mypage/payout` | 수익금 미리 받기 신청 — [payment/06-payout](../payment/06-payout) |
| 정산 이력 | `/counselor/mypage/settlement/history` | 월 정산 내역 — [payment/05-settlement](../payment/05-settlement) |
| 정산 계좌 | `/counselor/mypage/bank` | 입금 계좌 등록/변경(변경 시 3일 잠금) |
| 운영 팁 | `/counselor/mypage/tips` | 상담사 운영 도움말 |

---

## 돈 관련 표기 규칙 (중요)
- 상담사 화면은 **"수익금"** 단어만 쓴다. "포인트", "수익 내역", "earning" 금지.
- 정산은 통장 입금이므로 **원** 단위(`1,000,000원`), 회원 코인과 구분.

---

## 이건 정상인가요? 에러인가요?

| 상황 | 답변 |
|---|---|
| 비로그인 `/counselor/mypage` → 로그인 화면 | ✅ 정상(보호 라우트) |
| 상담 가능 토글 껐는데 목록에 "상담불가" | ✅ 정상(수동 토글) |
| 앱 껐는데도 "상담가능"으로 보임 | ✅ 현재 정상 — 자동 오프라인 미구현([counselor/03-absent](./03-absent)) |
| 메모장이 안 열리거나 저장 안 됨 | ❌ **사고**. 2026-06-12 이전엔 메모 호출이 깨져 먹통이었음 → **수정 완료**. 또 그러면 보고 |
| 상담 통계 "직접입력"에서 화면이 옆으로 잘림(가로 스크롤) | ❌ 사고. 2026-06-12 날짜칸 폭 수정 완료 |
| 신청 화면 "포인트" 단어 | ⚠️ 용어 위반("수익금"으로) |

---

## 2026-06-12 이 영역에서 고친 것
- 🔴 **나만의 메모장 완전 먹통** — 호출 주소 오류(`/api` 누락 + 폐기서버 주소) + 콜드로드 시 로그인으로 튕기던 가드 레이스. 둘 다 수정 → 정상 로드/자동저장.
- 🟡 **상담 통계 직접입력 날짜칸 가로 넘침(375px)** — 날짜 입력칸이 안 줄어들어 화면을 벗어나던 것 수정.
- 🟡 **받은/상품 후기 안내 문구** "포인트 지급!" → "코인 지급!"(회원 대상 안내 용어 통일).

---

## 관련 항목
- [counselor/02-grade-pricing](./02-grade-pricing) — 등급·단가·정산률·실시간 승급
- [payment/05-settlement](../payment/05-settlement) — 정산
- [payment/06-payout](../payment/06-payout) — 선지급
- [promotion/02-referral](../promotion/02-referral) — 추천 수익금
- [chat/05-incoming](../chat/05-incoming) — 채팅 수신 대기
- [member/04-dual-account](../member/04-dual-account) — 회원↔상담사 모드
- [.tech 문서](./06-mypage.tech) — 라우트·API·가드·수정 상세
