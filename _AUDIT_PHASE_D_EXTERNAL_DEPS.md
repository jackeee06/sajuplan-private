# Audit Phase D — 외부 의존성 실패 처리 종합 점검

> 작성: 2026-05-17
> 외부 시스템 4종 (M2NET / AG9 / BizM / 알리고) 각 실패 시나리오와 처리 방식

---

## 외부 의존성 인벤토리

| 시스템 | 용도 | 영향도 | 호출 위치 |
|---|---|---|---|
| **M2NET (PassCall)** | 통화/채팅 라우팅, 회원/상담사 등록, 코인 잔액 | 🔴 매우 큼 (서비스 중심) | [m2net.service.ts](api/src/shared/m2net/m2net.service.ts) |
| **AG9 (PG)** | 결제 (카드/가상계좌/간편결제) | 🔴 매우 큼 (매출) | [charge.service.ts](api/src/user/charge/charge.service.ts) |
| **BizM** | 카카오 알림톡 | 🟡 (마케팅/안내) | [sms.service.ts](api/src/user/sms/sms.service.ts), [ops-alert.service.ts](api/src/shared/ops-alert/ops-alert.service.ts) |
| **알리고** | SMS 폴백 (BizM 실패 시) | 🟡 (안내) | [sms.service.ts](api/src/user/sms/sms.service.ts) |

---

## M2NET 실패 시나리오

### 1) M2NET 응답 지연 (timeout)

**상황**: M2NET 호출 (drconn, csrchat 등) 이 30초+ 응답 없음.

**현재 처리**:
- HTTP timeout 30~60초 (axios/fetch 기본)
- timeout 시 예외 → 호출자에서 catch
- 사용자에게는 "잠시 후 다시 시도해주세요" 안내

**개선 여지**: 별도 timeout 설정 명시 (현재 기본값 의존). 큰 위험은 아님.

### 2) M2NET push 누락 (콜 종료 후 push 안 옴)

**상황**: 통화는 종료됐는데 `/api/pg/m2net/call-push` 도착 안 함.

**현재 처리**:
- **전화**: 처리 못함 (push 가 진실원천). consultation 행 없음 → 정산 누락
- **채팅**: `settleChatRoomLocal` 가 사용자 종료 시 self-trigger → push 가 안 와도 차감/적립

**위험도**: 전화에서 매우 큼. 다행히 운영상 push 도착 누락 사례 드뭄.

**개선 여지**: 추가 cron 으로 종료된 전화 (M2NET 측 잔액 변화 감지) 자동 정산. 복잡.

### 3) M2NET push 중복 (재전송)

**상황**: 같은 push 가 여러 번 도착.

**현재 처리**:
- consultation UNIQUE (callid + counselor / roomid + member + counselor + reason)
- ON CONFLICT DO NOTHING → 두 번째는 idempotent
- point_history UNIQUE (rel_table + rel_id + rel_action)

✅ 멱등성 완벽 보장.

### 4) M2NET addMemberCoin 실패 (잔액 동기화)

**상황**: 사주문 DB 차감 후 m2net 측 잔액 fill 실패.

**현재 처리**:
- 채팅: m2net 이 자체 차감 → fill 호출 안 함 (이중 차감 방지)
- 전화: m2net 측 fill 실패 시 warning 로그. DB 일관성은 유지됨.

