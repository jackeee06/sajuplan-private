# Audit Critical #4 — M2NET 콜백 트랜잭션 통합 ✅ 완료

> 작성: 2026-05-17
> **2026-05-17 적용 완료** — 옵션 1 (단일 트랜잭션) 채택, 양 서버 배포 완료

---

## 적용 결과 요약

**문제**: handleCallPush 의 consultation INSERT + 회원 차감 + 상담사 적립이 별도 트랜잭션이라 부분 실패 시 데이터 불일치 가능.

**해결**: 단일 `sql.begin()` 트랜잭션으로 통합.
- 셋 중 하나라도 실패 → 전체 롤백
- consultation 도 롤백되므로 M2NET 재전송 시 ON CONFLICT 안 걸림 → 자동 재시도

## 구현 상세

### 1. InTx 함수 분리 (DB 부분만)

```typescript
private async deductMemberPointInTx(
  tx: TxSql,
  memberId, amt, amtFree, amtPro, content, consultationId, relAction, isPaid,
): Promise<{ applied: boolean; membid: string | null }> {
  // 잔액 FOR UPDATE → 차감 → point_history INSERT → consultation amt_free/pro 업데이트
}

private async creditCounselorPointInTx(
  tx: TxSql,
  counselorId, amt, content, consultationId, relAction, isPaid,
): Promise<{ applied: boolean; csrMembid: string | null }> {
  // 동일 패턴
}
```

### 2. Wrapper 유지 (호환)

`deductMemberPoint` / `creditCounselorPoint` 는 wrapper 로 유지 — `settleChatRoomLocal` 등 다른 호출처는 변경 없이 동작.

### 3. handleCallPush 단일 트랜잭션

```typescript
try {
  txResult = await this.sql.begin(async (tx) => {
    const inserted = await tx`INSERT INTO consultation ... ON CONFLICT DO NOTHING RETURNING id`;
    if (inserted.length === 0) return { dup: true };
    const consultationId = inserted[0].id;

    if (endsHere && amt > 0) {
      if (!refundEligible && !isPostpaid && memberId !== null) {
        await this.deductMemberPointInTx(tx, ...);  // 실패 시 throw → 전체 롤백
      }
      if (counselorId !== null) {
        await this.creditCounselorPointInTx(tx, ...);  // 실패 시 throw → 전체 롤백
      }
    }
    return { dup: false, consultationId };
  });
} catch (e) {
  // 전체 롤백됨 — OpsAlert 발송
  void this.opsAlert.send('M2NET 콜백 트랜잭션 실패 (전체 롤백)', ...);
  throw e;
}
```

### 4. 타입 추가

[`api/src/shared/db/db.module.ts`](api/src/shared/db/db.module.ts):
```typescript
export type TxSql = postgres.TransactionSql<Record<string, never>>;
```

## 배포 결과

| 서버 | 빌드 | reload | state-push 검증 |
|---|---|---|---|
| test (172.235.211.75) | ✅ | ✅ | (상태) |
| prod (104.64.128.103) | ✅ | ✅ | 5건 연속 정상, IP=211.175.205.88, 에러 0 |

## 모니터링 가이드

1. **다음 1~2일** — OpsAlert 채널에서 `M2NET 콜백 트랜잭션 실패 (전체 롤백)` 알림 확인
2. 알림이 오면 — 어떤 callid/roomid 가 실패했는지 확인. M2NET 재전송 후 자동 복구 여부 추적.
3. **회귀 신호**: `[handleCallPush] consultation 중복 INSERT 차단` 가 평소보다 많이 발생하면 트랜잭션 retry 가 빈번한 것 — DB 부하 확인.

## 별개 발견 이슈 (Critical #4 와 무관)

prod pm2 로그에서 발견된 별도 에러:
```
PostgresError: column p.event_starts_at does not exist
  at MembersService.getCounselorDetail (src/admin/members/members.service.ts:538)
```

[api/src/admin/members/members.service.ts:538](api/src/admin/members/members.service.ts) 의 `getCounselorDetail` SQL 에 `p.event_starts_at` 참조가 있으나 prod DB 의 `profile` 테이블에는 해당 컬럼이 없음. 2026-05-15 부터 발생 (Critical #4 배포 전).

**조치**: 다음 세션에서 컬럼 추가 마이그레이션 또는 SELECT 에서 제외.

---

## 작성 완료 — Audit Critical 12건 종결

전체 audit phase A~H 모두 완료.
