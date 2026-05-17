# 사주문 정밀 감사 종합 보고서

> 작성: 2026-05-17
> Phase A~H 다단계 감사 누적 결과 + 적용된 수정 인덱스

---

## 진행 요약

| Phase | 내용 | 상태 |
|---|---|---|
| **A** | 정밀 코드 리뷰 (3 agents 병렬) | ✅ 완료 |
| **B** | 시나리오 추적 다이어그램 | ⏸️ 미진행 |
| **C** | DB 일관성 SQL 검사 | ✅ 완료 |
| **D** | 외부 의존성 실패 처리 | 부분 (A/C 일부 포함) |
| **E** | 보안/권한 검증 | ✅ 완료 (Critical 6 + Warning 9 + Info 3 → 별도 세션) |
| **F** | 운영 안전망 점검 | 부분 (OpsAlert 적용으로 일부 해소) |
| **G** | 자동 일관성 점검 스크립트 | ✅ 완료 |
| **H** | 문서화 (이 문서) | ✅ 완료 |

---

## A 그룹 — Quick Fix (Critical 4건)

각 30분~1시간 분량, 회귀 위험 최소.

| # | 위치 | 문제 | 수정 | 커밋 |
|---|---|---|---|---|
| 1 | settlement-cron rate 검증 | decimal 35 저장 시 ×100 후 3500% 적용 → 회사 손실 | rate 범위 0~1 강제, 위반 시 throw | `9b2aaf6e` |
| 2 | settlement_monthly 멱등성 | OR 조건이 잘못된 row 매칭 → 중복 INSERT | OR → AND + DB UNIQUE 제약 2종 | `9b2aaf6e` |
| 7 | refunds amt 정합성 | `amt_free + amt_pro ≠ amt` 깨진 데이터에서 비율 잘못 | 트랜잭션 진입 시 검증 추가 | `9b2aaf6e` |
| 11 | 상담사 적립 OpsAlert | 차감 실패는 알림 있지만 적립 실패는 logger.error 만 | catch 블록 2곳에 OpsAlert.send 추가 | `9b2aaf6e` |

## B 그룹 — Surgical Patch (Critical 4건)

각 2~3시간 분량, 코드 + 마이그레이션.

| # | 위치 | 문제 | 수정 | 커밋 |
|---|---|---|---|---|
| 3 | consultation 중복 INSERT | M2NET push race 시 같은 row 2개 | partial UNIQUE 2종 + ON CONFLICT DO NOTHING | `1e68f51b` |
| 5 | point.free_balance race | FOR UPDATE 없이 SELECT → 오버카운팅 | deductMemberPoint 내부 FOR UPDATE 후 actualFree/Pro 재계산 | `1e68f51b` |
| 8 | refund 멱등성 | HTTP 재전송 시 중복 환원 가능 | idempotent_key 컬럼 + UNIQUE + 프론트 자동 생성 | `1e68f51b` |
| 12 | 부동소수점 정산 검증 | floor 누적 손실 사후 추적 어려움 | 산식 후 anomaly (음수, 과다) 검사 + logger.error | `1e68f51b` |

## C 그룹 — 대규모 변경 (Critical 4건)

각 3~6시간 분량.

| # | 위치 | 문제 | 수정 | 커밋 |
|---|---|---|---|---|
| 6 | settlement 환불 차감 SQL | refunded_amount 만으로 추정 차감 → 분배 부정확 | refund_request 직접 LEFT JOIN, amount_free/pro 사용 | `dea87861` |
| 9 | settleChatRoomLocal M2NET 실패 | 차감 skip → 수익 손실 | chat_room.settle_status 마킹 + retry cron | `eeac2003` |
| 10 | applyCompletion M2NET sync | 동기화 실패 시 DB/m2net 불일치 | payment.m2net_retry_count + retry cron | `eeac2003` |
| **4** | M2NET 콜백 트랜잭션 분산 | consultation + deduct + credit 별도 → 부분 실패 시 불일치 | **⏸️ 별도 세션** ([`_NEXT_SESSION_AUDIT_CRITICAL4.md`](_NEXT_SESSION_AUDIT_CRITICAL4.md)) | — |

---

## DB 마이그레이션 누적

| 항목 | 어디 | 무엇 |
|---|---|---|
| settlement_monthly UNIQUE 2종 | `tools/_migrate_settlement_unique.py` | (member_id, month) / (mb_id, month) |
| consultation UNIQUE 2종 | `tools/_migrate_audit_b.py` | (callid+counselor) / (roomid+member+counselor+reason) |
| refund_request.idempotent_key | `tools/_migrate_audit_b.py` | 컬럼 + (consultation_id, idempotent_key) UNIQUE |
| chat_room.settle_* | `tools/_migrate_audit_c9_c10.py` | settle_status, retry_count, last_retry_at, failure_reason + 인덱스 |
| payment.m2net_retry_* | `tools/_migrate_audit_c9_c10.py` | retry_count, last_retry_at + 인덱스 |

---

