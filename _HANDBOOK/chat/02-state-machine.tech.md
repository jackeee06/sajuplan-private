# [AI 전용] 채팅 상태 머신 — 기술 상세

> ⚠️ **두 개의 다른 머신을 혼동하지 말 것.**
> - **`chat_room.status`** (이 문서) = 채팅방 1건의 진행 상태 (STAY/CNCH/DISCONNECT).
> - **`member.state`** = 상담사의 접속/가능 상태 (IDLE/RDCH/RDVC/CONN/CNCH/ABSE/RESV). → [counselor/03-absent](counselor/03-absent) 참조.
> 둘 다 'CNCH'를 쓰지만 의미·테이블이 다르다. 상담사가 채팅 중이면 member.state='CNCH' **이고** 그 방의 chat_room.status='CNCH'.

## 상태값

`chat_room.status` VARCHAR — 3가지:
- `'STAY'`: 회원 신청 후 상담사 대기. F 정책 (차감 0).
- `'CNCH'`: 상담사 입장 후 진행 중. 선결제 차감 발생.
- `'DISCONNECT'`: 종료. 단방향 (되돌아가지 않음).

## 전환 트리거

### STAY → CNCH
- m2net START_CHAT push 도착 (메인 경로)
- `chat_room.counselor_joined_at = NOW()`
- F 정책 → 선결제 차감 실행 (chargeMinutes × 분당 단가)

### CNCH → DISCONNECT
- `leave('close')` (명시적 종료) — 회원 또는 상담사
- m2net END_CHAT push (m2net 측 세션 종료)
- tick API 가 잔여 0 감지 (시간 소진 자동 종료)
- 5초 이내 종료 → G 정책 환불 처리

### STAY → DISCONNECT (직접)
- `autoCancelStaleChats` 매분 cron — `started_at < NOW() - INTERVAL '3 minutes'`
- 헤더 종료 버튼

## 핵심 코드 위치

- 정의: `chat_room` 테이블 (DB)
- 전환 처리: `api/src/user/chat/chat.service.ts` `leave()`, `rejoin()`, `tickRoom()`
- m2net push 핸들러: `api/src/pg-callbacks/m2net-push.service.ts`
- 클라이언트 폴링: `web/user/src/pages/ChatRoom.tsx` `useEffect getStatus` 5초 주기
- 3분 cron: `api/src/user/consult/consult.service.ts:547-595` `autoCancelStaleChats()`

## DB 스키마

```
chat_room
- id BIGSERIAL
- member_id INT FK → member(id)
- counselor_id INT FK → member(id)
- status VARCHAR — 'STAY' / 'CNCH' / 'DISCONNECT'
- charge_minutes INT
- started_at TIMESTAMPTZ
- counselor_joined_at TIMESTAMPTZ
- ended_at TIMESTAMPTZ
- member_try_out BOOL — 회원 잠시 자리비움 마킹
- counselor_try_out BOOL
- roomid VARCHAR — m2net 측 roomid
- wss_token VARCHAR
```

## 운영 SQL

```sql
-- 진행 중 채팅
SELECT id, member_id, counselor_id, started_at, charge_minutes
FROM chat_room
WHERE status IN ('STAY', 'CNCH')
ORDER BY started_at DESC;

-- 종료 사유별 분포 (최근 30일)
SELECT
  COALESCE(c.reason, 'unknown') AS reason,
  COUNT(*) AS cnt
FROM chat_room cr
LEFT JOIN consultation c ON c.roomid = cr.roomid
WHERE cr.started_at >= NOW() - INTERVAL '30 days'
GROUP BY reason
ORDER BY cnt DESC;
```

## 함정

1. **STAY → CNCH 전환 미발화**: m2net START_CHAT push 누락 시 차감 안 됨. 안전망: 클라이언트 측 폴링이 상태 동기화 (5초 주기)
2. **DISCONNECT → CNCH 역전 시도**: 단방향 정책 위반. m2net push 충돌 검토
3. **3분 cron 정지**: STAY 무한 대기. `pm2 logs sajumoon-api | grep autoCancelStaleChats` 매분 로그
4. **try_out 마킹 안 풀림**: rejoin 호출 실패 시 회원이 영원히 "자리비움". 클라이언트 측 focus 이벤트 검증

## 관련 메모리

- `[[prepaid-chat-plan]]` §2 (상태 머신 정의)
- `[[id-unification-complete]]` (member_id ↔ counselor_id 같은 member 테이블)
