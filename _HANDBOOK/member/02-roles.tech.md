# [AI 전용] 역할 시스템 — 기술 상세

## DB 컬럼

```
member
- role VARCHAR — 'user' / 'counselor' / 'admin'
- is_super BOOLEAN (admin 일 때만 의미)
- csrid VARCHAR (counselor 일 때 m2net 측 ID)
- m2net_membid VARCHAR
- state VARCHAR — 'active' / 'banned' / 'withdrawn'
```

## 가드

### API
- `AdminAuthGuard`: role='admin' 검사
- `SuperGuard` (또는 inline): is_super=true 검사

### 프론트
- `SuperOnlySection`: 슈퍼 아니면 컴포넌트 렌더 X (빨강)
- `ReadOnlyForSuper`: 일반관리자에게도 표시되나 편집 불가 (노랑)

## 정책 (메모리 `[[super-admin-scope]]`)

슈퍼 전용:
1. 다른 관리자 슈퍼 승격
2. 비밀 수치 (영업이익률, 회사 마진, 비밀 단가)

일반관리자 전권: 일상 돈업무, 콘텐츠, 알림, 게시판

## 듀얼 계정

한 사람 = 한 `member` row + `role='counselor'` + `csrid` 채워짐.
- 회원 마이페이지 (`/mypage`) 접근 가능 (role 무관)
- 상담사 마이페이지 (`/counselor/mypage`) 접근 가능 (role='counselor' 만)

→ ID 단일화 (메모리 `[[id-unification-complete]]`)

## 핵심 코드 위치

- 가드: `api/src/admin/auth/admin-auth.guard.ts`
- 슈퍼 가드 컴포넌트: `web/mng/src/components/SuperOnlySection.tsx`, `ReadOnlyForSuper.tsx`
- 듀얼 모드: `web/user/src/components/ModeIndicator.tsx`
- 상담사 승급: `api/src/admin/counselor-apply/counselor-apply.service.ts`

## 운영 SQL

```sql
-- 역할 분포
SELECT role, COUNT(*) FROM member GROUP BY role;

-- 듀얼 계정 (회원 + 상담사 양쪽)
SELECT id, mb_id, nickname, role FROM member WHERE role='counselor';

-- 관리자 목록
SELECT id, mb_id, is_super, last_login_at FROM member WHERE role='admin';

-- 정지된 회원
SELECT COUNT(*) FROM member WHERE state='banned';
```

## 관련 메모리

- `[[id-unification-complete]]`
- `[[super-admin-scope]]`
- `[[permission-visibility-pattern]]`
- `[[security-audit-2026-05-22]]`