## crontab 양 서버 (총 5개)

```
3 13 * * *  acme.sh           — SSL 갱신 (기존)
5 0 1 * *   grade/recalculate — 월 1일 등급 재산정
0 4 1 * *   settlement/monthly — 월 1일 정산
5,15,..,55 * * * * retry/chat-settle  — 채팅 정산 재시도 (10분)
0,10,..,50 * * * * retry/payment-m2net — M2NET 적립 재시도 (10분)
0 * * * *   health-check       — DB 일관성 점검 (매시간)
```

---

## DB 일관성 health-check (Phase G)

17 invariants 자동 점검 + Critical 위반 시 OpsAlert.

| ID | 검사 | 심각도 |
|---|---|---|
| C-1 | 음수 포인트 잔액 | 🔴 |
| C-2 | member.point 음수 | 🔴 |
| C-3 | consultation amt 불일치 | 🔴 |
| C-4 | 환불금액 > 결제금액 | 🔴 |
| C-5 | refund 합 > 결제금액 | 🔴 |
| C-6 | refund free/pro 합 불일치 | 🟡 |
| C-7 | orphan refund_request | 🟡 |
| C-8 | member.point drift | 🟡 |
| C-9 | settlement 중복 | 🔴 |
| C-10 | usetm 비현실적 | 🟡 |
| C-12 | 등급 임계값 역전 | 🔴 |
| C-13 | 정산률 범위 외 | 🔴 |
| C-15 | refund_status='full' 불일치 | 🟡 |
| C-16 | M2NET 결제 적립 retry 대기 | 🟡 (>10 시 🔴) |
| C-17 | 채팅 정산 retry 대기 | 🟡 (>10 시 🔴) |

**현재 상태 (배포 직후)**:
- test: 위반 0건
- prod: 위반 1건 (C-8 Warning, mb_id=ubuub1234, 100원 drift) — 운영자 결정 대기

---

## ✅ 후속 점검 — settleChatRoomLocal + health-check 보완 (2026-05-17 완료)

### settleChatRoomLocal 단일 트랜잭션 통합 ([Audit #4-B])
Critical #4 의 handleCallPush 와 동일 패턴 적용:
- 기존: consultation INSERT + deduct + credit + chat_room.settle_status = 4개 별도 트랜잭션
- 신규: 단일 `sql.begin()` 트랜잭션. 실패 시 전체 롤백 + retry cron 재시도 + OpsAlert
- 양 서버 빌드+reload 성공

### health-check C-11, C-14 추가
이전엔 "17 invariants" 라고 명시했으나 실제 15개. 누락 분 보완:
- **C-11**: settlement_monthly.price 음수 (환불 많아 음수 정산 알림용, Warning)
- **C-14**: point.free_balance > total_earned (사기성 데이터, Warning)
- 양 서버 17 invariants 모두 활성 확인 (violations: 1 = known C-8 drift)

## ✅ Critical #4 — M2NET 콜백 트랜잭션 통합 (2026-05-17 완료)

📄 [`_NEXT_SESSION_AUDIT_CRITICAL4.md`](_NEXT_SESSION_AUDIT_CRITICAL4.md) — 분석 자료

**적용 내용** (옵션 1, 단일 트랜잭션):
- `deductMemberPointInTx(tx, ...)` / `creditCounselorPointInTx(tx, ...)` 신규 분리 (DB 부분만)
- `deductMemberPoint` / `creditCounselorPoint` 는 wrapper 로 유지 — `settleChatRoomLocal` 호환
- `handleCallPush` 의 consultation INSERT + deduct + credit → 단일 `sql.begin` 트랜잭션으로 통합
- 트랜잭션 실패 시 전체 롤백 + OpsAlert 발송 (`M2NET 콜백 트랜잭션 실패 (전체 롤백)`)
- M2NET 재전송 시 자동 재시도 가능 (consultation 도 롤백되어 UNIQUE 안 걸림)

**배포 결과**:
- test, prod 양 서버 빌드 + reload 성공
- 배포 후 state-push 5건 연속 정상 처리 확인 (IP=211.175.205.88, 에러 0)
- `handleCallPush` 통합 로직은 다음 call-push 도착 시 실전 검증

**Audit Critical 12건 모두 처리 완료** 🎉

### Phase E — 보안/권한 (자율 처리 + 별도 세션)

📄 [`_NEXT_SESSION_SECURITY.md`](_NEXT_SESSION_SECURITY.md)

