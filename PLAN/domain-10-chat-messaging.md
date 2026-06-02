# 도메인 10: 채팅(1:1 상담) — 분석 / 마이그레이션 계획

> **구현 진행 상태 (2026-05-08)**:
> - ✅ Phase 1 백엔드: `m2net.service.createChatRoom/getChatLog`, `consult.service.startChat` 보강(토큰 발급), `user/chat` 모듈(목록·상세·메시지·leave) 완성.
> - ✅ Phase 2 webhook: `pg-callbacks/m2net-push.{controller,service}.ts` 가 이미 매뉴얼 §3.5/§4.4 수준으로 구현되어 있어 추가 작업 불필요. 정산 멱등성은 `point_history (rel_table, rel_id, rel_action)` UNIQUE (마이그레이션 0051) 로 이미 보장.
> - ✅ Phase 3 프론트: `useChatSocket` 훅 신규, `ChatRoom.tsx` mock → 실 API + wss 직결, `MyChats.tsx` / `CounselorMyChats.tsx` mock → `chatApi.listRooms` 연동, `ConsultModal` 의 navigate state 에 `roomid/memberToken/wssUrl` 전달.
> - ⏳ 운영 셋업(매뉴얼 §3.7 `etc-mgr/{cpid}/notiurl` 등록, §3.8 `permip` 등록, env `M2NET_WSS_URL`) 은 운영 배포 시 1회 수동 작업.
> - ⏳ 후속 보강: `chat_room` 응답에 `unit_seconds/unit_cost/peer.badge/peer.code` 추가해 ChatRoom 타이머·MyChats 카드 시안 완전화.

## 분석 범위

`sample/`(PHP 레거시) 의 실시간 채팅 상담 기능을 신규 NestJS API + 기존 React 화면으로 옮긴다.
sample 의 코드는 **참고만** — 비즈니스 규칙(상태 전이·차감 공식·webhook reason 분기)만 추출하고, NestJS 로 새로 작성한다.

분석 대상 sample 파일:
- `sample/chat_test/get_chat_token.php` — m2net `chat-mgr` 호출, roomid+토큰 발급
- `sample/chat_test/get_state_token.php`, `sample/chat_test/counselor_state/*` — 상담사 상태 변경
- `sample/chat_test/cn.php`, `cn.html` — wss 클라이언트 메시지 프로토콜
- `sample/counsel/counsel_chat.php`, `chat.php` — 채팅 화면 + 히스토리 렌더
- `sample/counsel/ajax.counsel_chat.php` — `updateTime`(10초 단위), `storeChat`
- `sample/counsel/ajax.go_chat_room.php` — 진입 직전 상담사 상태 변경
- `sample/counsel/chat_history.php` — 종료된 채팅 다시보기
- `sample/mtonet/mtonet_rcv.php` — m2net webhook(reason 분기, 차감/적립/상태복귀)
- `sample/lib/pay_lib.php` — 환불·취소 헬퍼
- `sample/cron/counselor_abse.php` — 자동 부재중 전환

**최우선 권위 문서**:
- `docs/상담서비스_API매뉴얼-V1.3(45) (1).pdf` — m2net (PassCall / AG9) 공식 API 매뉴얼 v1.3 (2026-02-23). 본 문서가 sample 코드와 충돌하면 **매뉴얼이 우선**.
- `docs/(주)엠투넷상담서비스-결제(pay)-v1.6메뉴얼(go).pdf` — 결제 매뉴얼 v1.6. 자동결제·취소 관련.
- 매뉴얼 §4.5 에 따르면 m2net 측에서 React Native 샘플(`chat-ag9-demo-04.tar.gz`)을 별도 제공 — 운영팀 통해 입수 후 본 도메인 R&D 자료로 사용.

신규 측 참조:
- `api/src/shared/m2net/m2net.service.ts` — m2net REST 래퍼(상담사·회원 등록·상태 변경·drconn 까지 구현 완료)
- `api/src/admin/chat-history/*` — 관리자 조회 전용(그대로 유지)
- `web/user/src/pages/ChatRoom.tsx` — Figma `109:8613` 기준 디자인 완성 — **이 화면이 디자인 정답**
- `web/user/src/pages/MyChats.tsx`, `CounselorMyChats.tsx` — 회원/상담사 채팅 목록
- `web/user/src/components/ConsultHistoryCard.tsx` — 채팅 카드 컴포넌트

---

## 개요 (배경)

사주플랜의 핵심 매출원은 1:1 상담(채팅·전화)이다. 현재 라이브의 채팅은 **PassCall(엠투넷 / m2net)** 의 외부 SaaS WebSocket 서버를 통해 동작하며, sample/(PHP) 가 그 앞단에서 토큰 발급·메시지 저장·포인트 차감·상담사 상태 동기화·자동 부재중 처리를 수행한다.

라이브 PHP 측의 채팅 코드는 라이브 다른 도메인과 동일하게 부실이 누적되어 있다 — SQL injection 가능 라인, 트랜잭션 누락, 디버그 코드, 백업 파일 다수, mtonet webhook 의 멱등성 처리 부재. 신규 NestJS 로 옮길 때는 이 부실을 한 줄도 재현하지 않는다.

