# [AI 전용] 회원·상담사 운영 도구 — 기술 상세

## DB

```
member
- state VARCHAR — 'active' / 'banned' / 'withdrawn'
- ban_reason TEXT
- banned_at TIMESTAMPTZ
- banned_by INT FK admin
```

## 정지 처리

```typescript
async banMember(memberId, reason, adminId) {
  await this.sql`
    UPDATE member SET
      state='banned',
      ban_reason=${reason},
      banned_at=NOW(),
      banned_by=${adminId}
    WHERE id=${memberId}
  `
  // 알림톡 발송 (옵션, 백로그)
}
```

## 강제 로그아웃

세션 무효화 — JWT 인증이면 토큰 만료 또는 블랙리스트 관리.

## 절대 금지

`DELETE FROM member` 또는 `TRUNCATE member` — 메모리 `[[db-truncate-cascade-disaster]]` 사고. FK 제약 + 이력 손실.

## 핵심 코드 위치

- 회원: `api/src/admin/members/members.service.ts`
- 상담사: `api/src/admin/counselor-ops/counselor-ops.service.ts`
- 신청: `api/src/admin/counselor-apply/counselor-apply.service.ts`
- 환불: `api/src/admin/refunds/refunds.service.ts`
- 포인트 수동: `api/src/admin/points/points.service.ts`

## 운영 SQL

```sql
-- 정지 회원
SELECT id, mb_id, ban_reason, banned_at FROM member
WHERE state='banned' ORDER BY banned_at DESC;

-- 같은 IP / phone 패턴 다수 가입 (어뷰징 의심)
SELECT SUBSTRING(phone, 1, 7) AS prefix, COUNT(*)
FROM member
GROUP BY prefix HAVING COUNT(*) > 3;
```

## 포인트 수동 조정 (D-4) — 2026-06-12 무관용 검증 수정

`api/src/admin/points/points.service.ts adjust()` (POST `/admin/members/customers/:id/point-adjust`, `/admin/points/adjust-by-mb-id`). free/paid/earning 3계좌 직접 증감. 일반관리자 가능(정책).

- 🔴 **balance_kind 누락 fix**: earning 조정인데 INSERT 가 `balance_kind` 를 안 넣어 default `'consumer'` 로 저장 → ① 정산 합산(`WHERE balance_kind='earning'`)에서 빠지고 ② 회원 코인내역(consumer)에 오염. → `kind==='earning' ? 'earning' : 'consumer'` 명시.
- 🟠 **더블서밋 멱등 가드 fix**: 같은 관리자·회원·사유·금액 10초 내 중복 조정 → 두 번째 `duplicated:true` 무시(이중 적립·차감 방지). point 행 FOR UPDATE 로 동시요청도 직렬화. 검증: `e2e/tests/67-admin-point-idempotency.spec.ts`(더미 더블서밋 → net-zero).
- 견고: 차감 시 사이드별 음수 방지, FOR UPDATE, actor(admin_id/ip) 이력.
- 잔존(보고): 금액 상한/일일한도/2차승인 없음(내부자 위협은 사후 audit 만). 정책 결정.

## 권한 경계 보강 (2026-06-12)

- **선지급 정책키 슈퍼 전용화**: `payout.enabled / available_ratio / max_per_day_per_counselor / bank_lock_days / min_amount / block_preliminary` 를 `SUPER_ONLY_SETTING_KEYS` 에 추가(기존 fee_rate/withholding_rate 만 있었음). 일반관리자가 사기방지 레버·kill switch 변경 불가. 검증: `e2e/tests/66-admin-payout-superonly.spec.ts`(일반관리자 403).
- **마지막 슈퍼관리자 보호**: `permissions.service setSuperFlag(false)`/`deactivateAdmin` 에 "다른 슈퍼 0명이면 거부" 가드 — 슈퍼 0명 영구 잠김 방지.
- ③ **결제취소↔환불 상호가드는 의도적 미적용**: payment(충전건)↔consultation(사용건) 신뢰할 연결키 없음 → 자동 가드는 정상 작업 오차단 위험이 더 큼. actor·이력으로 추적, 운영자 분별 의존.

## 관련 메모리

- `[[db-truncate-cascade-disaster]]`
- `[[id-unification-complete]]`

---

## 추가 운영 도구 (2026-06-12)

### 상담사 리스트 매출 — 전화(070)/채팅 2분류  → 메모리 [[project-counselor-sales-call-chat]]
- 이번달/지난달 매출 서브쿼리(`findCounselors` 의 `this_m`/`last_m` CTE)를 **preflag → roomid 기준**으로 분리.
  - 전화(070) = `roomid IS NULL` (후불 060 흡수) = `this_month_070`
  - 채팅 = `roomid IS NOT NULL` = `this_month_chat`
- 이전엔 preflag 기준이라 **채팅이 070(전화)에 섞이는** 버그(채팅 consultation 의 preflag='Y' 케이스). 매출 총합은 같았으나 항목 분류가 틀렸음.
- 060(전화 후불)은 미사용(개발보류)이라 화면에서 칸 제거(데이터는 consultation 에 보존, 부활 가능). 컬럼 "이번달 전화 / 이번달 채팅". `monthSalesOf = 070 + chat`.
- ⚠️ 매출 건별 정확 검증은 **사용(상담) 내역**(ConsultationList) 이 가장 정확(전화·채팅 모두 amt 원장).

### 듀얼계정 ID 링크 폴백  → 메모리 [[project-dual-account-link-fallback]]
- 한 사람이 회원이자 상담사(듀얼). 목록에서 **회원ID 클릭 → `/members/customers/:id`(고객 화면)** 인데 그 사람이 상담사면 "고객을 찾을 수 없습니다"(고객 조회가 `role='user'`). 12개 진입점에 동일 위험.
- 해결(12곳 안 고치고 근본): 신설 `GET /admin/members/whois/:id`(role 필터 없이 role 반환) + 고객/상담사 상세 화면 **폴백 리다이렉트**.
  - `CustomerForm`: 고객 못 찾으면 whois → role='counselor' 면 `/members/counselors/:id` 로.
  - `CounselorForm`: 상담사 못 찾으면 whois → role='user' 면 `/members/customers/:id` 로.

### 사용(상담) 내역 긴 ID 말줄임
- 소셜 가입(카카오/네이버)의 긴 `mb_id`(예: `aWl_8ZEh…sg_N`)가 표를 옆으로 늘림 → ID 셀에 `max-w-[140px] truncate` + `title`(전체 ID) 툴팁 + 클릭 시 회원/상담사 상세. 짧은 휴대폰 ID는 그대로. `ConsultationList.tsx`.

### 상담사 단가 단위시간 30초 고정  → 메모리 [[project-unit-seconds-fixed-30]]
- `member.call_unit_seconds`/`chat_unit_seconds` 는 **항상 30 강제**(서버가 입력 무시). 화면이 단가를 "30초당 N원"으로 하드코딩 표시하기 때문. `CounselorForm` 입력칸 제거 → "30초 고정" 안내만. (상세: counselor/02-grade-pricing.tech.md)
