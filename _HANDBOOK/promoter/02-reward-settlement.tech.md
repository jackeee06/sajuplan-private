# [TECH] 모집인 적립·정산 — 구조 (✅ 운영 — 2026-06-18)

> 구현·배포 완료. 적립 훅: `m2net-push.service.ts`(종량 amt_pro / 선결제 takePaid), 환불 void: `refunds.service.ts` + 선결제 5초 환불. 정본: `PLAN/promoter-referral.md`.

## DB 스키마 (예정)

### `promoter_reward` (상담별 적립 원장)
`id, promoter_id(FK), member_id(FK), consultation_id(UNIQUE FK), base_amount(=amt_pro), rate, reward_amount(=floor(base*rate)), status('accrued'|'voided'), settlement_id(NULL FK), created_at`
- `consultation_id` UNIQUE → 상담 1건 1적립(멱등).

### `promoter_settlement` (수동 정산 배치)
`id, promoter_id(FK), total_reward, withholding(default 0), paid_amount, status('calculated'|'paid'|'voided'), paid_at, paid_by_admin_id, memo, created_at`
- 정산 시 대상 `promoter_reward.settlement_id` 채우고 status 전이. settlement_monthly "지급완료 마킹" 패턴 동일.

## 적립 로직 (예정)
- 진입점: `api/src/pg-callbacks/m2net-push.service.ts` — `consultation` INSERT 직후.
- 조건: `promoter_referral` 존재 AND `now() <= reward_until` AND `amt_pro > 0`.
- `INSERT INTO promoter_reward ... ON CONFLICT (consultation_id) DO NOTHING` (멱등).
- reward = `floor(amt_pro × rate_snapshot)`. point/earning 무침범.

## 환불 연동 (예정)
- 진입점: `api/src/admin/refunds/refunds.service.ts` — 상담 환불로 amt_pro 감소 시.
- 대응 `promoter_reward` 차감/`voided`. 이미 지급(settlement_id 존재 & paid)이면 다음 정산 상계(이월).
- void 시 **알림톡 미발송**.

## 알림톡 (예정)
- 적립 INSERT 성공 시(멱등 1회) 모집인 phone 으로 BizM 발송.
- 신규 템플릿 필요. 변수: 회원 마스킹명(`홍**`), 사용액, 적립액, 누적 기대수익.
- 발송 인프라: `api/src/user/sms/sms.service.ts` 재사용. `alimtalk_log` 기록.
- 버튼 URL 함정 주의(`_INFRA_LOCKED.md`, K108/K208). 버튼은 대시보드 링크 1개만.

## 공유 링크 OG (카톡 붙여넣기도 "사주플랜 서포터즈")
- **모집인 입구** = **`https://sajuplan.com/promoter`** (대시보드 그 주소 그대로). 카톡 붙여넣기 시 "사주플랜 서포터즈" 카드, 사람이 열면 정상 SPA 대시보드.
  - 구현: nginx UA split — `location = /promoter { error_page 418=@promoter_og; if ($http_user_agent ~* "kakaotalk-scrap"){return 418;} try_files /index.html =404; }` + `location @promoter_og { try_files /sp.html =404; }`. **카카오 스크랩 봇(UA `kakaotalk-scrap`)만** OG 페이지(sp.html=서포터즈), 일반 사용자는 SPA. (⛔ 잠금 인프라 — 삭제 금지)
- **특정 모집인 모집 링크** = **`https://sajuplan.com/r/{코드}`** (깨끗한 경로, 코드 포함). 카톡 붙여넣기 시 카드 제목 "사주플랜 서포터즈".
- 구현: nginx `sajuplan.com.conf` 에 `location ^~ /r/ { try_files /sp.html =404; }` 추가(잠금 인프라 — **삭제 금지**). `web/user/public/sp.html`(서버 루트 `/data/wwwroot/sajumoon.co.kr/sp.html`)에 정적 og:title="사주플랜 서포터즈" + JS 가 경로/쿼리에서 코드 읽어 `/s/{코드}` 로 `location.replace`.
- 카카오 크롤러는 JS 미실행 → sp.html 정적 OG 만 읽음. 실제 방문자는 즉시 랜딩 이동. **메인 사주플랜 OG(=정적 `<title>사주플랜`)는 무영향** — `/r/` 경로만 서포터즈.
- 모집인 대시보드 "카카오톡으로 내 링크 공유하기" 버튼(Kakao SDK feed, title "사주플랜 서포터즈")은 `/r/{코드}` 링크를 공유.
- ⚠️ 서버 nginx 에 `http_sub_module` 없음 → `/s/` 경로 직접 OG 주입은 불가(그래서 `/r/`+sp.html 우회).

## 모집인 대시보드/OTP (예정)
- 신규 모듈 `api/src/promoter/` : `/api/promoter/otp/request|verify`(SMS OTP→세션쿠키 `sjm_promoter`), `/api/promoter/me/dashboard`.
- 대시보드 집계: 미정산 `promoter_reward(status='accrued', settlement_id IS NULL)` 합 = 기대수익. 타임라인 = 최신순 적립 피드(회원 마스킹).
- 프론트: 신규 경량 페이지(`/s`), 앱 게이트 예외 처리 필요.

## 정산 (예정)
- 관리자 `api/src/admin/promoters/` (또는 별도 settlements): 모집인별 미정산 합 → 배치 생성 → mark-paid.
- 원천징수 적용(`withholding`). 주민번호 미제출 시 미지급(주민번호 수집·암호화 저장 필요 — 세무 신고용).

## API (예정)
- 공개/OTP: `GET /api/promoter/by-code/:code`, `POST /api/promoter/otp/{request,verify}`, `GET /api/promoter/me`, `GET /api/promoter/me/dashboard`
- 가입연동: 회원가입 payload `promoter_code?`
- 관리자: `GET/POST/PATCH /api/admin/promoters`, `GET /api/admin/promoters/:id`, `POST /api/admin/promoter-settlements`, `PATCH /api/admin/promoter-settlements/:id/mark-paid`

## E2E (구현 시 추가)
- 귀속(QR/코드/자기추천차단) · 적립 멱등 · 환불 void · OTP · 정산 마킹.
