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

## 관련 메모리

- `[[super-admin-scope]]`
- `[[permission-visibility-pattern]]`
- `[[security-audit-2026-05-22]]`
