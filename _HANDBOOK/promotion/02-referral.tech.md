# [AI 전용] 추천인 시스템 v2 — 기술 상세 (2026-06-04 최종 정리)

## 아키텍처 한 줄 요약

> 상담사-상담사 추천 관계를 `counselor_referral` 에 등록 → 매월 1일 `settlement-cron` 이 자동으로 수당 계산·차감·적립. 양방향 UI 표시 + 수익금 내역 통합.

---

## DB 스키마

### member 테이블 추가 컬럼

```sql
referral_code VARCHAR(20) UNIQUE
-- = mb_id 값으로 설정. 예: 'jackee'.
-- 상담사 승인 시 approve() 에서 자동 SET.
-- 대소문자 무관 조회: LOWER(referral_code) = LOWER(입력값)
```

### counselor_referral 테이블

```sql
id              BIGSERIAL PK
referrer_id     BIGINT FK → member(id)   -- 추천한 사람 (A)
referee_id      BIGINT FK → member(id)   -- 추천받은 사람 (B)
rate_snapshot   NUMERIC(5,4)             -- 등록 당시 요율 (0.01 = 1%). 이후 정책 변경 무관.
months_snapshot INT                      -- 등록 당시 기간 (3). 이후 정책 변경 무관.
registered_at   TIMESTAMPTZ              -- 상담사 승인일 (기간 기산점)
expires_at      TIMESTAMPTZ              -- registered_at + months_snapshot개월
status          VARCHAR(20)              -- 'active' / 'expired' / 'suspended'
UNIQUE (referrer_id, referee_id)         -- 동일 쌍 중복 등록 방지
```

### counselor_referral_payment 테이블

```sql
id           BIGSERIAL PK
referral_id  BIGINT FK → counselor_referral(id)
pay_month    VARCHAR(7)     -- 'YYYY-MM'
paid_amount  NUMERIC        -- 실제 지급된 수당 (원)
UNIQUE (referral_id, pay_month)  -- 동일 월 중복 지급 방지 (멱등성)
```

### setting 테이블 — 정책값

```sql
namespace='promotion', key='referral_rate'    value='0.01'   -- 현재 요율 (소수)
namespace='promotion', key='referral_months'  value='3'      -- 현재 기간 (개월)
```

---

## 코드 흐름

### 1. 상담사 승인 시 (referral_code 발급 + 추천 관계 등록)

파일: `api/src/admin/counselor-apply/counselor-apply.service.ts` → `approve()`

```
신청서 승인 처리 완료 (memberId 확정)
   ↓
member.referral_code 가 NULL → referral_code = mb_id 로 UPDATE
   ↓
신청서 extras.referrer_code 있으면:
   LOWER(member.referral_code) = LOWER(extras.referrer_code) AND role='counselor' 로 referrer 조회
   referrer.id === memberId 면 self-referral → 차단
   setting에서 referral_rate, referral_months 읽기
   ↓
   counselor_referral INSERT:
     referrer_id    = referrer.id
     referee_id     = memberId
     rate_snapshot  = setting.referral_rate       ← 스냅샷 고정
     months_snapshot = setting.referral_months    ← 스냅샷 고정
     registered_at  = NOW()
     expires_at     = NOW() + months_snapshot개월
     status         = 'active'
```

### 2. 추천 코드 실시간 조회 (신청서 입력 UX)

API: `GET /api/user/counselor-apply/check-referral-code?code=jackee`
응답: `{ found: true, nickname: '찬물선생', mb_id: 'jackee' }`

파일: `api/src/admin/counselor-apply/counselor-apply.controller.ts` → `checkReferralCode()`
프론트: `CounselorApplyNew.tsx` — input onChange debounce 0.5초 → API 호출 → 초록/빨강 표시

### 3. 매월 정산 시 수당 계산 (settlement-cron)

파일: `api/src/cron/settlement-cron.service.ts` → `settleCounselor()`