신규 React 측은 `pages/ChatRoom.tsx` 에서 `https://sajumoon.kr/chat/7` 화면이 이미 픽셀 단위 시안 그대로 구현되어 있고, 다만 상담사 정보·메시지·타이머·전송·종료 5 군데가 mock/하드코딩 상태다. 디자인은 그대로 두고 백엔드 연결만 채우면 된다.

본 도메인의 산출물:
1. 회원/상담사용 채팅 NestJS 모듈 (`user/chat/*`)
2. m2net webhook 수신 + 정산 (`shared/m2net/m2net-webhook.controller.ts` + `shared/payment/consult-charge.service.ts`)
3. 상담사 상태머신 모듈 + 자동 부재중 cron (`user/counselor-state/*`)
4. 기존 React 채팅 페이지의 mock → 실연동 교체

---

## 핵심 발견

### m2net 매뉴얼 §4.5 기준 동작 골격 (정답)

> 본 절은 매뉴얼 v1.3 §4.5 "상담채팅 기능" 과 부록 §1 "reason 코드" 를 1차 출처로 한다. sample 코드는 동일 흐름의 PHP 구현이며 검증 보조 자료.

1. **토큰 발급**: NestJS 가 m2net `POST {apiUrl}/chat-mgr/{cpid}` (cmd=csrchat) `{ membid, csrid }` → `{ roomid, membtoken, csrtoken }` 수신. `chat_room` 에 row INSERT (단, **단가/잔여시간은 m2net 측이 관리**하므로 unit_sec/unit_cost 스냅샷은 표시 용도일 뿐 실 차감 기준 아님).
2. **WebSocket 직결**: 클라이언트가 `wss://passcall.co.kr:28729/wscp/{token}` 로 직접 붙는다. NestJS 는 wss 경로에 관여하지 않음.
3. **메시지 프로토콜** (sample `cn.php` JS + 매뉴얼 2025.07.28 변경분):
   - `regist` — 접속 등록(서버가 `cli_connect_ok` 응답, `Tid/MembId/CsrId/RoomId/Cid` 부여)
   - `conv_msg` (text) — body `{ CmdTp:'conv_msg', Msg, HtmlFlag:false }`
   - `conv_msg` (image) — `HtmlFlag:true` + base64 본문
   - `room_out_req` — 종료 요청
   - 매뉴얼 2023.11.15: json 변수명 `cmd → msg` 로 수정 — sample `cn.php` 와 양쪽 다 받도록 클라이언트 호환 코드 필요.
4. **메시지 저장 (중요 정정)**: **m2net 측이 자체 저장**한다 (매뉴얼 §4.5: "엠투넷 서버 단에서 전부 알아서 처리"). sample 의 `ajax.counsel_chat.php:storeChat` 의 `chat_t` INSERT 는 사주플랜 자체 백업·통계용일 뿐 필수 아님. **신규에서는 자체 히스토리 보존을 위해 wss 메시지를 React 가 받아 NestJS `POST /messages` 로 백업 INSERT 하는 것을 유지** (관리자 chat-history 화면에서 조회 가능해야 하므로).
5. **시간/포인트 차감 (중요 정정)**: **m2net 측이 자동으로 처리**한다 (매뉴얼 §4.5: "기존 AG9 의 전화상담 단가와 차감 결제를 모두 동일하게 사용하며 엠투넷 서버 단에서 전부 알아서 처리"). sample `ajax.counsel_chat.php:updateTime` 의 PHP 측 `use_time +=10` 누적 + 잔여 검증은 **불필요**. NestJS 에 `/tick` 엔드포인트 만들지 않음. 클라이언트의 잔여시간은 m2net 가 보내주는 push 또는 회원 잔액 + 단가로 자체 계산.
6. **종료/정산 webhook (매뉴얼 §3.5 + 부록 §1 reason 코드 전체)**:
   `POST {등록한 notiurl}` body 핵심: `{ amt, cpid, csrid, dtmfno, end, eventtm, from, membid, reason, start, telno, to, usetm, preflag, pin, callid?, regid?, roomid? }`
   - `START_ARS` — 회원 ARS 진입 (접속 이벤트)
   - `TRY_OK` — 전화연결 시작 (통신사로 전문 발송 완료)
   - `CONNECT_CSR` — 상담사·회원 전화 연결 완료 → 차감 시작
   - `START_CHAT` — 채팅 상담 시작 → 차감 시작
   - `END_CHAT` — 채팅 상담 종료 (차감 종료)
   - `DISCONNECT` — 전화 끊김. **CallID 로 1~2회 발생 가능 (1회 필수, 2회 보장 X)** — 멱등성 키 필수
   - `NO_ANSWER_CSR` — TRY_OK 후 30초 내 응답 없음
   - `INSUFFICIENT` — 연결 시도 시점 잔액 부족 거절
   - `INSUFFICIENT_CONN` — 상담 중 잔액 부족
   - `ABSE` — 회원 선택 상담사가 부재중
   - `NOT_IDLE` — 상담사 통화중
   - `NOT_FOUND_CSRNO` — DTMF 번호 매칭 실패
   - `CSR_BUSY_RCVSIG` — 상담사 통화중(통신사 신호)
   - `CSR_REJECT_RCVSIG` — 상담사 수신거절(통신사 신호)
   - `AUTO_PAY_CARD_IN_CONNECT` / `AUTO_PAY_CARD_NOT_CONNECT` — 자동결제(별도 webhook 흐름)
   - 응답 본문: `{"req_result":"00"}` (필수). 응답 시간: TLS 1.5s + context 1.5s + 대기 2s. **재전송/retry 미지원** — 200 응답 즉시 반환 후 무거운 후처리는 비동기 큐로.
