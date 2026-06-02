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
    // 6. 환영 보상 (옵션)
  })
}
```

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