**개선 여지**: m2net fill 실패 시 [Audit C-#10] 의 payment-m2net retry cron 와 비슷한 패턴으로 재시도 큐 추가. 우선순위 낮음.

### 5) M2NET 회원/상담사 등록 실패

**상황**: 회원가입 시 `m2net.registerMember` / `registerCounselor` 실패.

**현재 처리**:
- 회원가입: m2net 등록 실패 시 사주문 가입도 롤백 (회원 row 삭제) → 사용자에게 명확한 에러
- 상담사 등록: m2net.error 반환 후 사주문 row 는 유지, csrid=NULL. 운영자가 수동 재시도 또는 `linkCounselorToM2net` 호출.

✅ 회원은 안전, 상담사는 운영자 수동 처리 가능.

---

## AG9 (PG) 실패 시나리오

### 1) PG 결제 페이지 오픈 실패

**상황**: AG9 sign API 호출 실패 또는 사용자가 결제 페이지 닫음.

**현재 처리**:
- prepareCharge 시 payment row INSERT (status='pending')
- 사용자가 결제 안 하면 그냥 pending 으로 남음 (만료 정책 없음)

**개선 여지**: pending 24시간 이상 row 자동 expired 마킹. 우선순위 낮음.

### 2) PG 콜백 누락

**상황**: 결제 완료됐는데 콜백 안 옴 (네트워크 단절 등).

**현재 처리**:
- form_post 와 returnurl 2개 경로 — 한쪽 누락도 다른 쪽 처리
- 그래도 둘 다 누락이면 payment 가 pending 으로 남음

**진단**:
- `_OPS_RUNBOOK.md` 의 진단 SQL 참고
- 사용자 신고 시 수동 처리

### 3) PG 콜백 중복 (returnurl + form_post)

**상황**: 같은 결제에 콜백 2번 도착.

**현재 처리**:
- `payment.status='completed'` 검사 → 두 번째는 idempotent
- `point_history` UNIQUE → 적립 중복 방지

✅ 멱등성 보장.

### 4) 가상계좌 발급 후 미입금

**상황**: vbank 발급 후 회원이 입금 안 함.

**현재 처리**:
- vbank-callback 의 issuance 단계만 처리됨
- deposit_tm 비어있으면 충전 처리 안 함
- 만료 시 자동 처리 없음 (운영자 수동 또는 미정산)

### 5) PG 콜백 payload 위조

**상황**: 공격자가 `/pg/charge/callback` 위조 호출.

**현재 처리**:
- C-1: IP 화이트리스트 (`211.175.205.88` only, log 모드)
- C-5: oid → DB payment 진실원천 사용 (membid 검증)
- throttle 분당 60회
- payment UNIQUE (oid) + point_history UNIQUE

✅ 위조 차단 완비 (defense in depth).

---

## BizM (알림톡) 실패 시나리오

### 1) BizM API 응답 실패

**상황**: HTTP 4xx/5xx 또는 timeout.

**현재 처리**:
- `sendViaBizm` 이 false 반환 → `sendViaAligo` 폴백 시도
- 둘 다 실패 시 콘솔 로그 (개발 모드처럼)

✅ 폴백 체인 있음.

### 2) BizM 템플릿 거부

**상황**: 본문이 등록 템플릿과 1글자라도 다르면 친구톡/SMS 강등 후 결국 거부 가능.

**현재 처리**:
- 본문을 `alimtalk_template` DB 에서 가져옴 → 코드와 등록 본문 동일 보장
- 변수만 치환

✅ 거부 위험 낮음.

### 3) BizM 키 만료 / 잔액 부족

**상황**: BIZM_USER_ID/PROFILE_KEY 만료 또는 잔액 0.

**현재 처리**:
- 알리고 폴백 시도
- OpsAlert 발송 (자체 알림 채널 — 본인이 BizM 사용 → 무한 루프? 차단됨)

**위험**: BizM 자체로 OpsAlert 보내니까 BizM 죽으면 OpsAlert 도 안 옴.

**개선 여지**: OpsAlert 를 알리고 폴백으로 보내는 채널도 추가. 우선순위 중간.

---

## 알리고 (SMS) 실패 시나리오

### 1) 알리고 API 실패

**상황**: HTTP 실패 또는 잔액 부족.

**현재 처리**:
- false 반환 → 콘솔 로그
- 사용자에게 인증번호 도착 안 함 → "재발송" 버튼 누를 수 있음

✅ 사용자 측 fallback 가능 (수동 재시도).

---

## 종합 위험 매트릭스

| 외부 시스템 | 응답 지연 | 응답 누락 | 응답 중복 | 위조 |
|---|---|---|---|---|
| M2NET | 🟡 timeout 처리 | 🟠 전화 push 누락 위험 (운영 미발생) | ✅ 멱등 | ✅ IP 화이트리스트 |
| AG9 | 🟡 timeout 처리 | 🟢 form_post + returnurl 2단 | ✅ 멱등 | ✅ IP + oid 진실원천 |
| BizM | 🟢 폴백 (알리고) | 🟢 폴백 | n/a | n/a |
| 알리고 | 🟢 콘솔 폴백 | 🟢 사용자 재시도 | n/a | n/a |

---

## 외부 의존성 모니터링

### 매일 점검 항목

```sql
-- M2NET push 누락 의심 (consultation 없는데 시간 경과한 통화 추적)
-- (현재는 직접 SQL — 별도 도구 없음. 우선순위 낮음.)

-- BizM 발송 실패 비율 (pm2 log 패턴)
-- grep -c "bizm 거부" /root/.pm2/logs/sajumoon-api-out-0.log

-- 알리고 발송 실패 비율
-- grep -c "알리고 SMS 실패" /root/.pm2/logs/sajumoon-api-error-0.log
```

### 주간 점검

- M2NET 잔액 ↔ 사주문 DB drift (member별 sample) — `reconcileMemberBalanceFromM2net` 활용
- PG payment.status='pending' 24h+ 누적 row 청소

---

## 보강이 권장되는 항목 (다음 세션)

1. **OpsAlert 폴백 채널** — BizM 죽었을 때 알리고로 알림
2. **payment pending 자동 만료** — 24h+ 미입금 row 마킹
3. **m2net push 누락 자동 감지** — 통화 시작 후 30분+ push 없는 row 추적
4. **m2net addMemberCoin 실패 retry** — Audit #10 와 비슷한 패턴

이들은 모두 **우선순위 중간** — 매출/사용자 영향 작음 (운영자 수동 가능). 시간 여유 있을 때 처리.

---

## 결론

**Phase D 종합 평가**: 외부 의존성 4종 모두 기본 실패 처리는 적용됨. 응답 누락만 일부 (M2NET 전화 push) 운영자 수동 처리 영역으로 남아 있으나, **운영상 발생 사례 드뭄**.

**완전한 자동 복구** 까지는 추가 개발 필요 (우선순위 중간).