7. **상담사 상태 매트릭스** (매뉴얼 §3.3 코드 + 사주플랜 use_phone/use_chat 매핑):
   ```
   use_phone=Y, use_chat=Y → RDVC (채팅+전화 가능)
   use_phone=Y, use_chat=N → IDLE (전화상담가능)
   use_phone=N, use_chat=Y → RDCH (채팅상담가능)
   use_phone=N, use_chat=N → ABSE (부재중)
   상담 진행 중: CONN(전화) / CNCH(채팅) / CRDY(상담준비)
   예약 진행 중: RESV
   ```
8. **상담사 전체상태 실시간 push (매뉴얼 §4.4)**: m2net 이 **15초 간격으로 모든 상담사 상태 list array 를** 우리 webhook 으로 push (`{ list: [{csrid, state}, ...] }`). 별도 URL 등록 가능 또는 §3.7 `notiurl` 로 통합. 우리 NestJS 는 이걸 read-only sync 로 받아 `g5_member.state` 갱신.
9. **자동 부재중 전환 (매뉴얼 §4.6)**: m2net 측 자체 로직으로 **TRY_OK 후 상담사가 응답 안 하면 강제 ABSE 전환 + 다음 순위 상담사로 전환** (2회 처리). 우리 cron `counselor_abse.php` 의 30분 ≥2회 집계 로직은 **m2net 자체 처리와 중복** — sample 의 cron 은 보강용일 뿐 필수 아님. 신규에서는 §4.4 의 15초 push 만으로도 상태 동기화 가능.
10. **운영 1회 셋업** (매뉴얼 §3.7, §3.8):
    - `PUT etc-mgr/{cpid}/notiurl` body `{ notiurl: "https://api.sajumoon.kr/webhook/m2net" }`
    - `PUT etc-mgr/{cpid}/permip` body `{ permip: "{NestJS 운영서버 IP};..." }`
    - 별도 포트: 채팅 토큰 발급은 매뉴얼 §3.2 표 기준 `:25205` (csr-mgr/memb-mgr/etc-mgr) 와 동일 포트지만 m2net 측 운영자 안내에 따라 다른 포트일 수도 있음 — 매뉴얼 §4.5 "API(기존과 다른포트) 호출" 명시 → 운영팀 확인 후 env 분리.

### sample 의 부실 (신규에서 재현 금지)

- `mtonet_rcv.php` 가 동일 m2net 이벤트 재시도 시 중복 차감을 방지하는 멱등성 키 부재
- `ajax.counsel_chat.php:updateTime` 의 트랜잭션 미사용 — 동시 호출 시 `use_time` 갱신 누락 가능
- `chat_t` 의 `token` 컬럼이 `chat_room.room_token` 외래키 미설정
- 상담사 상태 변경에 SELECT FOR UPDATE 미사용 → use_phone/use_chat 동시 토글 race
- `counsel_chat.php` 의 권한 체크가 session 만 의존, csrf 토큰 없음
- 메시지 저장 시 `msg_type` 검증 없이 그대로 INSERT (XSS 가능)

### 신규 React 의 디자인 정답

`web/user/src/pages/ChatRoom.tsx` 는 다음을 이미 구현했다 — 이 시안을 절대 변경하지 않는다:
- 헤더(60px): 뒤로가기 + 상담사명 + 타이머(보라 `#8259F5` tabular-nums, 현재 `00:30:43` 하드코딩) + 상담종료 outline 버튼
- 메시지 영역(`bg #F3EEFE`): date divider, system pill, mine/other 버블, sender 아바타+이름, 자동 하단 스크롤
- 입력창: textarea auto-grow(최대 5줄), 입력 있을 때만 전송 버튼, Enter=전송 / Shift+Enter=줄바꿈
- 상담종료 컨펌 모달(`AlertIcon` + 취소/상담종료 버튼)
- 포인트 부족 알럿 모달
- 종료 상태 시 헤더의 타이머·종료버튼 숨김 + 메시지 마지막에 안내 pill
- `?status=ended|ended-points`, `?modal=end-confirm|points-alert` 쿼리 파라미터로 시안 상태 전환

→ 교체 대상은 **mock/하드코딩 5곳뿐**: `MOCK_DETAILS`, `MOCK_MESSAGES`, 타이머 하드코딩, `onSend()` `TODO`, `setChatStatus('ended')` 직접 호출.

---

## DB 인벤토리

`sajumoon_db_2026-04-24.sql` 기준 — **신규 마이그레이션 없이 기존 테이블 그대로 사용**. 단 멱등성 인덱스 1건 추가.

