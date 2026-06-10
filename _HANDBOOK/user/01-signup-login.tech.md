# [AI 전용] B-1 회원가입 / 로그인 / 비밀번호 찾기 — 기술 상세

> 적대적 점검(2026-06-11)으로 검증. 모든 동작은 아래 코드 근거 기준.

## 엔드포인트 맵 (`@Controller('user/auth')` → `/api/user/auth/...`)

| 메서드 | 경로 | 용도 | 코드 위치 |
|---|---|---|---|
| POST | `/login` | 로컬 로그인 (mb_id+password) | `auth.controller.ts:78` |
| POST | `/signup` | 가입 (로컬 / 소셜 공용) | `auth.controller.ts:931` |
| GET | `/check-mb-id?mb_id=` | 아이디 중복·형식 검사 | `auth.controller.ts:900` |
| POST | `/find/phone` | 휴대폰 비번찾기 (인증번호 검증 → 임시비번 알림톡) | `auth.controller.ts:847` |
| POST | `/find/phone/reset` | 휴대폰 인증 후 새 비번 직접 설정 | `auth.controller.ts:871` |
| POST | `/find/email` | 이메일 비번찾기 (임시비번 메일) | `auth.controller.ts:892` |
| GET | `/me` | 현재 로그인 사용자 (UserAuthGuard) | `auth.controller.ts:111` |
| POST | `/logout` | 쿠키 정리 | `auth.controller.ts:364` |

