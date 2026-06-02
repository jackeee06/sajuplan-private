# 사주플랜 운영 알림 (OpsAlert) 카탈로그

> 작성: 2026-05-30
> 사주플랜 백엔드 → BizM 알림톡 (`ops_admin_alert` 템플릿) → 사장님 휴대폰
> 발신: `api/src/shared/ops-alert/ops-alert.service.ts` (모든 케이스 단일 진입점)
> 수신자: prod setting `ops_alert_recipients` 에 등록된 운영자 휴대폰 (현재 사장님 01075740572 + 01066633914)

이 문서는 **알림톡 받았을 때 무엇인지·왜 발생했는지·어떻게 대응할지** 를 찾는 운영자 매뉴얼.

---

## 📊 알림 분류 (총 28건)

| 분류 | 건수 | 우선순위 |
|---|---|---|
| 🔴 Critical (즉시 개입) | 7건 | 결제·정산·보안 직결 |
| 🟡 Warning (모니터링) | 9건 | 잠시 후 풀릴 수도 / 운영자 판단 |
| 🟢 Info (정상 보고) | 3건 | 매일·매주 정기 |
| ⚙️ Cron 실패 (재시도 권장) | 9건 | 일시 장애 가능 |

---

# 🔴 Critical — 즉시 운영자 개입

## 1. M2NET 콜백 트랜잭션 실패 (전체 롤백)

**위치**: `api/src/pg-callbacks/m2net-push.service.ts:795`
**발생 조건**: 전화 통화 종료 (DISCONNECT) push 처리 중 회원 차감 또는 상담사 적립이 트랜잭션 안에서 실패 → 전체 롤백
**왜 critical**: 회원 코인 차감 + 상담사 적립이 안 됐다 = **상담은 했는데 돈 이동 0** = 즉시 사고
**자동 대응**: `retry-cron` 가 다시 시도 (settle_status='m2net_failed' 마킹)
**운영자 액션**:
1. consultation.callid 로 통화 실 발생 여부 확인
2. retry-cron 결과 추적 (10분 후 자동 재시도)
3. retry 5회 다 실패 시 "M2NET 결제 적립 영구 실패" 알림으로 격상 → 수동 처리
**예시 메시지**: `callid=20260530_xxxx member_id=15 counselor_id=3 amt=5000\n\n에러메시지...`

---

## 2. 채팅 정산 트랜잭션 실패 (전체 롤백)

**위치**: `m2net-push.service.ts:1078`
**발생 조건**: 채팅 종료 시 settleChatRoomLocal 의 트랜잭션 안에서 차감/적립 실패 → 전체 롤백
**왜 critical**: 채팅이 끝났지만 상담사 적립 안 됨. 상담사가 "오늘 채팅했는데 수익금 안 들어옴" 신고 가능
**자동 대응**: `chat_room.settle_status='m2net_failed'` 마킹 → retry-cron 가 5회 재시도
**운영자 액션**:
1. chat_room.id 확인 → settle_failure_reason 컬럼 읽기
2. retry-cron 자연 재시도 대기 (보통 자동 복구)
3. 5회 다 실패 시 "채팅 정산 영구 실패" 알림으로 격상
**예시 메시지**: `chatRoomId=42\nmemberId=15 counselorId=3\namt=5000\n\n에러메시지\n\nretry cron 이 다시 시도. 영구 실패 시 수동 점검 필요.`

---

## 3. 채팅 정산 영구 실패

**위치**: `api/src/cron/retry-cron.service.ts:98`
**발생 조건**: settle_status='m2net_failed' 인 chat_room 을 5회 재시도해도 정산 실패 → settle_status='permanently_failed' + 알림 1회 발송
**왜 critical**: 5회 재시도해도 실패 = 시스템적 이슈. m2net API 장애 또는 데이터 미스매치
**[2026-05-30 fix]**: use_seconds=0 row 는 시작점에서 'skipped' 마킹 → 영구 실패 알림에서 제외. 진짜 정산 대상만 도달.
**알림 메시지에 컨텍스트 포함** (2026-05-30 fix):
```
chat_room.id=N retry=5
use_seconds=N
시작=YYYY-MM-DD HH:MM:SS
종료=YYYY-MM-DD HH:MM:SS
사유: m2net_get_balance_failed: 응답 없음

수동 개입 필요 (use_seconds=0 이면 정상 — skipped 마킹).
```

