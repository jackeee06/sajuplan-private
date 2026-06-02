# [AI 전용] 상담사 신청 + 승인 — 기술 상세

## 흐름 코드

```typescript
// 회원: api/src/user/counselor-apply/counselor-apply.service.ts
async apply(memberId, dto) {
  // counselor_apply INSERT (status='pending')
  // 운영자 알림 (OpsAlert)
}

// 운영자: api/src/admin/counselor-apply/counselor-apply.service.ts
async approve(applyId, adminId) {
  return await this.sql.begin(async (tx) => {
    // 1. counselor_apply.status='approved'
    // 2. member.role='counselor'
    // 3. m2net.registerCounselor 시도
    //    - 성공: member.csrid 업데이트
    //    - 실패: csrid=NULL 유지 (운영자 수동 재시도)
    // 4. 환영 알림톡
  })
}

async reject(applyId, adminId, reason) {
  // counselor_apply.status='rejected' + rejected_reason
  // 반려 알림톡
}
```

## DB 스키마

```
counselor_apply
- id BIGSERIAL
- member_id INT FK
- nickname VARCHAR
- introduction TEXT
- category VARCHAR — '사주' / '타로' / '신점'
- profile_image_url VARCHAR
- status VARCHAR — 'pending' / 'approved' / 'rejected'
- rejected_reason TEXT
- approved_by INT FK admin
- approved_at TIMESTAMPTZ
- created_at TIMESTAMPTZ
```

## m2net 등록 실패 시 정책

메모리 `[[id-unification-complete]]` + `_AUDIT_PHASE_D_EXTERNAL_DEPS.md` §5:
- 사주플랜 측 role='counselor' 유지
- csrid=NULL
- 운영자가 `linkCounselorToM2net` 수동 재시도

## 핵심 코드 위치

- 회원: `api/src/user/counselor-apply/counselor-apply.service.ts`
- 운영자: `api/src/admin/counselor-apply/counselor-apply.service.ts`
- m2net: `m2net.service.ts:registerCounselor()`
- 수동 재시도: `linkCounselorToM2net()` (어디 위치 확인 필요)

## 운영 SQL

```sql
-- 대기 중 신청
SELECT id, member_id, nickname, category, created_at
FROM counselor_apply
WHERE status='pending'
ORDER BY created_at;

-- csrid 미발급 상담사 (m2net 재시도 대상)
SELECT id, mb_id, nickname FROM member
WHERE role='counselor' AND csrid IS NULL;

-- 승인률
SELECT status, COUNT(*) FROM counselor_apply
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY status;
```

## 관련 메모리

- `[[id-unification-complete]]`
- `[[event-counselors-plan]]` (이벤트 상담사 시스템)
