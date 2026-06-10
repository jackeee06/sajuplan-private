# 🔴 다음 세션 인수인계 — 정산 단순화

> 작성: 2026-06-10
> 이 문서 하나만 읽으면 정산 단순화 작업을 정확히 이어받을 수 있다.
> 긴 이전 세션을 다시 읽지 말 것 (컨텍스트 낭비). 이 문서가 진실원.

---

## 0. 한 줄 요약

**정산을 "수익금(earning_balance) 합산 − 선지급 − 원천세 3.3%" 단순 방식으로 재작성하고, 차감을 cron→[정산하기] 버튼으로 옮긴다.** 부가세/회선비/등급재계산/carry_over는 전부 제거 (사장님이 지시한 적 없는 임의 계산).

---

## 1. ✅ 이미 완료된 것 (절대 다시 건드리지 말 것)

### 추천수익금 실시간화 (검증 완료)
- **위치**: `api/src/pg-callbacks/m2net-push.service.ts` `creditCounselorPointInTx` (line ~1640 이후 "추천수익금 실시간 적립" 블록)
- **동작**: 상담 종료 시점에, 피추천자(referee) 상담이면 → 추천자(referrer) earning에 `effectiveAmt × rate_snapshot` 적립 + 피추천자 earning에서 차감 (제로섬)
- **멱등성**: 상담사 적립 INSERT(ON CONFLICT)가 성공할 때만 도달 → 자동 멱등
- **prod 검증**: 찬물선생(91) 상담 → 라온선생(123) +4 즉시 적립 확인, 정리 완료
- **cron 추천수당 블록 제거됨**: `api/src/cron/settlement-cron.service.ts` 의 구 추천수당 처리(497~590)는 삭제, 추천관계 만료체크만 남김

→ **추천수익금은 이제 상담수익금과 100% 동일하게 earning에 흐른다. 정산은 그냥 earning 합산하면 추천수익금 자동 포함.**

---

## 2. 🔴 해야 할 것 — 정산 단순화 (확정된 설계)

### 확정된 정책 (사장님 직접 결정)
```
정산예상금액 = 전달 말일까지 미정산 수익금(earning) 순액 합산
              (상담수익 + 추천수익금 모두 earning 이라 그냥 합산)
선지급(payout) = 현재 그 사람 수익금의 70% (이미 받은 미정산 선지급은 정산에서 제외)
실지급액     = (정산예상 − 미정산 선지급) × (1 − 0.033)   ← 원천세 3.3%만
```

**제거 대상 (사장님이 지시 안 한 임의 계산):**
- ❌ 부가세 (`supply = priceTot/1.1`, `vat`)
- ❌ 회선비 (`replyFee = priceTot>=50000 ? 20000 : 0`)
- ❌ 등급별 구간 재계산 (consultation.amt × 등급정산률 재계산)
- ❌ carry_over_negative (음수 이월)
- ❌ 무료/유료 정산비 구분 (`price_free`, `price_paid`)

### 왜 재작성이 필요한가 (중요)
기존 정산(`settleOne`)은 `consultation.amt`에서 등급정산률을 **다시 곱해** 재계산한다. 그런데 상담 시점에 이미 `effectiveAmt = amt × 정산률`로 earning에 적립했으니 **이중 계산**. 게다가 추천수익금 실시간화로 피추천자 earning에서 추천분이 빠졌는데, 기존 정산은 amt 전체로 계산해서 **과지급**. → earning 합산 방식으로 바꿔야 일관됨.

---

## 3. 구현 — 정확한 위치와 설계

### (A) `settleOne` 재작성 — `api/src/cron/settlement-cron.service.ts`
현재 `settleOne`(line ~127~621, 약 480줄)을 아래 단순 버전으로 교체. **차감은 안 하고 계산+저장(status='calculated')만.**

