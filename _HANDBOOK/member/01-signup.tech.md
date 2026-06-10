# [AI 전용] 회원 가입 — 기술 상세

## 가입 트랜잭션

`api/src/user/auth/auth.service.ts` `signup()`:

```typescript
async signup(dto) {
  return await this.sql.begin(async (tx) => {
    // 1. SMS 인증 검증
    // 2. member INSERT (role='user')
    // 3. point INSERT
    // 4. m2net.registerMember 시도
    //    - 실패 시: 트랜잭션 롤백 → 가입 자체 취소
    // 5. 추천인 처리 (referrer_id 있으면)
    // 6. 회원가입 코인 지급 — creditRegisterPoint() (register_point)
  })
}
```

## 회원가입 코인 (register_point)

- 가입 완료 시 `creditRegisterPoint(memberId)` → `setting.member.register_point`(예: 10,000) 코인 즉시 지급. best-effort.
- 로컬 가입: `auth.service.ts:createLocalMember()` 내부 호출.
- 소셜 가입: `auth.controller.ts:signup()` 소셜 분기에서 호출 (`creditRegisterPoint(created.id)`).

### [BUG FIX 2026-06-10] 소셜 가입 코인 누락 + [정책 2026-06-07] 쿠폰 폐지

- 과거 소셜 가입 분기는 폐지된 `issueSignupCoupon`(쿠폰)만 호출 → 0 지급. 로컬만 `creditRegisterPoint` 호출.
- 수정: 소셜 분기에 `creditRegisterPoint` 추가 + `issueSignupCoupon` 호출 제거(이중지급 방지). 기존 소셜 가입자 9명(카카오 3 + 네이버 6) 각 10,000 코인 소급 지급 완료.
- 정책: 가입 보상은 `register_point`(즉시 코인) 단일 경로로 통일. 회원가입 쿠폰 폐지.
- 상세: `auth/01-signup-auth.tech` 참조.

## DB 스키마

```
member
- id, mb_id (UNIQUE), nickname, phone, role
- password (bcrypt)
- m2net_membid VARCHAR
- referrer_id INT FK → member(id)
- created_at, last_login_at
- state — 'active' / 'banned' / 'withdrawn'

point (회원당 1 row)
- member_id INT FK (PK)
- free_balance, paid_balance, earning_balance — INT
```

## m2net 등록 실패 시 정책

- 회원: 가입 자체 롤백 → 사용자에게 명확한 에러
- 상담사: 사주플랜 row 유지, csrid=NULL → 운영자 수동 재시도

→ 메모리 `[[id-unification-complete]]`, 감사 `_AUDIT_PHASE_D_EXTERNAL_DEPS.md` §5

## 핵심 코드 위치

- 가입: `api/src/user/auth/auth.service.ts:signup()`
- DTO: `api/src/user/auth/dto/signup.dto.ts`
- m2net: `m2net.service.ts:registerMember()`
- 추천인: `auth.service.ts:processReferral()`

## 운영 SQL

```sql
-- 일별 가입 수
SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS new_members
FROM member
WHERE role='user'
GROUP BY day
ORDER BY day DESC LIMIT 30;

-- m2net 미등록 회원 (사고 흔적)
SELECT id, mb_id, created_at FROM member
WHERE role='user' AND m2net_membid IS NULL
ORDER BY created_at DESC;
```

## 관련 메모리

- `[[id-unification-complete]]`
- `[[event-counselors-plan]]` (상담사 가입 별도)
