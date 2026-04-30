# Phase A: 포인트 조정 이력화

## 목표

관리자가 회원의 포인트를 직접 +/- 하는 기능을 **트랜잭션 + 감사로그 기반**으로 처음부터 구현한다.

현재 [web/mng/src/pages/CustomerForm.tsx](../web/mng/src/pages/CustomerForm.tsx)에서 포인트 필드는 **신규 회원 등록 시에만** 입력 가능하고, 수정 시에는 disabled로 막혀 있으며 hint 문구로 "포인트 조정 기능으로 변경 (이력 기록)"이라고 안내한다. 그러나 **그 조정 기능 자체가 미구현 상태**이므로, 이번 Phase에서 이를 정상화한다.

라이브의 [sample/adm/point_update.php](../sample/adm/point_update.php)는 트랜잭션 없이 직접 INSERT, 관리자 식별자 미기록, 특정 사내 IP에서만 음수 검증이 다른 부실한 설계 — 이 패턴은 새 mng에서 절대 재현하지 않는다.

---

## 정책 (확정)

| 항목 | 정책 |
|---|---|
| 권한 | 모든 admin 가능 (별도 등급 분기 없음) |
| 음수 잔액 | **금지** — 잔액 미만 차감 시 400 에러 |
| 필수 기록 | `actor_admin_id`, `actor_ip`, `reason`(content), `balance_after` |
| 트랜잭션 | `SELECT ... FOR UPDATE` 행 잠금 + 동일 트랜잭션 내 4개 테이블 update |

---

## 영향 받는 테이블

| 테이블 | 역할 | 위치 |
|---|---|---|
| `point_history` | 변동 이력 (이번 Phase 핵심) | [api/db/migrations/0004_payment.sql:220-263](../api/db/migrations/0004_payment.sql) |
| `point` | 무료/유료 분리 잔액 집계 | [api/db/migrations/0004_payment.sql:200-216](../api/db/migrations/0004_payment.sql) |
| `member` | 레거시 호환용 단일 point 잔액 | [api/db/migrations/0001_member.sql](../api/db/migrations/0001_member.sql) |

---

## 작업 단계

### A-1. DB 마이그레이션 추가

**파일:** `api/db/migrations/0013_point_history_actor.sql` (신규)

```sql
ALTER TABLE point_history
  ADD COLUMN actor_admin_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
  ADD COLUMN actor_ip       INET,
  ADD COLUMN actor_type     VARCHAR(20) NOT NULL DEFAULT 'system';
  -- actor_type: 'admin' | 'system' | 'consultation' | 'payment'

CREATE INDEX idx_point_history_actor
  ON point_history (actor_admin_id, created_at DESC)
  WHERE actor_admin_id IS NOT NULL;

COMMENT ON COLUMN point_history.actor_admin_id IS '변동을 일으킨 관리자 ID (admin이 직접 조정한 경우)';
COMMENT ON COLUMN point_history.actor_ip       IS '변동 발생 시점의 클라이언트 IP';
COMMENT ON COLUMN point_history.actor_type     IS '변동 출처 (admin/system/consultation/payment)';
```

### A-2. 백엔드 (NestJS)

#### 모듈 구조

기존 [api/src/admin/members](../api/src/admin/members)와 별개로 `api/src/admin/points/` 모듈 신설 권장.

```
api/src/admin/points/
├── points.module.ts
├── points.controller.ts
└── points.service.ts
```

#### `PointService.adjust(memberId, delta, reason, actor, opts)`

