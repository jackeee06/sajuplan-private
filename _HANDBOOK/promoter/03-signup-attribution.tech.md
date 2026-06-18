# 기술 — 모집인 자가신청 · 추천 귀속 · 사후입력 (2026-06-18)

> 코드가 진실원천. 이 문서는 파일·API·테이블 포인터. 변경 시 함께 갱신.

## 모집인 자가신청 → 승인

### 공개 (회원/비회원, 앱 불필요)
- `api/src/promoter/promoter.controller.ts`
  - `POST /promoter/otp/request` — OTP 발송(유효 휴대폰이면 누구나)
  - `POST /promoter/otp/verify` — 검증 → `{ status, promoterId?, memberName? }`
    - `status`: `active`(로그인·쿠키발급) / `pending` / `rejected` / `inactive` / `new`(미등록→신청가능, 회원이면 `memberName` prefill)
  - `POST /promoter/apply` — 자가신청(직전 OTP 인증 필수, `sms.isVerifiedRecently`) → `status='pending'`
- `api/src/promoter/promoter.service.ts` (`PromoterPublicService`) — `otpRequest/otpVerify/apply`
- `api/src/shared/promoter/promoter-core.service.ts`
  - `getPromoterByPhone` · `findMemberNameByPhone`(회원 이름 prefill) · `createApplication`(pending·is_active=false)
  - `generateUniqueCode(phone)` — 전화 뒷4자리, 충돌 시 **'A' 접두** 반복(guard<30)

### 관리자 승인/반려
- `api/src/admin/promoters/promoters.controller.ts`
  - `@Patch('approve/:id')` · `@Patch('reject/:id')` — ⚠️ **정적 접두** 라우트
    (같은 PATCH `@Patch(':id')`(update)가 `:id/approve`를 가려 500 나던 것 수정)
- `api/src/admin/promoters/promoters.service.ts`
  - `approve(id, adminId)` — `status='active'`, `is_active=true` + 알림톡 `sms.sendAlimtalkByCode('promoter_approved', phone, {이름:name}, ...)` (best-effort)
  - `reject(id, reason?)`, `list`(status 필터·`status='pending'` 우선 정렬), `globalSettings`(reward_rate/months/withholding)
- 프론트: `web/mng/src/pages/PromoterList.tsx`(StatusBadge·필터·등록버튼 좌측정렬) / `PromoterForm.tsx`(승인/반려 버튼 = `confirm`/`alert`)
- DB: `api/db/migrations/20260618010000_promoter_status.sql` — `promoter.status VARCHAR(12) DEFAULT 'active'` + CHECK(pending/active/rejected) + 부분 인덱스

### 승인 알림톡 `promoter_approved`
- BizM 등록 완료(검수 대기) + prod `alimtalk_template` 본문 1:1 준비(**len 87 == BizM 화면 87**, 버튼없음, `is_active=true`)
- 변수 `#{이름}` 하나. 검수 통과 시 코드 변경 없이 자동 발송. 실발송 검증=찬물선생(jackee) 번호

## 추천 귀속 (회원 ↔ 모집인)

### 가입 시 귀속
- `api/src/user/auth/auth.controller.ts` `signup()` → `this.promoter.createReferralForSignup({ memberId, code: body.promoter_code, entryMethod, memberPhone })`
  - ⚠️ 이 호출은 **createReferralForSignup 내부 전체 try/catch 격리** → 추천 실패해도 **가입은 절대 안 터짐**(best-effort). 가입 로직 자체는 이번 작업에서 무변경.
- `createReferralForSignup`(promoter-core): code→active promoter 조회 → 자기추천 차단(phone/member_id) → `promoter_referral` INSERT(`ON CONFLICT(member_id) DO NOTHING`), `rate_snapshot`·`reward_until=가입+months`
- 프론트 가입화면: `web/user/src/pages/Signup.tsx`
  - `promoter_ref`(localStorage, RecruiterLanding이 심음) → `form.promoterCode` prefill + `showPromoter` 자동 펼침
  - **접이식**: `showPromoter` false면 "추천코드가 있으신가요?" 버튼, true면 입력칸(placeholder "받으신 추천코드 (없으면 비워두세요)")
  - 제출 시 `promoter_code` + `promoter_entry('qr'|'code')` 전송 — 제출 로직 무변경
- 랜딩: `web/user/src/pages/RecruiterLanding.tsx`(`/s/:code`) — `localStorage.promoter_ref` 저장 + 문구 "앱 설치 후 가입할 때 이 코드를 입력하세요"

### 사후 입력 복구 (마이페이지)
- `api/src/promoter/promoter-member.controller.ts` (`@Controller('user/promoter')` + `UserAuthGuard`)
  - `GET /user/promoter/referral-status` → `{ hasReferral, canInput, promoterName }`
  - `POST /user/promoter/referral` `{ code }` → `{ ok, message }`
- promoter-core:
  - `getReferralStatus(memberId)` — 귀속 여부 + `created_at > now()-7days`(`POST_SIGNUP_DAYS=7`)
  - `applyReferralPostSignup(memberId, code)` — 7일가드 + 미귀속 + `createReferralForSignup` 재사용 + after 조회로 성공판정(멱등)
- 프론트: `web/user/src/components/PromoterReferralPrompt.tsx`(`canInput`일 때만 렌더) → `MemberMyPage.tsx` 코인카드 아래 삽입
- 클라이언트: `web/user/src/lib/api.ts` `promoterApi.referralStatus()` / `applyReferral(code)`

## 적립 (변경 없음 — 참고)
- `api/src/pg-callbacks/m2net-push.service.ts` 상담 종료 시 `promoter.accrueInTx(tx, { memberId, paidAmount: amtPro, ... })`
- `floor(amt_pro × rate_snapshot)`, `promoter_reward`(`source_table+source_id` UNIQUE 멱등), 환불 시 `voidBySource`
- 원장 분리 → `_verify_money_integrity.py` 무영향(point/earning 무침범)

## 검증
- E2E: `e2e/tests/102-promoter-apply.spec.ts`(자가신청 가드·승인라우트) / `103-promoter-fullflow.spec.ts`(실손가락 신청→승인→로그인) / `104-promoter-referral-input.spec.ts`(사후입력 가드·접이식) / `105-signup-intact.spec.ts`(가입화면 무결성)
- 격리 스모크(paramiko+localhost): 자가신청 승인 pending→active / 사후입력 성공경로(ok:true·rate0.03·3개월·재입력차단)
- ⚠️ `member.created_at` = NOT NULL default now() / `member` 참조 FK 0개(레거시 구조)

## 주의 (함정)
- NestJS 라우트: 같은 메서드의 `:id`(동적)가 `:id/sub`를 가린다 → 정적 접두(`approve/:id`)로 분리
- 신규 회원에게 **localStorage prefill 자동채움은 사실상 무효**(앱 전용 → 앱 설치 시 저장소 분리). 코드 손입력 기본 + 사후입력 안전망. [[WebAppGate]]
- 앱 재배포 안 함 정책 → Deferred Deep Link(Install Referrer/Branch) 불가
