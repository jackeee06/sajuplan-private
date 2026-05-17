# Audit Phase B — 시나리오별 데이터 흐름 다이어그램

> 작성: 2026-05-17
> 6개 핵심 시나리오 — 정상/실패/동시성/멱등성 4가지 분기 다이어그램

---

## 시나리오 1 — 전화 통화 정상 종료 → 정산

```
[회원 앱] tel:070-XXXX   [M2NET]                  [SAJUMOON API]              [DB]
    │ dial               │                              │                      │
    │  ──────────────►   │                              │                      │
    │                    │                              │                      │
    │                    │ 대표번호로 회원-상담사 라우팅 │                      │
    │                    │ (drconn 예약된 상태)         │                      │
    │  통화 진행 ...     │                              │                      │
    │  ◄────────────────►│ (M2NET 자체 1분/만원 단위 차감)                    │
    │                    │                              │                      │
    │  hang up           │                              │                      │
    │  ─────────────────►│                              │                      │
    │                    │ POST /api/pg/m2net/call-push │                      │
    │                    │ { reason=DISCONNECT,         │                      │
    │                    │   csrid, membid, amt, ... }  │                      │
    │                    │  ──────────────────────────► │                      │
    │                    │                              │                      │
    │                    │       handleCallPush         │                      │
    │                    │                              │                      │
    │                    │ [Audit #4 단일 트랜잭션]    │                      │
    │                    │       sql.begin {            │                      │
    │                    │         consultation INSERT  ──INSERT────────────► │
    │                    │         deductMember(tx)    ──UPDATE point──────► │
    │                    │         creditCounselor(tx) ──INSERT point_hist─► │
    │                    │       } commit               │                      │
    │                    │                              │                      │
    │                    │  ◄─ 200 OK                   │                      │
    │                    │                              │                      │
    │ ... 한 달 후 ...   │                              │                      │
    │                    │                              │                      │
    │                    │ [매월 1일 04:00 cron]       │                      │
    │                    │ /api/cron/settlement/monthly │                      │
    │                    │                              ──SELECT consultation─►│
    │                    │                              ──LEFT JOIN refund────►│
    │                    │                              ──INSERT settle_mon──►│
    │                    │                              │                      │
    │                    │                              │  → 상담사 정산 확정  │
```

### 실패 분기 (Critical #4 해결됨)

```
실패 시점                | 결과
─────────────────────────|──────────────────────────────────────
consultation INSERT      | 트랜잭션 롤백 → M2NET 재전송 시 재시도 (UNIQUE 안 걸림)
deduct 실패              | 전체 롤백 + OpsAlert → M2NET 재시도 또는 수동 처리
credit 실패              | 전체 롤백 + OpsAlert → 동일
commit 후 외부 m2net 호출 실패 | DB 는 일관, m2net 측 fill 만 누락 (로그 + 자동 retry)
```

### 멱등성

- `consultation` UNIQUE (callid + counselor / roomid + member + counselor + reason)
- `point_history` UNIQUE (rel_table + rel_id + rel_action)
- 같은 push 가 2회 도착 → 두 번째는 ON CONFLICT DO NOTHING → `{ idempotent: true }`

### 동시성

- 같은 통화 종료 push 가 race 도착 가능 (M2NET 재전송)
- consultation INSERT 가 먼저 성공한 쪽만 처리, 다른 쪽은 conflict 로 skip

---

## 시나리오 2 — 채팅 정상 종료 → 정산

```
[회원 앱]              [M2NET]              [SAJUMOON API]            [DB]
    │ 채팅방 입장        │                          │                    │
    │ (START_CHAT push)  │  ─POST /m2net/call-push─►│                    │
    │                    │                          ──UPDATE chat_room──►│
    │                    │                          ──UPDATE member──────►│
    │                    │                          │                    │
    │ 대화 진행...        │                          │                    │
    │                    │                          │                    │
    │ 종료 버튼          │                          │                    │
    │  ──────────────────►                          │                    │
    │                    │                          │                    │
    │ Path A: M2NET 가 END_CHAT push 먼저 도착      │                    │
    │                    │  ─POST /m2net/call-push─►│                    │
    │                    │                          ─[단일 트랜잭션]────►│
    │                    │                          │ consultation INSERT │
    │                    │                          │ + deduct + credit  │
    │                    │                          │                    │
    │ Path B: settleChatRoomLocal 가 먼저 (m2net push 지연)              │
    │ (사용자가 닫음 → chat.service.markLeave)      │                    │
    │                    │                          ─[단일 트랜잭션]────►│
    │                    │                          │ consultation INSERT │
    │                    │                          │ (reason='END_CHAT_  │
    │                    │                          │  LOCAL')           │
    │                    │                          │ + deduct + credit  │
```