```typescript
// 의사코드
async adjust(
  memberId: number,
  delta: number,
  reason: string,
  actor: { adminId: number; ip: string },
  opts?: { isPaid?: boolean; expireDate?: Date }
) {
  return await this.sql.begin(async (tx) => {
    // 1. 행 잠금 + 현재 잔액 조회
    const [pt] = await tx`
      SELECT free_balance, paid_balance
      FROM point
      WHERE member_id = ${memberId}
      FOR UPDATE
    `;
    const current = (pt?.free_balance ?? 0) + (pt?.paid_balance ?? 0);

    // 2. 음수 잔액 검증
    if (delta < 0 && current + delta < 0) {
      throw new BadRequestException('잔액이 부족합니다.');
    }

    const balanceAfter = current + delta;
    const isPaid = opts?.isPaid ?? false;

    // 3. 이력 insert
    const earnPoint = delta > 0 ? delta : 0;
    const usePoint  = delta < 0 ? -delta : 0;
    await tx`
      INSERT INTO point_history (
        member_id, content, earn_point, use_point, balance_after,
        is_paid, expire_date, rel_action,
        actor_admin_id, actor_ip, actor_type
      ) VALUES (
        ${memberId}, ${reason}, ${earnPoint}, ${usePoint}, ${balanceAfter},
        ${isPaid}, ${opts?.expireDate ?? null}, 'admin_adjust',
        ${actor.adminId}, ${actor.ip}, 'admin'
      )
    `;

    // 4. 집계 update (point 테이블)
    if (isPaid) {
      await tx`UPDATE point SET paid_balance = paid_balance + ${delta},
                                 ${delta > 0 ? tx`total_earned = total_earned + ${delta},` : tx`total_used = total_used + ${-delta},`}
                                 updated_at = now()
                WHERE member_id = ${memberId}`;
    } else {
      await tx`UPDATE point SET free_balance = free_balance + ${delta},
                                 ${delta > 0 ? tx`total_earned = total_earned + ${delta},` : tx`total_used = total_used + ${-delta},`}
                                 updated_at = now()
                WHERE member_id = ${memberId}`;
    }

    // 5. 레거시 호환 동기화 (member.point)
    await tx`UPDATE member SET point = ${balanceAfter} WHERE id = ${memberId}`;

    return { balanceAfter };
  });
}
```

#### 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/admin/members/customers/:id/point-adjust` | 포인트 가감. body: `{ delta, reason, isPaid?, expireDate? }` |
| GET | `/admin/members/customers/:id/point-history?page=&limit=` | 회원별 이력 |
| GET | `/admin/points/history?q=&fr_date=&to_date=&actor_type=&page=&limit=` | 전체 이력 (검색/필터) |

모두 `AdminAuthGuard` 필수. `req.adminUser.id`를 `actor.adminId`로, `req.ip`를 `actor.ip`로 전달.

### A-3. 프론트엔드 (React)

#### CustomerForm 수정

**파일:** [web/mng/src/pages/CustomerForm.tsx](../web/mng/src/pages/CustomerForm.tsx)

- 기존 point 필드의 hint 문구 그대로 유지 (수정 시 disabled)
- 페이지 하단에 새 섹션 **"포인트 조정"** 추가
  - input: 변동값 (+/-), 사유 (필수), 소멸예정일 (옵션), 유료/무료 토글
  - 제출 버튼 클릭 시 confirmation modal: "회원 [이름]에게 [+1000] 포인트를 [이벤트 보상] 사유로 조정합니다. 진행할까요?"
  - 성공 시 잔액 표시 갱신 + 하단 "포인트 이력" 섹션 reload
- 그 아래 **"최근 포인트 이력"** 섹션 (최근 10건, 더 보기 버튼 → PointHistoryList 페이지로)

#### 신규 페이지 PointHistoryList

**파일:** `web/mng/src/pages/PointHistoryList.tsx` (신규)

- 전체 포인트 변동 이력을 검색/필터로 조회
- 필터: 회원 검색 (아이디/이름), 날짜 범위, 변동 출처(admin/consultation/payment/system)
- 컬럼: 일시, 회원, 적립/사용, 잔액, 사유, 변동출처, 처리 관리자
- 페이지네이션은 [CustomerList.tsx](../web/mng/src/pages/CustomerList.tsx) 패턴 그대로

#### 라우트/메뉴 등록

- [web/mng/src/App.tsx](../web/mng/src/App.tsx): `/points/history` 라우트 추가
- [web/mng/src/components/layout/Sidebar.tsx](../web/mng/src/components/layout/Sidebar.tsx): "회원관리 > 포인트 이력" 또는 별도 그룹으로 추가

### A-4. ETL (병행)

**파일:** `api/db/etl/04_point.sql` (신규)

레거시 영카트 데이터 → 신규 스키마 매핑:

