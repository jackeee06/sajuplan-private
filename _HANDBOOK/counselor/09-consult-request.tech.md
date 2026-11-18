# [tech] 부재중 상담요청 & 콜백 재연결

> 대상: 개발자/AI. 부재(ABSE/RESV) 상담사에게 온 상담요청 → 알림 → 상담사 재접속 → 대기 고객 콜백 재연결의 전체 코드 경로.
> 사용자용 개요: [09-consult-request](counselor/09-consult-request)

## 데이터 모델 — `counselor_request_alert`

| 컬럼 | 타입 | 의미 |
|---|---|---|
| id | serial PK | |
| counselor_id | int NOT NULL | 요청 받은 상담사 member.id |
| member_id | int NOT NULL | 요청한 고객 member.id |
| requested_at | timestamptz NOT NULL default now() | 요청 시각 |
| channel | varchar(10) NULL | `'phone'` / `'chat'` / NULL(구버전) — 마이그레이션 `20260703000000` |
| callback_sent_at | timestamptz NULL | 콜백(상담가능 알림) 발송 완료 마킹 — 마이그레이션 `20260703010000` |
| notified_at / notify_method / notify_error | | 최초 요청 알림 발송 결과 |

`callback_sent_at IS NULL` = **아직 상담사가 상담가능을 켜지 않아 콜백이 안 나간(=미응답) 요청**. 이 값이 대시보드 카드 노출과 콜백 대상 판정의 핵심 플래그.

## 1) 요청 생성 — `requestConsult`

`api/src/user/counselors/counselors.service.ts` · `POST /user/counselors/:id/request-consult` (body `{ channel?: 'phone'|'chat' }`)

- **멱등 INSERT (동시요청 이중 알림 방지)** — 기존 `SELECT→INSERT` 2단계를 단일 원자문으로:
  ```sql
  INSERT INTO counselor_request_alert (counselor_id, member_id, requested_at, channel)
  SELECT :cid, :mid, now(), :channel
  WHERE NOT EXISTS (
    SELECT 1 FROM counselor_request_alert
     WHERE member_id=:mid AND counselor_id=:cid AND requested_at > now() - interval '24 hours'
  ) RETURNING id
  ```
  0행 반환 = 24h 내 이미 요청 있음 → `{ ok:true, already:true }`. (완벽한 UNIQUE는 24h 슬라이딩 창이라 불가 → 경합 창 제거로 실용 해소.)
- **채널 라벨**: `channel==='chat'?'채팅 ':channel==='phone'?'전화 ':''` → 알림 문구에 삽입.
- **알림 3종** (best-effort, 하나 실패해도 DB row 유지·응답 정상): 알림톡(`counselor_request_v1`) + FCM 푸시(`event_url:'/counselor/mypage'`) + 인앱 `inbox.record`(code `call_request`, `linkUrl:'/counselor/mypage'`).
- controller 채널 화이트리스트: `body?.channel === 'phone' || 'chat' ? channel : undefined`.

## 2) 콜백 — 상담가능 전환 시 대기 고객 재알림

`setMyAvailability` 안에서 트리거:
```ts
const wasOffline = c.state === 'ABSE' || c.state === 'RESV';  // ⚠️ ABSE 뿐 아니라 RESV(예약중)도 포함
if (wasOffline && target !== 'ABSE' && !unchanged) {
  this.notifyRequestersOnAvailable(counselorId).catch(...);   // fire-and-forget, 응답 비블로킹
}
```
> ❗ `c.state==='ABSE'` 만 보면 RESV 상담사에 요청한 고객을 영영 놓친다(프론트 counselor-mapper `isOffline = ABSE || RESV`와 불일치). 반드시 `wasOffline`.

`notifyRequestersOnAvailable` — **원자 claim (재발송·유실 방지)**:
```sql
UPDATE counselor_request_alert SET callback_sent_at = now()
 WHERE counselor_id=:cid AND callback_sent_at IS NULL AND requested_at > now() - interval '24 hours'
RETURNING id, member_id, channel
```
- 잡은 행만 발송 → 발송 루프 도중 들어온 신규 요청은 `callback_sent_at` NULL 유지 → 다음 켜기 때 정상 포착(**유실 없음**).
- 동시 토글(더블탭/두 기기)이면 한 호출만 행 획득 → **콜백 중복 발송 없음**.
- 각 행: FCM(`event_url:'/counselors/:cid'`) + `inbox.record`(code `counselor_available`).