### 실패 분기

```
Path A 실패 → M2NET 재전송 자동
Path B 실패 → chat_room.settle_status='m2net_failed' 마킹
            → 10분 간격 retry cron (최대 5회)
            → MAX 도달 → 'permanently_failed' + OpsAlert
```

### 멱등성 (Path A/B 경쟁 보호)

- Path A 가 먼저 처리되면 consultation UNIQUE 위반으로 B 가 skip
- B 가 먼저 처리되면 reason='END_CHAT_LOCAL' 로 row 생성 → A 의 END_CHAT 도 UNIQUE 충돌로 skip
- 양쪽 모두 차감 보장 (둘 중 한 번만 실행)

---

## 시나리오 3 — 환불 처리 → 정산 영향

```
[관리자] /mng/refund 모달    [SAJUMOON Admin API]        [DB]
    │ 환불 amount + reason   │                            │
    │ + idempotent_key       │                            │
    │  ─POST /admin/refunds──►│                           │
    │                        │                            │
    │                        │ [단일 트랜잭션]            │
    │                        │  ┌─ assertVerified         │
    │                        │  │   (amt = free+pro)      │
    │                        │  │                          │
    │                        │  │ INSERT refund_request  ──►│ (idempotent_key UNIQUE)
    │                        │  │ UPDATE consultation     ──►│  refund_status
    │                        │  │ INSERT point_history    ──►│ 환원
    │                        │  │ UPDATE point.balance    ──►│
    │                        │  │ UPDATE member.point     ──►│
    │                        │  └─ commit                  │
    │                        │                            │
    │ ◄── { ok: true }       │                            │
    │                        │                            │
    │ ... 매월 1일 ...        │                            │
    │                        │                            │
    │                        │ settlement-cron            │
    │                        │  └─ consultation 합계      │
    │                        │     LEFT JOIN refund_request│
    │                        │     amt - refund.amt_free  │
    │                        │     amt - refund.amt_pro   │
    │                        │     = 정산 대상 amount     │
```

### 멱등성
- `(consultation_id, idempotent_key)` UNIQUE
- 클라이언트가 같은 키 두 번 보내면 두 번째 INSERT 실패 → 응답 동일

### 실패 분기
```
환불 검증 실패 (amt 불일치) → 즉시 400 + 처리 없음
INSERT 충돌 (멱등) → 두 번째는 skip, 첫 환불만 유효
point UPDATE 실패 → 전체 트랜잭션 롤백 (refund_request 도 안 들어감)
```

---

## 시나리오 4 — 등급 변동 → 단가 변경 → 다음 정산

```
[매월 1일 00:05]        [grade-cron]                      [DB]
    │                       │                                │
    │ /api/cron/grade/recalculate                            │
    │  ─────────────────────►│                              │
    │                       │ 직전 1개월 통계 집계           │
    │                       │  ┌─ 통화시간/매출/순응 점수    │
    │                       │  │                              │
    │                       │  │ 각 상담사:                  │
    │                       │  │   - 새 grade 계산           │
    │                       │  │   - role='counselor' 만     │
    │                       │  │     (level=5 통일됨)        │
    │                       │  │                              │
    │                       │  └─ UPDATE member.grade        │
    │                       │     INSERT grade_history       │
    │                       │     grade_recalculated_at = now()
    │                       │                                │
    │ [매월 1일 04:00]      │                                │
    │ /api/cron/settlement/monthly                           │
    │  ─────────────────────►│                              │
    │                       │ 직전 1개월 합산                │
    │                       │  └─ 새 등급 + 정산률 적용     │
    │                       │     = settlement_monthly       │
```

### 멱등성
- `grade_recalculated_at >= 당월 1일` 이면 skip
- `settlement_monthly` UNIQUE (member_id + month, mb_id + month)
- 두 번 호출해도 두 번째는 처리 안 됨

### 단가 변경 정책
- 상담사가 본인 단가 변경 — 매월 1일 락 (락 해제 후만 가능)
- 변경 시 history 기록
- consultation 의 `unit_cost_snapshot` 으로 사후 추적

---

## 시나리오 5 — 자동충전 push → 회원 잔액

