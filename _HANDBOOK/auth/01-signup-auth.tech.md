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
