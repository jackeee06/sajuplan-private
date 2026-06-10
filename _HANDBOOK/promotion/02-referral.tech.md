# [AI 전용] 추천인 시스템 v2 — 기술 상세 (2026-06-10 실시간 적립 전환)

## 아키텍처 한 줄 요약

> 상담사-상담사 추천 관계를 `counselor_referral` 에 등록 → **상담 종료 시점에 `m2net-push.service.ts` `creditCounselorPointInTx` 가 실시간으로 추천수익금 적립·차감** (제로섬). `settlement-cron` 은 추천수당 계산을 더 이상 하지 않고 만료 관계 정리(`active→expired`)만 담당. 양방향 UI 표시 + 수익금 내역 통합.
>
> ⚠️ **2026-06-10 변경**: 월배치(매월 1일) 추천수당 계산 → 상담 단위 실시간 적립으로 전환. 용어 "추천 수당" → **"추천수익금"** 통일. 부담은 피추천자(B) earning 차감 → 추천자(A) earning 이전(제로섬, 회사 비용 0).

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

### counselor_referral_payment 테이블 — ⚠️ 구 월배치 잔재, 실시간 전환으로 **미사용**

```sql
id           BIGSERIAL PK
referral_id  BIGINT FK → counselor_referral(id)
pay_month    VARCHAR(7)     -- 'YYYY-MM'
paid_amount  NUMERIC        -- 실제 지급된 수당 (원)
UNIQUE (referral_id, pay_month)  -- (구) 동일 월 중복 지급 방지
```

> 2026-06-10 실시간 적립 전환 이후 **이 테이블에는 더 이상 INSERT 하지 않는다.**
> 멱등성은 이제 `point_history (rel_table, rel_id, rel_action)` ON CONFLICT 로 보장한다.
> 테이블 자체는 과거 데이터 보존을 위해 DROP 하지 않고 남겨둠.

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

### 3. 상담 종료 시 추천수익금 실시간 적립 (2026-06-10 신규 — 핵심)

파일: **`api/src/pg-callbacks/m2net-push.service.ts` → `creditCounselorPointInTx()`**
위치: 메서드 내부, 상담사 본인 earning 적립(point_history INSERT ON CONFLICT) 직후의
`// ─── 추천수익금 실시간 적립 (2026-06-10) ───` 블록.

전제: 이 블록은 같은 트랜잭션(`tx`) 안에서, 상담사 본인 적립 INSERT 가 **성공(refIns 멱등 통과)** 한 직후에 도달한다.

```
피추천자(counselorId = B)의 이번 상담 본인 earning 적립 완료
   ↓
if (effectiveAmt > 0):           ← effectiveAmt = 이번 상담의 실수익 (= amt × 정산률)
   counselor_referral cr
     WHERE referee_id = counselorId
       AND status = 'active'
       AND expires_at > now()
     LIMIT 1                     ← B를 추천한 활성 referrer 1건
   ↓
   referrer(A) 있으면:
     refRate   = parseFloat(cr.rate_snapshot)          ← 스냅샷 고정 요율
     incentive = floor(effectiveAmt × refRate)
     가드: incentive>0 AND 0<refRate<1 AND referrer_id ≠ counselorId (self-referral 차단)
   ↓
     A: point row 보장 (INSERT ... ON CONFLICT DO NOTHING)
        earning FOR UPDATE → balance_after 산출
        point_history INSERT (
          balance_kind = 'earning', earn_point = incentive,
          rel_table='consultation', rel_id='{consultationId}', rel_action='{consultationId}@추천수익금적립',
          content='[추천수익금] 피추천 상담사 수익의 N.NN%')
        ON CONFLICT (rel_table, rel_id, rel_action) WHERE rel_table IN ('payment','payment_autopay','consultation') DO NOTHING
        RETURNING id  → refIns
   ↓
     if refIns.length > 0:   ← 멱등 안전망: 이미 처리된 상담이면 0건 → 적립/차감 모두 스킵
        A: point.earning_balance += incentive, total_earned += incentive
        B: point.earning_balance = GREATEST(earning_balance - incentive, 0), total_used += incentive   ← 제로섬 차감
        B: point_history INSERT (
             balance_kind='earning', use_point=incentive,
             rel_table='consultation', rel_id='{consultationId}', rel_action='{consultationId}@추천수익금차감',
             content='[추천수익금 차감] 추천 상담사에게 N.NN% 이전')
           ON CONFLICT (...) DO NOTHING
        log [referral-realtime] consultation=.. referee=.. → referrer=.. incentive=..
```