`@Throttle({ login: { limit: 30, ttl: 60_000 } })` — login/signup 분당 30회. find/* 는 분당 10회.

## 가입 — 휴대폰 인증 필수 (`signup`)

핵심 가드 (`auth.controller.ts:1042-1050`, 소셜 분기는 `978-983`):
```typescript
const isVerified = await this.sms.isVerifiedRecently(body.phone, 30); // 30분 윈도우
if (!isVerified) {
  throw new BadRequestException('휴대폰 인증이 만료되었습니다. 인증번호를 다시 받아주세요.');
}
```
- `isVerifiedRecently(phone, 30)` = `sms_auth` 에 `is_verified=TRUE` 이고 `created_at > now()-30분` 인 행 존재 여부 (`sms.service.ts:135`).
- **인증 안 한 / 30분 초과 phone → 400.** (테스트 시 정확 메시지로 단언)
- 로컬/소셜 둘 다 동일 가드. 캡차는 2026-05-21 제거 (SMS 인증으로 봇 차단 충분).

분기 결정:
- `sjm_social_pending` 쿠키(JWT, `readPendingPayload`)가 유효하면 → **소셜 가입** (mb_id/password 무시, (provider, uid) 연결).
- 없으면 → **로컬 가입** (`mb_id` + `password` 필수, `auth.controller.ts:1033`).
- `body.social` 명시했는데 pending 없음 → `소셜 인증이 만료되었습니다...` 400 (`947-957`).

비밀번호 정책 (`dto/signup.dto.ts:53-59`):
```typescript
@Length(8, 20, { message: '비밀번호는 8~20자여야 합니다.' })
@Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: '비밀번호는 영문과 숫자를 각각 1개 이상 포함해야 합니다.' })
password?: string;
```

mb_id 정책 (`dto/signup.dto.ts:42-48`): `@Length(3,20)` + `/^(?!.*_[KNA]$)[A-Za-z0-9_]+$/` (소셜형식 `_K/_N/_A` 차단).

## 가입 트랜잭션 & m2net 롤백 (`auth.service.ts`)

`createLocalMember()` (`auth.service.ts:471`):
1. `assertMbIdNotProhibited` (`setting.security.prohibit_id` 콤마/개행 구분) + `assertEmailNotProhibited`
2. `isMbIdAvailable` 중복 검사 (못 통과 → `ConflictException`)
3. `assertPhoneAvailable` — 같은 phone + role='user' + left_at IS NULL 있으면 `ConflictException`
4. `bcrypt.hash(password, 12)` → `INSERT INTO member` (unique_violation 23505 → ConflictException)
5. **`registerWithM2net(insertedId)`** — 실패 시 `DELETE FROM member WHERE id=...` 후 throw (`auth.service.ts:677-688`) ← **m2net 등록 실패 = 가입 롤백**
6. `creditRegisterPoint(insertedId)` best-effort (`.catch(()=>{})`)

소셜 가입은 `auth.controller.ts:993` `createSocialMember` → `registerWithM2net(created.id)`(`1015`) → `creditRegisterPoint`(`1022`, 2026-06-10 버그수정으로 추가). 자세한 가입 코인 정책은 `auth/01-signup-auth.tech.md` 참조.

## 아이디 중복확인 (`check-mb-id`, `auth.controller.ts:900`)

순차 검증 (실패 시 즉시 400):
```typescript
if (id.length < 3 || id.length > 20)  → '아이디는 3~20자여야 합니다.'
if (!/^[A-Za-z0-9_]+$/.test(id))      → '아이디는 영문/숫자/_ 만 사용 가능합니다.'
if (/_[KN]$/.test(id))                → '소셜 가입 형식과 동일한 ID는 사용할 수 없습니다.'
await assertMbIdNotProhibited(id)     → '이미 예약된 단어로 사용할 수 없는 아이디입니다.'
const available = await isMbIdAvailable(id)  → { available, mb_id }
```

## 로그인 — 계정 존재 미노출 (`loginByLocal`, `auth.service.ts:71`)

```typescript
// timing-attack 방지: mb 없어도 dummyHash 로 bcrypt.compare 항상 1회 실행
const hash = mb?.password ?? dummyHash;
const ok = await this.verifyBcrypt(password, hash);
if (!mb || !mb.password || !ok) {
  throw new UnauthorizedException('가입된 회원아이디가 아니거나 비밀번호가 틀립니다.'); // 401
}
this.assertNotBlocked(mb); // 탈퇴(left_at)/차단(intercept_until) → ForbiddenException
```
- **존재하지 않는 ID와 틀린 비번이 동일 401 메시지** + 동일 타이밍(dummy bcrypt). user enumeration 차단.
- 성공 시 `last_login_at` 갱신 + JWT 쿠키 발급(`sjm_user`) + m2net 잔액 동기화 + 로그인포인트(하루1회) fire-and-forget.

## 비밀번호 찾기

### find/phone (`auth.controller.ts:847` → `findPasswordByPhone`)
```typescript
if (!/^01[0-9]{8,9}$/.test(phone)) throw 400
if (!code) throw 400 '인증번호를 입력해주세요.'
await this.sms.assertVerified(phone, code); // = verify(): sms_auth UPDATE...RETURNING, 불일치/만료 시 400
await this.authService.findPasswordByPhone(phone); // 임시비번 생성 → member.password 갱신 → sendFindPwAlimtalk(register_idpw1)
```
- `findPasswordByPhone` (`auth.service.ts:773`): role='user'+left_at IS NULL 회원 조회. 없으면 400. `social_provider` 있으면 소셜 안내 400.

### find/phone/reset (`auth.controller.ts:871` → `resetPasswordByPhone`)
```typescript
const verified = await this.sms.isVerifiedRecently(phone, 10); // 최근 10분
if (!verified) throw 400 '휴대폰 인증이 만료되었습니다. 다시 인증해주세요.'
await this.authService.resetPasswordByPhone(phone, newPw);
```
- `resetPasswordByPhone` (`auth.service.ts:826`): newPw 8~20자 + 영문/숫자 재검증. 소셜 가입자 차단. `bcrypt.hash(...,12)` 로 갱신, `{ mb_id }` 반환.
- **인증번호 없이/오래된 인증 → 차단.** 1회용 소비 아님(`isVerifiedRecently`)이라 인증 직후 폼 제출 2단계 가능.

### find/email (`auth.controller.ts:892` → `findPasswordByEmail`, `auth.service.ts:864`)
- email 또는 social_email 매칭, role='user'. 없으면 400. 소셜 가입자 차단.
- 임시비번 생성 → member.password 갱신 → `mailer.send`(네이버 SMTP, 제목 `[사주플랜] 임시비밀번호 안내`).

## SMS 인증 내부 (`sms.service.ts`)

- `send(phone)` (`:58`): `^01[0-9]{8,9}$` 검사 → **5분 내 같은 번호 5회 제한**(초과 시 400) → 6자리 코드 INSERT `sms_auth(phone, auth_code, expires_at=now()+5min)` → BizM(`BIZM_TPL_SIGNUP_AUTH`) → 알리고 SMS → 콘솔 순.
- `verify(phone, code)` (`:101`): `UPDATE sms_auth SET is_verified=TRUE WHERE id=(최근 미소비 5분내 매칭) RETURNING` — **1회용 atomic 소비**. 불일치/만료 → 400.
- `isVerifiedRecently(phone, minutes)` (`:135`): is_verified=TRUE & created_at 윈도우 내 행 존재. **소비 안 함** → 가입/reset 의 재검증용.

## DB 스키마 (관련 컬럼)

```
member
- id, mb_id (UNIQUE, NULL 가능=소셜), password (bcrypt, 소셜은 NULL)
- name, nickname (NOT NULL), email, social_email, phone
- role ('user'/'counselor'/...), level
- social_provider ('kakao'/'naver'/'apple'/NULL), m2net_membid
- left_at (탈퇴), intercept_until (차단), signup_source ('local'), last_login_at

sms_auth
- id, phone, auth_code, is_verified (bool), expires_at, created_at

setting
- (security, prohibit_id) / (security, prohibit_email) / (member, register_point) ...
```

## JWT sub 정규화 (2026-06-11 근본수정)

`user-auth.guard.ts:46-50`:
```typescript
const sub = Number(payload.sub);           // 런타임에 문자열로 들어오던 sub 를 number 강제
if (!Number.isFinite(sub)) throw new UnauthorizedException(...); // NaN → 세션 거부
req.user = { ...payload, sub };
```
- 배경: JWT `sub` 가 문자열로 들어와 숫자 id 와 `===` 직접 비교 시 self/소유권 검증(qna/consult/counselors)이 조용히 무력화되던 버그. 가드 진입점에서 number 로 통일.

## 쿠키 / 세션

- 쿠키명 `sjm_user`(`USER_COOKIE_NAME`), `httpOnly`, `secure=true`, `SameSite=None`(cross-origin sajuplan.com→api.sajuplan.com, `auth.controller.ts:1129`).
- `keep_login=false` → 세션 쿠키(브라우저 종료 시 만료), 아니면 `USER_JWT_EXPIRES_IN`(기본 14d).
- 소셜 pending: `sjm_social_pending` JWT 쿠키, 60분.

## 관련 E2E spec

| spec | 커버 |
|---|---|
| `e2e/tests/08-user-auth-stability.spec.ts` | 로그인/세션 안정성 |
| `e2e/tests/16-password-policy.spec.ts` | 비번 8~20 + 영문/숫자 정책 |
| `e2e/tests/18-password-change.spec.ts` | 비번 변경/재설정 |
| `e2e/tests/54-auth-b1-edge.spec.ts` | B-1 적대적 엣지(인증만료/계정미노출/인증없는 비번찾기 차단) |

## 핵심 코드 위치

- 컨트롤러: `api/src/user/auth/auth.controller.ts`
- 서비스: `api/src/user/auth/auth.service.ts`
- 가드: `api/src/user/auth/user-auth.guard.ts`
- SMS: `api/src/user/sms/sms.service.ts`
- DTO: `api/src/user/auth/dto/signup.dto.ts`
- 프론트: `web/user/src/pages/Login.tsx` · `Signup.tsx` · `Find.tsx`

## 관련 메모리
- `[[id-unification-complete]]` (한 사람 한 mb_id, 회원=m2net_membid)
- `[[alimtalk-bizm-only]]` (인증/임시비번 알림톡은 BizM, SMS 폴백 현재 미설정)
