# [AI 전용] 사용자 인증 — 기술 상세

## 비밀번호 정책 (2026-05-25)

- 최소 8자
- 영문 + 숫자 혼합 (정규식 검증)
- DTO: `api/src/user/auth/dto/signup.dto.ts`

```typescript
@MinLength(8)
@Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/)
password: string;
```

## SMS 인증

- 5분 유효 + 5분 5회 한도
- DB: `sms_auth (phone, auth_code, expires_at)`
- 발송: BizM 알림톡 `register_num_v2` 우선 + 실패 시 알리고 SMS 폴백 (현재 미설정, 메모리 `[[alimtalk-bizm-only]]`)

## 회원가입 코인 지급 (register_point)

- 가입 완료 시 `creditRegisterPoint(memberId)` 호출 → `setting.member.register_point` 값(예: 10,000)을 코인으로 즉시 지급 + m2net 동기화. best-effort (실패해도 가입 진행).
- **로컬 가입**: `auth.service.ts:createLocalMember()` 내부에서 `creditRegisterPoint()` 호출 (`auth.service.ts:535-537`).
- **소셜 가입**: `auth.controller.ts:signup()` 의 소셜 분기에서 `creditRegisterPoint(created.id)` 호출 (`auth.controller.ts:1022`).

```typescript
// auth.service.ts
async creditRegisterPoint(memberId: number): Promise<void> {
  const rows = await this.sql`SELECT value FROM setting WHERE namespace='member' AND key='register_point' LIMIT 1`;
  const amount = Math.max(0, Math.trunc(Number(rows[0]?.value ?? '0')));
  if (amount <= 0) return;
  await this.creditPointToMember(memberId, amount, '회원가입 적립', 'register_point');
}
```

### [BUG FIX 2026-06-10] 소셜 가입 코인 누락

- **증상**: 카카오/네이버 가입자가 회원가입 코인(10,000)을 못 받음. 로컬 가입자만 받음.
- **원인**: 로컬 가입(`createLocalMember`)은 `creditRegisterPoint` 호출. 소셜 가입(`auth.controller.signup` 소셜 분기)은 폐지된 `issueSignupCoupon`(쿠폰)만 호출했고 쿠폰존도 비활성 → 0 지급.
- **수정**: 소셜 분기에 `creditRegisterPoint(created.id)` 추가 + 폐지된 `issueSignupCoupon` 호출 제거(이중지급 방지).
- **소급**: 기존 소셜 가입자 9명(카카오 3 + 네이버 6)에게 각 10,000 코인 수동 소급 지급 완료.

### [정책 2026-06-07] 회원가입 쿠폰 폐지

- `issueSignupCoupon()` 는 더 이상 가입 경로에서 호출하지 않음 (메서드 자체는 잔존하나 호출처 제거).
- 가입 보상은 `register_point`(즉시 코인) 단일 경로로 통일 → 쿠폰+코인 이중지급 지뢰 제거.

## OAuth (카카오/네이버)

```
- 카카오 SDK (메모리 [[kakao-keys]]: Web JS b0c5... + Native 8b59...)
- 네이버 SDK
- callback URL: /api/user/auth/oauth/{provider}/callback
- 매칭: member.social_provider + social_uid (UNIQUE 제약)
```

코드: `api/src/user/auth/social-auth.service.ts`

## 가입 트랜잭션

```typescript
async signup(dto) {
  return await this.sql.begin(async (tx) => {
    // 1. phone 인증 검증
    const auth = await tx`SELECT * FROM sms_auth WHERE phone=${dto.phone} AND auth_code=${dto.code} AND expires_at > NOW()`
    if (!auth.length) throw new BadRequestException('인증 실패')

    // 2. ID/phone 중복 검사
    // 3. member INSERT (role='user')
    const member = await tx`INSERT INTO member ... RETURNING id`

    // 4. point INSERT (잔액 0)
    await tx`INSERT INTO point (member_id) VALUES (${member.id})`

    // 5. m2net 등록 (실패 시 트랜잭션 롤백)
    const m2netResult = await this.m2net.registerMember(...)
    await tx`UPDATE member SET m2net_membid=${m2netResult.membid} WHERE id=${member.id}`

    // 6. 추천인 보상 처리 (referrer_id 있으면)
    if (dto.referrerId) {
      await this.processReferral(tx, member.id, dto.referrerId)
    }

    return member
  })
}
```

## 비번 찾기 흐름

```typescript
async findPassword(mb_id, phone, code) {
  // 1. mb_id + phone 매칭 검증
  // 2. SMS 인증 검증
  // 3. 임시비번 생성 (예: 8자 랜덤)
  const tempPw = randomString(8)
  // 4. member.password 해시 저장
  // 5. 알림톡 register_idpw_v2 발송
  await this.sms.sendAlimtalkByCode('register_idpw_v2', phone, { temp_pw: tempPw })
}
```

## 핵심 코드 위치

- 가입/로그인: `api/src/user/auth/auth.service.ts`
- SMS: `api/src/user/sms/sms.service.ts`
- OAuth: `api/src/user/auth/social-auth.service.ts`
- DTO: `api/src/user/auth/dto/signup.dto.ts`

## DB 스키마

```
member
- id, mb_id (UNIQUE), nickname, phone, role
- password (bcrypt hash)
- m2net_membid VARCHAR
- social_provider VARCHAR — 'kakao' / 'naver' / NULL
- social_uid VARCHAR
- referrer_id INT FK → member(id)
- state VARCHAR — 'active' / 'banned' / 'withdrawn'
- created_at TIMESTAMPTZ

sms_auth
- id, phone, auth_code, expires_at, created_at
```

## UNIQUE 제약

- `uq_member_mb_id (mb_id)`
- `uq_member_social (social_provider, social_uid)`
- phone 은 UNIQUE 아님 (메모리 박제: 한 사람 한 mb_id 라 phone 중복 가능성 작음)

## 관련 메모리

- `[[id-unification-complete]]` (한 사람 한 mb_id)
- `[[kakao-keys]]` (카카오 SDK 2개 키)
- `[[alimtalk-bizm-only]]` (SMS 폴백 미설정)
