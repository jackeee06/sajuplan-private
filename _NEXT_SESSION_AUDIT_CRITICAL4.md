# 다음 세션 — Audit Critical #4: M2NET 콜백 트랜잭션 통합

> 작성: 2026-05-17
> 작업자: 이 파일을 새 세션에게 "이 파일을 봐" 라고 알려주시면, 컨텍스트 + 작업 명세 한꺼번에 전달됩니다.

---

## 한 줄 요약

**M2NET 통화 종료 콜백(handleCallPush) 의 `consultation INSERT` + `회원 차감` + `상담사 적립` 이 별도 트랜잭션이라, 중간 실패 시 부분 변경 + 데이터 불일치 가능. 단일 트랜잭션으로 통합 필요.**

---

## 문제 시나리오

### A. 통화 기록 남고 포인트 미차감 (수익 손실)
1. M2NET END_CHAT push 도착
2. handleCallPush 진입
3. `consultation INSERT` 성공 — 통화 기록 남음
4. `deductMemberPoint` 호출 → DB 연결 끊김 또는 lock timeout
5. catch 블록 → OpsAlert (이미 적용됨)
6. **결과**: 통화는 기록되었지만 회원 포인트 차감 안 됨 → 회원이 무료로 통화한 셈

### B. 회원 차감 + 상담사 미적립
1. consultation INSERT 성공
2. deductMemberPoint 성공 (회원 차감됨)
3. creditCounselorPoint 실패
4. **결과**: 회원은 비용 청구됐는데 상담사는 수익 미적립 → 정산 분쟁

### C. M2NET 재시도로 인한 처리 누락
1. consultation INSERT 성공
2. deduct/credit 도중 실패 → handleCallPush 가 catch 후 흐름 진행
3. M2NET 이 push 재전송 (네트워크 타임아웃 등)
4. 재시도 시 consultation ON CONFLICT DO NOTHING 으로 skip
5. **결과**: handleCallPush 가 즉시 `{ idempotent: true }` 반환 → deduct/credit 영원히 재시도 안 됨

---

## 현재 mitigation (이미 적용된 안전장치)

이 문제가 즉시 매출 사고로 이어지지는 않게 하는 기존 장치들:

| 장치 | 효과 |
|---|---|
| `point_history` UNIQUE on (rel_table, rel_id, rel_action) | 회원 차감 멱등성 — 같은 consultation_id 로 두 번 차감 안 됨 |
| `point` FOR UPDATE (Audit B-#5) | 동시 차감 race 방지 |
| `consultation` UNIQUE (Audit B-#3) | 같은 통화 중복 INSERT 차단 |
| OpsAlert (Audit A-#11) | 차감/적립 실패 즉시 운영자 알림 |
| settlement-cron `EXISTS (point_history)` 검증 | 차감 안 된 통화는 정산 대상에서 제외 |

→ 사고 발생해도 **운영자가 즉시 인지** + **정산이 잘못된 채로 진행되지 않음** (잘못된 row 는 정산에서 제외됨).

⚠️ 단, **수익 손실** 시나리오 A 는 여전히 위험 — 회원이 통화하고 포인트 안 빠진 채 다시 통화 가능.

---

## 권장 수정 접근 (3가지 옵션)

### 옵션 1: 단일 트랜잭션 통합 (정석, 가장 안전)

```typescript
async handleCallPush(payload) {
  // ... 페이로드 파싱 ...
  
  // 단일 트랜잭션 — 모든 DB 변경이 원자적
  const result = await this.sql.begin(async (tx) => {
    // 1. consultation INSERT (ON CONFLICT 로 멱등)
    const inserted = await tx`INSERT INTO consultation ... ON CONFLICT DO NOTHING RETURNING id`;
    if (inserted.length === 0) return { dup: true };
    const consultationId = inserted[0].id;
    
    // 2. 회원 차감 (deductMemberPointInTx — tx 인자 받음)
    if (endsHere && amt > 0 && !refundEligible && !isPostpaid && memberId) {
      await this.deductMemberPointInTx(tx, memberId, amt, ...);
    }
    
    // 3. 상담사 적립 (creditCounselorPointInTx)
    if (counselorId) {
      await this.creditCounselorPointInTx(tx, counselorId, amt, ...);
    }
    
    return { consultationId };
  });
  
  // 4. 트랜잭션 커밋 후 m2net 동기화 (best-effort, 실패해도 DB 일관성 유지)
  if (!result.dup) {
    void this.syncToM2net(...).catch(...);
  }
}
```

**필요 변경**:
- `deductMemberPoint` → `deductMemberPointInTx(tx, ...)` 로 분리 (DB 부분만, m2net 호출 제외)
- `creditCounselorPoint` → `creditCounselorPointInTx(tx, ...)` 동일
- 기존 deductMemberPoint / creditCounselorPoint 는 wrapper 로 유지 (다른 호출처 호환)
- handleCallPush 의 외부 호출 (m2net.set_crs_status_chg 등) 는 트랜잭션 밖으로 이동

**위험**:
- m2net push 처리 핵심 경로 → 회귀 시 매일 사고
- 트랜잭션 시간 길어짐 (deduct + credit 합산 ~200ms) → lock 경합
- 단위 테스트 없음 → 통합 검증만으로 안전성 확인

**예상 소요**: 4~6시간 (코드 + 양 서버 배포 + 1~2일 모니터링)

### 옵션 2: 보상 액션 (Compensating Action, 차선책)

consultation INSERT 후 deduct/credit 실패 시 → consultation 을 명시적으로 DELETE.

**문제**: 
- DELETE 실패하면 더 큰 사고
- 동시성 처리 복잡

→ **권장 안 함**

### 옵션 3: 재시도 큐 (Outbox Pattern, 분산 시스템 정석)

consultation INSERT 시 `consultation_outbox` 테이블에도 INSERT (같은 트랜잭션).
별도 cron 이 outbox 의 미처리 항목을 deduct/credit.

**장점**: 트랜잭션 분리 유지하면서 멱등성 + 재시도 보장
**단점**: 새 테이블 + 새 cron + 복잡도 ↑

**예상 소요**: 6~8시간

---

## 제 권장: **옵션 1 (단일 트랜잭션 통합)**

이유:
- 가장 정석
- 코드 단순
- 새 인프라 (outbox 테이블 / cron) 불필요
- postgres.js 의 savepoint 자동 지원으로 helper 재사용 가능

---

## 작업 시 주의사항

1. **deductMemberPoint 의 m2net 호출**:
   - 현재 트랜잭션 커밋 후 비동기 호출 → 그대로 유지 (트랜잭션 밖)
   - InTx 버전은 m2net 호출 정보(membid, amt)만 반환하고 호출자가 커밋 후 동기화

2. **외부 호출 트랜잭션 밖 이동 대상**:
   - `m2net.set_crs_status_chg` (END_CHAT 후 상담사 상태 동기화)
   - `m2net.addMemberCoin` (deduct/credit 후 m2net 잔액 fill)

3. **테스트 시나리오**:
   - 정상 통화 종료 → consultation + deduct + credit 모두 성공
   - 회원 잔액 부족 → deductMemberPoint 내 GREATEST(0, ...) 로 부분 차감
   - DB 연결 끊김 시뮬레이션 (가능하면) → 트랜잭션 롤백 확인
   - 동일 push 2회 도착 → ON CONFLICT 로 두 번째는 skip
   - 회원 차감 성공 + 상담사 적립 실패 (수동 throw) → 전체 롤백 확인

4. **배포 전략**:
   - test 서버 먼저 적용 → 24~48시간 운영 데이터 관찰
   - 이상 없으면 prod 적용
   - 적용 후 매일 OpsAlert 채널 모니터링 (회귀 신호 확인)

---

## 참고: 기존 안전장치 위치

- `point_history` 멱등 UNIQUE: `api/src/pg-callbacks/m2net-push.service.ts:885` (ON CONFLICT WHERE rel_table IN ...)
- `consultation` 멱등 UNIQUE: 마이그레이션 `tools/_migrate_audit_b.py` (uq_consultation_call_callid, uq_consultation_chat_roomid)
- `point` FOR UPDATE: `api/src/pg-callbacks/m2net-push.service.ts:815`
- OpsAlert 발송 위치: 위 파일의 catch 블록들

---

## 작업 시작 시 첫 액션

1. 이 파일 + `_NEXT_SESSION_등급단가시스템.md` G 섹션 (감사 결과 종합) 읽기
2. 양 서버 운영 데이터에서 "최근 7일 m2net push 실패" 로그 확인 — 실제 문제 빈도 파악
3. test 서버에서 통화 1건 → 의도적으로 deductMemberPoint catch 활성화 → 현재 동작 재현
4. 위 옵션 1 구현 → test 서버 검증 → 1일 모니터링 → prod

이 작업 끝나면 Audit Critical 12건 모두 완료 + Phase B/C 감사도 진행 가능.

작성 끝.