```typescript
private async settleOne(memberId, mbId, bmonth, range, testOnly) {
  return await this.sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(7777002, ${memberId})`;

    // 정산예상금액 = 전달 말일까지 미정산 earning 순액
    const settleRow = await tx`
      SELECT COALESCE(SUM(earn_point) - SUM(use_point), 0)::text AS amount
        FROM point_history
       WHERE member_id = ${memberId}
         AND balance_kind = 'earning'
         AND is_settled = false
         AND created_at < ${range.endday}   -- range.endday = 정산대상월 다음달 1일 00:00 = 전달말일까지
    `;
    const settleAmount = Math.max(0, Number(settleRow[0].amount));

    // 미정산 선지급 차감 (status='paid' AND settled_at IS NULL)
    const earlyRow = await tx`
      SELECT COALESCE(SUM(requested_amount), 0)::text AS total
        FROM payout_request
       WHERE counselor_id = ${memberId} AND status = 'paid' AND settled_at IS NULL
    `;
    const earlyPayoutTotal = Number(earlyRow[0].total);

    const netSettle = Math.max(0, settleAmount - earlyPayoutTotal);
    const withholding = Math.floor(netSettle * 0.033);  // 원천세 3.3%
    const price = netSettle - withholding;               // 실지급액
    const priceTot = settleAmount;                        // 정산예상(원금)

    const existing = await tx`SELECT id, status FROM settlement_monthly WHERE month=${bmonth} AND member_id=${memberId} LIMIT 1`;
    const alreadyExists = existing.length > 0;

    if (testOnly) return { already: alreadyExists, price, price_tot: priceTot, early_payout_total: earlyPayoutTotal, prev_carry_over: 0, final_payout_amount: price, carry_over_negative: 0 };
    if (alreadyExists && existing[0].status === 'paid') return {...};  // 이미 정산완료 → 안 건드림

    // upsert (status='calculated', vat/reply_fee/price_free/price_paid/price_other = 0)
    // INSERT 시 status='calculated' 명시
    ...
    // ★ 차감 안 함! markPaid가 함.
    return { already: alreadyExists, price, price_tot: priceTot, ... };
  });
}
```

**주의**: `range.endday` 의미 확인. `monthRange(bmonth)` 가 endday = 그 월 다음달 1일 00:00 이어야 "전달말일까지". 현재 코드의 `monthRange` 확인 필수.

### (B) `markPaid`(정산하기 버튼) 재작성 — `api/src/admin/settlements/settlements.service.ts:175`
현재는 status='paid' 마킹 + 알림톡만 함. **여기에 earning 차감을 추가**:

```typescript
async markPaid(id, adminId) {
  await this.sql.begin(async (tx) => {
    const rows = await tx`SELECT member_id, mb_id, month, price_tot, status FROM settlement_monthly WHERE id=${id} FOR UPDATE`;
    if (rows[0].status === 'paid') throw '이미 지급완료';
    if (rows[0].status === 'voided') throw '무효화됨';
    const { member_id, mb_id, month, price_tot } = rows[0];
    const settleAmount = Number(price_tot);  // 정산예상=원금

    if (settleAmount > 0) {
      // earning 차감
      const pt = await tx`SELECT earning_balance FROM point WHERE member_id=${member_id} FOR UPDATE`;
      const after = Math.max(0, Number(pt[0].earning_balance) - settleAmount);
      await tx`UPDATE point SET earning_balance = GREATEST(earning_balance - ${settleAmount}, 0), total_used = total_used + ${settleAmount}, updated_at=now() WHERE member_id=${member_id}`;
      // 정산 차감 이력 (is_settled=true)
      await tx`INSERT INTO point_history (member_id, mb_id, content, earn_point, use_point, balance_after, rel_table, rel_id, rel_action, is_settled, actor_type, balance_kind)
               VALUES (${member_id}, ${mb_id}, ${month+' 정산'}, 0, ${settleAmount}, ${after}, 'settlement_monthly', ${String(id)}, ${month+' 정산'}, true, 'admin', 'earning')`;
      // 정산 대상 earning 이력 '정산됨' 마킹 (전달말까지 미정산)
      await tx`UPDATE point_history SET is_settled=true
               WHERE member_id=${member_id} AND balance_kind='earning' AND is_settled=false
                 AND created_at < ((${month} || '-01')::date + interval '1 month')`;
      // 미정산 선지급도 settled 마킹
      await tx`UPDATE payout_request SET settled_at=NOW() WHERE counselor_id=${member_id} AND status='paid' AND settled_at IS NULL`;
    }
    await tx`UPDATE settlement_monthly SET status='paid', paid_at=now(), paid_by_id=${adminId} WHERE id=${id}`;
  });
  // 알림톡 (트랜잭션 후, 기존 notifySettlementComplete 유지)
}
```

### (C) 화면 — `web/mng/src/pages/SettlementList.tsx`
- 컬럼 제거: 무료R%/유료R%/무료정산비/유료정산비/기타정산비/**부가세공제**/**회선비**
- 컬럼 유지/단순화: 아이디 | 이름 | 해당월 | **정산예상금액(price_tot)** | **원천세(withholding_tax)** | **실지급액(price)** | 상태 | 액션
- 버튼 라벨: "지급완료" → "**정산하기**" (의미 명확화 — 누르면 실제 수익금 차감)
- API 응답(`SettlementsService.list`)도 단순화된 필드만

---

## 4. ⚠️ 주의사항 (반드시 인지)

1. **정산 cron 자동실행 차단해둠**: prod crontab 의 `settlement/monthly` 라인(매월 9일 04:00)을 `# [2026-06-10 정산단순화 작업중 비활성]` 로 주석처리함. 백업: 서버 `/tmp/crontab_backup_20260610.txt`. **새 정산 방식 완성+검증 후 복구** (`#` 제거).
2. **현재 settlement_monthly 0건**: 정산이 한 번도 저장된 적 없음 (GROUP BY 버그로 전건 실패했던 것은 오늘 고쳤으나, 사장님 방식으로 재작성 예정이라 실 데이터 안 만듦).
3. **선지급(payout) prod 0건**: 선지급 연동은 코드만 반영하고 검증은 상담수익+추천수익금만으로 가능.
4. **롤백 API 있음**: `POST /api/cron/settlement/rollback?month=YYYY-MM` — 잘못되면 복구.
5. **testOnly 모드**: `GET /api/cron/settlement/monthly?token=CRON_TOKEN&month=YYYY-MM&test=1` — 계산만, 부수효과 0. 검증에 활용.

