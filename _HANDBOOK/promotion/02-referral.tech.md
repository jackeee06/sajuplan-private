# [AI 전용] 추천인 시스템 v2 — 기술 상세 (2026-06-04)

## 아키텍처 한 줄 요약

> 상담사-상담사 추천 관계를 `counselor_referral` 에 등록 → 매월 1일 `settlement-cron` 이 자동으로 수당 계산·차감·적립.

---

## DB 스키마

### member 테이블 추가 컬럼

```sql
referral_code VARCHAR(20) UNIQUE   -- = mb_id. 예: 'jackee'. 상담사 승인 시 mb_id 값으로 자동 설정.
```

### counselor_referral 테이블

```sql
id              BIGSERIAL PK
referrer_id     BIGINT FK → member(id)   -- 추천한 사람 (A)
referee_id      BIGINT FK → member(id)   -- 추천받은 사람 (B)
rate_snapshot   NUMERIC(5,4)             -- 등록 당시 요율 (예: 0.01 = 1%). 정책 변경 시에도 유지.
months_snapshot INT                      -- 등록 당시 기간 (예: 3개월). 동일.
registered_at   TIMESTAMPTZ              -- 상담사 승인일 (기간 기산점)
expires_at      TIMESTAMPTZ              -- registered_at + months_snapshot 개월
status          VARCHAR(20)              -- 'active' / 'expired' / 'suspended'
UNIQUE (referrer_id, referee_id)         -- 동일 쌍 중복 등록 방지
```

### counselor_referral_payment 테이블

```sql
id           BIGSERIAL PK
referral_id  BIGINT FK → counselor_referral(id)
pay_month    VARCHAR(7)     -- 'YYYY-MM'
paid_amount  NUMERIC        -- 실제 지급된 수당 (원)
UNIQUE (referral_id, pay_month)  -- 동일 월 중복 지급 방지
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
member.referral_code 가 NULL 이면 → mb_id 값으로 SET (referral_code = mb_id)
   ↓
extras.referrer_code 있으면:
   member WHERE referral_code = extras.referrer_code AND role='counselor' → referrer 찾기
   setting에서 referral_rate, referral_months 읽기 (현재 정책값)
   ↓
   counselor_referral INSERT:
     referrer_id    = referrer.id
     referee_id     = memberId
     rate_snapshot  = setting.referral_rate       ← 스냅샷! (이후 정책 변경 무관)
     months_snapshot = setting.referral_months    ← 스냅샷!
     registered_at  = NOW()
     expires_at     = NOW() + months_snapshot개월
     status         = 'active'
```

### 2. 매월 정산 시 수당 계산 (settlement-cron)

파일: `api/src/cron/settlement-cron.service.ts`

```
counselor B 의 이번 달 settlement 계산 완료 (priceTot 확정)
   ↓
counselor_referral WHERE referee_id=B AND status='active' AND expires_at>NOW() 조회
   ↓
referral 있으면:
   incentive = floor(priceTot × rate_snapshot)
   ↓
   counselor_referral_payment WHERE referral_id=? AND pay_month=? 중복 체크
   ↓
   중복 없으면:
     A의 point.earning_balance += incentive
     A의 point_history INSERT (rel_table='counselor_referral', content='[추천 수당] B_mb_id YYYY-MM')
     B의 point.earning_balance -= incentive   ← 수익금에서 차감
     B의 point_history INSERT (rel_table='counselor_referral', content='[추천 수당 차감] YYYY-MM')
     counselor_referral_payment INSERT (referral_id, pay_month, paid_amount)
   ↓
   expires_at <= NOW() 이면 → status='expired' 업데이트
```

### 3. 정책 변경 (슈퍼 관리자)

API: `PUT /api/admin/referrals/policy` (슈퍼 전용)

```
body: { rate: 0.015, months: 6 }   ← 1.5%, 6개월로 변경 예시
   ↓
setting UPDATE (referral_rate, referral_months)
   ↓
기존 counselor_referral.rate_snapshot / months_snapshot → 변경 없음 (스냅샷 유지)
신규 승인부터 새 값 적용
```

