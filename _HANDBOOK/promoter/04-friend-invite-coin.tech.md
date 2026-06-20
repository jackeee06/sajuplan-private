# 회원 친구초대 코인 보상 — 기술 상세

> 모집인(서포터즈) 인프라 재활용. `promoter.reward_type`(cash/coin) 분기 하나로 갈린다.
> 비즈니스: [04-friend-invite-coin.md](promoter/04-friend-invite-coin)

## DB

```sql
-- 20260619100000_promoter_reward_type.sql
ALTER TABLE promoter ADD COLUMN reward_type VARCHAR(10) NOT NULL DEFAULT 'cash'
  CHECK (reward_type IN ('cash','coin'));   -- 기존 행=cash, 회원 친구초대=coin
```
- 그 외 테이블(`promoter`, `promoter_referral`, `promoter_reward`)은 모집인과 공용.
- 코인형도 `promoter_reward` 에 적립행 1개(멱등·추적). 차이는 "코인 적립 분기"가 추가로 도는 것.

## 적립 — accrueInTx 코인 분기 (PromoterCoreService)

`api/src/shared/promoter/promoter-core.service.ts` `accrueInTx(tx, {...})` — m2net-push 트랜잭션 내부 호출(상담종료/선결제 차감과 원자성). 현금형 서포터즈가 2026-06-18부터 쓰던 그 코드에 코인 분기만 추가.

```ts
// promoter_referral JOIN promoter 로 reward_type + 수혜회원(member_id) 동시 조회
// reward = floor(paidAmount * rate_snapshot)  (rate=0.03)
// promoter_reward INSERT (ON CONFLICT(source_table,source_id) DO NOTHING) → 멱등 게이트
if (rewardType === 'coin' && beneficiaryMemberId) {
  // creditPointToMember(auth.service) 와 동일 정석 패턴:
  //   point FOR UPDATE → point_history(earn, balance_after, balance_kind='consumer',
  //     rel_table='promoter_reward', rel_action='promoter_reward@<rid>@invite_coin')
  //   → free_balance += reward, total_earned += reward → member.point 미러 재동기화
}
return { promoterId, rewardAmount, rewardType, beneficiaryMemberId };
```

- **수혜자 = 초대한 회원(promoter.member_id)**, 상담한 친구(args.memberId)가 아님.
- **balance_kind='consumer'** → 상담사 수익금(earning)·정산 **무침범**. 출석코인과 동일 성격.
- **멱등**: `promoter_reward (source_table, source_id)` UNIQUE → 같은 상담 재처리 시 적립행 안 생기고 코인 분기도 안 돔(중복 게이트가 INSERT RETURNING 0이면 즉시 return null).
- **m2net 동기화**: 커밋 후 `m2net-push.service.ts syncInviteCoinReward()` 가 수혜회원 membid 로 addMemberCoin(+코인) (HTTP라 tx 밖, best-effort).

호출부: `m2net-push.service.ts` — 종량제(L960 영역) + 선결제 채팅(L497 영역) 둘 다 `accrueInTx` 후 `syncInviteCoinReward`. 환불 void 는 `voidBySource`(코인형은 코인 회수 안 함 — 원장만 voided).

## 회원 opt-in + 현황 (PromoterCoreService)

- `ensureCoinPromoterForMember(memberId)` — 코인형 모집인 보장(없으면 생성, 멱등). 코드=전화뒷4자리(`generateUniqueCode`), 폰 없으면 `String(memberId)` 폴백. 이미 같은 phone/member_id 모집인 있으면 재사용(현금형 겸업 회원 보호).
- `getMemberInviteDashboard(memberId)` — 친구 수/받은 코인/타임라인. totalCoins=Σreward_amount(환불 void 여도 코인 유지라 전체 합산).

엔드포인트 (`promoter-member.controller.ts`, UserAuthGuard):
- `POST /api/user/promoter/invite/enable` → {code, shareUrl, rewardType}
- `GET  /api/user/promoter/invite/dashboard` → {enabled, code, shareUrl, friendCount, totalCoins, timeline}

## 코드 박힌 쿠폰 이미지 (즉석 합성·무저장)

⚠️ **PROD 서버 폰트 0개(fc-list 0)** → 서버에서 SVG 텍스트(한글·숫자) 렌더 불가.
→ 우회: **베이스 PNG(디자인+한글, Playwright 로컬 생성) + 숫자 글리프 PNG(0~9,A) 를 sharp `composite`**(이미지 합성, 폰트 불필요).

