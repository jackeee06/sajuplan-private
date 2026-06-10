# [AI 전용] 상담사 정산 — 기술 상세

> 🔴 **상태 (2026-06-10): 정산 방식 전환 중. 자동 cron 차단됨. 새 설계는 다음 세션 구현 예정.**
> 이 문서는 현황 요약. **상세 설계·구현 위치·검증 순서는 [`PLAN/_NEXT_SESSION_정산단순화.md`](../../PLAN/_NEXT_SESSION_정산단순화.md) 가 진실원.** 작업 이어받을 땐 그 문서 먼저 읽을 것.

## 현재 상태 요약

| 항목 | 상태 |
|---|---|
| 자동 정산 cron | 🔴 **차단됨** (prod crontab `settlement/monthly` 라인 주석처리, 원래 매월 9일 04:00) |
| `settlement_monthly` 데이터 | 0건 (한 번도 저장 안 됨) |
| 선지급(payout) prod 데이터 | 0건 |
| 추천수익금 실시간 적립 | ✅ 완료·검증됨 (상담 종료 시점 earning 적립) |
| 정산 단순화 (settleOne/markPaid 재작성) | ⏳ 미구현 — 다음 세션 |

## 오늘(2026-06-10) 고친 것 — GROUP BY 버그

- 파일: `api/src/cron/settlement-cron.service.ts`
- 증상: `COALESCE(c.grade_at_session, ${param})` 처럼 GROUP BY 절에 바인드 파라미터가 섞여 PostgreSQL `column must appear in GROUP BY` 에러 → 6/9 정산이 전건 실패(settlement_monthly 0건).
- 조치: 순수 컬럼만 GROUP BY 하도록 수정 (바인드 파라미터 제거).
- 단, 어차피 사장님 방식으로 settleOne 재작성 예정이라 이 cron으로 실 정산 데이터는 만들지 않음.

## 왜 자동 cron 을 차단했나 (과지급 방지)

- 추천수익금을 상담 종료 시점 **실시간 적립**으로 바꿈 (`m2net-push.service.ts` `creditCounselorPointInTx` 내 "추천수익금 실시간 적립" 블록, line ~1640+).
  - 피추천자(referee) 상담 → 추천자(referrer) earning 에 `effectiveAmt × rate_snapshot` 적립 + 피추천자 earning 에서 차감(제로섬). INSERT(ON CONFLICT) 성공 시에만 도달 → 자동 멱등.
- 기존 cron(`settleOne`)은 `consultation.amt` 에서 등급정산률을 **다시 곱해** 재계산 → 상담 시점 이미 `effectiveAmt = amt × 정산률`로 적립한 것과 **이중 계산**. 게다가 추천분이 빠진 피추천자 earning 을 amt 전체로 계산해 **과지급**.
- 7월 9일 자동 실행 시 과지급 위험 → crontab 라인 주석처리(`# [2026-06-10 정산단순화 작업중 비활성]`). 백업: 서버 `/tmp/crontab_backup_20260610.txt`. **새 방식 완성+검증 후 `#` 제거로 복구.**

## 새 정산 설계 (확정 — 다음 세션 구현)

```
정산예상금액(price_tot) = 전달 말일까지 미정산 earning 순액 합산
                         (SUM(earn_point) - SUM(use_point) WHERE balance_kind='earning' AND is_settled=false)
미정산 선지급(early)     = payout_request WHERE status='paid' AND settled_at IS NULL 의 requested_amount 합
순정산(netSettle)        = max(0, 정산예상 - 미정산 선지급)
원천세(withholding)      = floor(netSettle × 0.033)   ← 3.3%만
실지급액(price)          = netSettle - withholding
```

**제거 대상 (개발 과정의 임의 계산, 사장님 미지시):**
- ❌ 부가세 10% (`supply = priceTot/1.1`, `vat`)
- ❌ 회선비 (`replyFee = priceTot>=50000 ? 20000 : 0`)
- ❌ 등급별 구간 재계산 (consultation.amt × 등급정산률) — 상담 시점 earning 에 이미 반영됨
- ❌ carry_over_negative (음수 이월)
- ❌ 무료/유료 정산비 구분 (`price_free`, `price_paid`)

## 핵심 코드 위치