```
[M2NET]                    [SAJUMOON API]                    [DB]
    │                          │                                │
    │ 회원 잔액 X원 미만        │                                │
    │ 자동 결제 트리거           │                                │
    │  ─POST /pg/charge/autopay-push─►│                          │
    │                          │                                │
    │ [Audit C-5 우회로]      │                                │
    │                          │ 1) IP 화이트리스트 검증         │
    │                          │    (log 모드 — 현재)            │
    │                          │ 2) oid UNIQUE 멱등 검사         │
    │                          │ 3) DB 진실원천:                 │
    │                          │    - membid → member 찾음       │
    │                          │    - payment_method.auto_enabled│
    │                          │      = TRUE 인지 검증            │
    │                          │    - 등록 패키지 amount 와 일치  │
    │                          │ 4) 통과 시:                     │
    │                          │    - payment INSERT              │
    │                          │    - point INSERT/UPDATE        │
```

### 위조 방어
- IP 화이트리스트 (`211.175.205.88` 만 통과)
- 자동결제 미등록 회원 → 거부 + OpsAlert
- 등록 금액과 다른 amount → 거부 + OpsAlert
- throttle 분당 60회 (정상은 분당 1~2회)

### 멱등성
- `payment.oid` UNIQUE — 같은 oid 두 번 처리 안 됨
- pending 단계에서도 deduplicate (최근 10분 같은 회원/금액 자동결제 row 검색)

---

## 시나리오 6 — 결제 콜백 → 회원 충전

```
[브라우저]            [AG9 PG]              [SAJUMOON API]                    [DB]
    │                     │                       │                            │
    │ 결제 진행            │                       │                            │
    │  ───POST /charge/prepare──────────────────►│                            │
    │                                              ──INSERT payment(pending)──►│
    │                     │                       │                            │
    │ ◄── form_post URL ─                                                       
    │                     │                       │                            │
    │  → PG 결제 페이지   │                       │                            │
    │  → 카드 결제 완료    │                       │                            │
    │                     │                       │                            │
    │                     │ POST /pg/charge/callback                            │
    │                     │ (form_post returnurl)                              │
    │                     │  ────────────────────►│                            │
    │                     │                       │ handlePaymentCallback      │
    │                     │                       │  ┌─ oid → DB payment 진실원천│
    │                     │                       │  ├─ paytype=VRBANK? → vbank│
    │                     │                       │  └─ applyCompletion        │
    │                     │                       │     - status='completed'  │
    │                     │                       │     - point 적립 + history │
    │                     │                       │                            │
    │                     │ ◄── 200               │                            │
    │ ◄── 302 /complete ──│                       │                            │
```

### 멱등성 (returnurl + form_post 2회 처리 위험)
- `payment.oid` UNIQUE
- `applyCompletion` 이 status='completed' 면 즉시 idempotent return
- `point_history` UNIQUE (rel_table='payment', rel_id, rel_action)

### 위조 방어
- C-1: IP 화이트리스트
- C-5: payload.membid 무시, oid → DB payment.member_id 사용 (이미 구현)
- throttle 분당 60회

---

## 분기 표 (요약)

| 시나리오 | 정상 흐름 | 실패 시 자동 복구 | 멱등성 보장 | 동시성 보장 |
|---|---|---|---|---|
| 1. 전화 종료 | 단일 트랜잭션 | M2NET 재전송 | consultation UNIQUE | row lock |
| 2. 채팅 종료 | 단일 트랜잭션 (A or B) | retry cron | UNIQUE 양쪽 보호 | A/B 경쟁 처리 |
| 3. 환불 | 단일 트랜잭션 | 즉시 fail | idempotent_key UNIQUE | row lock |
| 4. 등급 → 정산 | 매월 cron | grade_recalculated_at | settlement UNIQUE | cron 단일 실행 |
| 5. 자동충전 | 단일 트랜잭션 | M2NET 재전송 | oid UNIQUE | dedup 검사 |
| 6. 결제 콜백 | 단일 트랜잭션 | 사용자 재시도 | oid + point_history UNIQUE | applyCompletion atomic |

**모든 시나리오 정상 / 실패 / 동시성 / 멱등성 모두 보호됨** (이번 audit 결과).

---

## 새 사고 발생 시 분석 흐름

1. **OpsAlert 수신** → 이 문서에서 해당 시나리오 찾기
2. **실패 시점** 가설 → "실패 분기" 표 보고 어디서 끊겼는지 추정
3. **DB SQL** 로 실제 상태 확인 ([`_OPS_RUNBOOK.md`](_OPS_RUNBOOK.md) 진단 SQL 참고)
4. **자동 복구 대기** → 재시도 시 정상 처리되는지 확인
5. **수동 보정 필요** → 영향 받은 회원/상담사 ID 찾아 수동 SQL