**운영자 액션**:
1. **use_seconds=0 이면** → 안전한 사고. `UPDATE chat_room SET settle_status='skipped' WHERE id=N;` (사용 0초 = 정산 대상 아님)
2. **use_seconds>0 이면** → 진짜 정산 누락. consultation 매칭 확인 + m2net 측 통화/채팅 데이터 확인 + 수동 차감/적립
3. m2net 측 장애 가능성 → 30분~1시간 후 재시도

---

## 4. M2NET 결제 적립 영구 실패

**위치**: `retry-cron.service.ts:172`
**발생 조건**: payment.m2net_status='failed' 인 결제 row 가 5회 재시도해도 m2net 적립 실패
**왜 critical**: 회원이 결제는 됐지만 m2net 측 잔액에 안 더해짐. 회원이 "충전했는데 잔액 안 늘었음" 신고 가능
**운영자 액션**:
1. payment.oid 로 PG 측 결제 성공 확인
2. m2net 측 잔액 수동 조회
3. 차이 = 수동 fill (운영팀 m2net 콘솔에서 직접)

---

## 5. ⚠️ autopay-push 위조 의심 (자동결제 미등록)

**위치**: `api/src/user/charge/charge.service.ts:914`
**발생 조건**: m2net autopay push 가 도착했는데 사주플랜 DB 에 자동결제 등록 없는 회원
**왜 critical**: **위조 결제 시도 가능성**. 누군가 m2net 콜백을 조작해서 회원 카드로 결제 트리거?
**자동 대응**: 결제 차단 (`BadRequestException`)
**운영자 액션**:
1. **즉시 m2net 측 + AG9 PG 측 IP / 요청 로그 확인**
2. 동일 패턴 반복 시 보안 사고 가능성 → m2net 담당자 연락
3. **IP allowlist (211.175.205.88) 외부에서 왔다면 진짜 위조**
**예시 메시지**: `membid=user_M_K member_id=15\noid=AUTO_PAY_xxx amount=33000\n자동결제 등록 안 된 회원에게 push 도착.`

---

## 6. ⚠️ autopay-push 금액 불일치

**위치**: `charge.service.ts:923`
**발생 조건**: autopay push 의 amount 가 등록된 자동결제 패키지 금액과 다름
**왜 critical**: 위조 또는 PG 측 오류. 사용자가 등록한 금액 외 다른 금액으로 결제 시도
**자동 대응**: 결제 차단
**운영자 액션**:
1. expected vs got 금액 차이 확인
2. PG 측 오류면 m2net/AG9 담당자 연락
3. 위조면 회원 카드 즉시 비활성화 + 보안 점검
**예시 메시지**: `member_id=15 membid=user_M_K\noid=xxx\n등록 금액=33000 push 금액=50000`

---

## 7. DB 일관성 위반 감지 (Critical)

**위치**: `api/src/cron/health-check.service.ts:350`
**발생 조건**: 매시간 cron 이 18개 invariant 검사 → Critical 위반 발견
**Critical 항목** (C-1~C-18):
- C-1: 음수 포인트 잔액
- C-2: member.point 음수
- C-3: consultation 합계 불일치
- C-4: refund 잔액 초과
- C-5: chat_room counselor_id 무결성
- ... (전체 18개)
**운영자 액션**:
1. 알림 메시지에 위반 항목 + 카운트 + 샘플 row 포함
2. 즉시 [_OPS_RUNBOOK.md](_OPS_RUNBOOK.md) 의 해당 invariant 진단 SQL 실행
3. 사고 발생 패턴이면 트랜잭션 가드 점검
**예시 메시지**: `C-8 violations=1 mb_id=ubuub1234 100원 drift\n...`

---

# 🟡 Warning — 모니터링 + 운영자 판단

## 8. 단기통화 환불 m2net 복구 실패

**위치**: `m2net-push.service.ts:828`
**발생 조건**: 단기 통화 (amt < 환불 임계값) 으로 자동 환불 처리 시 m2net 측 잔액 복구 실패
**왜 warning**: 사주플랜 측은 차감 안 함 + m2net 측에 복구 못 함 = m2net 잔액에 차감만 남음
**자동 대응**: 로그 + OpsAlert. 자동 재시도 없음
**운영자 액션**: m2net 콘솔에서 회원 잔액 수동 복구

## 9. M2NET 회원 잔액 부족