```
counselor B 의 이번 달 settlement 계산 완료 (priceTot 확정)
   ↓
counselor_referral WHERE referee_id=B AND status='active' AND expires_at>NOW() 조회
   ↓
referral 있으면:
   incentive = floor(priceTot × rate_snapshot)
   incentive = 0 이면 → counselor_referral_payment 기록 생략
   ↓
   counselor_referral_payment UNIQUE(referral_id, pay_month) 중복 체크 (멱등성)
   ↓
   중복 없으면:
     A: point.earning_balance += incentive
        point_history INSERT (rel_table='counselor_referral', earn_point=incentive,
                              content='[추천 수당] B_mb_id YYYY-MM')
     B: point.earning_balance -= incentive
        point_history INSERT (rel_table='counselor_referral', use_point=incentive,
                              content='[추천 수당 차감] YYYY-MM')
     counselor_referral_payment INSERT (referral_id, pay_month, paid_amount=incentive)
   ↓
   expires_at <= NOW() → status='expired' UPDATE
```

> ⚠️ testOnly=true 모드에서는 추천 수당 로직 전체 스킵 (드라이런 보호)

### 4. 정책 변경 (슈퍼 관리자)

API: `PUT /api/admin/referrals/policy` (SuperOnly 가드)
- setting UPDATE (referral_rate, referral_months)
- 기존 counselor_referral.rate_snapshot / months_snapshot → **변경 없음** (스냅샷 유지)
- 신규 승인부터 새 값 적용

---

## UI 표시 구현

### settlements.service.ts — summary() 반환 필드

추천 관련 필드 (SettlementSummary 인터페이스):

```typescript
price_tot: number       // 정산비전체 = 상담수익 + 기타정산비(추천 수당 포함)
tax_deduction: number   // 세금 공제 합계 = 부가세 + 원천징수 + 회선비
referral_earn: number   // 이번 달 추천 수당 적립액 (추천인 A에게만 > 0)
referral_deduct: number // 이번 달 추천 수당 차감액 (피추천인 B에게만 > 0)
```

- `price_tot`, `tax_deduction` → 계산식 한 줄 표시에 사용
  ```
  정산비 9,196 − 공제 1,111(부가세+원천징수) = 8,085원
  ```
- `referral_earn`, `referral_deduct` → 상단 카드 초록/빨강 표시

### settlements.service.ts — incomeList() 반환

`counselor_referral` rel_table 항목 포함:
```typescript
// 추천인 A에게: earn_point=incentive, content='[추천 수당] jackee 2026-05'
// 피추천인 B에게: use_point=incentive, content='[추천 수당 차감] 2026-05'
```
프론트에서 `rel_table === 'counselor_referral'` 판별 → 초록/빨강 배경 행으로 구분 표시

### PointHistoryList.tsx (어드민)

`classifyFlow()` 에 `counselor_referral` 추가 → "추천" 초록 뱃지

### CounselorMyReferral.tsx — 양방향 구조

```typescript
// API: GET /api/user/settlements/referral
// 반환:
{
  referral_code: string | null       // 내 추천 코드 (= mb_id)
  referrals: ReferralItem[]          // 내가 추천한 사람들 (referrer_id = me)
  total_paid_all: number             // 지금까지 지급된 수당 누적 합계
  referred_by: ReferredByItem[]      // 나를 추천한 사람들 (referee_id = me)
}
```

- `referred_by`가 있을 때만 "나를 추천한 상담사" 섹션 표시
- 없으면 섹션 자체 미표시 (데이터 없는데 빈 섹션 노출 금지)

---

## 핵심 파일 인덱스

| 파일 | 역할 |
|---|---|
| `api/src/admin/counselor-apply/counselor-apply.service.ts` | 승인 시 코드 발급 + 추천 관계 자동 등록 |
| `api/src/admin/counselor-apply/counselor-apply.controller.ts` | `GET /check-referral-code` 실시간 조회 |
| `api/src/admin/referrals/referrals.service.ts` | 목록 / 수동 등록 / 비활성 / 정책 CRUD / 마이페이지 현황 + `getMyCounselorReferral()` (referred_by 포함) |
| `api/src/admin/referrals/referrals.controller.ts` | 슈퍼 전용 정책 엔드포인트 |
| `api/src/cron/settlement-cron.service.ts` | 매월 1일 자동 수당 계산·차감·적립 (`settleCounselor` 내부) |
| `api/src/user/settlements/settlements.service.ts` | `summary()` — price_tot / tax_deduction / referral_earn / referral_deduct 반환. `incomeList()` — counselor_referral 항목 포함 |
| `api/src/user/settlements/settlements.controller.ts` | `GET /user/settlements/referral` 마이페이지 현황 |
| `api/db/migrations/20260604000000_referral_system.sql` | DB 마이그레이션 (컬럼 추가 + 코드 일괄 발급 + setting 초기값) |
| `web/user/src/pages/CounselorMyReferral.tsx` | 추천 현황 (양방향: 추천한/받은) + 카카오 공유 |
| `web/user/src/pages/CounselorApplyNew.tsx` | 신청서 추천 코드 입력 + 닉네임 실시간 조회 |
| `web/user/src/pages/CounselorMyPage.tsx` | "추천 현황" 링크 버튼 |
| `web/user/src/pages/SettlementHistory.tsx` | 수익금 내역 추천 수당 표시 + 계산식 표시 |
| `web/mng/src/pages/ReferralList.tsx` | 어드민 추천 관리 + 슈퍼 정책 패널 |
| `web/mng/src/pages/PointHistoryList.tsx` | 어드민 포인트 내역 추천 뱃지 |