**멱등성**: consultation 재처리 시 `point_history (rel_table='consultation', rel_id, rel_action)` ON CONFLICT 로 적립·차감 모두 정확히 1회만 실행. 별도 카운터/플래그 불필요.
**제로섬**: B earning 에서 빠진 만큼 A earning 으로 이전 → 회사 추가 비용 0.
**정산 자동 포함**: earning 에 실시간 적립되므로 새 정산(earning 합산 방식)에서 자동·정확히 잡힌다.

> ⚠️ `counselor_referral_payment` 테이블에는 INSERT 하지 않는다 (구 월배치 방식 잔재).

### 3-1. settlement-cron 의 잔여 역할 — 추천수당 계산 제거됨

파일: `api/src/cron/settlement-cron.service.ts` → `settleCounselor()`

- **추천수당 계산·차감·적립 블록은 제거됨** (실시간 적립으로 이관).
- 남은 추천 관련 로직은 **만료 관계 정리뿐**:
  ```sql
  UPDATE counselor_referral SET status = 'expired'
   WHERE status = 'active' AND expires_at <= NOW()
  ```
  `testOnly=false` 일 때 정산 사이클당 1회 실행.
- ⚠️ 정산 cron 자체는 현재 자동실행 차단 상태(정산 단순화 = earning 합산 전환 중, 다음 세션 작업 예정).

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
price_tot: number       // 정산비전체 = 상담수익 + 기타정산비(추천수익금 포함)
tax_deduction: number   // 세금 공제 합계 = 부가세 + 원천징수 + 회선비
referral_earn: number   // 이번 달 추천수익금 적립액 (추천인 A에게만 > 0)
referral_deduct: number // 이번 달 추천수익금 차감액 (피추천인 B에게만 > 0)
```

- `price_tot`, `tax_deduction` → 계산식 한 줄 표시에 사용
  ```
  정산비 9,196 − 공제 1,111(부가세+원천징수) = 8,085원
  ```
- `referral_earn`, `referral_deduct` → 상단 카드 초록/빨강 표시

### settlements.service.ts — incomeList() 반환

추천수익금 항목은 이제 `rel_table='consultation'` + `rel_action='{id}@추천수익금적립/차감'` 으로 기록됨:
```typescript
// 추천인 A에게: earn_point=incentive, content='[추천수익금] 피추천 상담사 수익의 N.NN%'
// 피추천인 B에게: use_point=incentive, content='[추천수익금 차감] 추천 상담사에게 N.NN% 이전'
```
프론트에서 content 의 `[추천수익금]` / `[추천수익금 차감]` 접두로 판별 → 초록/빨강 배경 행으로 구분 표시.
> ⚠️ 구버전은 `rel_table === 'counselor_referral'` 로 판별했으나, 실시간 적립부터 `rel_table='consultation'` 이므로 rel_table 만으로는 구분 불가. content 접두 또는 rel_action 패턴(`@추천수익금`)으로 판별할 것.

### PointHistoryList.tsx (어드민)

`classifyFlow()` — content 접두 `[추천수익금]` 기준으로 "추천" 뱃지 분류.

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
| **`api/src/pg-callbacks/m2net-push.service.ts`** | **`creditCounselorPointInTx()` — 상담 종료 시 추천수익금 실시간 적립·차감 (제로섬, 멱등). 추천 시스템의 핵심 적립 지점.** |
| `api/src/cron/settlement-cron.service.ts` | (추천수당 계산 제거됨) 만료 관계 정리 `active→expired` 만 담당 (`settleCounselor` 내부) |
| `api/src/user/settlements/settlements.service.ts` | `summary()` — price_tot / tax_deduction / referral_earn / referral_deduct 반환. `incomeList()` — counselor_referral 항목 포함 |
| `api/src/user/settlements/settlements.controller.ts` | `GET /user/settlements/referral` 마이페이지 현황 |
| `api/db/migrations/20260604000000_referral_system.sql` | DB 마이그레이션 (컬럼 추가 + 코드 일괄 발급 + setting 초기값) |
| `web/user/src/pages/CounselorMyReferral.tsx` | 추천 현황 (양방향: 추천한/받은) + 카카오 공유 |
| `web/user/src/pages/CounselorApplyNew.tsx` | 신청서 추천 코드 입력 + 닉네임 실시간 조회 |
| `web/user/src/pages/CounselorMyPage.tsx` | "추천 현황" 링크 버튼 |
| `web/user/src/pages/SettlementHistory.tsx` | 수익금 내역 추천수익금 표시 + 계산식 표시 |
| `web/mng/src/pages/ReferralList.tsx` | 어드민 추천 관리 + 슈퍼 정책 패널 |
| `web/mng/src/pages/PointHistoryList.tsx` | 어드민 포인트 내역 추천 뱃지 |

---

## API 엔드포인트 목록

```
# 어드민
GET  /api/admin/referrals                    목록 (month, status 필터)
POST /api/admin/referrals                    수동 등록 (referrer_id, referee_id)
POST /api/admin/referrals/:id/pay           (DEPRECATED) 구 월배치 수동 지급 — 실시간 전환으로 사용 안 함
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
| B가 상담사 자격 정지 | admin에서 status='suspended' 수동 변경 필요 (자동 X) → 이후 상담분 적립 안 됨 |
| B의 상담 실수익 effectiveAmt = 0 | `if (effectiveAmt > 0)` 가드로 블록 진입 안 함 → 적립 없음 |
| incentive = floor(effectiveAmt × rate) = 0 | `incentive > 0` 가드로 스킵 (소액 상담은 적립 0 가능) |
| 동일 consultation 재처리 | point_history (rel_table='consultation', rel_id, rel_action) ON CONFLICT 로 정확히 1회 |
| A가 point 테이블 없음 | INSERT ... ON CONFLICT DO NOTHING 로 row 보장 후 적립 |
| self-referral 시도 | 등록 시 차단 + 적립 시 `referrer_id ≠ counselorId` 재확인 |
| 추천 코드 대소문자 | LOWER() 비교로 무관 |
| 기간 만료 처리 | 정산 크론이 expires_at <= NOW() → status='expired' 정리. 적립 자체는 SELECT 의 `expires_at > now()` 로 즉시 차단 |
| 요율 변경 후 기존 관계 | rate_snapshot 고정 → 영향 없음 |
| referrer 다수? | SELECT ... LIMIT 1 — referee당 활성 추천자 1명만 (UNIQUE(referrer_id, referee_id) + 실무상 1:1) |