**위치**: `m2net-push.service.ts:1376`
**발생 조건**: 채팅 종료 시 사주플랜 DB 잔액보다 m2net 측 잔액이 크게 부족
**자동 대응**: 차감 보정 시도. 실패 시 알림
**운영자 액션**: 회원에게 안내 + m2net 측 잔액 확인

## 10. M2NET 가상계좌 코인 적립 실패

**위치**: `charge.service.ts:841`
**발생 조건**: 가상계좌 입금 → m2net 측 잔액 적립 호출 실패
**자동 대응**: payment.m2net_status='failed' 마킹 → retry-cron 처리
**운영자 액션**: payment.oid 추적 + m2net 측 수동 fill (필요 시)

## 11. M2NET 카드/간편결제 코인 적립 실패

**위치**: `charge.service.ts:1138`
**발생 조건**: 카드/카카오페이/네이버페이 결제 후 m2net 측 적립 실패
**자동 대응**: m2net_status='failed' → retry
**운영자 액션**: 위와 동일

## 12. M2NET 잔액 정정 실패 (post-payment sync)

**위치**: `charge.service.ts:1189`
**발생 조건**: 결제 후 m2net 잔액 검증 → 사주플랜 DB 와 차이 발견 → 정정 실패
**자동 대응**: 알림 + retry 없음
**운영자 액션**: 즉시 잔액 차이 수동 조정

## 13. 자동결제 카드 등록 실패 (외부 예외)

**위치**: `charge.service.ts:282`
**발생 조건**: 사용자가 카드 등록 시도 → AG9 PG 또는 m2net 호출에서 예상 못한 예외
**왜 warning**: 사용자가 등록 못 함. 신뢰 손상
**운영자 액션**: 알림 메시지의 stack trace 분석 + AG9/m2net 상태 점검
**[2026-05-29 메모리]**: 실 등록 0건이라 미검증. 다음 등록 시 이 알림 가능성 모니터링

## 14. 자동충전(autopay-push) 처리 실패

**위치**: `api/src/user/charge/pg-callback.controller.ts:94`
**발생 조건**: m2net 의 자동충전 push 처리 자체가 예외 발생
**왜 warning**: 회원 충전 누락 또는 중복 차감 사고 가능
**자동 대응**: 회원에게 안내 X
**운영자 액션**: 알림의 membid/oid 로 PG/m2net 양쪽 확인 + 수동 정정

## 15. 정산 음수 임계값 초과

**위치**: `api/src/cron/settlement-cron.service.ts:320`
**발생 조건**: 월별 정산 cron 실행 시 carry-over 음수가 임계값 초과 (상담사가 회사에 돈 빚진 상황)
**운영자 액션**: 상담사별 잔여 누적 검토 + 카르 운영 정책 결정

## 16. ⚠️ 콜백 비-화이트리스트 IP 도착

**위치**: `api/src/pg-callbacks/callback-ip-allowlist.guard.ts:91`
**발생 조건**: m2net push 가 등록된 IP (`211.175.205.88`) 외 다른 IP 에서 도착
**자동 대응**: 현재 log 모드 (차단 안 함, 알림만). 1주 검증 후 reject 모드 전환 예정
**운영자 액션**: 알림 누적 시 보안 사고 의심. m2net 측 IP 변경 가능성 확인 (협의 필요)

---

# 🟢 Info — 정상 보고

## 17. 일일 운영 요약

**위치**: `api/src/cron/daily-summary.service.ts:35`
**발생 조건**: 매일 09:00 KST cron 자동 발송
**내용**: 어제의 상담 건수 / 매출 / 신규 회원 / 신규 상담사 / 주요 KPI
**운영자 액션**: 읽기. 비정상 수치면 진단

## 18. 정산 롤백 완료

**위치**: `cron.controller.ts:232`
**발생 조건**: 운영자가 명시적으로 정산 롤백 요청 + 성공 완료
**운영자 액션**: 읽기 (본인이 요청한 것의 완료 확인)

## 19. 테스트 알림

**위치**: `cron.controller.ts:123`
**발생 조건**: `/api/cron/test-alert` 수동 호출 (운영자가 휴대폰 등록 검증용)
**운영자 액션**: 받았다 = 시스템 정상

---

# ⚙️ Cron 실패 — 일시 장애 가능

각 cron 함수가 예외 throw 시 알림. 보통 다음 사이클에 자연 복구.