---

## API 엔드포인트 목록

```
# 어드민
GET  /api/admin/referrals                    목록 (month, status 필터)
POST /api/admin/referrals                    수동 등록 (referrer_id, referee_id)
POST /api/admin/referrals/:id/pay           이번 달 수동 지급
POST /api/admin/referrals/:id/disable       비활성화
GET  /api/admin/referrals/counselor-search  상담사 검색 (자동완성)
GET  /api/admin/referrals/policy            현재 정책 조회 (슈퍼 전용)
PUT  /api/admin/referrals/policy            정책 변경 (슈퍼 전용)

# 사용자
GET  /api/user/settlements/referral         내 추천 현황 (referrals + referred_by)
GET  /api/user/counselor-apply/check-referral-code?code=jackee  코드 실시간 조회
```

---

## 주의사항 / 엣지케이스

| 상황 | 동작 |
|---|---|
| B가 상담사 자격 정지 | admin에서 status='suspended' 수동 변경 필요 (자동 X) |
| B의 이번 달 수익금 = 0 | incentive=0 → counselor_referral_payment 기록 안 함 |
| 동일 월 중복 실행 | UNIQUE(referral_id, pay_month) 로 자연 방지 |
| testOnly=true | 추천 수당 로직 전체 스킵 |
| A가 point 테이블 없음 | 해당 월 수당 스킵 |
| self-referral 시도 | referrer.id !== memberId 체크로 차단 |
| 추천 코드 대소문자 | LOWER() 비교로 무관 |
| 기간 만료 처리 | 정산 크론 실행 시 expires_at <= NOW() → status='expired' 자동 갱신 |
| 요율 변경 후 기존 관계 | rate_snapshot 고정 → 영향 없음 |

---

## SettlementSummary 인터페이스 — 추천 관련 필드 주의

```typescript
// frontend: web/user/src/lib/api.ts
export interface SettlementSummary {
  // ...
  price_tot: number        // 정산비전체 (상담 + 기타정산비 합산). 직접 접근 가능.
  tax_deduction: number    // 세금 공제 합계. 직접 접근 가능.
  referral_earn?: number   // 추천 수당 적립 (추천인에게만)
  referral_deduct?: number // 추천 수당 차감 (피추천인에게만)
  payout_breakdown: { ... price_tot: number ... }
}
```

> ⚠️ **함정**: `price_paid`는 `priceTot`이 아닌 `thisMonthEarning` (순수 상담 수익만). 계산식:
> - `price_paid` = 상담 수익 (9,200)
> - `price_other` = 추천 차감 포함 기타 (-4)
> - `price_tot` = price_paid + price_other (9,196)
>
> 과거에 `price_paid = priceTot`로 잘못 설정해 "충전+후불 상담"과 "정산비전체"가 동일한 값을 표시하는 버그가 있었음. 2026-06-04 수정 완료.

---

## 카카오 공유 코드 (CounselorMyReferral.tsx)

```typescript
Kakao.Share.sendDefault({
  objectType: 'text',
  text: `사주플랜 상담사로 활동해보세요!\n추천 코드 [${referral_code}]로 신청하시면 수익금의 일부를 함께 나눌 수 있습니다.\n\n📱 앱스토어 / 구글플레이에서 '사주플랜' 검색 → 설치 → 상담사 신청 시 추천 코드 입력`,
  link: { mobileWebUrl: 'https://sajuplan.com', webUrl: 'https://sajuplan.com' },
})
```