```sql
-- g5_point → point_history
INSERT INTO point_history (po_id, member_id, mb_id, content, earn_point, use_point,
                            is_expired, expire_date, balance_after, rel_table, rel_id,
                            is_paid, actor_type, created_at)
SELECT
  gp.po_id,
  m.id,
  gp.po_mb_id,
  gp.po_content,
  CASE WHEN gp.po_point > 0 THEN gp.po_point ELSE 0 END,
  CASE WHEN gp.po_point < 0 THEN -gp.po_point ELSE 0 END,
  (gp.po_use_point >= gp.po_point AND gp.po_point > 0),
  NULLIF(gp.po_expire_date, '0000-00-00')::date,
  0,  -- balance_after는 레거시에 없음, NULL 허용 또는 별도 backfill
  gp.po_rel_table,
  gp.po_rel_id,
  FALSE, -- 레거시는 유료/무료 구분 없음, 기본 FALSE
  'legacy',
  gp.po_datetime
FROM legacy.g5_point gp
LEFT JOIN member m ON m.mb_id = gp.po_mb_id
WHERE m.id IS NOT NULL;

-- member.mb_point → point 집계
INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
SELECT
  m.id,
  GREATEST(gm.mb_point, 0), -- 무료에 통합 (레거시 미분리)
  0,
  COALESCE((SELECT SUM(po_point) FROM legacy.g5_point WHERE po_mb_id = gm.mb_id AND po_point > 0), 0),
  COALESCE((SELECT -SUM(po_point) FROM legacy.g5_point WHERE po_mb_id = gm.mb_id AND po_point < 0), 0)
FROM legacy.g5_member gm
JOIN member m ON m.mb_id = gm.mb_id
ON CONFLICT (member_id) DO UPDATE SET
  free_balance = EXCLUDED.free_balance,
  total_earned = EXCLUDED.total_earned,
  total_used   = EXCLUDED.total_used;

-- member.point는 이미 0001 ETL에서 mb_point로 채웠음 (가정)
```

> 주의: `g5_point_end`(정산)는 Phase D에서 처리. 이번엔 보류.

### A-5. 검증

| 시나리오 | 기대 결과 |
|---|---|
| 잔액 1000인 회원에 +500 조정 | 잔액 1500, point_history 1건 (earn_point=500, balance_after=1500, actor_admin_id 기록) |
| 잔액 1000인 회원에 -500 조정 | 잔액 500, point_history 1건 (use_point=500, balance_after=500) |
| 잔액 1000인 회원에 -1500 차감 시도 | 400 에러, point_history 미생성, 잔액 변동 없음 |
| 잔액 1000인 회원에 -800, -800 동시 호출 | 한 건만 성공, 다른 건 잔액 부족 에러 (트랜잭션/FOR UPDATE 검증) |
| 쿠키 없이 호출 | 401 응답 |
| 정상 조정 후 데이터 정합성 | `member.point == point.free_balance + point.paid_balance == 마지막 point_history.balance_after` |

검증 후 [DB_REFACTOR_PROGRESS.md](../DB_REFACTOR_PROGRESS.md)에 Phase A 완료 항목 추가.

---

## 체크리스트

### DB
- [ ] `api/db/migrations/0013_point_history_actor.sql` 작성

### 백엔드
- [ ] `api/src/admin/points/points.module.ts` 신규
- [ ] `api/src/admin/points/points.service.ts` — `adjust()` 메서드
- [ ] `api/src/admin/points/points.controller.ts` — 3개 엔드포인트
- [ ] `api/src/app.module.ts`에 PointsModule 등록

### 프론트엔드
- [ ] [web/mng/src/pages/CustomerForm.tsx](../web/mng/src/pages/CustomerForm.tsx)에 포인트 조정 섹션 + 최근 이력 추가
- [ ] `web/mng/src/pages/PointHistoryList.tsx` 신규
- [ ] [web/mng/src/App.tsx](../web/mng/src/App.tsx)에 라우트 추가
- [ ] [web/mng/src/components/layout/Sidebar.tsx](../web/mng/src/components/layout/Sidebar.tsx)에 메뉴 추가

### ETL
- [ ] `api/db/etl/04_point.sql` 작성 (g5_point → point_history, mb_point → point 집계)

### 검증
- [ ] 정상 +/- 조정
- [ ] 잔액 부족 음수 거부
- [ ] 동시 조정 race condition
- [ ] 권한 미장착 401
- [ ] 데이터 정합성 (member.point == point 합계 == 마지막 history.balance_after)
- [ ] [DB_REFACTOR_PROGRESS.md](../DB_REFACTOR_PROGRESS.md) 업데이트
