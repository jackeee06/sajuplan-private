# [AI 전용] m2net (PassCall) 통합 — 기술 상세 (완전판)

> ⚠️ **MONEY-CRITICAL.** 이 문서는 사주플랜의 돈이 움직이는 심장부(m2net push)를 설명한다.
> 관련 코드 수정 후엔 반드시 `python tools/_verify_money_integrity.py` 가 PASS 여야 한다.
> 핵심 코드: `api/src/pg-callbacks/m2net-push.service.ts` (진실원천 — 이 문서와 충돌 시 코드가 정답).

---

## 1. m2net 이 무엇인가 (한 줄 모델)

- 서비스명 **PassCall (m2net)** — 가상번호 통화중계 + 채팅중계 + **과금** 외부 시스템.
- **단방향 push**: m2net → 사주플랜 으로 이벤트를 쏜다. 사주플랜이 m2net 에 "통화목록 줘" 라고 **조회하는 API 는 없다**. (잔액 조회 `getMemberByMembid` 는 있음)
- **항상 실시간 실과금**: m2net 을 거친 통화·채팅은 무조건 과금된다. **"테스트 통화/가짜 과금" 같은 건 존재하지 않는다.** push 의 `amt` 가 과금액의 **single source of truth**.
- 가맹점 CPID `0047`. API 호스트 `passcall.co.kr:25205`. 통신 HTTPS REST + push callback.

---

## 2. Push 엔드포인트 (m2net → 사주플랜)

컨트롤러: `api/src/pg-callbacks/m2net-push.controller.ts` · `@Controller('pg/m2net')`
- 가드: `CallbackIpAllowlistGuard` (PassCall IP 화이트리스트, 현재 log 모드) · throttle 분당 120회
- **항상 HTTP 200 응답** (처리 실패도 200 — sample 동등, 재전송 유도). 실패는 로그로만 추적.

| 메서드 | 경로 | 핸들러 | body |
|---|---|---|---|
| POST | `/api/pg/m2net/call-push` | `handleCallPush` | 단일 객체 **또는 배열** (배열이면 순회) |
| POST | `/api/pg/m2net/state-push` | `handleStatePush` | `{ list: [{csrid, state}, ...] }` |
| GET | `/api/pg/m2net/push-log?key=&tail=` | 진단용 | `.env M2NET_PUSH_LOG_KEY` 일치 시만 노출 |

- m2net CP관리자 등록 URL: `Push통지Url` → call-push, `상담사상태통지Url` → state-push.
  - **외부 연동은 옛 API 도메인 `api.sajumoon.co.kr` 유지** (도메인↔폴더 역사, CLAUDE.md "도메인 구조" 참조).
- **로그 3중**: ① `consultation_log` 테이블(원본 JSON raw) ② `logs/m2net-push.log` 파일(도착 진단) ③ `consultation` 테이블(파싱된 상담기록).

---

## 3. Push payload 필드 사전 (call-push)

`handleCallPush(payload)` 가 읽는 키 전부:

| 필드 | 의미 | 비고 |
|---|---|---|
| `reason` | **이벤트 종류** (필수) | 비어 있으면 즉시 무시 (§4 카탈로그) |
| `csrid` | m2net 상담사 ID | `member.csrid` 로 상담사 매핑 |
| `membid` | m2net 회원 ID | `member.m2net_membid` 로 회원 매핑 (2026-05-22 ID 단일화) |
| `roomid` | 채팅방 ID | **있으면 채팅, 없으면 통화**. `__c_<id>` 꼬리표 주의 (§7) |
| `amt` | **과금액 (코인)** | 진실원천. `rawAmt` 로 보관. 정규화는 §5 |
| `usetm` | 사용 시간(초) | 단기통화/5초환불 판정 |
| `from` | 발신자 폰 = 회원 폰 SIM | `consultation.caller_phone` |
| `to` | 수신 가상번호 | `=='5000878'` 이면 후불(§5) → `consultation.callee_phone` |
| `telno` | 상담사 실 phone | 라우팅 대상 |
| `cpid`/`cp_id` | 가맹점 | |
| `dtmfno` | 상담사 표시번호 매핑 | |
| `preflag` | 선/후불 플래그(m2net 측) | 참고용. 사주플랜 차감 판정엔 사용 안 함 |
| `eventtm` | 이벤트 시각 | rel_action 멱등키 일부 |
| `start`/`end` | 통화 시작/종료 시각 | `safeTimestamp` 파싱 (§8 타임존) |
| `callid` | 통화 식별자 | 5분 알림 dedup + `consultation.callid` UNIQUE |

---

## 4. reason 카탈로그 (call-push) — 각자 트리거하는 동작