- **정산 계산 cron**: `api/src/cron/settlement-cron.service.ts`
  - `settleOne(memberId, mbId, bmonth, range, testOnly)` (line ~141) — **재작성 대상**. 차감 없이 계산+저장(`status='calculated'`)만 하도록.
  - 롤백: `POST /api/cron/settlement/rollback?month=YYYY-MM` (해당 월 settlement_monthly + 정산 차감 point_history 삭제).
  - testOnly 모드: `GET /api/cron/settlement/monthly?token=CRON_TOKEN&month=YYYY-MM&test=1` — 계산만, 부수효과 0.
- **정산하기 버튼**: `api/src/admin/settlements/settlements.service.ts` `markPaid(id, adminId)` (line ~175) — **재작성 대상**. 현재는 status='paid' 마킹 + 알림톡만. 여기에 **earning 차감 + point_history 정산 이력 + is_settled 마킹 + 미정산 선지급 settled_at 마킹** 추가.
- 등급 단가: `api/src/admin/grade/grade.service.ts`
- 단가/추천수익금 적립: `api/src/pg-callbacks/m2net-push.service.ts` END_CHAT / `creditCounselorPointInTx`
- 화면: `web/mng/src/pages/SettlementList.tsx` — 부가세/회선비/무료R%/유료R%/정산비 컬럼 제거, 버튼 라벨 "지급완료"→"정산하기".

## DB 스키마 (현재)

```
settlement_monthly
- id, member_id, mb_id
- month (YYYY-MM)
- price_tot   (정산예상=원금)
- withholding_tax (3.3%)
- price       (실지급액)
- status      'calculated' / 'paid' / 'voided'
- paid_at, paid_by_id, created_at
- (제거 예정 잔존 컬럼: vat, reply_fee, price_free, price_paid, price_other → 0 처리)

point_history
- member_id, mb_id, balance_kind ('earning' 등)
- earn_point, use_point, balance_after
- is_settled BOOLEAN  ← 정산 완료 시 true
- rel_table, rel_id, rel_action, actor_type, created_at

payout_request (선지급)
- counselor_id, requested_amount, status ('paid' 등), settled_at
```

## 운영 SQL

```sql
-- 상담사별 미정산 수익금(=정산예상 후보)
SELECT member_id,
       SUM(earn_point) - SUM(use_point) AS pending_earning
  FROM point_history
 WHERE balance_kind='earning' AND is_settled=false
 GROUP BY member_id
 ORDER BY pending_earning DESC;

-- 미정산 선지급
SELECT counselor_id, SUM(requested_amount) AS unsettled_payout
  FROM payout_request
 WHERE status='paid' AND settled_at IS NULL
 GROUP BY counselor_id;

-- 월별 정산 합계 (지급완료분)
SELECT month, COUNT(*) AS counselors,
       SUM(price_tot) AS total_gross,
       SUM(withholding_tax) AS total_tax,
       SUM(price) AS total_net
  FROM settlement_monthly
 WHERE status='paid'
 GROUP BY month ORDER BY month DESC;
```

## 함정

1. **자동 cron 차단 상태** — 지금 정산이 안 도는 것은 정상(의도적). 복구 전 자동 정산 기대 금지.
2. **settleOne 재계산 = 이중 계산** — 옛 amt×등급률 재계산 방식. 새 방식은 earning 합산만.
3. **markPaid 가 차감 책임** — 새 방식에선 cron(settleOne)은 계산만, 실제 earning 차감은 [정산하기]=markPaid 가 함.
4. **range.endday 의미 확인** — `monthRange(bmonth)` 의 endday = 정산대상월 다음달 1일 00:00 (= 전달말일까지) 여야 함. 재작성 시 검증.
5. **prod 데이터 오염 주의** — testOnly / rollback 으로 검증, 테스트 정산은 정리.

## 관련 문서·메모리

- 🔴 **`PLAN/_NEXT_SESSION_정산단순화.md`** (상세 설계·구현 위치·검증 순서 — 진실원)
- `MONEY_FLOW.md` §6 정산 / §7 선지급 / §18.5 지급완료 마킹
- `[[grade-system-plan]]` (등급 단가 시스템)
- `[[payout-system-plan]]` (선지급은 별도)