### chat_room
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `idx` | int unsigned PK | |
| `room_token` | varchar(150) | m2net 발급 토큰(URL 의 `:id` 로 사용) |
| `csr_id` | varchar(50) | 상담사 mb_1 (m2net csrid) |
| `mb_id` | varchar(50) | 회원 mb_1 |
| `status` | enum | `STAY`(대기) / `CNCH`(상담중) / `DISCONNECT`(종료) |
| `chat_wdate` | datetime | 방 생성 |
| `chat_edate` | datetime | 방 종료 |
| `use_time` | int | 사용한 시간(초) |
| `unit_sec` | int | 스냅샷: 상담사 단위 초 |
| `unit_cost` | int | 스냅샷: 상담사 단위 포인트 |
| `alloc_sec_user` | int | 사용자 배정 초 |
| `alloc_sec_csr` | int | 상담사 배정 초(동일) |
| `point_residue` | int | 포인트 환산 후 잔여 |
| `snap_mb_point` | int | 마지막 동기화 포인트 |

### chat_t
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `idx` | int unsigned PK | |
| `mb_id` | varchar(50) | 작성자 (`g5_member.mb_id`) |
| `token` | varchar(50) | `chat_room.room_token` (FK 설정 안 되어 있음) |
| `msg` | text | 메시지 본문 |
| `msg_type` | tinyint | `1=text` / `2=image` |
| `wdate` | datetime | |

### g5_member (관련 컬럼)
- `state` enum `IDLE|ABSE|CONN|RESV|CRDY|RDVC|RDCH|CNCH`
- `use_phone` / `use_chat` enum `Y|N`

### platform_consulting (m2net webhook 로그)
- `reason` / `csrid` / `membid` / `roomid` / `callid` / `regid` / `amt` / `usetm` / `start` / `end` / `preflag` / `pin` / 원본 JSON / 처리 결과
- **신규 추가 멱등성 인덱스**: UNIQUE `(reason, callid)` — 매뉴얼 부록 §1 에 의하면 DISCONNECT 는 동일 CallID 로 1~2회 발생할 수 있고 다른 reason 도 재전송이 보장되지 않으므로 **CallID 가 유일성 키**. callid 가 비어 있는 reason(START_ARS 등)을 위해 `(reason, csrid, membid, start)` 보조 UNIQUE 도 추가.
- 컬럼이 누락되어 있으면 마이그레이션으로 `callid varchar(64)` `regid varchar(64)` `pin varchar(16)` 추가.

> TypeORM 엔티티: `api/src/entities/chat-room.entity.ts`, `chat-message.entity.ts` 신규 작성. `g5_member` 엔티티에 state/use_phone/use_chat 매핑 확인.

---

## 상세 분석 (sample 파일별 → 신규 매핑)

| sample 레거시 PHP | 신규 NestJS API | 기존 React 적용 |
|---|---|---|
| `chat_test/get_chat_token.php` | `M2netService.createChatRoom({ membid, csrid })` 신규 + `user/chat/chat.service.ts:createRoom()` | `ChatRoom.tsx` 진입 시 `POST /user/chat/rooms` 호출 |
| `chat_test/get_state_token.php`, `counselor_state/*` | `user/counselor-state/state.service.ts:setState()` (이미 구현된 `m2net.updateCounselorState` 활용) | 상담사 마이페이지 토글 |
| `chat_test/cn.php` (wss 클라이언트) | — (m2net 직결, NestJS 미경유) | `ChatRoom.tsx` 신규 훅 `useChatSocket(token)` |
| `counsel/counsel_chat.php` (히스토리 렌더) | `user/chat/chat.service.ts:getRoom()` + `getMessages()` | `ChatRoom.tsx` 초기 로드(`MOCK_MESSAGES` 대체) |
| `counsel/ajax.counsel_chat.php:updateTime` | `POST /user/chat/rooms/:token/tick` (10s 단위 use_time +=10, 포인트 검증) | `ChatRoom.tsx` 인터벌(타이머 하드코딩 대체) |
| `counsel/ajax.counsel_chat.php:storeChat` | wss `conv_msg` → m2net 자체 저장 + `POST /user/chat/rooms/:token/messages` 백업 INSERT | `ChatRoom.tsx`의 `onSend()` |
| `counsel/chat_history.php` | `chat.service.ts:getEndedRoom()` | `MyChats.tsx` / `CounselorMyChats.tsx` 카드 클릭 |
| `mtonet/mtonet_rcv.php` (webhook) | `shared/m2net/m2net-webhook.controller.ts: POST /webhook/m2net` | — |
| `lib/pay_lib.php` (차감/환불) | `shared/payment/consult-charge.service.ts` | — |
| `cron/counselor_abse.php` | `user/counselor-state/state-cron.service.ts` (`@Cron('*/5 * * * *')`) | — |
| `counsel/ajax.go_chat_room.php` (입장 직전 상태) | `chat.service.ts:enterRoom()` 내부 통합 | `ChatRoom.tsx` 마운트 시 |

---

## 신규 설계 방침

### 모듈 구조