---

## SettlementSummary 인터페이스 — 추천 관련 필드 주의

```typescript
// frontend: web/user/src/lib/api.ts
export interface SettlementSummary {
  // ...
  price_tot: number        // 정산비전체 (상담 + 기타정산비 합산). 직접 접근 가능.
  tax_deduction: number    // 세금 공제 합계. 직접 접근 가능.
  referral_earn?: number   // 추천수익금 적립 (추천인에게만)
  referral_deduct?: number // 추천수익금 차감 (피추천인에게만)
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
-- ⚠️ 실시간 전환(2026-06-10) 후 추천수익금 실적은 point_history 가 진실원천이다.
--    counselor_referral_payment 는 더 이상 채워지지 않음(구 월배치 잔재).

-- 이번 달 추천수익금 적립 현황 (적립 = earn_point, 차감 = use_point)
SELECT ph.created_at, m.mb_id, m.nickname,
       ph.earn_point, ph.use_point, ph.rel_id AS consultation_id, ph.content
FROM point_history ph
JOIN member m ON m.id = ph.member_id
WHERE ph.rel_table = 'consultation'
  AND ph.rel_action LIKE '%@추천수익금%'
  AND ph.created_at >= date_trunc('month', NOW())
ORDER BY ph.created_at DESC;

-- 상담사별 누적 추천수익금 (상위 추천인) — 적립분만 합산
SELECT m.mb_id, m.nickname,
       COUNT(*) AS credit_count,
       COALESCE(SUM(ph.earn_point), 0) AS total_earned
FROM point_history ph
JOIN member m ON m.id = ph.member_id
WHERE ph.rel_table = 'consultation'
  AND ph.rel_action LIKE '%@추천수익금적립'
GROUP BY m.id, m.mb_id, m.nickname
ORDER BY total_earned DESC;

-- 특정 상담사의 추천 코드 확인
SELECT mb_id, nickname, referral_code
FROM member
WHERE role = 'counselor' AND referral_code IS NOT NULL
ORDER BY id;

-- 추천수익금 point_history 조회 (차감·적립 양쪽)
SELECT ph.created_at, m.mb_id, m.nickname,
       ph.earn_point, ph.use_point, ph.rel_id AS consultation_id, ph.content
FROM point_history ph
JOIN member m ON m.id = ph.member_id
WHERE ph.rel_table = 'consultation'
  AND ph.rel_action LIKE '%@추천수익금%'
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
| 3 | 추천수익금 관련 알림톡 (적립/차감 안내) | 미구현 |
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
| **2026-06-10** | **추천수당 → 추천수익금 실시간 적립 전환.** 월배치(settlement-cron) 추천수당 계산 제거, `m2net-push.service.ts creditCounselorPointInTx` 에 상담 종료 시 실시간 적립·차감 블록 추가. 제로섬(B earning → A earning), point_history (rel_table='consultation', rel_action='{id}@추천수익금적립/차감') ON CONFLICT 멱등. counselor_referral_payment 미사용 전환. 용어 "추천 수당"→"추천수익금". 정책값(rate 0.01 / 3개월) 불변. settlement-cron 은 만료 관계 정리만 잔존. **prod 검증**: 찬물선생(91) 상담 → 라온선생(123) 추천수익금 +4 즉시 적립 확인. |
