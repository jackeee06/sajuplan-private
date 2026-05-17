# 사주문 운영 사고 대응 매뉴얼

> 작성: 2026-05-17
> 사용자: 운영자 (사장님 / 위임받은 운영팀)
> 사고 발생 시 이 문서 먼저 참조 → 해당 카테고리로 점프

---

## 0. 알림 채널 확인

모든 사고는 **카카오 알림톡** 으로 운영자(`setting.ops.recipients` 등록 휴대폰)에게 발송됩니다. 매일 카톡 채널 확인 필수.

알림이 안 올 경우: `어드민 → 설정 → 운영알림` 탭에서 수신번호 확인.

---

## 1. OpsAlert 카테고리별 대응

### A. M2NET 콜백 트랜잭션 실패 (전체 롤백)
**알림 내용**: `M2NET 콜백 트랜잭션 실패 (전체 롤백)` + callid/roomid/memberId/counselorId/amt/reason
**의미**: 통화/채팅 종료 push 처리 중 DB 트랜잭션 실패 → 자동 롤백됨

**대응**:
1. M2NET 이 재전송 시 자동 복구되는지 5분 후 동일 callid 알림이 또 오는지 확인
2. **재전송 후 정상 처리되면**: 자동 복구. 추가 조치 없음.
3. **30분 후에도 알림 계속 오면**:
   ```sql
   -- 같은 callid 로 처리 시도된 흔적 확인
   SELECT * FROM consultation_log WHERE message LIKE '%${callid}%' ORDER BY id DESC LIMIT 5;
   SELECT * FROM consultation WHERE callid = '${callid}';
   ```
4. 패턴 발견 시 (DB connection pool 부족 등) → 운영팀 / 개발자 연락

---

### B. M2NET 회원 차감 실패 / 상담사 적립 실패
**알림 내용**: `M2NET 회원 차감 실패` / `M2NET 상담사 적립 실패` + memberId/consultationId/amt/reason
**의미**: consultation 은 INSERT 됐지만 포인트 차감/적립 안 됨 → 데이터 불일치