```
api/src/
  user/
    chat/
      chat.module.ts
      chat.controller.ts
      chat.service.ts
      dto/
        create-room.dto.ts
        send-message.dto.ts
        tick.dto.ts
    counselor-state/
      state.module.ts
      state.controller.ts          # PATCH /user/counselor/me/state
      state.service.ts
      state-cron.service.ts        # 자동 ABSE
  shared/
    m2net/
      m2net.service.ts             # createChatRoom, endChatRoom 추가
      m2net-webhook.controller.ts  # POST /webhook/m2net
      m2net-webhook.service.ts     # reason 분기
    payment/
      consult-charge.service.ts    # 차감/적립/환불
```

### m2net.service 추가 메서드

```ts
createChatRoom({ membid, csrid }): Promise<{ ok; roomid; membtoken; csrtoken; raw }>
endChatRoom(roomid): Promise<{ ok; raw }>
```

m2net `/chat-mgr/{cpid}` POST `{ cmd: 'csrchat', membid, csrid }`. 기존 `postWithKey` + `M2NET_CHAT_URL/CHAT_KEY` env 재사용.

### 사용자 채팅 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/user/chat/rooms` | 방 생성. body `{ csrid }`. 회원 잔액·상담사 상태(`RDCH`/`RDVC`) 검증 → m2net 토큰 발급 → `chat_room` INSERT → `{ token, membtoken, csrtoken, wssUrl, unitSec, unitCost, mbPoint }` 반환 |
| `GET` | `/user/chat/rooms/:token` | 방 메타 + 백업된 메시지 (회원·상담사 본인용) |
| `GET` | `/user/chat/rooms/:token/messages?since=` | 증분 fetch (재연결 시) |
| `POST` | `/user/chat/rooms/:token/messages` | wss 메시지 백업 INSERT (`chat_t`) — React 가 wss `conv_msg` 수신 후 호출 |
| `POST` | `/user/chat/rooms/:token/leave` | 사용자 종료 — wss `room_out_req` 와 같이 트리거 (실제 차감 종료는 m2net `END_CHAT` webhook 으로 도착) |
| `GET` | `/user/chat/rooms` | 회원/상담사 본인의 채팅 목록 (role 분기) |

> **`/tick` 엔드포인트 제거** — 매뉴얼 §4.5: 차감은 m2net 측이 처리. 잔여시간은 클라이언트가 `mb_point / unit_cost * unit_sec` 으로 자체 계산하고, 실 잔액은 webhook (`INSUFFICIENT_CONN` 또는 `END_CHAT`) 도착 시 React Query invalidate.

모든 엔드포인트는 `UserAuthGuard` + `csr_id == me || mb_id == me` 권한 검증. 방 토큰은 URL 파라미터로 받지만 본인 소유가 아니면 404.

### m2net webhook (매뉴얼 §3.5 + §4.4 + 부록 §1)

`POST /webhook/m2net` — m2net 서버에서 호출. **응답 본문 `{"req_result":"00"}` 을 2초 안에 반드시 반환** (매뉴얼 부록 §2). 무거운 후처리는 BullMQ 등 비동기 큐로 분리.

body 예시 (매뉴얼 §3.5 페이지 9):
```json
{ "amt":100, "cpid":"0001", "csrid":"00001", "dtmfno":"20",
  "end":"2022-05-16 12:57:03", "eventtm":"2022-05-16 12:57:03",
  "from":"01011112222", "membid":"000003", "reason":"DISCONNECT",
  "start":"2022-05-16 12:56:55", "telno":"3303", "to":"07080147892",
  "usetm":8, "preflag":"Y", "pin":"12345678" }
```

처리:
1. **멱등성**: `platform_consulting` UNIQUE `(reason, callid)` 또는 `(reason, csrid, membid, start)` 로 중복 거부 (이미 처리된 row 면 200 즉시 반환).
2. **list 형태 push 분기** — body 가 `{ list: [{csrid, state}, ...] }` 면 §4.4 "상담사 전체상태 실시간 push" (15초 주기) 로 인식 → 단순 `g5_member.state` 갱신 후 200 반환.
3. **개별 reason 분기**:
   | reason | 처리 |
   |---|---|
   | `START_ARS` | 로그 INSERT 만 (`platform_consulting`) |
   | `TRY_OK` | 전화 연결 시작 — 상태 표시 갱신 (CONN 전환은 CONNECT_CSR 에서) |
   | `CONNECT_CSR` | `g5_member.state='CONN'` |
   | `START_CHAT` | `chat_room.status='CNCH'`, `g5_member.state='CNCH'` |
   | `END_CHAT` | `chat_room` 종료 처리 + `consult-charge.charge(roomid 有)` + state 복귀(매트릭스) |
   | `DISCONNECT` | 콜 종료 + `consult-charge.charge(roomid 無)` + state 복귀 (멱등성 키 필수 — 1~2회 발생) |
   | `NO_ANSWER_CSR` | state 복귀 + abse 카운트(15초 push 가 cron 보다 빠르므로 자체 cron 은 백업) |
   | `INSUFFICIENT` | 거절 로그 — 차감 X |
   | `INSUFFICIENT_CONN` | 진행 중 잔액 부족 — `consult-charge.charge` + 종료 처리 |
   | `ABSE` / `NOT_IDLE` / `NOT_FOUND_CSRNO` | 거절 로그 — 차감 X |
   | `CSR_BUSY_RCVSIG` / `CSR_REJECT_RCVSIG` | 통신사 신호 거절 — 차감 X, 회원 알림 |
   | `AUTO_PAY_CARD_IN_CONNECT` / `AUTO_PAY_CARD_NOT_CONNECT` | 자동결제 webhook — `domain-02-payment-order` 의 결제 모듈로 라우팅 (도메인-10 범위 외) |
