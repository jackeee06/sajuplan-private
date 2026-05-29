# 💰 MONEY_FLOW.md — 사주플랜 돈 흐름 마스터 문서

> **이 문서의 목적**: 사주플랜과 m2net 의 관계, 회원 결제, 상담사 수익금, 정산, 환불 — 돈이 움직이는 모든 경로를 한 곳에 모은다. 새 세션이 열릴 때 Claude 가 가장 먼저 읽는 단 하나의 진실원.
>
> **작성**: 2026-05-29 (Phase 1)
> **검수 주체**: 사장님 (jackee). 정책 변경 시 이 문서를 가장 먼저 수정.
> **연결**: [PLAN/domain-01-member-point.md](PLAN/domain-01-member-point.md), [PLAN/domain-02-payment-order.md](PLAN/domain-02-payment-order.md), [PLAN/domain-03-counselor-settlement.md](PLAN/domain-03-counselor-settlement.md), [PLAN/domain-03b-settlement-flow-trace.md](PLAN/domain-03b-settlement-flow-trace.md)

---

## 📑 목차

0. [이 문서를 읽는 법 (새 세션용)](#0-이-문서를-읽는-법-새-세션용)
1. [한 장 요약 — Big Picture](#1-한-장-요약--big-picture)
2. [4자 관계 — 회원 / 사주플랜 / m2net / 상담사](#2-4자-관계)
3. [결제 흐름 — 회원이 충전한다](#3-결제-흐름)
4. [사용 흐름 — 상담 시 차감](#4-사용-흐름)
5. [환불 흐름](#5-환불-흐름)
6. [정산 흐름 — 매월 1일 (상담사 수익금 확정)](#6-정산-흐름)
7. [선지급(Payout) — 정산 전 미리 출금](#7-선지급-payout)
8. [point 테이블 3계좌 의미 ★](#8-point-테이블-3계좌-의미)
9. [핵심 테이블 사전](#9-핵심-테이블-사전)
10. [m2net API 사전](#10-m2net-api-사전)
11. [정책 상수](#11-정책-상수)
12. [건강 검증 (health-check 돈 관련)](#12-건강-검증)
13. [과거 돈 사고/이슈 히스토리](#13-과거-돈-사고이슈-히스토리)
14. [★ Claude 가 자주 틀리는 추측 — 금지 목록](#14--claude-가-자주-틀리는-추측--금지-목록)
15. [⚠️ 미확정/사장님 답변 대기](#15--미확정사장님-답변-대기)
16. [관련 파일 인덱스](#16-관련-파일-인덱스)
17. [관련 메모리 인덱스](#17-관련-메모리-인덱스)

---

## 0. 이 문서를 읽는 법 (새 세션용)

Claude 가 이 프로젝트에서 **돈 관련 질문**을 받으면 (정산 / 결제 / 환불 / 코인 / 수익금 / m2net) → **무조건 이 문서를 먼저 읽는다**. 부분만 읽지 말고 §1~§2 + 관련 섹션 전체.

특히 다음 상황에서 이 문서 없이 추측하면 **반드시 틀린다**:
- "consultation 0건인데 결제는 됐다 — 누락 사고 아니냐?" → §14 #1
- "earning_balance=0 인데 상담은 했다 — 미정산 아니냐?" → §14 #2, §6
- "chat_room.settle_status=m2net_failed 10건 — 사고?" → §14 #3, §12 C-17
- "회원 결제했는데 m2net 잔액과 사주플랜 잔액이 다르다" → §13 H-1
- "환불했는데 회원 카드로 안 돌아왔다" → §14 #4, §5

---

## 1. 한 장 요약 — Big Picture

```
┌──────────┐    카드/계좌    ┌───────┐    동기화    ┌─────────────┐
│  회원    │ ──────────────→ │  AG9  │ ─────────→ │   m2net     │
│ (소비자) │   결제 (PG)     │  PG   │  코인 fill │ (코인 보유 + │
└──────────┘                 └───────┘            │  정산 주체) │
     │                            │                └─────────────┘
     │ 충전 완료 콜백             │ push                │
     │ (handlePaymentCallback)    │ (handleAutopay      │ 월별
     ↓                            │  Push)              │ 정산금
┌─────────────────────────────────┴──────────┐         │ 송금
│           사주플랜 (사용 기록자)            │ ←───────┘
│  - payment, point, consultation,            │
│  - settlement_monthly, payout_request 관리  │
└─────────────────────────────────────────────┘
     │                       │
     │ 상담 시 코인 차감     │ 매월 1일 정산 크론
     │ (m2net push)          │ 상담사 수익금 확정
     ↓                       ↓
┌──────────┐         ┌──────────────┐
│ 상담사   │ ←─────  │  통장 입금   │
│ (제공자) │  지급   │ (사장님 수동)│
└──────────┘         └──────────────┘
```

**핵심 3원칙**:

1. **m2net 이 돈의 진실원** — 회원 코인 잔액의 마스터는 m2net 측. 사주플랜 `point` 테이블은 사용 기록 + UI 표시용 사본.
2. **사주플랜은 정산 계산 + 지급 결정 주체** — m2net 이 모은 돈을 받아서, 상담사별 수익금을 계산하고, 통장에 입금하는 책임은 사주플랜.
3. **정산은 월 1회** — 매월 1일 자정에 `settlement-cron` 이 도는 단발 이벤트. 그 외 시점엔 `point.earning_balance` 만 누적될 뿐 "수익금" 으로 확정 안 됨.

---

## 2. 4자 관계

### 회원 (소비자)
- 카드/계좌로 코인 충전 → 사주플랜에서 상담 (전화 070/060 or 채팅)
- 보유한 코인 = `point.paid_balance` (유료 충전분) + `point.free_balance` (무료/쿠폰분)
- 상담사로 승급 가능 (듀얼 역할). 라온선생 케이스 — §13 H-2

### 사주플랜 (서비스 운영자, 이 코드베이스)
- 회원·상담사 등록, 충전 UI, 상담 기록(consultation), 정산 계산, 수익금 지급 결정
- 돈을 직접 보유하지 않음 — 결제는 PG(AG9) → m2net 으로 흐름
- **사장님 운영**: 정산 결과 보고 통장에서 직접 송금, 어드민 "지급완료" 마킹

### m2net (엠투넷 — 통화/채팅/결제 인프라 외부 시스템)
- 070(선불)/060(후불) 통화 + 채팅 시스템 운영 (passcall.co.kr:25205, :32837)
- **회원 코인 잔액 마스터** — 코인 충전/차감은 `m2net.addMemberCoin()` 호출로 m2net 측에 반영
- 상담 종료 시 차감 결과를 사주플랜으로 push (handleCallPush)
- 매월 사주플랜으로 정산금 송금 (이 부분은 m2net ↔ 사장님 간 외부 계약, 코드에 없음 — §15 Q1)

### 상담사 (제공자)
- 사주플랜에서 회원과 상담 → 수익금 적립 → 매월 1일 정산 → 통장 입금
- 누적 수익금: `point.earning_balance`
- 정산 전이라도 70% 까지 선지급 신청 가능 (§7)
- 회원이기도 함 — `member.role='counselor'` 인 회원

---

## 3. 결제 흐름

### 3.1 일반 결제 (카드/간편/가상계좌)

```
회원이 사주플랜에서 충전 패키지 선택
   ↓
prepareCharge(): payment row 생성 (status='pending', oid 생성)
   ↓
AG9 PG 결제 페이지 이동 (form post)
   ↓
회원이 카드 정보 입력 → AG9 결제 처리
   ↓
[2갈래로 갈라짐 — ⚠️ 이중 적립 위험 지점, §13 H-1 참조]
   ├─ AG9 → m2net 직통 fill (자동) → m2net 잔액 + amount
   └─ AG9 → 사주플랜 returnurl 콜백 → handlePaymentCallback()
                                       ↓
                                  payment.status='completed'
                                       ↓
                                  m2net.addMemberCoin(+amount) ← (직통 fill 과 중복!)
                                       ↓
                                  point.paid_balance +=
                                       ↓
                                  point_history INSERT (rel_table='payment')
                                       ↓
                                  correctM2netDoubleFill() 2초 뒤 m2net 잔액 overwrite (안전망)
```

**파일**:
- 충전 패키지/준비: [api/src/user/charge/charge.service.ts](api/src/user/charge/charge.service.ts)
- PG 콜백 처리: [api/src/pg-callbacks/m2net-push.service.ts](api/src/pg-callbacks/m2net-push.service.ts)
- m2net 코인 조작: [api/src/shared/m2net/m2net.service.ts](api/src/shared/m2net/m2net.service.ts) `addMemberCoin()`

### 3.2 자동충전 (사주플랜페이 — BillKey)

```
회원이 BillKey 등록 (카드 정보 1회 입력)
   ↓
member.billkey 저장 + m2net.updateAutoPayConfig() (autopayflag=Y)
   ↓
[상담 중 m2net 잔액 < 임계값]
   ↓
m2net 이 자체적으로 AG9 호출 (사주플랜 개입 X)
   ↓
AG9 → m2net 직통 fill
   ↓
m2net → 사주플랜 push (autopaypushurl) → handleAutopayPush()
   ↓
payment INSERT + point.paid_balance += + point_history
```

### 3.3 결제 실패 retry

- payment.m2net_status='코인충전실패' 인 건은 `retry-cron` 이 매시간 재시도
- health-check **C-16**: 10건 이상 누적 시 critical 알림
- 파일: [api/src/cron/retry-cron.service.ts](api/src/cron/retry-cron.service.ts)

---

## 4. 사용 흐름

### 4.1 상담 시 코인 차감 (m2net 주도)

회원이 상담사에게 전화/채팅 → m2net 이 실시간으로 코인 차감 → 종료 시 결과를 사주플랜에 push.

```
상담 종료 (DISCONNECT / END_CHAT / END_CHAT_LOCAL)
   ↓
m2net → 사주플랜 push 콜백 → handleCallPush()
   ↓
consultation INSERT
   - amt = m2net 이 반환한 총 차감액 (★ m2net 이 진실원, 사주플랜 자체 계산 X)
   - amt_free = free_balance 로 충당된 부분
   - amt_pro = paid_balance 로 충당된 부분
   - reason, csrid, membid, callid/roomid, usetm, preflag
   - unit_cost_snapshot, grade_at_session (분쟁 추적용)
   ↓
회원 측: point.free_balance -= amt_free, point.paid_balance -= amt_pro
        point_history INSERT (rel_table='consultation', rel_action='consultation')
   ↓
상담사 측: point.earning_balance += (상담사 몫 — 등급 단가 기반 계산)
          point_history INSERT (적립)
   ↓
m2net.addMemberCoin(+상담사_몫) — m2net 측 상담사 잔액에도 적립
```

### 4.2 단기통화 자동환불 (2026-05-21 정책)

```
조건: usetm < 30초 AND amt <= 상담사 단가 AND reason='DISCONNECT'
   ↓
consultation.refund_status='short_call_refund'
   ↓
회원 차감 스킵 (UX 보호 — 잘못 끊긴 통화는 무료)
m2net.addMemberCoin(+amt) 로 회원 잔액 복구
   ↓
★ 상담사 적립은 정상 진행 (상담사 보호 — 회사 손실 감수)
```

**의의**: 회사가 짧은 통화 비용을 **고객보호비용**으로 떠안음. 사장님 정책.

---

## 5. 환불 흐름

### 5.1 결제 환불 (어드민 → 회원 코인 회수)

- 어드민이 payment 상세에서 "환불" 클릭
- [api/src/admin/payments/payments.service.ts](api/src/admin/payments/payments.service.ts) `cancel()` L379-521
- 처리:
  - payment.cancelled_amount += 환불액
  - payment_cancel_log INSERT
  - point.paid_balance -= 환불 코인 (멱등성 검증, 부족 시 400)
  - point_history INSERT (rel_action='payment_cancel')
- **⚠️ 카드/계좌 실 환불은 stub** — point 회수만 함. 실제 카드 취소는 AG9 API 별도 호출 필요 (현재 미구현, §15 Q2)
- PHP 레거시: `pay_ag9.php:pay_cancel_full()` 에 AG9 `gnrc_cancel_pay` 호출 있음 (당일 전액취소만)

### 5.2 상담 환불 (어드민 → 회원 포인트 환원 + 정산 차감)

- 어드민이 consultation 상세에서 "환불" 처리
- [api/src/admin/refunds/refunds.service.ts](api/src/admin/refunds/refunds.service.ts) `createAndApprove()` L38-228
- 처리:
  - refund_request INSERT (amount_free / amount_pro 분리)
  - consultation.refund_status = 'partial' or 'full'
  - consultation.refunded_amount += 환불액
  - point.free_balance += amt_free, point.paid_balance += amt_pro
  - point_history INSERT (환원)
  - **정산 차감**: settlement-cron 실행 시 `consultation.refunded_amount` 만큼 정산액에서 자동 차감
- 멱등성: `idempotent_key` UNIQUE
- 짧은 통화는 `refund_status='short_call_refund'` 로 이미 처리됨 → 재환불 불가

---

## 6. 정산 흐름

### 6.1 정산 주기

- **매월 1일 자정** — `settlement-cron` 이 전월(예: 5월 1일 실행 → 4월분) 정산 수행
- 단위: 상담사 1인 × 1개월 = settlement_monthly 1행
- 멱등성: `(member_id, month)` UNIQUE — 재실행해도 UPDATE 만 (point 차감 스킵)
- 파일: [api/src/cron/settlement-cron.service.ts](api/src/cron/settlement-cron.service.ts)

### 6.2 정산 대상 상담

다음 조건 **모두** 만족하는 consultation 만:
- `reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')`
- `refund_status != 'full'` (전액 환불 제외)
- 해당 consultation 의 point_history 기록 존재 (미지급 건 제외)
- ★ 2026-05-22 정책: `refund_status='short_call_refund'` 도 **정산 포함** (회원 차감만 스킵, 상담사 적립은 정상)

### 6.3 정산 계산식

```
[상담사별 월 합산]
sum_amt_free        = SUM(consultation.amt_free)
sum_amt_pro         = SUM(consultation.amt_pro)
sum_amt_other_plus  = SUM(기타 +포인트)  // 어드민 조정 등
sum_amt_other_minus = SUM(기타 -포인트)

[로열티 적용 — member.grade 별 setting.revenue_rate.<grade>]
price_free  = floor(sum_amt_free × free_royalty_pct / 100)
price_paid  = floor(sum_amt_pro × paid_royalty_pct / 100)
price_other = floor(sum_amt_other_plus × royalty_pct / 100) + sum_amt_other_minus
price_tot   = price_free + price_paid + price_other

[세금 분리]
supply      = floor(price_tot / 1.1)            // 공급가 (부가세 분리)
vat         = price_tot - supply                // 부가세 10%
withholding = floor(supply × 0.033)             // 원천징수 3.3%
reply_fee   = (price_tot >= 50000) ? 20000 : 0  // 회선비 (5만원 이상에만 2만)

[실 지급액]
price = supply - withholding - reply_fee

[선지급 차감]
early_payout_total = SUM(payout_request WHERE status='paid' AND settlement_month=이번달)
prev_carry_over    = settlement_monthly.carry_over_negative (이전 달)
final_payout_amount = max(0, price - early_payout_total - prev_carry_over)

[음수 이월]
음수 발생 시 carry_over_negative 에 박제 → 다음 달 자동 차감
```

### 6.4 정산 후 처리

```sql
INSERT INTO settlement_monthly (member_id, mb_id, month, status='calculated',
  amt_free, amt_pro, amt_other_plus, amt_other_minus,
  price_free, price_paid, price_other, price_tot,
  supply_price, vat_amount, withholding_tax, reply_fee, price,
  early_payout_total, carry_over_negative, final_payout_amount,
  -- 정책 스냅샷 (재계산 가능)
  free_royalty_pct, paid_royalty_pct, vat_rate, withholding_rate,
  line_fee_threshold, line_fee, calculated_by_id, calculated_at);

UPDATE point SET earning_balance -= price WHERE member_id = 상담사;
INSERT INTO point_history (..., rel_action='settlement', use_point=price);
```

이후 사장님이 어드민에서 결과 확인 → 통장에서 송금 → "지급완료" 마킹:
```sql
UPDATE settlement_monthly SET status='paid', paid_by_id=admin_id, paid_at=NOW();
```

### 6.5 ★ 첫 정산 시점 — 이게 매번 헷갈리는 부분

> **새 세션 Claude 주의**: "이 상담사 earning_balance=23,000원인데 왜 settlement_monthly 없냐?" 라는 의문이 들면 **정산 시점 전인 것일 가능성이 매우 높다**.
>
> 정산은 **매월 1일** 만 도는 이벤트. 5/29 시점에 5월 상담 결과는 아직 settlement_monthly 에 없는 게 정상. 6/1 자정 크론이 돌아야 5월분 생김.
>
> "earning_balance 값이 보이는 = 적립은 됐다. 정산만 아직 안 돈 것." — §14 #2

---

## 7. 선지급 (Payout)

### 7.1 개요

상담사가 정산일(매월 1일) 전에 누적 예상 수익금의 **최대 70%** 까지 미리 출금 신청 가능.

### 7.2 정책 상수 (2026-05-21 확정)

| 항목 | 값 | 비고 |
|---|---|---|
| 가용율 | 70% | 안전 마진 30% |
| 수수료 | 5% | 정률 |
| 원천징수 | 3.3% | 추가 |
| 최소 신청액 | 30,000원 | |
| 신청 빈도 | 일 1회 | |
| 계좌 변경 잠금 | 변경 후 N일 출금 제한 | `member.bank_locked_until` |

**예**: 신청 100만 → 수수료 5만 → 원천징수 3.3만 → 실 지급 91.7만

### 7.3 가용 한도 계산식

```
estimated_settlement = SUM(consultation 환불 차감 후) × revenue_rate
already_paid_this_month = SUM(payout_request WHERE status='paid' AND paid_at >= 이번달)
carry_over = settlement_monthly.carry_over_negative (이전 달)
available_amount = floor((estimated - already_paid - carry_over) × 0.7)

신청 가능 = available_amount >= 30,000
```

### 7.4 처리 흐름

```
상담사가 마이페이지에서 신청 (금액 + 계좌)
   ↓
payout_request INSERT (status='pending', fee_amount, withholding_amount, actual_payout 계산)
   ↓
운영자(사장님)가 일과 종료 시 어드민에서 일괄 송금 (은행 앱 직접 + 어드민 마킹)
   ↓
payout_request.status='paid', paid_at=NOW()
   ↓
다음 정산 cron 실행 시 → final_payout_amount = price - early_payout_total - ...
```

### 7.5 알림 (카톡 3단)

1. 접수: 신청 즉시
2. 반려: 운영자가 reject 시
3. 지급완료: paid 마킹 시

파일: [api/src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts](api/src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts)

---

## 8. point 테이블 3계좌 의미 ★

가장 자주 헷갈리는 부분. **개인 1명 = point 1행** 이지만 컬럼별로 회계 의미가 다르다.

| 컬럼 | 회계 의미 | 누가 사용 | 언제 +/- | 회사 입장 |
|---|---|---|---|---|
| `paid_balance` | 회원이 결제한 코인 (유료 충전분) | 회원 | + 충전 / - 상담 / - 결제환불 / + 상담환불 | **부채** (회원에게 진 빚) |
| `free_balance` | 무료 코인 (쿠폰/이벤트/적립) | 회원 | + 어드민 적립 / - 상담 / + 상담환불 | 마케팅 비용 |
| `earning_balance` | 상담사가 상담으로 번 코인 (수익 — 정산 전) | 상담사만 | + 상담 종료 / - 월 정산 | **미지급금** (상담사에게 줄 돈) |
| `total_earned` | 누적 적립 (감사추적) | 모두 | 모든 + 시 누적 | 카운터 |
| `total_used` | 누적 차감 (감사추적) | 모두 | 모든 - 시 누적 | 카운터 |

**중요**:
- 회원 "보유 코인" 표시 = `paid_balance + free_balance` (earning_balance 미포함)
- 상담사 "누적 수익금" 표시 = `earning_balance` (정산 안 된 것)
- 듀얼 역할 (회원→상담사 승급, 라온선생) 은 한 row 에 3계좌 모두 사용 — §13 H-2

**`member.point` 컬럼**: `paid_balance + free_balance` 의 캐시 (denormalized snapshot). drift 발생 시 health-check **C-8** 경고.

---

## 9. 핵심 테이블 사전

### `payment` (결제 마스터)
- PG 결제 1건 = 1행. 카드/계좌/간편/자동충전 모두 통합
- 주요 컬럼: `oid` (사주플랜 주문번호), `tid` (AG9 거래번호), `amount`, `coin_amount`, `status` (pending/completed/cancelled), `pay_type`, `m2net_status` (코인충전 결과)

### `consultation` (상담 원장)
- 전화/채팅 1회 = 1행. m2net push 로 생성
- 주요 컬럼: `member_id`/`counselor_id` (사주플랜 PK), `csrid`/`membid` (m2net ID), `callid`/`roomid`, `reason`, `preflag` ('Y'=070선불), `amt` / `amt_free` / `amt_pro`, `usetm`, `refund_status`, `unit_cost_snapshot`, `grade_at_session`

### `point_history` (포인트 이력 — 모든 +/- 기록)
- 주요 컬럼: `member_id`, `earn_point`/`use_point`, `rel_table` ('payment'/'consultation'/'@member'/'@platform_consulting'), `rel_id`, `rel_action`, `is_paid`, `actor_type`, `actor_admin_id`

### `settlement_monthly` (월별 정산 결과)
- `(member_id, month)` UNIQUE
- 정책 스냅샷 보존 → 재계산 가능
- **실제 schema (2026-05-29 prod 확인)**: id, no, member_id, mb_id, month(varchar 'YYYY-MM'), **kind**, price_free, price_paid, price_other, price_tot, vat_amount, withholding_tax, reply_fee, price, early_payout_total, carry_over_negative, final_payout_amount, wr_datetime, created_at
- ⚠️ `amt_free`, `amt_pro`, `status`, `calculated_at`, `paid_at` 컬럼은 **없음** — MONEY_FLOW.md §6.4 INSERT 예시는 산식 의도일 뿐 실제 컬럼 아님

### `payout_request` (선지급 신청)
- status: pending / paid / rejected / cancelled
- `requested_amount` / `fee_amount` / `withholding_amount` / `actual_payout`
- `settlement_month` (어느 달 정산에서 차감할지)
- `settled_at` (정산 cron 이 차감 처리한 시각)

### `chat_room` (채팅방)
- `roomid` = m2net room ID
- `status`: STAY / CNCH(상담중) / DISCONNECT
- `settle_status`: pending / settled / **m2net_failed** ← health-check C-17 감시
- `settle_retry_count`: retry-cron 재시도 횟수

### `refund_request` (환불 신청)
- consultation 1건당 N행 가능 (부분환불 누적)
- `idempotent_key` UNIQUE (HTTP 재전송 방지)
- `amount_free` / `amount_pro` 분리

### `account_setting` (충전 패키지)
- `coin_amount`, `payment_amount`, `bonus_amount`, sort, active

---

## 10. m2net API 사전

베이스 URL:
- 코인 관리: `http://passcall.co.kr:25205/` (운영) — header `Authorization` 필요
- 자동결제 관리: `http://passcall.co.kr:32837/`

| 엔드포인트 | 메서드 | 용도 | 호출 위치 |
|---|---|---|---|
| `memb-mgr/{CPID}` | POST | 회원 m2net 등록 → membid 발급 | `registerMember()` |
| `memb-mgr/{membid}` | PUT | 회원 정보/잔액 업데이트 | `updateMember()`, `addMemberCoin()` |
| `memb-mgr/{membid}` | DELETE | 회원 삭제 | (어드민) |
| `memb-mgr/{membid}` | GET | 잔액 조회 (URL-suffix, membid 6자리 zero-pad) | `getMemberByMembid()` |
| `csr-mgr/{csrid}` | POST/PUT | 상담사 등록/업데이트 | `registerCounselor()`, `updateCounselorFull()` |
| `chat-mgr/csrstat` | PUT | 상담사 상태 즉시 반영 | (상태 변경 시) |

**addMemberCoin body**: `{"amt": "+10000"}` 또는 `{"amt": "-10000"}`. `+`/`-` 부호 필수.

**⚠️ 진실원 정책**: `addMemberCoin()` 는 m2net 잔액을 **delta** 로 조정. 사주플랜 측에서 절대값으로 m2net 잔액을 덮어쓰는 건 `correctM2netDoubleFill()` (이중 적립 안전망) 에서만 함.

---

## 11. 정책 상수

| 항목 | 값 | 위치 (코드/설정) | 변경 시 영향 |
|---|---|---|---|
| 부가세 | 10% (price_tot / 1.1) | `settlement-cron.service.ts` 하드코딩 | 정산 공급가 |
| 원천징수 | 3.3% | `settlement-cron.service.ts` 하드코딩 | 정산 + 선지급 |
| 회선비 | 50,000원 이상 시 20,000원 차감 | `settlement-cron.service.ts` 하드코딩 | 정산 |
| 정산률 (등급별) | grade.revenue_rate.<grade> | `setting` 테이블 namespace='grade' | 정산 |
| 등급 임계값 | grade.thresholds.partner1~5 | `setting` 테이블 | 자동 등급 인상 |
| 선지급 가용율 | 70% | `payout.service.ts` 상수 | 가용 한도 |
| 선지급 수수료 | 5% | `payout.service.ts` 상수 | 실 지급액 |
| 선지급 최소액 | 30,000원 | `payout.service.ts` 상수 | 신청 가능 여부 |
| 단기통화 환불 기준 | usetm<30초 AND amt<=단가 | `m2net-push.service.ts` | 회원 보호 |
| 정산 시점 (월) | 매월 1일 자정 | `settlement-cron` cron expression | 결과 가시화 시점 |
| 정산 기준일 (대정리) | 2026-03-01 이전 포인트는 0 처리 | PHP 레거시 `get_point_sum()` | 마이그레이션 컷오프 |

**모두 한 곳에 모으는 게 이상적** — 현재는 코드 하드코딩 + setting 테이블 + 상수가 섞여있음 (§15 Q3).

---

## 12. 건강 검증

[api/src/cron/health-check.service.ts](api/src/cron/health-check.service.ts) 의 invariants 중 **돈 관련**:

| ID | 검사 | 심각도 | 의미 |
|---|---|---|---|
| C-1 | 음수 포인트 잔액 | Critical | paid/free/earning 음수면 무결성 깨짐 |
| C-2 | member.point 음수 | Critical | snapshot 무결성 |
| C-3 | consultation amt 불일치 (amt ≠ amt_free + amt_pro) | Critical | 정산 산식 기초 |
| C-4 | 과다 환불 (refunded > amt) | Critical | 환불 로직 버그 |
| C-5 | refund_request 합 > amt | Critical | 환불 합계 초과 |
| C-6 | refund free/pro 분배 불일치 | Warning | refund_request 데이터 |
| C-8 | member.point drift (≠ free + paid) | Warning | denorm sync 누락 |
| C-9 | settlement 중복 ((member_id, month)) | Critical | 멱등성 깨짐 |
| C-11 | settlement 음수 정산액 | Warning | 환불 많을 때 — carry_over 로 정상 처리 |
| C-13 | 정산률 범위 외 (0~1 아님) | Critical | grade.revenue_rate 정수면 ×100 환산 → 대손 |
| C-16 | payment retry 누적 (m2net_status='코인충전실패') | Warning→Critical (10+) | 코인 충전 실패 |
| C-17 | chat_room settle_status='m2net_failed' 누적 | Warning→Critical (10+) | 채팅 정산 push 실패 |
| C-19 | 선지급 paid > 예상정산 × 1.5 | Critical | 사기/버그 |
| C-20 | paid 됐는데 정산 차감 누락 (1개월+ 경과) | Critical | payout_request.settled_at 미설정 |

---

## 13. 과거 돈 사고/이슈 히스토리

### H-1. PG-m2net 이중 적립 (2026-05-23)
- **증상**: 사장님 본인 잔액 60,000원 (실제 충전 30,000원의 2배)
- **원인**: AG9 가 m2net 에 직통 fill + 사주플랜 `addMemberCoin()` 도 호출 → 중복
- **수정**: `charge.service.ts:correctM2netDoubleFill()` — 결제 직후 2초 지연 후 m2net 잔액을 사주플랜 기준으로 overwrite (안전망)
- **장기 계획**: 1주일 후 `addMemberCoin()` 호출 자체 제거 검토 (메모리 `project_pg_m2net_double_fill`)

### H-2. 포인트 분리 (2026-05-22)
- **증상**: 라온선생(회원→상담사 승급)의 소비/수익 포인트가 `paid_balance` 한 컬럼에 섞임 → 회계 구분 불가
- **수정**:
  - DB 마이그레이션: `point.earning_balance` 컬럼 추가
  - 코드 분기: m2net-push (회원=paid_balance 차감, 상담사=earning_balance 적립), settlement-cron (earning_balance 만 차감)
  - 어드민 UI: 3계좌 분리 표시
- **상태**: 양 서버 적용 완료. 보류: `PointHistoryList` 색 구분
- 메모리: `project_point_separation_done`

### H-3. PHP v1 정산 SQL 버그 (`where  and`)
- **증상**: 옛 PHP `set_con_account()` (v1) 가 SQL 버그로 항상 `price=0` INSERT
- **현재**: v2 (`set_con_account_v2()`) 가 매월 1일 자동 실행. v1 호출 경로 비활성
- **NestJS**: 새 `settlement-cron.service.ts` 가 v3 산식 기반 (가장 정확)

### H-4. ID 단일화 (2026-05-22)
- 회원 m2net id = `m2net_membid`, 상담사 m2net id = `csrid` 로 분리 완료
- 한 사람 = 한 mb_id (회원/상담사 토글 가능)
- 메모리: `project_id_unification_complete`

### H-5. WebView 캐시 푸시 미수신 (2026-05-28)
- 직접 돈 사고는 아니지만, 정책 변경 후 사용자 WebView 옛 코드 캐시로 부분 동작 → 사장님이 모바일 개발자 야단치는 사고
- 교훈: 정책 변경 시 캐시 갱신 정책 함께 고려
- 메모리: `feedback_webview_cache_policy_change`

---

## 14. ★ Claude 가 자주 틀리는 추측 — 금지 목록

> 새 세션 Claude 가 가장 자주 빠지는 함정들. 이 항목 위반 시 즉시 사장님이 "이미 확인된 사항인데 또 헷갈리네" 라며 답답해함.

### #1. ❌ "consultation 0건 = 결제 누락 사고"
- **사실**: consultation 은 **상담 종료 시** 생성됨. 결제만 하고 상담 안 했으면 0건이 정상.
- **검증 순서**:
  1. payment 에 결제 기록은 있나? (충전만 하고 미사용일 수 있음)
  2. point.paid_balance 에 잔액 남아있나? (충전됐는데 안 썼음)
  3. m2net push 실패는? (chat_room.settle_status='m2net_failed' 확인)

### #2. ❌ "earning_balance=0 또는 settlement_monthly 없음 = 미정산 사고"
- **사실**: 정산은 매월 1일에만 도는 단발 이벤트. 그 외 시점엔 settlement_monthly 생성 안 됨.
- **검증 순서**:
  1. 오늘 날짜는? 이번 달 1일이 지났나?
  2. 상담사의 `earning_balance` 가 0보다 크면 → 적립은 됨, 정산 시점 대기 중
  3. 이번 달 1일 이후 상담은 다음 달 1일에 정산됨

### #3. ❌ "chat_room.settle_status='m2net_failed' = 즉시 사고"
- **사실**: 테스트 데이터 + 짧은 통화 + 진짜 실패 가 섞여있음. 단순 count 만으로 판단 X
- **검증 순서**:
  1. 해당 chat_room 의 consultation 이 있는가? (있으면 정산은 됐을 수 있음)
  2. settle_retry_count 가 max_retries 도달했나?
  3. point_history 에 차감 기록이 있는가?
  4. 사장님이 "고객보호비용으로 처리된 건도 있다" 라고 했으므로 — refund_status='short_call_refund' 도 확인

### #4. ❌ "환불 = 카드로 자동 환급"
- **사실**: 사주플랜 환불 = **point 회수만**. 카드 환불은 stub (AG9 API 별도 호출 필요)
- 실제 카드 환불이 필요하면 사장님이 AG9 어드민에서 수동 처리

### #5. ❌ "m2net 잔액 ≠ 사주플랜 잔액 = 즉시 사고"
- **사실**: 잠시 drift 발생 가능. 자동 정정 안전망 (`correctM2netDoubleFill`) 이 결제 직후 2초 후 동기화
- 결제 직후 2초간은 drift 가 정상. 그 후에도 다르면 그때 의심

### #6. ❌ "amt 와 amt_free + amt_pro 가 안 맞으면 사주플랜 계산 버그"
- **사실**: amt 는 **m2net 이 반환한 값**. 사주플랜이 자체 계산 X. 안 맞으면 m2net 데이터 이슈 → health-check C-3 으로 감지

### #7. ❌ "지급률(revenue_rate) 이 35 면 35% 적용됨"
- **사실**: setting.revenue_rate.<grade> 는 **decimal** (0.35). 정수 35 로 저장되면 ×100 환산 → **3500% 적용 → 대손**
- health-check C-13 으로 감지하지만, 등록 시점에 검증 필수

### #8. ❌ "선지급 후 정산이 음수 = 환수 처리"
- **사실**: 회사가 임시로 메움. 다음 달 carry_over_negative 로 자동 이월. 환수 코드 없음 (정책)

### #9. ❌ "consultation.amt 를 사주플랜이 다시 계산해서 검증해야 한다"
- **사실**: m2net 이 진실원. consultation.amt 는 받은 값 그대로 저장. 사주플랜이 재계산하면 정책 충돌
- 단가 변경 검증은 `unit_cost_snapshot` 으로 별도

### #10. ❌ "회원과 상담사는 다른 사람"
- **사실**: 듀얼 역할 가능. `member.role='counselor'` 인 회원. 한 mb_id 가 회원 모드 ↔ 상담사 모드 토글
- BottomNav 도 URL 경로 기반 (`/counselor/*` = 상담사 모드) — `inCounselorArea` 검사

---

## 15. ⚠️ 미확정/사장님 답변 대기

이 섹션은 사장님이 답변해주시는 대로 채워넣어야 함. 답변 받기 전엔 코드/문서로 추측하지 말 것.

### Q1. m2net → 사주플랜 정산금 송금 사이클
- **현재 안 됨**: m2net 이 매월 사주플랜으로 얼마를 어떤 주기로 송금하는지 코드/문서에 없음
- **필요한 정보**: 사장님과 m2net 의 외부 계약 — 송금 주기 (월말? 익월 N일?), 송금 금액 산정 기준 (사주플랜 측 consultation 합산 vs m2net 측 자체 산정), 정산 보고서 양식

### Q2. 카드 환불 (실 환불) 운영 절차
- **현재**: 사주플랜은 point 회수만. 카드 취소는 미구현
- **필요한 정보**: 실 환불 발생 시 사장님이 AG9 어드민 직접 처리하는지, 처리 후 사주플랜에 어떻게 반영하는지

### Q3. 정책 상수 한 곳에 모을지
- **현재**: 부가세 10%, 원천징수 3.3%, 회선비 5만/2만 — 코드 하드코딩
- 등급별 정산률 — setting 테이블
- 선지급 정책 — payout.service.ts 상수
- **필요한 결정**: 전부 setting 테이블로 모을지, 현재 분산 유지할지 (코드 안정성 vs 운영 유연성 trade-off)

### Q4. 정산 음수 (carry_over_negative) 무한 누적 시 처리 — ✅ 코드 답 (2026-05-29)
- **확인 완료**: `settlement-cron.service.ts` L254-286
  - 음수 발생 시 `finalPayoutAmount = 0` cap + `carry_over_negative` 에 박제
  - 다음 달 자동 차감 (prev_carry_over 로 읽음)
  - 회사 임시 메움 정책 (사장님 명시: 회수 X)
- **코드에 없음**: 한도 / 자동 알림 / 자격 정지 룰
- **사장님 정책 결정 사항**: 일정 누적액 초과 시 (예: -100만원) 자동 알림 또는 자격 정지 룰 도입할지

### Q5. 첫 정산 시점 정책 (신규 상담사) — ✅ 코드 답 (2026-05-29)
- **확인 완료**: `settlement-cron.service.ts` L60-67 `WHERE role='counselor' AND left_at IS NULL`
- **답**: 최소 활동 기간 룰 **없음**. 어제 가입한 상담사도 다음 달 1일 정산 자동 포함
- 단, 그 달 상담 0건이면 price=0 row 만 settlement_monthly 에 INSERT (지급액 0원)
- **사장님 정책 결정 사항**: 신규 상담사에게 최소 활동 기간 (예: 30일) 룰 도입할지 여부

### Q6. 선지급 음수 정산 후 상담사 통보 — ✅ 코드 답 (2026-05-29)
- **확인 완료**: settlement-cron 코드에 `notifyCounselor` / 알림톡 호출 0건
- **현재 동작**: 음수 carry_over_negative 박제만. 상담사에게 알림 X.
- **상담사 인지 경로**: 어드민 페이지 본인 정산 내역 직접 확인 (사장님이 보여줘야 함)
- **사장님 정책 결정 사항**: 음수 발생 시 자동 알림톡 추가 + 신청 한도 자동 조정 룰

### Q7. 정산 결과 검수 흐름 — ✅ Phase 1 완료 / Phase 2 진행 중 (2026-05-29)
- **Phase 1 완료 (2026-05-29)**:
  - 마이그레이션 적용 — `settlement_monthly` 에 status / paid_at / paid_by_id / voided_at / voided_by_id / void_reason 컬럼 추가
  - API 추가 — `PATCH /api/admin/settlements/:id/mark-paid` + `PATCH .../mark-voided` (5자 사유 필수)
  - status check constraint: 'calculated' (자동 계산만) / 'paid' (사장님 송금 완료) / 'voided' (사고 정정)
  - paid → 단방향 (voided 후 paid 불가)
- **Phase 2 진행 중**: 어드민 UI (`SettlementList.tsx`) 에 status 컬럼 + "지급완료"/"무효화" 액션 버튼 + 모달
- **사장님 운영 흐름**: 매월 1일 정산 cron → 어드민 정산이력 페이지 → 통장 송금 → "지급완료" 버튼 클릭 → status='paid' + paid_at + paid_by_id 박제
- 선지급(payout_request) 시스템과 동일 패턴으로 통일

### Q8. 사주플랜페이(BillKey) 자동충전 한도
- **현재**: m2net 이 자체 판단으로 자동충전 발동 — 임계값/한도 코드에 안 보임
- **필요한 정보**: m2net 측 임계값, 1회 충전액, 일 누적 한도

### Q9. 알림톡 BizM 정산/환불 템플릿 현황
- 정산 완료 / 선지급 접수/반려/지급 / 환불 — 어느 단계까지 알림톡 발송되는지 확인 필요
- 메모리 `project_alert_system_complete` 와 교차 검증 필요

### Q10. m2net push 실패 시 누가 책임지는가
- chat_room.settle_status='m2net_failed' 10건 발생 (현재 상황)
- 사주플랜이 retry 하는데, 영구 실패 시 m2net 측 책임인지 사주플랜 측 책임인지 명확화 필요

---

## 16. 관련 파일 인덱스

### 비즈니스 로직
- [api/src/shared/m2net/m2net.service.ts](api/src/shared/m2net/m2net.service.ts) — m2net API 연동
- [api/src/user/charge/charge.service.ts](api/src/user/charge/charge.service.ts) — 충전 패키지/결제 준비
- [api/src/pg-callbacks/m2net-push.service.ts](api/src/pg-callbacks/m2net-push.service.ts) — m2net push 콜백 (결제/상담)
- [api/src/admin/payments/payments.service.ts](api/src/admin/payments/payments.service.ts) — 결제 관리 (취소 포함)
- [api/src/admin/refunds/refunds.service.ts](api/src/admin/refunds/refunds.service.ts) — 상담 환불
- [api/src/admin/points/points.service.ts](api/src/admin/points/points.service.ts) — 포인트 어드민 조정
- [api/src/cron/settlement-cron.service.ts](api/src/cron/settlement-cron.service.ts) — 월별 정산
- [api/src/cron/retry-cron.service.ts](api/src/cron/retry-cron.service.ts) — 실패 재시도
- [api/src/cron/health-check.service.ts](api/src/cron/health-check.service.ts) — 무결성 검증
- [api/src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts](api/src/user/counselor-mypage-payout/counselor-mypage-payout.service.ts) — 선지급

### PHP 레거시 (원본 진실)
- [sample/coin/coin_pay_ok.php](sample/coin/coin_pay_ok.php) — 결제 콜백
- [sample/mtonet/auto_pay_result.php](sample/mtonet/auto_pay_result.php) — 자동결제 콜백
- [sample/lib/pay_ag9.php](sample/lib/pay_ag9.php) — 결제 취소
- [sample/cron/month_pay_end.php](sample/cron/month_pay_end.php) — 매월 1일 정산
- [sample/lib/common.lib.php](sample/lib/common.lib.php) — `set_con_account_v2()` 정산 함수

### 도메인 문서
- [PLAN/domain-01-member-point.md](PLAN/domain-01-member-point.md) — 회원/포인트 도메인
- [PLAN/domain-02-payment-order.md](PLAN/domain-02-payment-order.md) — 결제/주문 도메인
- [PLAN/domain-03-counselor-settlement.md](PLAN/domain-03-counselor-settlement.md) — 상담사/정산 도메인
- [PLAN/domain-03b-settlement-flow-trace.md](PLAN/domain-03b-settlement-flow-trace.md) — 정산 흐름 trace
- [PLAN/phase-b-user-charge.md](PLAN/phase-b-user-charge.md) — 충전 phase 계획

---

## 17. 관련 메모리 인덱스

`C:\Users\USER\.claude\projects\c--claudeworkspace-sajumoon\memory\` 하위:

- `project_money_flow_master.md` ← **이 문서를 가리키는 인덱스** (Claude 가 우선 로드)
- `project_payout_system_plan.md` — 선지급 정책 (5%/3.3%/70%/3만)
- `project_pg_m2net_double_fill.md` — 이중 적립 사고 + 안전망
- `project_point_separation_done.md` — paid/free/earning 분리 완료
- `project_grade_system_plan.md` — 등급/단가 시스템
- `project_role_level_cleanup.md` — role/level 이중 진실원
- `project_id_unification_complete.md` — m2net_membid / csrid 분리
- `project_alimtalk_bizm_only.md` — 알림톡은 BizM only
- `project_alert_system_complete.md` — 38이벤트 알림 매트릭스
- `feedback_db_truncate_cascade_disaster.md` — TRUNCATE 사고 (돈 데이터 보호)

---

## 📝 변경 이력

| 날짜 | 변경 | 작성자 |
|---|---|---|
| 2026-05-29 | 최초 작성 (Phase 1) — 코드/문서/메모리 전수 통합 | Claude (사장님 요청) |

> ★ **다음 작업**: §15 미확정 항목 사장님 답변 받아 채우기 → Phase 2 확정