## 20. daily-summary cron 실패
**위치**: `cron.controller.ts:52`
**대응**: 24시간 후 다음 발화. 1일 누락 = 큰 손해 X

## 21. 채팅 자동 취소 cron 실패
**위치**: `cron.controller.ts:74`
**역할**: 3분 무응답 채팅 자동 취소
**대응**: 매분 발화. 다음 분에 자연 재시도. 누락 누적 시 회원이 무한 STAY 상태

## 22. 채팅 5분 알림 cron 실패
**위치**: `cron.controller.ts:93`
**역할**: 채팅 잔여 5분 진입 회원/상담사 알림
**대응**: 매분 재시도

## 23. 전화 5분 알림 cron 실패
**위치**: `cron.controller.ts:111`
**역할**: 통화 잔여 5분 알림
**대응**: 매분 재시도

## 24. 등급 재산정 크론 실패
**위치**: `cron.controller.ts:171`
**역할**: 매월 1일 상담사 등급 재산정
**대응**: 다음 달 1일까지 수동 재호출 (`GET /api/cron/grade/recalculate?token=...`)

## 25. 월별 정산 크론 실패
**위치**: `cron.controller.ts:192`
**역할**: 매월 1일 상담사 수익금 정산
**대응**: 수동 재호출. 정산 안 되면 상담사 정산 누락 = 즉시 영향

## 26. ⚠️ 정산 롤백 요청
**위치**: `cron.controller.ts:226`
**역할**: 운영자가 의도적으로 정산 롤백 트리거. 작업 시작 알림
**대응**: 본인이 요청한 것의 시작 확인. 끝나면 "정산 롤백 완료" 또는 "실패"

## 27. 정산 롤백 실패
**위치**: `cron.controller.ts:239`
**역할**: 위의 작업 실패
**대응**: 알림의 에러 메시지 + DB 상태 점검. 부분 롤백 가능성 검토

## 28. 상담사 엠투넷 연동 실패

**위치**: `api/src/admin/counselor-apply/counselor-apply.service.ts:453`
**발생 조건**: 어드민이 상담사 가입 신청 승인 시 m2net 측에 상담사 등록 실패
**왜 중요**: 상담사가 csrid 없이 등록되면 통화/채팅 매핑 실패 → 상담 시도 시 사고
**자동 대응**: 사주플랜 DB 만 등록. m2net 측 미반영
**운영자 액션**: m2net 콘솔에서 수동 등록 + csrid 받아서 사주플랜 DB 업데이트

---

# 🔁 발송 흐름 (OpsAlertService)

## 발송 채널 우선순위

1. **BizM 알림톡** (`ops_admin_alert` 템플릿) — 1순위. 사장님 카톡 도달
2. **ALIGO SMS LMS 폴백** — BizM 실패 시. **현재 ALIGO 미설정 = 폴백 없음**

## 수신자 등록

- **DB**: `setting` 테이블 의 `namespace='ops_alert' key='recipients'` JSON 배열
- **형식**: `[{name: "사장님", phone: "01075740572"}, ...]`
- **편집**: 어드민 → 운영알림 페이지 (`/mng/settings/ops-alert`)

## 발송 빈도 제한 (cooldown)

- 같은 카테고리 + 같은 사유는 **30분 cooldown** (메모리 캐시)
- 같은 채팅방/통화의 영구 실패는 **1회만 발송** (DB 마킹: `permanent_failure_alerted_at`)

## 실패 시

- BizM 실패: 로그 warn + ALIGO 시도
- ALIGO 실패 (현재 항상 실패): 로그 error
- **알림 자체 누락 가능성** = ops_alert 발송 실패는 알 길 없음. 모니터링 어려운 사각지대

---

# 🛠️ 운영자 매뉴얼 — 알림 받았을 때 흐름

```
알림톡 도착
  ↓
제목 보고 위 카탈로그에서 검색 (Ctrl+F)
  ↓
[Critical?]
  Yes → 본문의 ID/oid/membid 확인 → 즉시 진단 SQL 실행
  No  → [Warning?]
         Yes → 모니터링 30분, 또 오면 진단
         No  → [Cron 실패?]
                Yes → 다음 사이클 대기 (자연 복구 가능성 높음)
                No  → 보고용 (테스트/완료 알림)
```

## 가장 빈번한 진단 SQL