| reason | 의미 | 동작 |
|---|---|---|
| `CONNECT_CSR` | 통화 연결됨 | `member.state='CONN'` + **5분 잔여 알림 setTimeout 등록**(회원+상담사) |
| `START_CHAT` | 상담사 채팅방 입장 | `chat_room.status` STAY→CNCH(RETURNING 1회) + 입장 시스템메시지 + **★선결제 차감 1회**(§6) + 상담사 state CNCH |
| `DISCONNECT` | **통화 종료** | (통화 종료이벤트) ready state 복귀 + `last_consult_ended_at=now()` + **정산**(§5) + 5분알림 취소 |
| `END_CHAT` | **채팅 종료** | (채팅 종료이벤트) `chat_room.status='DISCONNECT'`+roomid 꼬리표 + m2net 외부상태 동기화 + **5초 자동환불**(§6) + **m2net 잔액 덮어쓰기**(§6) + **정산**(§5) |
| `NO_ANSWER_CSR` | 상담사 미응답 | ready state 복귀만. 차감/적립 X, `last_consult_ended_at` 갱신 X |
| `INSUFFICIENT_CONN` | 잔액부족 연결실패 | `amt=0` 강제 (정산 안 됨) |
| 기타(`TRY_OK` 등) | 진행 로그성 | consultation_log/consultation 기록만, 정산 분기 미진입 |

**종료 이벤트 판정**: `endsHere = (통화 && DISCONNECT) || (채팅 && END_CHAT)`. 정산은 종료 이벤트에서만.

### state-push (`handleStatePush`)
- body `{list:[{csrid,state}]}` 순회 → `member.state` 일괄 UPDATE.
- `state='RDVC'` 는 **무시**(sample 정책).
- `CNCH`/`CONN` 푸시는 **우리 DB 에 진짜 진행중 세션 없으면 무시**(stale 방어 — m2net 지연/오류 푸시가 다음 회원 상담을 막는 버그 방지).

### ready state 머신 (`computeReadyState`)
상담사 `use_phone`/`use_chat` 조합으로 종료 후 복귀 상태 계산:
| use_phone | use_chat | state |
|---|---|---|
| ✓ | ✓ | `RDVC` |
| ✓ | ✗ | `IDLE` |
| ✗ | ✓ | `RDCH` |
| ✗ | ✗ | `ABSE` |

---

## 5. 금액 정규화 & 회원 차감 / 상담사 적립 규칙

### amt 정규화
1. `rawAmt = payload.amt` (원본 보관 — 상담사 적립 기준).
2. `INSUFFICIENT_CONN` → `amt=0`.
3. **선결제 채팅이면 `amt=0`** (START 에서 이미 차감 → END 이중차감 방지, §6).

### 회원 차감 (`deductMemberPointInTx`, 종료+amt>0 일 때만)
조건: `!refundEligible && !shortCallRefund && !isPostpaid && memberId!=null`
- **`refundEligible`**: 통화 && `0 < rawAmt <= 1000`(CSR_THRESHOLD_DEFAULT) → 차감 skip.
- **`shortCallRefund`**: 통화 && 종료 && `usetm < 30초` && `amt <= 단가스냅샷` → 차감 skip + `refund_status='short_call_refund'`. (사용자 오터치/상담사 즉시끊음 UX 보호. m2net 손실은 회사 부담)
- **`isPostpaid`**: 통화 && `to=='5000878'` → 차감 skip(후불은 통신사 청구). **상담사 적립은 함.**
- 차감 순서: **`free_balance` 우선 → `paid_balance`** (`amt_free`/`amt_pro` 분리). `member.point` 는 free+paid 절대값 동기화.
- `isPaid = amt >= 10000`.

### 상담사 적립 (`creditCounselorPointInTx`, 종료 일 때)
- 기준액 `counselorEarnAmt` = **선결제면 `rawAmt`, 종량제면 `amt`** (선결제 amt=0 여도 m2net 실과금 기준 적립).
- **`effectiveAmt = floor(counselorEarnAmt × revenueRate)`** — 등급별 수익률 적립시점 적용.
  - revenueRate: `setting(namespace='grade', key='revenue_rate.<grade>')` → 없으면 `paid_royalty_pct`/`free_royalty_pct` → **그래도 못구하면 안전 fallback `0.4`** + error log. (**옛 100% fallback 제거** — 설정 실수가 "전액 적립 사고" 되던 구멍 차단, 2026-06-12)
- `earning_balance` 에 적립 (회원 표면 `member.point` 갱신 X — 수익금은 별개).
- **단기통화환불 때도 적립은 정상 발생**(상담사 보호, 손실은 회사 부담).
- **추천수익금 제로섬 이전**: 이 상담사를 추천한 active referrer 가 있으면 `effectiveAmt × rate_snapshot` 만큼 피추천자 earning→추천자 earning 이전(회사 비용 0, 2026-06-10).