## 3) 대시보드 "지금 상담 켜기" 카드

- `GET /user/counselors/me/consult-requests` → `getMyConsultRequests(counselorId)`:
  `callback_sent_at IS NULL AND requested_at > now()-24h`, `JOIN member`(닉네임), `ORDER BY requested_at DESC LIMIT 10`.
  ⚠️ 라우트는 `@Get(':id')` **앞**에 선언(`me/*` 그룹) — 아니면 `consult-requests`가 `:id`로 파싱됨.
- 프론트 `web/user/src/pages/CounselorMyPage.tsx`: `consultRequests` state, 30초 폴링 + visibilitychange + focus 갱신, `!available && length>0` 노출.
- **원터치 켜기 = 원래 채널 보존**:
  ```ts
  updateAvailability(callOn || chatOn ? { available: true } : { available: true, use_phone: true })
  ```
  `available`만 보내면 백엔드 `usePhone = input.use_phone ?? c.use_phone`로 **기존 채널 유지**(전화만 하던 상담사에 채팅 강제 안 켜짐). 둘 다 꺼진 상담사만 `use_phone:true`로 최소 전화 오픈(안 그러면 `target=ABSE`로 되돌아감).

## 4) 딥링크 & 요청됨 표시

- **딥링크**: 요청 알림 `event_url`/`linkUrl` = `/counselor/mypage` (상담사 대시보드, App.tsx 실재). ⚠️ bare `/counselor`는 라우터에 없어 catch-all→회원홈으로 튕김(옛 버그). 상담사 딥링크는 반드시 `/counselor/mypage` 등 실재 경로.
- **is_requested**: 목록/상세가 로그인 회원의 24h 요청 여부를 내려줌 → 카드·상세 CTA "요청됨" 표시. `getDetail(id, requesterId?)`가 `is_liked` 패턴으로 조회, `PublicCounselorDetail.is_requested`.
- **부재 CTA**: 카드·상세 모두 "전화 요청 / 채팅 요청" 2버튼(`CounselorCard.tsx`, `CounselorDetailLayout.tsx`). hideChat=true(전화전용)면 전화만.

## 파일 위치
| 역할 | 파일 |
|---|---|
| 요청 생성·콜백·조회 | `api/src/user/counselors/counselors.service.ts` (requestConsult / notifyRequestersOnAvailable / setMyAvailability / getMyConsultRequests) |
| 엔드포인트 | `api/src/user/counselors/counselors.controller.ts` |
| 부재 카드 2버튼 | `web/user/src/components/CounselorCard.tsx` |
| 상세 2버튼 CTA | `web/user/src/components/CounselorDetailLayout.tsx` |
| 대시보드 카드 | `web/user/src/pages/CounselorMyPage.tsx` |
| API 클라이언트 | `web/user/src/lib/api.ts` (counselorMypageApi.getConsultRequests, requestConsult) |
| 마이그레이션 | `api/db/migrations/20260703000000_counselor_request_channel.sql`, `20260703010000_counselor_request_callback.sql` |

## 검증 도구
- `tools/_verify_callback_claim.py` — 콜백 원자 claim(발송대상/재발송방지/유실방지)
- `tools/_verify_callback_round2.py` — 배포물(소스+dist) 반영 + 멱등 실동작
- `tools/_verify_consult_requests.py` — 대시보드 카드 데이터원 SQL
- E2E: `e2e/tests/99-absent-counselor-finger.spec.ts`(부재 카드·상세 2버튼), `98-absent-counselor-listed.spec.ts`(부재 노출)

## 불변식 / 함정
1. **콜백 대상 = `callback_sent_at IS NULL`** — 마킹은 반드시 잡은 id 기준(원자 claim). 조건 재평가로 일괄 UPDATE 하면 발송 루프 중 신규 요청이 유실됨.
2. **wasOffline은 ABSE + RESV** — 둘 중 하나만 보면 재연결 누락.
3. **원터치는 `available`만** — 채널 강제 켜기 금지(상담사 원래 설정 파괴).
4. **딥링크는 실재 경로만** — bare `/counselor` 금지.
5. **연결 시작은 항상 고객측** — 상담사 자동 발신/자동 채팅개시 경로 없음. 콜백은 "다시 알림"이지 "자동 연결"이 아님.
