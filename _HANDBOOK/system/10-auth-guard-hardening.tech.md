# [AI 전용] 권한 가드 하드닝 — 기술 상세

## 핵심 함정 (JWT sub 문자열)

JWT payload `sub` 는 인터페이스상 `sub: number` 로 선언돼 있어도 **런타임 값은 문자열**이다.
가드가 `req.user = payload` 로 그대로 부착하면, 컨트롤러/서비스가 `req.user.sub` 를 숫자로 가정하고
DB id(number)와 `===` 직접 비교할 때 타입 불일치로 조용히 무력화된다.

```
'141' === 141   // false  → self 차단·소유권 검증 우회
```

## 적용 (양 가드 진입점 정규화)

```ts
// user-auth.guard.ts (2026-06-11)
const sub = Number(payload.sub);
if (!Number.isFinite(sub)) throw new UnauthorizedException();
req.user = { ...payload, sub };

// admin-auth.guard.ts (2026-06-11 추가)
const sub = Number(payload.sub);
if (!Number.isFinite(sub)) throw new UnauthorizedException();
req.admin = { ...payload, sub };
```

- 관리자 sub 는 주로 audit `adminId`(actor_admin_id, integer 컬럼)로만 사용 → 문자열이어도 Postgres 가
  파라미터를 정수로 coerce 하므로 활성 익스플로잇은 없었음. **방어적 정규화**(향후 `===` 비교 신설 대비).
- user 측은 2026-06-11 운영 직전 점검에서 4곳 실 발생 후 국소 `Number()` 로 1차 수정 → 가드 정규화로 근본 차단.

## user 측 과거 발생 지점 (2026-06-11 수정 완료)

| 파일:라인 | 증상 |
|---|---|
| `qna.service.ts:749` | 본인 페이지 문의 차단 실패 → self 문의 5건 |
| `consult.service.ts:68,202` | 본인 전화/채팅 상담 차단 실패 → self 상담 3건 |
| `counselors.service.ts:1470` | 본인 단골 등록 차단 실패 → self 단골 2건 |
| `members.service.ts:1606` | admin 본인 차단 (방어적) |

## 새 코드 작성 규칙

- 권한/소유 비교는 **항상 `Number(a) === Number(b)`** 양변 정규화 (가드 정규화 후에도 방어적으로 유지).
- `/api/api/` 함정: `API_BASE` 가 이미 `/api` 포함 → 컴포넌트 직접 fetch 시 앞에 `/api` 또 붙이면 404.
  점검: `grep '}/api/(user|admin)/' web/*/src`

## 3·4·5순위 적대적 정밀점검 결과 (2026-06-11)

코드 정밀점검 결과 **확정 버그 0건**. 검토한 후보는 전부 false positive로 판명:
- `counselor-apply.service.ts:411` `isSamePerson` — 비회원 재신청 시 `r.member_id==null && ex.mb_id!==mbId` → `false` →
  ConflictException **정상 차단** (우회 아님). 복구 경로(member→`r.member_id===ex.id`, 비회원→`ex.mb_id===mbId`)도 정상.
- `settlements.service.ts:499` markVoided `total_used = GREATEST(total_used - settleAmount, 0)` — markPaid(:372)의
  `total_used + settleAmount` 와 **대칭 복구**. 정상. (spec 42-settlement-preview-settle 의 정산→무효화→복구 사이클로 실증)
- 정산 markPaid/markVoided 슈퍼 가드 누락 주장 — **정책상 정상**. 슈퍼 전용은 ①슈퍼 승격 ②영업이익 시뮬레이터뿐,
  일상 돈업무(정산 지급/무효)는 일반관리자 전권. (admin/01-permissions 참조)
- `members.service.ts` 날짜 `${f.fr_date + ' 00:00:00'}` — postgres.js 태그드 템플릿이 파라미터 바인딩 → SQL injection 불가.

## 가드 검문 매트릭스 (E2E 실측, spec 57·58)

| 호출자 | 상담사 전용(payout/grade) | 관리자 돈(point/settlement) |
|---|---|---|
| 비로그인 | 401 | 401 |
| 회원(member) | 403 (role gate) | 401 (admin guard) |
| 상담사(counselor) | 200(본인)/4xx(경계·소유) | 401 (admin guard) |
| 관리자 | — | 200 (정상 동작) |

## 배포 / 검증

```bash
# API (admin-auth.guard.ts 포함, _patch_api.py FILES 에 등록됨)
set -a; . ./.env.local; set +a; MSYS_NO_PATHCONV=1 \
  python tools/_patch_api.py root@104.64.128.103 /data/wwwroot/api.sajumoon.co.kr sajumoon-api

# E2E (2026-06-11 round: 57·58 신규 + 35·38·42·09 회귀 = 0 failed)
cd e2e && npx playwright test tests/57-counselor-edge.spec.ts tests/58-admin-guard-edge.spec.ts
```

## 관련 항목
- [E2E 엄격검증](system/08-e2e-verification)
- [권한 체계](admin/01-permissions)