---

## 핵심 파일 인덱스

| 파일 | 역할 |
|---|---|
| `api/src/admin/counselor-apply/counselor-apply.service.ts` | 승인 시 코드 발급 + 추천 관계 자동 등록 |
| `api/src/admin/referrals/referrals.service.ts` | 목록 조회 / 수동 등록 / 비활성 / 정책 CRUD / 마이페이지 현황 |
| `api/src/admin/referrals/referrals.controller.ts` | `GET/PUT /admin/referrals/policy` 슈퍼 전용 |
| `api/src/cron/settlement-cron.service.ts` | 매월 1일 자동 수당 계산·차감·적립 (settleCounselor 함수 안) |
| `api/src/user/settlements/settlements.controller.ts` | `GET /user/settlements/referral` 마이페이지 현황 |
| `api/src/user/settlements/settlements.module.ts` | AdminReferralsService 주입 |
| `api/db/migrations/20260604000000_referral_system.sql` | DB 마이그레이션 (컬럼 추가 + 코드 일괄 발급 + setting 초기값) |
| `web/user/src/pages/CounselorMyReferral.tsx` | 상담사 마이페이지 추천 현황 탭 |
| `web/user/src/pages/CounselorApplyNew.tsx` | 신청서 추천 코드 입력칸 |
| `web/user/src/pages/CounselorMyPage.tsx` | "추천 현황" 링크 버튼 추가 |
| `web/mng/src/pages/ReferralList.tsx` | 어드민 추천 관리 + 슈퍼 정책 패널 |

---

## API 엔드포인트 목록

```
GET  /api/admin/referrals                   목록 (month, status 필터)
POST /api/admin/referrals                   수동 등록 (referrer_id, referee_id)
POST /api/admin/referrals/:id/pay          이번 달 수동 지급
POST /api/admin/referrals/:id/disable      비활성화
GET  /api/admin/referrals/counselor-search 상담사 검색 (자동완성)
GET  /api/admin/referrals/policy           현재 정책 조회 (슈퍼 전용)
PUT  /api/admin/referrals/policy           정책 변경 (슈퍼 전용)

GET  /api/user/settlements/referral        내 추천 현황 (상담사 로그인 필요)
```

---

## 주의사항 / 엣지케이스

| 상황 | 동작 |
|---|---|
| B가 상담사 자격 정지 | admin에서 status='suspended' 수동 변경 필요 (자동 X) |
| B의 이번 달 수익금 = 0 | incentive=0 → counselor_referral_payment 기록 안 함 |
| 동일 월 중복 실행 | UNIQUE(referral_id, pay_month) 로 자연 방지 |
| testOnly=true | 추천 수당 로직 스킵 (드라이런 보호) |
| A가 point 테이블 없음 | 해당 월 수당 스킵 (point 없으면 적립 불가) |
| self-referral 시도 | referrer.id !== memberId 체크로 차단 |

---

## 운영 SQL

```sql
-- 이번 달 추천 수당 지급 현황
SELECT r.id, rer.mb_id AS referrer, ree.mb_id AS referee,
       r.rate_snapshot, r.months_snapshot,
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
       SUM(p.paid_amount) AS total_earned
FROM counselor_referral r
JOIN member rer ON rer.id = r.referrer_id
LEFT JOIN counselor_referral_payment p ON p.referral_id = r.id
GROUP BY rer.id, rer.mb_id, rer.nickname
ORDER BY total_earned DESC NULLS LAST;

-- 특정 상담사의 추천 코드 확인
SELECT mb_id, nickname, referral_code FROM member
WHERE role = 'counselor' AND referral_code IS NOT NULL
ORDER BY id;

-- 추천 수당 point_history 조회
SELECT ph.*, m.mb_id FROM point_history ph
JOIN member m ON m.id = ph.member_id
WHERE ph.rel_table = 'counselor_referral'
ORDER BY ph.created_at DESC LIMIT 20;
```