**대응** (Critical #4 단일 트랜잭션 적용 후로는 0건 예상. 그래도 발생 시):
1. 해당 consultation 확인:
   ```sql
   SELECT * FROM consultation WHERE id = ${consultationId};
   SELECT * FROM point_history WHERE rel_table='consultation' AND rel_id='${consultationId}';
   ```
2. **point_history 가 없으면** → 수동 차감 SQL 실행 (개발자 협의):
   ```sql
   -- 회원 차감 (예시 — amt, free, pro 확인 후)
   INSERT INTO point_history (member_id, content, earn_point, use_point, balance_after,
     rel_table, rel_id, rel_action, is_paid, actor_type)
   VALUES (${memberId}, '[수동] 차감 실패 복구', 0, ${amt}, ${잔액 - amt},
     'consultation', '${consultationId}', '${consultationId}@수동복구@2026-05-17', false, 'admin:사장');
   ```
3. 5분 내 처리 안 되면 → 회원에게 "잠시 후 다시 시도" 안내 (수익 손실 방지)

---

### C. autopay-push 실패 / 위조 의심
**알림 내용**: `자동충전(autopay-push) 처리 실패` 또는 `⚠️ autopay-push 위조 의심`
**의미**:
- 처리 실패 = 정상 자동결제 push 인데 DB 처리 중 예외
- 위조 의심 = `payment_method.auto_enabled = TRUE` 가 아닌 회원에게 push 도착

**대응 — 처리 실패**:
1. payment 상태 확인 (`SELECT * FROM payment WHERE oid = '...'`)
2. 회원 카톡 친절 안내 + 수동 충전 처리

**대응 — 위조 의심**:
1. 즉시 위협 차단됨 (BadRequestException). 추가 충전 안 됨.
2. payload IP 확인 (`/api/pg/charge/autopay-push` 의 access log)
   ```bash
   grep '/api/pg/charge/autopay-push' /data/wwwlogs/api.sajumoon.co.kr_nginx.log | grep -v '211.175.205.88' | tail
   ```
3. 비-211.175.205.88 IP 면 → 진짜 위조 시도 → 네트워크 보안팀에 IP 차단 요청

---

### D. 콜백 비-화이트리스트 IP 도착
**알림 내용**: `⚠️ 콜백 비-화이트리스트 IP 도착` + path/ip/UA
**의미**: M2NET/AG9 외 IP 가 콜백 라우트 호출 (log 모드라 통과시킴)

**대응**:
1. **정상 케이스**: M2NET/AG9 가 IP 변경한 경우. 영업담당 확인 후 추가:
   ```bash
   # /data/wwwroot/api.sajumoon.co.kr/.env 에
   CALLBACK_ALLOW_IPS=211.175.205.88,새IP1,새IP2
   pm2 reload sajumoon-api
   ```
2. **위조 케이스**: 모르는 IP. 차단 모드로 전환:
   ```bash
   # .env 에 추가
   CALLBACK_IP_MODE=reject
   pm2 reload sajumoon-api
   ```

---

### E. 등급 재산정 / 정산 크론 실패
**알림 내용**: `등급 재산정 크론 실패` 또는 `월별 정산 크론 실패` + month + 에러 메시지

**대응**:
1. 매월 1일 새벽에 발생. 보통 자동 재시도 안 됨 (cron 은 다음 달 1일까지 안 돌음)
2. 에러 메시지 분석 후 수동 재실행:
   ```bash
   # CRON_TOKEN 확인 후
   curl -H "X-Cron-Token: $TOKEN" "https://api.sajumoon.co.kr/api/cron/grade/recalculate?month=2026-04"
   curl -H "X-Cron-Token: $TOKEN" "https://api.sajumoon.co.kr/api/cron/settlement/monthly?month=2026-04"
   ```
3. 멱등성 보장 — 한 번 더 돌려도 중복 처리 안 됨
4. 그래도 실패 시 → 개발자 연락 (마이그레이션/스키마 충돌 가능성)

---

### F. 정산 롤백 요청 (절대 무시 금지)
**알림 내용**: `⚠️ 정산 롤백 요청` + month
**의미**: 누군가가 `POST /api/cron/settlement/rollback?month=...` 호출 — 한 달 정산 모두 복원 시도

**대응**:
1. **즉시 확인**: 운영팀에서 의도한 요청인가?
2. 의도 안 한 요청이면:
   ```bash
   # CRON_TOKEN 즉시 회전
   # /data/wwwroot/api.sajumoon.co.kr/.env 에서
   CRON_TOKEN=새토큰64자
   pm2 reload sajumoon-api
   # crontab 의 토큰도 갱신 필요
   ```
3. 양 서버 nginx access log 에서 발신 IP 확인 → 차단

---

### G. 채팅 정산 영구 실패 / M2NET 결제 영구 실패
**알림 내용**: `채팅 정산 영구 실패` 또는 `M2NET 결제 영구 실패` + chatRoomId/paymentId
**의미**: retry cron 이 5회 시도 후도 실패 → 수동 처리 필요

**대응**:
1. 해당 row 상태 확인:
   ```sql
   SELECT * FROM chat_room WHERE id = ${id};  -- settle_status, settle_failure_reason 확인
   SELECT * FROM payment WHERE id = ${id};    -- m2net_retry_count, m2net_status 확인
   ```
2. 실패 원인 분석 후:
   - **회원 잔액 부족**: 회원에게 충전 안내
   - **M2NET 응답 누락**: 시간 두고 재시도 (`UPDATE chat_room SET settle_status='m2net_failed', settle_retry_count=0`)
   - **데이터 정합성 문제**: 개발자 협의

---

### H. 회원 잔액 부족
**알림 내용**: `M2NET 회원 잔액 부족` + memberId/consultationId/요청금액/실차감금액/부족액
**의미**: m2net push amt 만큼 차감하려 했으나 회원 잔액이 부족 → 부분 차감만 됨

**대응**:
1. **수익 손실** 의미. 회원에게 안내 (선택):
   ```sql
   SELECT id, mb_id, name, phone FROM member WHERE id = ${memberId};
   ```
2. 회원에게 카톡 / 전화로 "통화 시간만큼 코인이 부족합니다. 충전 후 다시 이용해주세요" 안내
3. 누적 패턴 (한 회원이 반복 발생) → 의도적 무료 이용 의심 → 일시 차단 검토

---

## 2. health-check OpsAlert (매시간 자동)

매시간 정각 `/api/cron/health-check` 가 자동 실행. **Critical 위반 발견 시** OpsAlert 발송.

### invariants 별 의미

| ID | 위반 의미 | 대응 |
|---|---|---|
| C-1 | 음수 포인트 잔액 | SQL 로 어떤 회원인지 확인 → 0 으로 보정 |
| C-2 | member.point 음수 | 동일 |
| C-3 | consultation amt 불일치 | 데이터 무결성 깨짐 — 개발자 협의 |
| C-4 | 환불금액 > 결제금액 | 환불 처리 실수 가능 — 환불 이력 확인 |
| C-5 | refund 합 > 결제금액 | 동일 |
| C-9 | settlement 중복 | UNIQUE 제약 깨짐 — 마이그레이션 점검 |
| C-12 | 등급 임계값 역전 | 어드민 → 설정 → 등급/단가 탭에서 임계값 확인 |
| C-13 | 정산률 범위 외 (0~1) | 즉시 어드민에서 수정 (5만원 손실 위험) |

### Warning 항목
주로 데이터 drift / 자동화 미작동 신호. 누적되면 점검.

| ID | 의미 | 대응 시점 |
|---|---|---|
| C-8 | member.point drift | 분기별 보정 |
| C-16 | M2NET 적립 retry 대기 | 10건 초과 시 즉시 |
| C-17 | 채팅 정산 retry 대기 | 동일 |

---

## 3. 일반 사고 대응 절차

### 가. 알림이 폭주할 때
- 같은 카테고리 알림이 5분에 10건 이상 → 시스템 문제 가능성
- 운영팀 / 개발자 즉시 호출
- 임시 조치: cron 일시 중단 (`crontab -e` → 해당 줄 주석 처리)

### 나. 회원 / 상담사 분쟁 발생 시
1. **회원 측 문의 (코인 부족 등)**:
   - `어드민 → 회원 → 해당 회원 → 포인트 이력` 확인
   - 통화 상세 (`/mng/consultations/:id`) 에서 정산 내역 확인
2. **상담사 측 문의 (정산 누락 등)**:
   - `/mng/grade/counselor/:id` 에서 등급/단가/이력 확인
   - 정산 결과 (`/mng/settlements`) 에서 해당 월 row 확인

### 다. DB 데이터 복구
**절대 직접 DELETE/UPDATE 금지**. 항상:
1. SELECT 로 영향 범위 확인
2. 트랜잭션 (`BEGIN; ... ROLLBACK`) 으로 시뮬레이션
3. 결과 확인 후 `COMMIT`
4. 가능하면 백업 후

---

## 4. 정기 점검 (운영자가 매일/매주)

### 매일
- [ ] 카톡 OpsAlert 채널 확인 (5분)
- [ ] `어드민 → 환불 이력` 신규 환불 확인 (3분)

### 매주 월요일
- [ ] `/api/cron/health-check` 응답 확인 (브라우저로 호출 — token 필요)
- [ ] retry 큐 상태:
  ```sql
  SELECT count(*) FROM chat_room WHERE settle_status='m2net_failed';
  SELECT count(*) FROM payment WHERE m2net_retry_count > 0 AND m2net_retry_count < 5;
  ```

### 매월 1일 (정산일)
- [ ] 등급 재산정 결과 확인 — `/mng/grade` 에서 분포
- [ ] 정산 결과 확인 — `/mng/settlements` 해당 월
- [ ] 알림 안 오면 정상. 알림 오면 위 E 항목 참고

### 분기별
- [ ] member.point drift 보정 (C-8 누적분)
- [ ] 영구 실패 큐 정리 (permanently_failed 상태)
- [ ] CRON_TOKEN 회전 (보안 강화)

---

## 5. 비상 연락처

| 역할 | 담당 | 연락처 |
|---|---|---|
| 운영자 (사장) | jackeee06 | (등록 필요) |
| 개발자 | (위임) | (등록 필요) |
| 카페24 호스팅 | 카페24 고객센터 | 1588-3284 |
| AG9 (PG) | 영업담당 | (확인 필요) |
| M2NET (PassCall) | 영업담당 | (확인 필요) |
| BizM (알림톡) | 영업담당 | (확인 필요) |

---

## 6. 자주 쓰는 SQL 스니펫

### 회원 조회
```sql
SELECT id, mb_id, name, role, level, grade, phone, point, left_at, intercept_until
FROM member WHERE mb_id = 'xxx';
```

### 통화 1건 상세
```sql
SELECT id, member_id, counselor_id, reason, usetm, amt, amt_free, amt_pro,
       unit_cost_snapshot, grade_at_session, refunded_amount, refund_status, created_at
FROM consultation WHERE id = 12345;
```

### 회원 최근 포인트 변동
```sql
SELECT ph.*
FROM point_history ph
WHERE member_id = (SELECT id FROM member WHERE mb_id = 'xxx')
ORDER BY ph.id DESC LIMIT 50;
```

### 환불 가능 여부
```sql
SELECT id, amt, refunded_amount, refund_status,
       amt - COALESCE(refunded_amount, 0) AS remaining
FROM consultation WHERE id = 12345;
```

---

## 7. 시스템 영구 종료 절차 (서비스 종료 시)

(기록만, 사용하지 마세요. 만약 필요하면 개발자 협의)

1. 신규 가입 차단 (admin/auth/signup throttle 0)
2. 신규 결제 차단 (charge prepareCharge)
3. 진행 중 통화 모두 종료 대기
4. 정산 마지막 1회 수동 실행
5. DB 백업 → 보관 (5년 — 전자상거래법)
6. 도메인/SSL 갱신 중단
7. M2NET/AG9/BizM 해지 통보

---

작성: 2026-05-17 (audit 종료 후 자율 진행)
업데이트 권장: 매년 1월 + 새 사고 카테고리 발생 시