```sql
-- chat_room 상태 확인
SELECT id, status, use_seconds, started_at, ended_at,
       settle_status, settle_retry_count,
       LEFT(COALESCE(settle_failure_reason, '-'), 80) AS reason
  FROM chat_room WHERE id = ?;

-- consultation 매칭 확인
SELECT id, callid, roomid, reason, member_id, counselor_id,
       usetm, amt, started_at, ended_at
  FROM consultation
 WHERE roomid LIKE '%baseRoomid%' OR callid = '?';

-- payment 상태
SELECT oid, pay_method, status, m2net_status, amount, coin_amount,
       LEFT(result_message, 100) AS msg
  FROM payment
 WHERE oid = '?' OR member_id = ?;

-- point_history 적립 여부
SELECT id, content, earn_point, use_point, balance_after, rel_table, rel_id
  FROM point_history
 WHERE member_id = ?
 ORDER BY created_at DESC LIMIT 20;
```

## 상황별 SQL

```sql
-- 채팅 정산 영구 실패 시 — use_seconds 보고 판단
SELECT id, use_seconds, started_at, ended_at,
       settle_status, settle_failure_reason
  FROM chat_room
 WHERE settle_status IN ('m2net_failed', 'permanently_failed');

-- use_seconds=0 인 row 강제 skipped 처리 (안전)
UPDATE chat_room
   SET settle_status = 'skipped',
       settle_failure_reason = 'manual: no_use_seconds'
 WHERE id IN (?, ?, ...) AND use_seconds = 0;

-- 자동결제 위조 의심 추적
SELECT created_at, message
  FROM consultation_log
 WHERE message ILIKE '%autopay%'
 ORDER BY created_at DESC LIMIT 30;

-- 음수 잔액 발견 시 (C-1, C-2)
SELECT member_id, free_balance, paid_balance, earning_balance
  FROM point WHERE free_balance < 0 OR paid_balance < 0 OR earning_balance < 0;
```

---

# 🐛 알려진 false positive / 안전한 무시 케이스

## 1. 채팅 정산 영구 실패 + use_seconds=0 (2026-05-30 fix 이전)
**증상**: chat_room.id=N use_seconds=0 / m2net 응답 없음
**원인**: 상담사 입장 전 종료 또는 자동 취소된 채팅을 정산 시도. m2net 측엔 등록 안 됨
**대응**: `UPDATE chat_room SET settle_status='skipped' WHERE id=N;` + 알림 무시
**fix 후**: 자동 차단됨 (use_seconds=0 row 는 시작부터 skipped 마킹)

## 2. 콜백 비-화이트리스트 IP (log 모드)
**현재 상태**: log 모드라 알림만 + 차단 X. 실제 사고 X
**대응**: 로그 누적 모니터링. m2net 측 IP 변경 시 화이트리스트 갱신

## 3. 테스트 알림
**대응**: 무시. 운영자가 직접 호출한 것

---

# 📚 관련 문서

- [_OPS_RUNBOOK.md](_OPS_RUNBOOK.md) — 사고 종류별 대응 매뉴얼 (이전 작성)
- [_OPS_INCIDENT_MANUAL.md](_OPS_INCIDENT_MANUAL.md) — 사고 시나리오별 메뉴얼
- [_NEXT_SESSION_자동충전.md](_NEXT_SESSION_자동충전.md) — 자동충전 핸드오프
- [PLAN/_BUGS_BACKLOG.md](PLAN/_BUGS_BACKLOG.md) — 알려진 버그
- 메모리 `project_alert_system_complete.md` — 사용자 알림 38이벤트
- 메모리 `project_alert_mapping.md` — 알림 매핑 가이드

---

# 🔄 이 문서 업데이트 시점

- 새 OpsAlert 케이스 추가 시 → 위 카탈로그 한 항목 추가
- 카테고리/우선순위 변경 시 → 분류표 + 본문 동시 수정
- 운영자 액션 변경 시 → 해당 케이스 본문 수정
- 발송 시스템 (BizM/ALIGO) 변경 시 → "발송 흐름" 섹션 수정

작성 기준 코드:
- `api/src/shared/ops-alert/ops-alert.service.ts` (발송 진입점)
- `grep -rn "opsAlert\.send" api/src/` (28건 전수)
- 검증일: 2026-05-30

---

작성 완료. 알림톡 받으면 이 파일 + 메모리 우선 참조.
