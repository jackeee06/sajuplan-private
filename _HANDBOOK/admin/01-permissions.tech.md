# [AI 전용] 관리자 권한 — 기술 상세

## DB

```
member
- role = 'admin'
- is_super BOOLEAN
```

## API 가드

- `AdminAuthGuard`: role='admin' 검사
- 슈퍼 가드: `is_super=true` (구현 위치 다양 — 컨트롤러 또는 inline)

## 프론트 가드 컴포넌트

```typescript
// web/mng/src/components/SuperOnlySection.tsx
<SuperOnlySection>
  <ProfitSimulator />  // 슈퍼만 렌더
</SuperOnlySection>

// web/mng/src/components/ReadOnlyForSuper.tsx
<ReadOnlyForSuper>
  <SecretField />  // 일반관리자에게도 보이지만 편집 불가 (노랑 마킹)
</ReadOnlyForSuper>
```

## 메모리 박제 (`[[super-admin-scope]]`)

슈퍼 전용:
1. 슈퍼 승격 (다른 관리자를 슈퍼로)
2. 비밀 수치 (영업이익률, 회사 마진, 비밀 단가)

일반관리자 전권:
- 일상 돈업무 (환불, 정산, 결제 조회)
- 회원·상담사 관리
- 콘텐츠 / 알림 / 게시판

## 핵심 코드 위치

- 가드 (API): `api/src/admin/auth/admin-auth.guard.ts`
- 가드 (프론트): `web/mng/src/components/SuperOnlySection.tsx`, `ReadOnlyForSuper.tsx`
- 관리자 페이지: `web/mng/src/pages/AdminUsers.tsx`
- 관리자 서비스: `api/src/admin/permissions/permissions.service.ts`

## 운영 SQL

```sql
-- 관리자 목록
SELECT id, mb_id, nickname, is_super, last_login_at
FROM member WHERE role='admin';

-- 슈퍼 1명만 있어야 정상 (현재)
SELECT COUNT(*) FROM member WHERE role='admin' AND is_super=true;
```

## 보안 hardening (2026-06-12)

### A 🔴 전화번호 마스킹 — `?show_phone=1` 쿼리 신뢰 제거 (fail-closed)
- 위치: `api/src/admin/members/members.controller.ts` `canShowPhone()`.
- 문제: 일반관리자가 `GET /admin/members/customers?show_phone=1` 쿼리 한 줄로 전 회원 평문 전화(PII) 열람 가능. 문서상 "슈퍼가 켠 시간제한 토글 ON 시만" 인데 **그 토글이 서버에 없었음**(쿼리만 신뢰).
- 수정: `return !!req.admin?.is_super;` — **슈퍼관리자만 평문, 일반관리자는 항상 마스킹.** (시간제한 토글은 추후 setting 기반 슈퍼 전용 기능으로 별도 구현)

### B 🔴 설정 조회 시크릿 마스킹
- 위치: `api/src/admin/settings/settings.service.ts` `getAll`/`getNamespace`/`update`.
- 문제: `GET /admin/settings` 가 `setting` 전체를 평문 반환 → kakao_client_secret/naver_secret/apple_private_key/recaptcha_secret 등이 **인증된 아무 관리자에게나 노출**.
- 수정: 키가 `/(secret|private_key|password|passwd)/i` 이고 값이 있으면 조회 시 **`'********'` 로 마스킹**. 저장(`update`) 시 들어온 값이 `'********'` 면 **무시(기존 시크릿 보존)** → 폼 일괄저장 라운드트립 안전.
- 회귀 spec: `e2e/tests/65-admin-security-hardening.spec.ts`.

### C 🟡 admin_permission 매트릭스 — 서버 미강제(재분류)
- 현상: 권한 매트릭스(`admin_permission` can_read/write/delete)는 저장/조회만 되고 **어떤 가드도 인가 결정에 참조하지 않음** → 실제 인가는 `is_super` 단일 비트뿐.
- 판단: **보안홀 아님.** 운영바이블 정책상 "일반관리자=일상 돈/회원/콘텐츠 전권"이 **의도**이고, 진짜 민감 기능(설정 SUPER_ONLY 키·정산률·추천·슈퍼승격)은 이미 `is_super` 게이트됨. 매트릭스를 그대로 서버강제하면 **매트릭스 미시드인 기존 일반관리자가 전부 잠기는 운영사고**가 난다.
- 결론: "미완 기능/오해 유발 UI" 로 재분류. 진짜 granular 권한이 필요하면 **매트릭스 시드 + per-route resource 매핑 + PermissionGuard** 를 별도 설계로 도입(이번엔 미실행).

## 관련 메모리

- `[[super-admin-scope]]`
- `[[permission-visibility-pattern]]`
- `[[security-audit-2026-05-22]]`
