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

## 본인소개(intro) 저장형 XSS 방어 (2026-06-12)

지원자가 작성한 본인소개(`introduction`/`intro`)는 **신뢰 불가 입력**인데, 신청 검토 화면이 `dangerouslySetInnerHTML` 로 정화 없이 렌더해 **관리자 세션을 노린 저장형 XSS** 위험이 있었다(공개 상세 `CounselorDetail` 은 sanitize 하는데 검토 화면만 누락 = 보호수준 역전).

- 수정: 공개 상세와 동일 정책의 `sanitizeIntroHtml()` 적용.
  - user: `web/user/src/pages/CounselorApplyDetail.tsx` + `web/user/src/lib/sanitizeHtml.ts`(신규)
  - mng: `web/mng/src/pages/CounselorApplyDetail.tsx` + `web/mng/src/lib/sanitizeHtml.ts`(신규)
- 정책: script/iframe/object/embed/style 제거 + on* 이벤트 속성 제거 + javascript:/data: URL 차단(정규식 denylist). 장기적으로 DOMPurify 권장.

## 승인 가드 — 종결 상태(반려/취소) 재승인 차단 (2026-06-12 fix)

`approve()` 가드가 `accepted`/`superseded` 만 막아 **`rejected`/`cancelled` 신청을 다시 승인**할 수 있었다.
- 반려 재승인 → 반려사유와 모순. 취소 재승인 → **신청자 본인이 철회했는데 강제 상담사 등록**(동의 정합/법적 리스크).
- 수정: approve 진입 시 `rejected`/`cancelled` 도 ConflictException 으로 차단.
## 승인 동시성·본인확인 보강 (2026-06-12 fix)

- **동시 승인 직렬화**: approve() 를 `sql.begin` 으로 감싸 진입 즉시 `pg_advisory_xact_lock(7777010, id)` + `post_apply ... FOR UPDATE`. 같은 신청 동시 2요청/더블클릭 시 두 번째는 첫 commit 까지 대기 → status='accepted' 보고 ConflictException. (중복 회원생성·중복 m2net 등록 방지)
- **데드락 회피**: 위 FOR UPDATE 로 잠근 행을 갱신하는 **최종 post_apply UPDATE 만 tx 로** 전환(나머지 헬퍼·m2net·파일은 기존대로 pool 연결). 전면 단일 트랜잭션은 헬퍼(promote/create)·외부 m2net HTTP 때문에 비채택 — 기존 **재실행-멱등 설계**(status 플립 최후 + 부분승인 자동복구) 유지.
- **본인확인 강화**: `existingByPhone` 동일인 판정에서 회원 신청(member_id 존재)이면 `member_id` 정확 일치만 인정(과거 `mb_id` 단독 매칭 → 엉뚱한 기존 상담사 후처리 위험 제거).
- 검증: `e2e/tests/69-admin-approve-tx.spec.ts`(없는 신청 승인 → tx 경로 404, 500 아님) + admin 라우트 회귀.

## 관련 메모리

- `[[id-unification-complete]]`
- `[[event-counselors-plan]]` (이벤트 상담사 시스템)