---

## 6. 선결제(F·G 정책) 채팅 — 돈 흐름 ⭐

> 정상 상태 = **`consultation.amt` 0**. 이걸 버그로 오해 금지. 상세: `_HANDBOOK/chat/01-prepaid-policy.tech.md`.

| 단계 | 이벤트 | 돈 동작 |
|---|---|---|
| 시작 | `START_CHAT`(STAY→CNCH 1회) | `requiredCost = ceil(charge_minutes×60 / unit_seconds) × unit_cost` 를 회원 free→paid 차감. point_history `채팅 선결제 (N분)`, `rel_action=chat_room@<id>@prepaid_Nmin`. 멱등=STAY→CNCH RETURNING. |
| 비정상 즉시종료 | `END_CHAT` && `usetm<5초` | **5초 자동 전액 환불**(G정책). 제한: 회원당 일 2회/주 4회(`member_chat_quick_refund_log`). m2net 첫 30초 1,000원은 회사 손해 감수. |
| 정상 종료 | `END_CHAT` | 회원 추가차감 **없음**(`amt=0`) + 상담사는 `rawAmt` 기준 적립 + **사주플랜 잔액 → m2net 덮어쓰기**(다음 통화 음수 방지). |

- 선결제는 **차액환불 없음** → m2net 실과금 < 선결제액 이면 차액이 사주플랜 수익(고수익 구조).

---

## 7. ⚠️ roomid 꼬리표 함정 (2026-06-14 이중차감 사고의 뿌리)

- `END_CHAT` 처리 시 `chat_room.roomid` 에 **`__c_<id>` 꼬리표를 붙인다** (`roomid || '__c_' || id`, 재종료 push 식별용).
- 그 결과 chat_room 에는 `Ye4ypi__c_39`, push 의 base roomid 는 `Ye4ypi` 로 **불일치**.
- **사고**: 선결제 무시 분기가 `WHERE roomid = <base>` 정확매칭이라 chat_room 을 못 찾음 → 선결제 무시 안 걸림 → END 에서 consultation 차감까지 발생 = **회원 이중차감**(실고객 포함).
- **수정**: roomid 매칭은 항상 `regexp_replace(roomid,'__c_[0-9]+$','')` 로 base 화 후
  `(roomid = base OR roomid LIKE base||'__c_%' ESCAPE)` 로 변형 모두 매칭. (선결제 무시 분기 + 종료 멱등 가드 둘 다 적용됨)
- 피해 복구: 5명/12건/15,000원 환불 + 해당 consultation `amt=0` 정리 완료. `point_history.rel_action LIKE '%선결제이중차감환불'`.

---

## 8. 멱등성 가드 (push 재전송 = m2net 일상)

1. **consultation INSERT** `ON CONFLICT DO NOTHING` (`uq_consultation_call_callid`, `uq_consultation_chat_roomid`).
2. **END_CHAT base roomid 중복** — 같은 base roomid 에 이미 종료 row 있으면 INSERT skip.
3. **차감/적립** — `point_history (rel_table, rel_id, rel_action)` UNIQUE + `ON CONFLICT DO NOTHING`.
4. **선결제 차감** — STAY→CNCH RETURNING 으로 1회만.
5. **5분 알림** — `consultation.five_min_alert_sent_at` first-write-wins.

→ 같은 push 가 몇 번 와도 돈은 한 번만 움직인다.

## 8-b. 타임존 함정
- m2net Excel/일부 시각 = **+0800(중국)**, 사주플랜 = **KST +0900**. 1시간 차.
- m2net 실내역과 DB 대조 시 ±70분 윈도우 + membid+amt 매칭 필요(단순 시각비교 시 false 누락).
- `safeTimestamp` 는 `"YYYY-MM-DD HH:mm:ss"`/ISO 모두 파싱(실패 시 null).

---

## 9. 🗺️ 데이터 진실원천 맵 (어느 테이블이 "정답"인가)

| 데이터 | 진실원천 | 비고 |
|---|---|---|
| **현재 잔액** | `point` (free/paid/earning_balance) | 모든 잔액의 정답 |
| 회원 표면 잔액 | `member.point` | = free+paid **미러**(절대값 동기화). 단독 신뢰 X |
| **충전(결제)** | `payment` 테이블 | 진실원장. `point_history` 엔 일부만 적힘 |
| 과금/상담 기록 | `consultation` | m2net push 1건 = 1 row. `amt`=과금액 |
| 활동 로그 | `point_history` | **불완전 로그** — 충전 일부 누락 정상. **잔액과 1:1 재구성 안 됨** |
| 원본 push | `consultation_log`(JSON) + `logs/m2net-push.log`(파일) | 진단용 |
| 상담사 수익금 | `point.earning_balance` = Σ(point_history earning) | 정산 대상. 이건 원장 일치함 |
| m2net 측 잔액 | END_CHAT 시 사주플랜이 **overwrite** | 사주플랜이 진실, m2net 은 따라옴 |