4. **응답** `{"req_result":"00"}` 반환. 트랜잭션 실패도 5xx 던지면 안 됨 (m2net 재시도 없음). 실패 시 `platform_consulting.process_status='FAILED'` 로 표기 후 별도 재처리 큐.

### 정산 서비스 (`consult-charge.service.ts`)

> 매뉴얼 §4.5 정정사항: 단가 계산 자체는 m2net 측이 수행. NestJS 는 webhook 의 `amt` 를 그대로 회원 잔액에서 빼고 상담사 잔액에 더하는 **정산 반영** 만 담당.

입력: `{ reason, membid, csrid, amt, usetm, preflag, roomid?, callid? }`
처리(트랜잭션):
- 채팅(`roomid` 有): `chat_room` 종료 처리(`status='DISCONNECT'`, `chat_edate`, `use_time = usetm`)
- 회원 차감: `g5_point` 음수 INSERT(`amt` 그대로) + `g5_member.mb_point` 갱신 (음수 잔액 금지 — `READMEPLAN.md` 공통 원칙)
- 상담사 적립: `g5_point` 양수 INSERT
- 쿠폰 분리: `chat_room.amt_free` vs `amt_pro` 비율 (sample 의 amt 컬럼 매핑 검증 후 확정 — 본 도메인 1차 산출에서 미정인 경우 일단 amt_pro 로 통합 처리)
- 1000원 이하 콜 자동환불(콜만 — 채팅 제외) — sample `mtonet_rcv.php` 동등
- 모든 이력은 `point_history` 와 동등한 형태(domain-01·02 패턴)로 기록 (`actor_type='m2net_webhook'` + `actor_ip = m2net_ip`).

webhook 응답 시간 제약(2초)을 위해 본 서비스는 **비동기 큐 worker 에서** 실행. webhook 컨트롤러는 `platform_consulting` row 만 INSERT 하고 worker 가 이 row 를 읽어 정산 → 큐 자체 retry 가능.

### 상담사 상태머신

`PATCH /user/counselor/me/state` body `{ use_phone, use_chat }`:
1. 트랜잭션 시작, `g5_member` SELECT FOR UPDATE.
2. 현재 `state` 가 `CNCH` / `CONN` / `RESV` 면 토글 차단(409 Conflict).
3. 매트릭스로 새 state 결정:
   ```
   use_phone=Y, use_chat=Y → RDVC
   use_phone=Y, use_chat=N → IDLE
   use_phone=N, use_chat=Y → RDCH
   use_phone=N, use_chat=N → ABSE
   ```
4. DB 갱신 후 `m2net.updateCounselorState(csrid, state)` 호출(이미 구현됨).
5. m2net 응답 결과는 `m2net_status` 컬럼에 기록.

cron `state-cron.service.ts`:
- 5분 주기. `platform_consulting` 의 `NO_ANSWER_CSR` 30분 이내 ≥2회 + `abse_check='N'` → `ABSE` 자동 전환 + 알림톡(`shared/notification` 재사용 — domain-05) + `abse_check='Y'` 마킹.

### React 변경 (디자인 유지, mock → 실연동)

`pages/ChatRoom.tsx`:

| 현재 | 교체 |
|---|---|
| `MOCK_DETAILS[id]` | `useQuery(['counselor', id])` → `GET /user/counselors/:id` |
| `MOCK_MESSAGES` | `useQuery(['chatMessages', token])` → `GET /user/chat/rooms/:token` |
| 타이머 하드코딩 `"00:30:43"` | `useChatRemaining(token)` 훅 — 자체 카운트다운 (잔여시간 = `unit_sec * floor(mb_point / unit_cost)` 기준 1초마다 −1). `INSUFFICIENT_CONN` / `END_CHAT` webhook 도착 시 React Query invalidate 로 종료 처리. **NestJS `/tick` 호출 없음** (m2net 측 차감) |
| `onSend()` `TODO` | `useChatSocket().send({ CmdTp:'conv_msg', Msg, HtmlFlag:false })` + 낙관적 UI + 응답 도착 시 `POST /messages` 백업 |
| `setChatStatus('ended')` 직접 호출 | `POST /user/chat/rooms/:token/leave` → wss `room_out_req` → m2net `END_CHAT` webhook 도착 → React Query invalidate → `chatStatus='ended'` |
| `?status=ended-points` 쿼리 | webhook `INSUFFICIENT_CONN` → SSE/polling 으로 React 알림 → `chatStatus='ended-points'` |