**자율 처리 완료 (15건 + false positive 3건)**:
- C-1: PG/M2NET 콜백 인증 — **IP 화이트리스트 (log)** + throttle + OpsAlert. 5일치 12,000+ 콜백 분석으로 `211.175.205.88` 단일 IP 자체 검증, trust proxy + X-Real-IP 적용 완료
- C-2: Admin 가드 — false positive (29개 모두 적용)
- C-3: admin list phone 마스킹 (고객 + 상담사)
- C-4: cron 토큰 헤더 전환 + 양 서버 crontab 5건 마이그레이션 + 검증
- C-5: 결제 콜백 membid 위조 **우회로** — autopay-push 시 payment_method.auto_enabled + 패키지 금액 교차 검증 + OpsAlert
- C-6: counselorId NaN/음수 검증
- W-1: 단가 분당 10만원 hard cap
- W-2: points page 10,000 hard cap
- W-3: 날짜 round-trip 검증 + KST 시차 버그 수정
- W-4: admin updateCustomer phone/password 타입 강제
- W-5: CORS — false positive (단일 origin)
- W-6 + I-1: Rate limit default 1M → 1200/분, login → 20/분
- W-7: packageId — false positive (DTO + service)
- W-9: settlement rollback OpsAlert 3단 알림
- I-2: 파일 업로드 MIME 화이트리스트
- I-3: 은행 계좌 — false positive (list 이미 제외, 단건은 편집용)

**남은 별도 세션 (Warning 1)**:
- W-8 (SMS 재검증) — 운영자 UX 결정 필요

**PG/M2NET 매뉴얼 도착 시 추가**: IP 화이트리스트 + HMAC 서명 (defense in depth)

### Phase B/D/F (선택)

- **Phase B**: 시나리오별 데이터 흐름 다이어그램
- **Phase D**: 외부 의존성 (M2NET/AG9/BizM) 실패 시나리오 — 일부 A/C 에서 다룸
- **Phase F**: 운영 안전망 (로깅/롤백/백업) — OpsAlert 적용으로 일부 해소

이들은 우선순위 낮음. 핵심 12 Critical 중 11 처리 완료.

---

## 운영 권장사항

### 매일/매시간
- `/api/cron/health-check` 자동 실행 (이미 crontab 등록)
- Critical 위반 시 OpsAlert 도착 → 즉시 점검
- Warning 누적 (예: C-16 retry pending >10) → 수동 점검

### 매월 1일
- 등급 재산정 → 정산 → 결과 검토
- 상담사별 정산액 분쟁 발생 시 [`/mng/grade/counselor/:id`](web/mng/src/pages/CounselorGradeDetail.tsx) 에서 이력 추적

### 분기별
- C-8 (member.point drift) 같은 누적 drift 보정 후 재점검
- 정책 변경 이력 (`setting_history`) 검토
- 오랜 retry 누적 항목 (Max retry 도달) 수동 정리

---

## 부록 — 모든 OpsAlert 발송 위치

| 카테고리 | 위치 | 트리거 |
|---|---|---|
| 크론 실패 | `cron.controller.ts` | grade/settlement cron 예외 |
| M2NET 회원 차감 실패 | `m2net-push.service.ts:340-365` | handleCallPush deduct 예외 |
| M2NET 상담사 적립 실패 | `m2net-push.service.ts:381-401` | handleCallPush credit 예외 |
| M2NET 채팅 회원 차감 실패 | `m2net-push.service.ts:settleChatRoomLocal` | 채팅 정산 deduct 예외 |
| M2NET 채팅 상담사 적립 실패 | 동일 위치 | 채팅 정산 credit 예외 |
| 자동충전 실패 | `pg-callback.controller.ts` | autopay-push 예외 |
| 회원 잔액 부족 | `m2net-push.service.ts:865-869` | deductMemberPoint 실제 차감 < 요청 |
| 가상계좌 적립 실패 | `charge.service.ts:vbank` | m2net.addMemberCoin 실패 |
| 카드/간편결제 적립 실패 | `charge.service.ts:applyCompletion` | 동일 |
| 채팅 정산 영구 실패 | `retry-cron.service.ts` | MAX_RETRY 도달 |
| M2NET 결제 영구 실패 | 동일 | 동일 |
| DB 일관성 Critical 위반 | `health-check.service.ts` | 매시간 자동 |

---

## 커밋 인덱스 (정밀 감사 관련)

| 커밋 | 내용 |
|---|---|
| `9b2aaf6e` | Audit A — Critical 4건 quick fix |
| `1e68f51b` | Audit B — Critical 4건 surgical patch |
| `dea87861` | Audit C-#6 — 정산 환불 차감 SQL 재작성 |
| `eeac2003` | Audit C-#9, #10 — retry queue 인프라 |
| `b48eace7` | Phase G — health-check 자동화 |

---

## 결론

**Critical 11/12 처리 완료** (A/B/C 그룹). 남은 #4 (M2NET 콜백 트랜잭션) 는 별도 세션 권장.

**Phase E 보안 감사 별도 발견** — Critical 6건 추가 (PG/M2NET 콜백 인증 누락이 가장 위험). [`_NEXT_SESSION_SECURITY.md`](_NEXT_SESSION_SECURITY.md) 참고.

자동화 인프라:
- 매시간 DB 일관성 점검 → 위반 시 OpsAlert
- 10분마다 실패한 정산/적립 재시도
- 매월 1일 등급/정산 자동 실행

오픈 후 첫 1~2주는 OpsAlert 채널 + `/api/cron/health-check` 응답을 매일 점검 권장.
