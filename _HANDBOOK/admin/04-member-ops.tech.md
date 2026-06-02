# [AI 전용] 회원·상담사 운영 도구 — 기술 상세

## DB

```
member
- state VARCHAR — 'active' / 'banned' / 'withdrawn'
- ban_reason TEXT
- banned_at TIMESTAMPTZ
- banned_by INT FK admin
```

## 정지 처리

```typescript
async banMember(memberId, reason, adminId) {
  await this.sql`
    UPDATE member SET
      state='banned',
      ban_reason=${reason},
      banned_at=NOW(),
      banned_by=${adminId}
    WHERE id=${memberId}
  `
  // 알림톡 발송 (옵션, 백로그)
}
```

## 강제 로그아웃

세션 무효화 — JWT 인증이면 토큰 만료 또는 블랙리스트 관리.

## 절대 금지

`DELETE FROM member` 또는 `TRUNCATE member` — 메모리 `[[db-truncate-cascade-disaster]]` 사고. FK 제약 + 이력 손실.

## 핵심 코드 위치

- 회원: `api/src/admin/members/members.service.ts`
- 상담사: `api/src/admin/counselor-ops/counselor-ops.service.ts`
- 신청: `api/src/admin/counselor-apply/counselor-apply.service.ts`
- 환불: `api/src/admin/refunds/refunds.service.ts`
- 포인트 수동: `api/src/admin/points/points.service.ts`

## 운영 SQL

```sql
-- 정지 회원
SELECT id, mb_id, ban_reason, banned_at FROM member
WHERE state='banned' ORDER BY banned_at DESC;

-- 같은 IP / phone 패턴 다수 가입 (어뷰징 의심)
SELECT SUBSTRING(phone, 1, 7) AS prefix, COUNT(*)
FROM member
GROUP BY prefix HAVING COUNT(*) > 3;
```

## 관련 메모리

- `[[db-truncate-cascade-disaster]]`
- `[[id-unification-complete]]`