신규 훅 (`web/user/src/hooks/`):
- `useChatSocket(token)` — wss `wss://passcall.co.kr:28729/wscp/{token}` 직결. `regist` → `cli_connect_ok` 응답 받고 `Tid/MembId/CsrId/RoomId/Cid` 보관. `conv_msg`(`cmd` 변수명도 호환), `room_out_req` 처리. 백그라운드 단절 시 재연결 + `GET /messages?since=` 로 누락 분 fetch.
- `useChatRemaining(token)` — 1초 카운트다운만. m2net 잔액 push (별도 wss 명령 또는 webhook 도착 후 /counselor 잔액 invalidate) 로 보정.

> webhook → React 푸시 채널: NestJS 가 `END_CHAT` / `INSUFFICIENT_CONN` 받으면 SSE(`GET /user/chat/rooms/:token/events` text/event-stream) 또는 `useQuery refetchOnInterval(3s)` 로 알림. 1차 구현은 폴링(3초) 이 단순.

`pages/MyChats.tsx`, `CounselorMyChats.tsx` — `MOCK_CHAT_HISTORY` → `useQuery(['myChats', role])` → `GET /user/chat/rooms?role=member|counselor`. `ConsultHistoryCard` 그대로.

라우트: 기존 `/chat/:id` 유지. `id` = `room_token` 으로 의미 통일(기존 mock 은 counselorId). 회원 입장은 상담사 상세 → "채팅상담 시작" → `POST /user/chat/rooms` 응답의 `token` 으로 `/chat/{token}` 리다이렉트.

---

## ETL

신규 schema 와 별도의 신규 테이블이 없고, 기존 `chat_room` / `chat_t` / `g5_member` / `platform_consulting` 을 그대로 사용하므로 **별도 ETL 없음**.

단, 신규 m2net webhook 컨트롤러 적용 시점에 `platform_consulting` 에 UNIQUE `(reason, csrid, membid, start)` 인덱스를 한 번 추가하는 마이그레이션(`api/db/migrations/00NN_chat_idempotency.sql`)이 필요하다. 적용 전에 중복 행이 있으면 가장 최근 1건만 남기고 삭제.

---

## 검증 방법 (end-to-end)

1. 로컬 NestJS `npm run start:dev` (api). `M2NET_*` env 확인(API_URL, CPID, HEADER_KEY, CHAT_URL, CHAT_KEY).
2. 로컬 React `npm run dev` (web/user).
3. 시나리오:
   - 상담사 마이페이지 토글: `use_chat=Y` → DB `state=RDCH` + m2net 응답 OK
   - 회원 → 상담사 상세 → "채팅상담 시작" → `/chat/{token}` 진입 → wss 연결 → 양쪽 메시지 송수신
   - 10초 경과 → `/tick` 으로 `use_time` 증가, 잔여시간 카운트다운 일치
   - 회원 "상담종료" → `/leave` → m2net `END_CHAT` webhook → 정산(g5_point INSERT × 2) + 상태 RDCH 복귀
   - 포인트 소진 시뮬: `mb_point < unit_cost` → `/tick` 응답 `points_drained` → `chatStatus='ended-points'` 시안 노출
   - `NO_ANSWER_CSR` 2회 시뮬 → cron 1회 → `state='ABSE'` + 알림톡
4. 관리자 chat-history 페이지에서 신규 row 노출 확인.
5. webhook 멱등성: 동일 webhook 페이로드 재전송 → 중복 차감/적립 발생 안 함 확인.
6. `npm run lint` / `npm run typecheck` (api, web/user 양쪽).

---

## 리스크 & 가드레일

- m2net 헤더키 운영/개발 분리 — `M2NET_*` env 분리(`.env.defaults` fallback 제거 또는 운영 키만 별도).
- **webhook 재전송 미지원**(매뉴얼 부록 §2) — 200 응답 즉시 반환 + 후처리 비동기 큐 분리. 5xx 던지면 영구 손실.
- **webhook 응답 시간 ≤ 2초**(TLS 1.5s + context 1.5s + 대기 2s) — DB write 1건만 동기, 정산 트랜잭션은 worker 로.
- **DISCONNECT 멱등성**(매뉴얼 부록 §1) — CallID 동일 reason 1~2회 발생. UNIQUE `(reason, callid)` 필수.
- **차감 단가는 m2net 측 처리** — NestJS 가 자체 차감 계산하면 m2net 와 이중 차감. webhook amt 만 그대로 반영.
- **메시지 저장은 m2net 측** — 사주플랜 `chat_t` 백업 INSERT 는 자체 통계용. m2net 응답이 정답.
- 트랜잭션 — 차감/적립/상태변경은 단일 트랜잭션. 음수 잔액 금지.
- WebSocket 재연결 — 모바일 백그라운드 진입 시 wss 단절. `useChatSocket` 에 재연결 + `messages?since=` 누락 fetch.
- 디자인 충실도 — `ChatRoom.tsx` 의 픽셀·색·간격 변경 금지. mock 교체로 인해 레이아웃이 바뀌지 않도록 prop/state 만 교체. (CLAUDE.md 디자인 충실도 규칙)
- 상태머신 race — m2net 의 §4.4 push (15초 주기, single source of truth) 와 사용자 토글이 충돌 가능. 토글 PATCH 후 즉시 m2net `csr-mgr` PUT → 다음 push 도착 시점에 정합성 회복.
- 라우트 의미 변경 — 기존 `/chat/:id` 의 `id` 는 mock counselorId. 실제 운영은 `roomToken` 으로 통일. 진입 경로 `counselor/:id` → 채팅 시작 버튼이 `roomToken` 을 받아 redirect.
- 메시지 순서 — m2net wss 메시지에 `SendTime` 포함. 클라이언트 표시 순서는 server time 기준.
- XSS — `chat_t.msg` 저장 시 `msg_type` 검증(text/image). 표시는 React 가 자동 escape.
- etc 필드 escape — 매뉴얼 부록 §3: etc 필드에 json string 사용 시 `"` → `<20>`, `'` → `<21>` 변환 필요. m2net 이 push 시 역변환해서 보내옴.