- 엔드포인트: `GET /api/promoter/coupon-image/:code(.png)` (공개·무인증·무저장 즉석 합성). `PromoterCoreService.renderCouponImage(code)`.
- 에셋: `api/assets/coupon/` (process.cwd 기준) = `coupon-base.png`, `glyph-0..9.png`, `glyph-A.png`, `coupon-layout.json`(코드박스 좌표 측정값). `_patch_api.py` FILES 등록(런타임 읽기).
- 재생성: `node tools/_make_coupon_assets.mjs` (베이스+글리프, 박스 좌표 측정→layout.json). 베이스/글리프/레이아웃은 서비스가 1회 읽어 메모리 캐시 → **에셋 교체 시 pm2 reload 필요**.
- **코드별 URL**이라 카카오 캐시 자동 회피. 디자인 변경 시 URL `?v=N` 으로 추가 회피.

**모양 두 종류**:
- **카톡/OG = 정사각형**(1080×1080) — 카카오 카드 정사각 크롭에 맞춤. 내용 세로 중앙정렬(하단 여백 균등). 동적 코드 이미지가 이것.
- **앱 미리보기 = 가로형** — `InviteFriends.tsx` 에서 React로 직접 렌더(이미지 아님, 즉시 표시).

## 카톡 복붙 OG (nginx)

`/usr/local/nginx/conf/vhost/sajuplan.com.conf` — `/event`·`/s/` 를 카카오봇(`kakaotalk-scrap` UA) 418 분기 → `coupon-og.html`(og:image=정적 쿠폰), 사람=SPA. (`/promoter` 패턴 복제). 홈 무영향.
- 정적 OG 이미지: `web/user/public/img/coupon-invite-v3.png`(코드 없는 일반 쿠폰). 동적 코드 이미지는 앱 SDK 공유(ShareBottomSheet imageUrl)용.

## 프론트

- `web/user/src/pages/InviteFriends.tsx` (`/mypage/invite`) — 가로 쿠폰 미리보기·코드·현황·공유. 인증 로딩 가드(메모장 레이스 방지).
- `web/user/src/pages/SignupCouponEvent.tsx` (`/event`) — 공개 쿠폰(게이트 예외).
- `WebAppGate.tsx` — `/event`·`/s/`·`/promoter` 게이트 예외.
- `ShareBottomSheet.tsx` (feed 카드) — imageUrl=동적 코드 이미지, title/description 에 코드.
- 공유 경로 SHARE_BASE = `https://sajuplan.com/s/{code}` (RecruiterLanding 랜딩 재활용).

## 검증

- E2E: `e2e/tests/111-invite-coin-reward.spec.ts` (가드·쿠폰이미지·동적엔드포인트·/event·dashboard·enable 멱등 = 6/6).
- 돈 무결성: `python tools/_verify_money_integrity.py` PASS (코인 적립은 free_balance/consumer라 earning·정산 무침범).
- **통제 실테스트(2026-06-20)**: 테스트 친구 귀속 + 10,000원 상담 적립 시뮬 → 초대자 free_balance +300(정확히 3%)·미러 일치·"내 초대 현황" 표시 확인 → 무결성 PASS → 데이터 원복. (적립 SQL은 accrueInTx 코인분기와 동일)

## 배포 함정 (Windows)

- `_patch_api.py`·마이그레이션·nginx 편집·DB쿼리는 **PowerShell**로(Git Bash가 `/data/...`→`C:/Program Files/Git/...` 경로변환 사고). 콘솔 한글깨짐→`$env:PYTHONIOENCODING="utf-8"`, 한글 SQL은 UTF-8 파일로 올려 `psql -f`.
- SSHPASS는 `.env.local` 작은따옴표 포함 → `.Trim("'")`.
- `_patch_frontend_fast.py`는 빌드 안 함 → `npm run build` 먼저. `/img/`·`*.html`·`assets/coupon/` 정적자산은 fast패치 동기화 안 해 `_put_prod_file.py` 직접 업로드.
- DB 마이그레이션은 코드배포보다 **먼저**(reward_type 컬럼 없으면 accrueInTx tx 롤백). `_run_prod_migrate.py`.
