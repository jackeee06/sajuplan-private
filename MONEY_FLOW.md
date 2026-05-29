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
18. [⭐ 운영 안전망 인프라 (2026-05-29 신설)](#18--운영-안전망-인프라)
19. [📅 변경 이력 상세](#-변경-이력-상세)

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

**돈 송금 사이클 (2026-05-29 사장님 명시)**:
- **m2net → 사주플랜**: 한 달에 **2~3회 송금** (불규칙, m2net 측 정책)
- **사주플랜 → 상담사**: 사장님(관리자) **수작업 계좌이체** (자동 송금 시스템 X)
- 어드민 [지급완료] 버튼 → `settlement_monthly.status='paid'` 박제 (2026-05-29 신설)

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

### 6.6 ★ 2026-05-29 신규 정책 (사장님 자율 결정)

| 항목 | 값 | 위치 |
|---|---|---|
| **신규 상담사 최소 활동 기간** | 14일 (가입 후 14일 이상 경과한 상담사만 정산) | settlement-cron.service.ts `COUNSELOR_MIN_ACTIVE_DAYS` |
| **carry_over_negative 임계값** | 1,000,000원 초과 시 OpsAlert (사장님 카톡) | settlement-cron.service.ts `CARRY_OVER_ALERT_THRESHOLD` |
| **정산 완료 알림톡** | 사장님 [지급완료] 버튼 → 상담사에게 알림톡 (template `settlement_complete`, BizM 등록 대기) | settlements.service.ts `notifySettlementComplete` |
| **지급완료/무효화 마킹** | settlement_monthly.status ('calculated'/'paid'/'voided') + paid_at/paid_by_id | settlement_monthly 컬럼 + 어드민 UI |

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
| **신규 상담사 최소 활동 기간** | 14일 | settlement-cron.service.ts `COUNSELOR_MIN_ACTIVE_DAYS` (2026-05-29 신설) | 가입 14일 미만 상담사 정산 제외 |
| **carry_over 임계값 알림** | 1,000,000원 | settlement-cron.service.ts `CARRY_OVER_ALERT_THRESHOLD` (2026-05-29 신설) | 초과 시 OpsAlert 발송 |

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

### H-6. jackee member.point +200 drift (2026-05-29)
- **증상**: jackee 회원의 member.point=38200, free+paid=38000, 차이 200원
- **원인**: 옛 코드 또는 마이그레이션에서 member.point 만 단독 UPDATE (point 테이블 누락) 흔적
- **수정**: `UPDATE member SET point = free_balance + paid_balance WHERE id=91` (안전한 동기화)
- **검증**: drift 0 확인, C-8 invariant 통과
- **재발 방지**: 모든 코드 경로에서 member.point 변경 시 point 테이블도 같이 갱신 필수 (deductMemberPointInTx 패턴 참고)

### H-7. 테스트 데이터 누적 (2026-05-29)
- **증상 1**: settlement_monthly 14건 (모두 price=0, 5/25 사장님이 정산 cron 테스트 흔적)
- **증상 2**: chat_room.settle_status='m2net_failed' 10건 (5/23 m2net 측 일시 장애 + 짧은 통화)
- **수정**:
  - settlement_monthly 14건 DELETE (화이트리스트 month='2026-04' AND price=0 AND created_at::date='2026-05-25')
  - chat_room 10건 settle_status='dropped' 마킹 (사유 메모 포함)
- **재발 방지**: 운영 시작 후 정산 cron 수동 테스트는 testOnly=true 사용 (실 INSERT 없음)

### H-8. consultation counselor_id NULL 회원 UI 노출 (2026-05-29)
- **증상**: m2net 전화 연결 실패 로그 (amt=0, usetm=0, counselor_id=NULL) 가 회원 마이페이지 "상담 이력" 에 "상담사 0초 0원" 카드로 노출
- **영향**: 사용자 혼란 (홍루연/박기수/사장님 본인 마이페이지에서 보였음)
- **수정**: consult.service.ts `history` 쿼리 WHERE 절에 `AND c.counselor_id IS NOT NULL` 추가
- **운영 흐름**: prod 데이터는 그대로 (감사 추적) + UI 노출만 차단

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

### Q1. m2net → 사주플랜 정산금 송금 사이클 — ✅ 사장님 답 (2026-05-29)
- **m2net → 사주플랜**: 한 달에 **2~3회 정산** 송금 (불규칙)
- **사주플랜 → 상담사**: 사장님(관리자) 수작업 계좌이체 (사주플랜 계좌에서)
- 즉 시스템 자동 송금 X. 사장님이 어드민 정산 결과 보고 통장에서 직접 송금 후 어드민 [지급완료] 버튼 클릭 (오늘 도입된 settlement_monthly status 시스템)
- 송금 금액 산정 기준은 m2net ↔ 사장님 외부 정산 (정확한 산식은 m2net 측 정책, 사주플랜 settlement_monthly 와는 별개 계산)

### Q2. 카드 환불 (실 환불) 운영 절차 — ✅ 사장님 답 (2026-05-29)
- **현재**: 아직 환불 사례 없음 (테스트 단계)
- **운영 시작 시 정책**: 사장님이 **수기 / 오프라인** 처리 예정
- 즉 자동 카드 환불 시스템 도입 안 함. 환불 요청 발생 시:
  1. 사장님이 PG (AG9) 또는 카드사에 직접 연락 → 카드 환불 처리
  2. 사주플랜 어드민 "환불" 버튼 → point 회수만 (이미 구현됨)
  3. 회원에게 별도 안내 (카톡/전화)
- **장기 검토**: 환불 빈도 늘어나면 AG9 API 자동 호출 시스템 추가

### Q3. 정책 상수 한 곳에 모을지
- **현재**: 부가세 10%, 원천징수 3.3%, 회선비 5만/2만 — 코드 하드코딩
- 등급별 정산률 — setting 테이블
- 선지급 정책 — payout.service.ts 상수
- **필요한 결정**: 전부 setting 테이블로 모을지, 현재 분산 유지할지 (코드 안정성 vs 운영 유연성 trade-off)

### Q4. 정산 음수 (carry_over_negative) 무한 누적 시 처리 — ✅ 일부 해결 (2026-05-29)
- **확인 완료**: `settlement-cron.service.ts` L254-286
  - 음수 발생 시 `finalPayoutAmount = 0` cap + `carry_over_negative` 에 박제
  - 다음 달 자동 차감 (prev_carry_over 로 읽음)
  - 회사 임시 메움 정책 (사장님 명시: 회수 X)
- **2026-05-29 추가**: `CARRY_OVER_ALERT_THRESHOLD = 1_000_000` — 음수 100만원 초과 시 OpsAlert 발송 → 사장님 카톡 즉시 알림
  - 사장님이 상담사와 직접 협의 (자격 정지/회수 정책 결정)
- **남은 사장님 결정**: 자격 정지 자동화 룰 도입 여부 (현재는 수동 협의)

### Q5. 첫 정산 시점 정책 (신규 상담사) — ✅ 해결 (2026-05-29)
- **2026-05-29 도입**: `COUNSELOR_MIN_ACTIVE_DAYS = 14` — 가입 후 14일 미만 상담사는 정산 대상에서 제외
- 코드: `settlement-cron.service.ts` 의 `minAgeFilter` (created_at < NOW() - 14일)
- 0 으로 설정하면 룰 비활성 (가입 직후도 포함)
- **목적**: 시스템 악용 방지 + 신규 상담사 검증 기간
- 사장님이 정책 변경 시 상수만 수정 (예: 30일로 늘리기)

### Q6. 선지급 음수 정산 후 상담사 통보 — ✅ 일부 해결 (2026-05-29)
- **현재 동작 (변경 X)**: 상담사에게 직접 알림 안 보냄 (Q4 OpsAlert 가 사장님 카톡으로 감 → 사장님이 상담사와 직접 협의)
- 직접 통보 시스템 미도입 — 알림톡 추가는 사장님 정책 결정 필요

### Q7. 정산 결과 검수 흐름 — ✅ Phase 1 완료 / Phase 2 진행 중 (2026-05-29)
- **Phase 1 완료 (2026-05-29)**:
  - 마이그레이션 적용 — `settlement_monthly` 에 status / paid_at / paid_by_id / voided_at / voided_by_id / void_reason 컬럼 추가
  - API 추가 — `PATCH /api/admin/settlements/:id/mark-paid` + `PATCH .../mark-voided` (5자 사유 필수)
  - status check constraint: 'calculated' (자동 계산만) / 'paid' (사장님 송금 완료) / 'voided' (사고 정정)
  - paid → 단방향 (voided 후 paid 불가)
- **Phase 2 진행 중**: 어드민 UI (`SettlementList.tsx`) 에 status 컬럼 + "지급완료"/"무효화" 액션 버튼 + 모달
- **사장님 운영 흐름**: 매월 1일 정산 cron → 어드민 정산이력 페이지 → 통장 송금 → "지급완료" 버튼 클릭 → status='paid' + paid_at + paid_by_id 박제
- 선지급(payout_request) 시스템과 동일 패턴으로 통일

### Q8. 사주플랜페이(BillKey) 자동충전 한도 — 🟡 사장님 미결정 (2026-05-29)
- **사장님 답**: "새로운 주제 — 생각해본 적 없다"
- **현재 동작**: m2net 측 기본값으로 자동충전 발동 중 (구체 임계값/한도 사주플랜 측에서 모름)
- **사장님 액션 필요 (시간 날 때)**: m2net 담당자에게 현재 설정값 1회 확인
  - 자동충전 발동 잔액 임계값
  - 1회 충전액
  - 일/월 누적 한도
  - 사주플랜 측 회원별 변경 가능 여부
- 받은 답 → MONEY_FLOW Q8 채움 + 정책 안내 페이지 추가

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

## 18. ⭐ 운영 안전망 인프라

운영 시작 전 (2026-05-29) 도입한 안전망 시스템. 사고 발생 시 사장님 즉시 인지 + 복구 가능 + 분쟁 대응.

### 18.1 OpsAlert (운영자 알림)
- **무엇**: 운영 중 사고/실패를 사장님 카톡으로 즉시 발송
- **트리거**: 코드에서 `OpsAlertService.send(category, detail)` 호출
- **prod 설정** (setting 테이블 namespace='ops'):
  - `admin_alert.enabled` = true
  - `admin_alert.recipients` = `01075740572` (사장님 주 폰)
  - `admin_alert.template_code` = `ops_admin_alert_v2`
  - `admin_alert.cooldown_sec` = 300 (같은 카테고리 5분 중복 차단)
- **검증 완료**: 2026-05-29 테스트 발사 → 사장님 카톡 도착 확인
- **현재 사용처**: settlement-cron carry_over -100만 초과 / 정책 위반 / 시스템 사고
- 파일: `api/src/shared/ops-alert/ops-alert.service.ts`

### 18.2 alimtalk_log (발송 흔적 영구 DB 기록)
- **무엇**: BizM 알림톡 모든 발송 (성공/실패) DB 영구 기록
- **신설 마이그레이션**: `20260529000000_alimtalk_log.sql`
- **컬럼**: template_code, phone, vars(jsonb), success, response_code, response_message, error_reason, raw_response, sent_at
- **인덱스 3종**: (phone, sent_at) / (template_code, sent_at) / 실패 partial
- **목적**: 분쟁 시 "보냈다" DB 증거. 감사 추적. 실패 패턴 분석.
- **자동 기록 케이스 7가지**: phone_invalid / template_not_found / dev_mode / parse_error / bizm_rejected / network_error / 정상발송
- 파일: `api/src/user/sms/sms.service.ts` `logToAlimtalkLog`

### 18.3 DB 자동 백업 (매일)
- **스크립트**: `/root/sajumoon_db_backup.sh`
- **주기**: 매일 03:30 (crontab 등록)
- **보관**: 7일 (`find -mtime +7 -delete`)
- **위치**: `/data/backup/db/sajumoon_YYYYMMDD_HHMM.sql.gz`
- **로그**: `/var/log/sajumoon_db_backup.log`
- **검증**: 2026-05-29 즉시 1회 백업 95KB 검증 완료

### 18.4 uploads 자동 백업 (매주)
- **스크립트**: `/root/sajumoon_uploads_backup.sh`
- **주기**: 매주 일요일 04:00 (crontab 등록)
- **보관**: 4주 (28일)
- **위치**: `/data/backup/uploads/uploads_YYYYMMDD.tar.gz`
- **크기**: 약 331MB (uploads 폴더 320MB → 압축률 낮음, 이미지 다수)

### 18.5 settlement_monthly 지급완료 마킹 시스템
- **무엇**: 사장님이 통장 송금 후 "지급완료" 마킹 → 추후 송금 누락 추적 가능
- **신설 마이그레이션**: `20260529010000_settlement_monthly_status.sql`
- **추가 컬럼**: status / paid_at / paid_by_id / voided_at / voided_by_id / void_reason
- **status check constraint**: 'calculated' / 'paid' / 'voided'
- **API**:
  - `PATCH /api/admin/settlements/:id/mark-paid` — 사장님 통장 송금 후 마킹
  - `PATCH /api/admin/settlements/:id/mark-voided` — 사고 정정 (사유 5자+)
- **어드민 UI**: SettlementList 에 status 컬럼 + [지급완료]/[무효화] 버튼 + 모달
- **운영 흐름**: 매월 1일 04:00 cron → settlement_monthly row 생성(status='calculated') → 사장님 어드민에서 결과 확인 → 통장 송금 → [지급완료] 클릭 → status='paid' + 알림톡 발송(settlement_complete)

### 18.6 health-check (매시간)
- **22 invariants** 자동 검사 (C-1~C-20, 돈 관련 + 데이터 무결성)
- **주기**: 매시간 정각 (crontab `0 * * * *`)
- **알림**: 실패 시 OpsAlert (위반 카테고리 + count)
- 파일: `api/src/cron/health-check.service.ts`

### 18.7 crontab 등록 9종 (prod)
```
3 10 * * *           acme.sh (SSL 갱신)
5 0 1 * *            grade/recalculate (매월 1일 0:05)
0 4 1 * *            settlement/monthly (매월 1일 04:00 ★ 정산 시점)
5,15,25,35,45,55 * * * *    retry/chat-settle (10분마다)
0,10,20,30,40,50 * * * *    retry/payment-m2net (10분마다)
0 * * * *            health-check (매시간)
* * * * *            chat/auto-cancel (매분) — STAY 3분 무응답 → 회원+상담사 알림
* * * * *            chat/five-min-alert (매분)
* * * * *            phone/five-min-alert (매분)
30 3 * * *           sajumoon_db_backup.sh (매일 03:30, 2026-05-29 신설)
0 4 * * 0            sajumoon_uploads_backup.sh (매주 일 04:00, 2026-05-29 신설)
```

---

## 📅 변경 이력 상세

### 2026-05-29 — 운영 시작 전 안전망 대규모 작업

#### A. 마스터 문서 신설
- MONEY_FLOW.md (이 문서) — 돈 흐름 전수 정리
- ALERT_MAPPING.md — 37 알림 이벤트 × 코드 × prod 3자 매핑

#### B. 데이터 정리 (테스트 데이터)
- settlement_monthly 14건 DELETE (5/25 테스트 정산 더미)
- chat_room m2net_failed 10건 → settle_status='dropped' (5/23 m2net 일시 장애)
- jackee member.point +200 drift → 38000 동기화

#### C. 알림톡 시스템 정상화 (5건 fix)
| 코드 호출 | 잘못된 prod 매칭 | 수정 후 |
|---|---|---|
| coupon_req2 | (미등록) | coupon_req_v2 |
| order_bankinfo2 | (미등록) | order_bankinfo_v2 |
| qa_ask2 | (미등록) | qa_ask_v2 |
| qa_answer2 | (미등록) | qa_answer_v2 |
| review_for_counselor | (미등록) | review_for_counselor_v2 |

#### D. 신규 마이그레이션 2개
- 20260529000000_alimtalk_log.sql — 발송 흔적 영구 DB 기록
- 20260529010000_settlement_monthly_status.sql — 지급완료 마킹 6 컬럼

#### E. 신규 코드 기능
- consultation `counselor_id IS NOT NULL` UI 필터 (회원 마이페이지 통화실패 로그 차단)
- alimtalk_log 자동 INSERT (sms.service.ts 7케이스)
- settlement_complete 알림톡 발송 (markPaid 직후)
- counselor_auto_absent 알림톡 (autoCancelStaleChats 안에서 상담사에게도 발송 — 사장님 C안 결정)
- settlement-cron 14일 룰 (COUNSELOR_MIN_ACTIVE_DAYS=14)
- settlement-cron carry_over -100만 OpsAlert (CARRY_OVER_ALERT_THRESHOLD=1_000_000)

#### F. 신규 인프라
- DB 자동 백업 (매일 03:30 + 7일 보관)
- uploads 자동 백업 (매주 일 04:00 + 4주 보관)
- OpsAlert recipients 등록 (사장님 폰 010-7574-0572)
- 옛 마이그레이션 7개 git 트래킹 (.gitignore *.sql 우회 -f)

#### G. 사장님 답변 받아 박제 (§15)
- Q1: m2net→사주플랜 월 2~3회 / 사주플랜→상담사 수작업
- Q2: 환불 사장님 수기/오프라인 처리 (자동 환불 도입 안 함)
- Q5: 신규 상담사 14일 룰 도입
- Q6: 음수 정산 시 사장님 카톡 (OpsAlert) 경유 → 상담사 직접 협의
- Q7: 지급완료 마킹 시스템 신설 (status 컬럼 + 어드민 UI)
- Q8: 사장님 미결정 (m2net 추가 문의 예정)

#### H. ALERT_MAPPING 발견/해소
- ✅ #1 counselor_auto_absent — C안 구현 (autoCancelStaleChats 안에 상담사 알림 추가)
- ✅ #2 settlement_complete — 코드 추가 (BizM 등록 후 작동)
- ✅ chat_counseling_v2 — 죽은 템플릿 (사장님 archive 검토 권고)
- ✅ counselor_state_changed_v2 — 부활 (counselor_auto_absent 호출로)

#### I. 검증
- 22 invariants 모두 PASS (정리 후 C-1/C-8/C-17 모두 0)
- E2E prod 53 passed / 0 failed (회귀 없음)
- OpsAlert 테스트 → 사장님 카톡 도착 ✅
- alimtalk_log 테스트 → row INSERT 확인 ✅
- 결제/상담/환불 흐름 누락 0건

### 2026-05-29 이전 작업 (요약)
- 2026-05-23: PG-m2net 이중 적립 안전망 (`correctM2netDoubleFill`)
- 2026-05-22: 포인트 분리 (`point.earning_balance` 컬럼 신설)
- 2026-05-22: ID 단일화 (`m2net_membid` vs `csrid` 컬럼 분리)
- 2026-05-21: 선지급 정책 확정 (5% / 3.3% / 70% / 30,000 / 일1회)
- 2026-05-16: 등급/단가 시스템 도입 (preliminary~partner5)

> ★ **다음 작업**: §15 미해결 Q (Q3/Q8/Q9/Q10) 사장님 답변 + #1 counselor_auto_absent state 전환 정책 m2net 협의
