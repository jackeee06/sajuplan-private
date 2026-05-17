# 사주문 운영 대응 매뉴얼 (Ops Runbook)

> 작성: 2026-05-17
> 대상: 운영자(jackeee06)
> 목적: OpsAlert 알림 도착 시 즉시 무엇을 할지 — 분석 시간 단축

---

## 알림 수신 채널

- **카카오 알림톡** (BizM 발송) → 사장님 핸드폰
- 발송 위치: `api/src/shared/ops-alert/ops-alert.service.ts`
- 5분 쿨다운 — 같은 alert 폭주 방지

---

## 알림별 즉시 대응

### 🔴 Critical — 즉시 (5분 내) 점검

#### 1. `M2NET 회원 차감 실패` / `M2NET 상담사 적립 실패`

**의미**: 통화/채팅 종료는 됐는데 포인트 이동이 실패. 회원 무료 통화 또는 상담사 미적립.

**즉시 확인**:
```sql
-- 해당 consultation 확인
SELECT * FROM consultation WHERE id = <consultation_id>;
-- 차감/적립 이력 확인
SELECT * FROM point_history WHERE rel_table='consultation' AND rel_id='<consultation_id>';
```

**조치**:
- `point_history` 가 있으면 → 이미 처리됨 (멱등성). 안심.
- 없으면 → 수동 차감/적립 SQL 실행 또는 M2NET 재전송 대기.

#### 2. `M2NET 콜백 트랜잭션 실패 (전체 롤백)`

**의미**: handleCallPush 의 단일 트랜잭션이 통째로 롤백됨. consultation 도 안 만들어짐.

**즉시 확인**:
- pm2 로그에서 해당 callid/roomid 검색: `pm2 logs sajumoon-api | grep <callid>`
- M2NET 이 재전송했는지 5~10분 모니터링 (보통 자동 복구)

**조치**:
- 재전송 후 정상 처리되면 → 끝
- 영구 실패 → SQL 로 수동 INSERT (사례 별로 다름, 코드 분석 필요)

#### 3. `DB 일관성 위반 감지 (Critical)`

**의미**: health-check 가 17 invariants 중 critical 위반 발견. 매시간 자동.

**즉시 확인**:
```bash
# 직접 호출
curl -H "X-Cron-Token: $TOKEN" https://api.sajumoon.co.kr/api/cron/health-check
```

**위반별 조치**:
| ID | 검사 | 조치 |
|---|---|---|
| C-1 | 음수 포인트 잔액 | 즉시 `point` 테이블 직접 점검. 음수 row UPDATE 보정 |
| C-2 | member.point 음수 | 동일. |
| C-3 | consultation amt 불일치 | `amt_free+amt_pro <> amt` 인 row 찾아 보정 |
| C-4/C-5 | 환불 > 결제 | 환불 취소 또는 결제 누락분 추가 |
| C-9 | settlement 중복 | UNIQUE 제약 이미 있으므로 정상이면 안 나옴. 나오면 즉시 신고 |
| C-12 | 등급 임계값 역전 | `setting` 테이블의 grade_thresholds JSON 검토 |
| C-13 | 정산률 범위 외 | `setting` 의 royalty_rate 가 0~1 범위인지 확인 |
| C-18 | role/level 매핑 어긋남 | 매핑 강제: admin=10, counselor=5, user=2 |

#### 4. `정산 롤백 요청` / `정산 롤백 완료`

**의미**: `/api/cron/settlement/rollback` 가 호출됨. 정상 요청이면 OK, 아니면 CRON_TOKEN 누출 의심.

**즉시 확인**:
- 본인이 호출했는지 — 맞으면 무시
- 아니면 → **즉시 .env 의 CRON_TOKEN 회전 + 호출 로그 점검**

#### 5. `자동충전(autopay-push) 처리 실패`

**의미**: M2NET 자동결제 push 처리 중 예외. 회원 충전 누락 또는 중복 차감 위험.

**즉시 확인**:
```sql
-- 해당 oid 의 payment + point_history
SELECT * FROM payment WHERE oid = '<oid>';
SELECT * FROM point_history WHERE rel_table='payment_autopay' AND rel_id='<payment.id>';
```

**조치**: 회원 잔액 / m2net 측 잔액 / 결제 상태 3개 비교 후 수동 보정.

#### 6. `⚠️ autopay-push 위조 의심 (자동결제 미등록)`

**의미**: 자동결제 미등록 회원에게 push 도착. 위조 시도 가능성.

**즉시 확인**:
- 해당 membid (csrid) 의 `payment_method.auto_enabled` 상태
- 만약 진짜 위조면 → IP 확인 후 차단

---

### 🟡 Warning — 24시간 내 점검

#### 7. `채팅 정산 영구 실패` / `M2NET 결제 영구 실패`

**의미**: retry-cron 이 5회 시도해도 실패. `settle_status='permanently_failed'` 마킹됨.

**조치**:
```sql
-- chat-settle 영구 실패 목록
SELECT * FROM chat_room WHERE settle_status = 'permanently_failed';
-- payment-m2net 영구 실패 목록
SELECT * FROM payment WHERE m2net_retry_count >= 5;
```
원인 분석 후 수동 처리 (보통 M2NET 측 데이터 정합 필요).

