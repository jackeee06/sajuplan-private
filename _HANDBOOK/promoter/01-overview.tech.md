# [TECH] 모집인 제도 — 구조 (✅ 운영 — 2026-06-18)

> 구현·배포 완료. 코드: `api/src/shared/promoter/`(코어), `api/src/admin/promoters/`(관리자), `api/src/promoter/`(공개). 마이그레이션 `20260618000000_promoter.sql`. 정본: `PLAN/promoter-referral.md`.

## 도메인 격리 원칙
- 모집인 보상은 **회사 부담 비용 원장**. `point` / `point_history` / `earning_balance` 절대 미사용.
- 상담사 추천수익금(제로섬, `m2net-push.service.ts creditCounselorPointInTx`)과 **별개 테이블·별개 로직**.

## DB 스키마 (예정)

### `promoter`
`id, name, phone(UNIQUE), code(UNIQUE), bank_name, bank_account, account_holder, member_id(NULL FK), reward_rate(NULL=글로벌 setting), is_active(bool), memo, created_by_admin_id, created_at, updated_at`
- `phone` = 고유키(정산·OTP). `code` = 회원 입력용(기본 전화 뒷자리, 중복 시 관리자 임의 유니크).

### `promoter_referral` (회원 귀속, 한 회원 1행)
`id, promoter_id(FK), member_id(UNIQUE FK), entry_method('qr'|'code'), signup_at, reward_until(date), rate_snapshot(numeric), created_at`
- `member_id` UNIQUE → "한 회원 = 모집인 1명" DB 강제.
- `reward_until` / `rate_snapshot` = 가입 시점 정책 스냅샷(이후 정책 변경 무관).

## 정책 상수 (setting namespace='promoter')
- `reward_rate` = 0.03, `reward_months` = 3 (관리자 변경 가능, 가입 시 referral 에 스냅샷).
- 타임존 KST 기준 window 계산 (`reference_server_timezone_kst`).

## 귀속 처리 (가입 연동)
- 회원가입 payload 에 `promoter_code?` 추가.
- 가입 성공 후: code→promoter 조회(없거나 inactive 시 skip) → 자기추천 차단(`member.phone==promoter.phone || member.id==promoter.member_id`) → `promoter_referral` INSERT(member_id UNIQUE 충돌 시 skip).
- QR/링크 `/s/{code}` 또는 `?ref={code}` → localStorage → 가입폼 prefill.

## 듀얼(모집인=회원) 처리
- 회원가입 시 phone 일치하는 `promoter` 있으면 `promoter.member_id` 자동 연결.
- 회원 point 원장 ↔ promoter_reward 원장 완전 분리.

## 안전장치
- `promoter_referral.member_id` UNIQUE / 자기추천 차단 / code UNIQUE(등록 시 검사).
- point 무침범 → 돈 불변식 무영향.

## 관련 코드 (구현 시 진입점)
- 가입: `api/src/user/auth/auth.service.ts` (회원가입 성공 분기에 귀속 훅)
- 신규 모듈(예정): `api/src/admin/promoters/`, `api/src/promoter/`(랜딩·OTP·대시보드)