---

## 5. 검증 순서 (사장님 요구 = 엄격검증, 실제 손가락 동작)

1. settleOne 재작성 → 배포 → testOnly 로 계산값 확인 (earning 합산 맞는지)
2. markPaid 재작성 → 배포
3. **실제 1명 정산**: testOnly 빼고 1명 정산 → settlement_monthly INSERT(calculated) 확인 → [정산하기] → earning 차감 확인 → is_settled 마킹 확인
4. C-8 정합성 (health-check) + 무효화/롤백 검증
5. 화면 배포 + E2E (기존 35-settlement-logic.spec 갱신 필요할 수 있음)

검증 시 prod 데이터 오염 주의: 테스트용 정산은 검증 후 rollback 또는 정리.

---

## 6. 추가 정리 (시간 되면)

- **프로모션 화면 "지급" 버튼 제거**: `web/mng/src/pages/ReferralList.tsx` 의 지급 버튼 + `api/src/admin/referrals/referrals.service.ts` `payCurrentMonth`(paid_balance 에 잘못 넣는 지뢰) 제거 → 조회 전용으로. (추천수익금이 이제 상담 시점 실시간 적립되므로 수동 지급 불필요)
- **화면 용어 통일**: 추천 관련 화면 "추천 수당/포인트" → "**추천수익금**" 으로. (CLAUDE.md 돈 용어: 회원=추천코인(free_balance, 미구현), 상담사=추천수익금(earning_balance))
- **member.referred_by_id / is_recommended 컬럼**: 회원 추천 기능 미구현 잔재. 회원 추천은 아직 기능 없음 (사장님 확인).

---

## 7. 관련 문서
- [MONEY_FLOW.md](../MONEY_FLOW.md) §6 정산 / §7 선지급 / §18.5 지급완료 마킹
- [_HANDBOOK/payment/05-settlement.md](../_HANDBOOK/payment/05-settlement.md)
- [_HANDBOOK/promotion/02-referral.md](../_HANDBOOK/promotion/02-referral.md)
- CLAUDE.md 돈 용어 사전 (코인/수익금)

---

## 8. 다음 세션 시작 멘트 (사장님이 입력할 것)

> `PLAN/_NEXT_SESSION_정산단순화.md 읽고 이어서 작업해줘`