#### 8. `⚠️ 콜백 비-화이트리스트 IP 도착`

**의미**: callback-ip-allowlist 의 화이트리스트 외 IP 가 콜백 시도.

**조치**:
- 정상 IP 변경이면 → `.env` 의 `CALLBACK_ALLOW_IPS` 에 추가
- 위조 의심이면 → IP 차단 (nginx 단계)

---

## 정기 점검 항목

### 매일 (아침)
- OpsAlert 채널 — 밤 사이 알림 있는지
- health-check API — `curl ... /api/cron/health-check` 응답 확인

### 매주 (월요일)
- pm2 logs 에서 ERROR/WARN 패턴 빈도 점검
- DB 백업 정상 작동 확인 (호스팅사 콘솔)

### 매월 (1일)
- 등급 재산정 결과 (`grade_history`) 검토
- 정산 결과 (`settlement_monthly`) 검토
- C-8 drift 누적 점검 — 발견 시 보정

### 매 분기
- C-8 drift 보정
- 정책 변경 이력 (`setting_history`) 검토
- 오랜 retry 영구 실패 항목 수동 정리

---

## 유용한 진단 SQL

### 회원 포인트 정합성
```sql
-- member.point vs point 테이블 잔액 drift
SELECT m.id, m.mb_id, m.point AS member_point,
       (p.free_balance + p.paid_balance) AS point_total,
       m.point - (p.free_balance + p.paid_balance) AS drift
  FROM member m LEFT JOIN point p ON p.member_id = m.id
 WHERE ABS(m.point - COALESCE(p.free_balance + p.paid_balance, 0)) > 0
 ORDER BY ABS(drift) DESC;
```

### 환불 정합성
```sql
-- 환불 > 결제금액 (있으면 안 됨)
SELECT p.id, p.amount, SUM(rr.amount) AS refund_sum
  FROM payment p
  LEFT JOIN refund_request rr ON rr.payment_id = p.id
 GROUP BY p.id, p.amount
HAVING SUM(rr.amount) > p.amount;
```

### 정산 누락 의심
```sql
-- 종료된 통화인데 point_history 없는 row
SELECT c.id, c.created_at, c.member_id, c.counselor_id, c.amt
  FROM consultation c
 WHERE c.reason IN ('DISCONNECT', 'END_CHAT')
   AND c.amt > 0
   AND NOT EXISTS (
     SELECT 1 FROM point_history ph
      WHERE ph.rel_table='consultation' AND ph.rel_id = c.id::text
        AND ph.member_id = c.member_id
   )
 ORDER BY c.created_at DESC LIMIT 50;
```

### retry 큐 상태
```sql
-- chat-settle 대기
SELECT settle_status, COUNT(*), MAX(settle_retry_count) AS max_retry
  FROM chat_room
 GROUP BY settle_status;
-- payment-m2net 대기
SELECT m2net_retry_count, COUNT(*)
  FROM payment
 WHERE status='completed' AND m2net_retry_count > 0
 GROUP BY m2net_retry_count;
```

---

## 비상 연락처 / 외부 의존성

### AG9 (결제 PG)
- 콜백 발신 IP: `211.175.205.88` (passcall.co.kr 인프라)
- 매뉴얼: PG사 영업담당 보유 (HMAC 서명 적용 시 필요)

### M2NET (통신 인프라)
- 콜백 발신 IP: `211.175.205.88` (동일)
- API: chat-mgr / csr-mgr / drconn 등

### BizM (알림톡)
- 발송 실패 시 사용자/운영자 통지 누락
- API 상태: https://alimtalk-api.bizmsg.kr

### 알리고 (SMS 폴백)
- BizM 실패 시 SMS 대체

---

## 코드 변경 / 배포

### 외과적 패치 (단일 파일)
```bash
SSHPASS=<root비번> python tools/_patch_api.py root@172.235.211.75 /data/wwwroot/api.sajumoon.kr sajumoon-api
SSHPASS=<root비번> python tools/_patch_api.py root@104.64.128.103 /data/wwwroot/api.sajumoon.co.kr sajumoon-api
```

### 전체 배포
```bash
./deploy.sh api both
```

### 롤백
```bash
git revert <commit> && ./deploy.sh api both
```

---

## 마지막 정밀 감사 결과 (2026-05-17)

- Audit Critical 12건 모두 처리 완료
- Phase E 보안 16건 자율 적용 + 3건 false positive
- health-check 18 invariants 활성 (C-1~C-18, 매시간 자동)
- Critical #4 단일 트랜잭션 통합 + settleChatRoomLocal 동일 적용
- IP 화이트리스트 (log 모드, 1주 후 reject 전환 검토)
- crontab 5건 헤더 방식 마이그레이션

자세한 내용은 [`_AUDIT_SUMMARY.md`](_AUDIT_SUMMARY.md), [`_NEXT_SESSION_HANDOVER.md`](_NEXT_SESSION_HANDOVER.md) 참고.