---

## 비범위

- m2net 자체 호스팅 대체 (사용자 결정으로 그대로 유지)
- 전화상담(콜) UI 신규화 — webhook/정산만 같이 처리, 발신 UX 는 별도 이슈
- admin 채팅 모니터링 신규 기능 — 기존 admin chat-history 그대로
- 화상/음성, 파일 업로드, 이모지 리액션 — sample 미구현이므로 본 도메인 외
- React 화면 디자인 변경 — 기존 `ChatRoom.tsx` 가 정답, 시각적 수정 금지

---

## 체크리스트 (Phase 별)

### Phase 1 — 백엔드: 토큰 / 메시지 / 히스토리
- [ ] `chat-room`, `chat-message` TypeORM 엔티티
- [ ] `m2net.service.ts` 에 `createChatRoom`, `endChatRoom` 추가
- [ ] `user/chat` 모듈/컨트롤러/서비스 + DTO
- [ ] 권한 가드(`UserAuthGuard` + 본인 소유 검증)
- [ ] 단위 테스트(서비스 레벨, m2net 모킹)

### Phase 2 — 백엔드: webhook + 정산 + 상태머신
- [ ] `platform_consulting` UNIQUE `(reason, callid)` + 보조 `(reason, csrid, membid, start)` 마이그레이션 (callid/regid/pin 컬럼 누락 시 추가)
- [ ] `shared/m2net/m2net-webhook.controller.ts` — body 가 list 면 §4.4 상태 sync, 단건이면 reason 분기. 200 즉시 반환.
- [ ] BullMQ(또는 Postgres 큐) worker — `platform_consulting` 의 처리 안 된 row 를 읽어 `consult-charge` 실행.
- [ ] `shared/payment/consult-charge.service.ts` (트랜잭션, 멱등)
- [ ] `user/counselor-state` 모듈 (state.controller/service) — m2net `csr-mgr` PUT 호출 후 즉시 응답
- [ ] webhook 멱등성 통합 테스트 (동일 callid 2회 → 중복 반영 X)
- [ ] 운영 셋업: `etc-mgr/{cpid}/notiurl` + `permip` 등록 스크립트 작성 (수동 실행 1회)

### Phase 3 — 프론트: mock → 실연동
- [ ] `useChatSocket`, `useChatTick` 훅 작성
- [ ] `ChatRoom.tsx` 의 mock 5곳 교체(상담사 정보·메시지·타이머·send·leave)
- [ ] `MyChats.tsx`, `CounselorMyChats.tsx` 목록 API 연동
- [ ] 상담사 상태 토글 UI(마이페이지) 연결
- [ ] 라우트 의미 통일(`/chat/:token`)

### Phase 4 — 회귀 점검 + 레거시 OFF
- [ ] sample(PHP) `/counsel/chat.php`, `/chat_test/*` 진입 차단
- [ ] 시연: 시작 → 송수신 → 종료 → 정산 → 상태복귀 → 알림톡
- [ ] README.md / CLAUDE.md 채팅 섹션 갱신
- [ ] `./deploy.sh` 로 mng/api 배포

---

## 관련 문서

- [`PLAN/domain-03-counselor-settlement.md`](domain-03-counselor-settlement.md) — 상담사/정산 도메인. 상담사 단가(`mb_12`/`mb_13`)·상태머신·정산 흐름은 본 도메인과 강하게 결합. 채팅 진행에서 발생하는 포인트는 domain-03 의 월별 정산 사이클로 이어진다.
- [`PLAN/domain-05-notification.md`](domain-05-notification.md) — 자동 부재중 시 알림톡 발송 모듈을 재사용.
- [`PLAN/domain-01-member-point.md`](domain-01-member-point.md) — 회원 포인트 차감 패턴(트랜잭션 + 이력화) 일치.
- [`PLAN/domain-02-payment-order.md`](domain-02-payment-order.md) — `AUTO_PAY_CARD_*` reason 의 자동결제 webhook 은 결제 도메인으로 라우팅.
- `docs/상담서비스_API매뉴얼-V1.3(45) (1).pdf` — m2net (PassCall / AG9) 공식 API 매뉴얼 v1.3 (2026-02-23). 본 도메인의 1차 권위 문서.
- `docs/(주)엠투넷상담서비스-결제(pay)-v1.6메뉴얼(go).pdf` — 결제(자동결제·취소) 매뉴얼 v1.6.