> **함정**: 소비자 잔액(free+paid)이 `point_history` 합계보다 큰 건 **정상** — 충전이 `payment` 로 들어오고 활동로그엔 안 적히기 때문. 이걸 "돈이 샜다"고 오해 금지. (검증 스크립트도 이 비교는 일부러 안 함)

---

## 10. 🔒 돈 불변식 & 검증 (CLAUDE.md "돈 불변식" 과 동일)

1. 음수 잔액 0  2. `member.point == free+paid`  3. 선결제 = `consultation.amt` 0
4. `earning_balance == earning 원장합`  5. 적립 = m2net실과금 × 수익률(≤100%, fallback 0.4)
6. 멱등(재전송 이중정산 X)

```bash
python tools/_verify_money_integrity.py     # 위 불변식 자동 점검 → PASS(exit 0)
```
> 돈 코드(머니크리티컬 5파일, CLAUDE.md 목록) 수정 후 이 스크립트 PASS 안 하면 완료 보고 금지.

---

## 11. 등록·동기화 흐름

### 회원 가입 (`user/auth/auth.service.ts`)
member INSERT → `m2net.registerMember` → `m2net_membid` UPDATE. **등록 실패 시 가입도 롤백**.
### 상담사 승인 (`admin/counselor-apply/counselor-apply.service.ts`)
role='counselor' → `m2net.registerCounselor` → `csrid` UPDATE. 실패해도 상담사 상태 유지(수동 `linkCounselorToM2net` 재시도).
### 충전 (`user/charge/charge.service.ts`)
`paid_balance += amt` + `m2net.addMemberCoin`(양쪽 적립). ⚠️ AG9 직통+사주플랜 양쪽 fill 이중적립 사고 이력 → `correctM2netDoubleFill` 자동정정 안전망(2026-05-23).
### 자동 정정 cron (`cron/retry-cron.service.ts`)
`retryPaymentM2netSync()` 10분마다 — 충전 m2net 동기화 실패건 재시도.

---

## 12. 운영 SQL

```sql
-- m2net 미등록 회원 (사고 흔적)
SELECT COUNT(*) FROM member WHERE role='user' AND m2net_membid IS NULL;
-- 상담사 csrid 미발급 (수동 재시도 대상)
SELECT id, mb_id, nickname FROM member WHERE role='counselor' AND csrid IS NULL;
-- 최근 24h reason 분포
SELECT reason, COUNT(*) FROM consultation WHERE started_at >= NOW()-INTERVAL '24 hours' GROUP BY reason ORDER BY 2 DESC;
-- 선결제 이중차감 잔존 점검 (0 이어야 정상)
SELECT c.id, c.member_id, c.amt FROM consultation c WHERE c.amt>0 AND EXISTS (
  SELECT 1 FROM point_history ph JOIN chat_room cr ON cr.id::text=ph.rel_id
  WHERE ph.member_id=c.member_id AND ph.content LIKE '채팅 선결제%' AND ph.rel_table='chat_room'
    AND regexp_replace(cr.roomid,'__c_[0-9]+$','')=c.roomid);
```

---

## 13. 핵심 코드 위치

- push 핸들러: `api/src/pg-callbacks/m2net-push.service.ts` (⚠️ MONEY-CRITICAL 배너)
- 컨트롤러: `api/src/pg-callbacks/m2net-push.controller.ts`
- m2net 클라이언트: `api/src/shared/m2net/m2net.service.ts` (`registerMember`/`registerCounselor`/`addMemberCoin`/`getMemberByMembid`/`updateMember`/`updateCounselorState`)
- 정산 cron: `api/src/cron/settlement-cron.service.ts`
- 검증: `tools/_verify_money_integrity.py`

## 14. 사고/메모리 박제

- `[[project-prepaid-chat-invariant]]` — 선결제 이중차감 근본수정(2026-06-14, roomid 꼬리표).
- `[[pg-m2net-double-fill]]` — 충전 이중적립 + 자동정정(2026-05-23).
- `[[money-flow-master]]` — `MONEY_FLOW.md` 전체.
- `[[project-counselor-sales-call-chat]]` — 상담사 매출 전화/채팅 분리(roomid 기준).

## 15. 협의 채널
- m2net 영업담당(사장님 직접) · m2net 콘솔(csrid 등록 phone 확인) · 사고 시 m2net 고객센터.