> - **정책**: 웹 신청 폼 링크 노출 금지. 메인 홈만 link로 지정 (Kakao API link 필수 필드라 빈값 불가).
> - Kakao SDK는 앱 WebView에 로드된 상태. `window.Kakao` 존재 여부 체크 후 호출.
> - **Android 스토어 승인 후**: text에 실제 스토어 링크 2개 추가, link를 스토어 링크로 교체.

---

## 스토어 현황 (2026-06-04)

| 플랫폼 | 상태 | 향후 작업 |
|---|---|---|
| iOS App Store | ✅ 등록 완료 | Android 승인 후 함께 링크 교체 |
| Android Google Play | ⏳ 심사 중 | 승인 완료 시 사장님 알려주시면 즉시 교체 |

---

## 운영 SQL

```sql
-- 이번 달 추천 수당 지급 현황
SELECT r.id,
       rer.mb_id AS referrer, rer.nickname AS referrer_nick,
       ree.mb_id AS referee,  ree.nickname AS referee_nick,
       r.rate_snapshot, r.months_snapshot, r.status,
       p.pay_month, p.paid_amount
FROM counselor_referral r
LEFT JOIN member rer ON rer.id = r.referrer_id
LEFT JOIN member ree ON ree.id = r.referee_id
LEFT JOIN counselor_referral_payment p ON p.referral_id = r.id
WHERE p.pay_month = TO_CHAR(NOW(), 'YYYY-MM')
ORDER BY p.paid_amount DESC;

-- 상담사별 누적 수당 (상위 추천인)
SELECT rer.mb_id, rer.nickname,
       COUNT(DISTINCT r.referee_id) AS referral_count,
       COALESCE(SUM(p.paid_amount), 0) AS total_earned
FROM counselor_referral r
JOIN member rer ON rer.id = r.referrer_id
LEFT JOIN counselor_referral_payment p ON p.referral_id = r.id
GROUP BY rer.id, rer.mb_id, rer.nickname
ORDER BY total_earned DESC NULLS LAST;

-- 특정 상담사의 추천 코드 확인
SELECT mb_id, nickname, referral_code
FROM member
WHERE role = 'counselor' AND referral_code IS NOT NULL
ORDER BY id;

-- 추천 수당 point_history 조회 (차감·적립 양쪽)
SELECT ph.created_at, m.mb_id, m.nickname,
       ph.earn_point, ph.use_point, ph.content
FROM point_history ph
JOIN member m ON m.id = ph.member_id
WHERE ph.rel_table = 'counselor_referral'
ORDER BY ph.created_at DESC LIMIT 30;

-- 특정 상담사가 추천한/받은 관계
SELECT
  CASE WHEN r.referrer_id = ${targetMemberId} THEN '추천함' ELSE '추천받음' END AS 방향,
  r.status, r.rate_snapshot, r.expires_at,
  rer.mb_id AS referrer, ree.mb_id AS referee
FROM counselor_referral r
LEFT JOIN member rer ON rer.id = r.referrer_id
LEFT JOIN member ree ON ree.id = r.referee_id
WHERE r.referrer_id = ${targetMemberId} OR r.referee_id = ${targetMemberId};
```

---

## 알려진 이슈 / 향후 작업

| # | 항목 | 상태 |
|---|---|---|
| 1 | Android Google Play 승인 후 카카오 공유 링크 교체 | ⏳ 대기 중 |
| 2 | 추천 관계 수동 연장 기능 (어드민 UI) | 미구현 — 현재 SQL 직접 |
| 3 | 추천 수당 관련 알림톡 (지급/차감 안내) | 미구현 |
| 4 | 자기 추천 방지는 코드 체크만 — DB CONSTRAINT 미적용 | 낮은 우선순위 |

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-06-04 | 추천인 시스템 v2 최초 구현 |
| 2026-06-04 | 추천 코드 CSR-랜덤 → mb_id 변경 + 닉네임 실시간 조회 |
| 2026-06-04 | 수익금 내역 추천 수당 표시 + 계산식 한 줄 추가 |
| 2026-06-04 | 추천 현황 양방향 구현 (추천한/받은 모두 표시) |
| 2026-06-04 | 카카오 공유 웹 링크 → 앱 설치 안내 텍스트로 교체 |
| 2026-06-04 | price_paid = priceTot 버그 수정 (충전+후불 상담 금액 오표시) |
| 2026-06-04 | 추천 현황 페이지 api() 함수 호출 오류 수정 (→ api.get()) |
