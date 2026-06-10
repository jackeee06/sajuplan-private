# [AI 전용] 내 상담 내역 — 기술 상세

## 조회 API

```
GET /api/user/consult/history
  ?page=1
  &limit=10
  &type=all | call | chat
  &role=member | counselor
```

- **인증**: `UserAuthGuard` (JWT). `req.user.sub` = 본인 member id.
- **role**: 미지정 시 토큰 role 로 폴백. `counselor` 면 `counselor_id = me`, 그 외엔 `member_id = me` 기준.
  - ⚠️ 프론트는 회원 화면에서 **항상 `role: 'member'` 명시**. 미지정 시 듀얼역할자(상담사)가 counselor 시점으로 조회돼 "본인이 상담해준 건"이 회원 상담내역에 섞이는 버그가 있었음 (2026-06-10 수정, MyHistory/MyCalls/MyChats 모두 명시).
- **type**:
  - `call` → `c.roomid IS NULL OR c.roomid = ''`
  - `chat` → `c.roomid IS NOT NULL AND c.roomid <> ''`
  - `all` → 필터 없음
- **limit**: 최대 50 (`Math.min(50, ...)`), 기본 10.

핵심 위치: `api/src/user/consult/consult.service.ts` `history()` (controller `history` 핸들러는 consult.controller.ts).

## 어떤 row 가 보이나

```sql
WHERE c.{ownerCol} = :me
  AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')   -- 종료된 상담만
  AND c.counselor_id IS NOT NULL                                  -- ★ 연결 실패 로그 숨김
  AND NOT EXISTS (진행 중 STAY/CNCH 채팅방)                        -- 같은 상대 진행 중이면 ended 카드 숨김
```

- **`counselor_id IS NOT NULL` (consult.service.ts:1005)** — counselor_id 가 NULL 인 통화 실패 로그(상담사 미매칭, 0초·0원)는 회원 마이페이지에서 숨긴다. **2026-05-29 수정** — "0초 0원" 빈 카드 노출 방지.
- `ownerCol` / `peerCol` 은 role 에 따라 member_id ↔ counselor_id 로 스왑.

## active_chat UNION (진행 중 채팅)

- `type !== 'call'` 일 때만 `chat_room` 의 `STAY`/`CNCH` 방을 `'active_chat'` kind 로 UNION.
- 응답에 `is_active_chat: true`, `chat_room_id`, `chat_status` 동봉 → 프론트가 "채팅방 재입장하기" 버튼 노출.
- 정렬: active_chat 카드는 항상 목록 끝(`CASE WHEN kind='active_chat' THEN 1 ELSE 0`), 나머지는 `sort_at DESC`.

## 응답 스키마 (`ConsultHistoryItem`)

```ts
{
  id, consult_type: 'call'|'chat', consult_type_label,
  started_at, ended_at,
  usetm_seconds, usetm_label,        // "00시간17분30초"
  amt,                               // 사용 코인
  counselor_id, counselor_name, counselor_code,
  counselor_avatar, counselor_avatar_webp,
  counselor_badge: '사주'|'타로'|'신점'|'기타',
  review_id, reply_id,               // 후기/답변 매칭
  chat_room_id, chat_status, is_active_chat,
}
// + total, page, limit, other_role_count
```

- `usetm_label` = `formatUsetm(seconds)` → `HH시간MM분SS초`.
- `counselor_badge` = `inferBadge(specialty, hashtag1, hashtag2)` — 텍스트에 타로/신점/사주 포함 여부로 판정, 없으면 `기타`(프론트에서 뱃지 미노출).
- `review_id` 매칭: 1순위 `post_review.extras->>'consultation_id'` 정확 매칭, 폴백은 (member_id, counselor_id)+시간순 + 중복 방지 (LATERAL).
- `other_role_count` — 반대 역할 시점 종료 상담 건수. `> 0` 일 때만 프론트가 "회원 ⇄ 상담사 모드 전환" 안내 노출. 일반 회원은 0 → 안내 비노출.

## self 상담 차단 (2026-06-11)

`startPhone` / `startChat` 둘 다:

```ts
if (Number(params.memberId) === Number(params.counselorId)) {
  throw new BadRequestException('본인에게 상담을 요청할 수 없습니다.');
}
```

- JWT `sub` 는 런타임에 문자열일 수 있어 `===` 직접 비교가 타입 불일치로 무력화됐음 → `Number()` 정규화로 수정. (self 상담이 실제로 발생했던 버그)

## 프론트 매핑

| 화면 | 파일 | 호출 |
|------|------|------|
| 통합 | `web/user/src/pages/MyHistory.tsx` | `historyApi.list({ role:'member', page, limit:10, type:filter })` |
| 전화 | `web/user/src/pages/MyCalls.tsx` | `historyApi.list({ role:'member', type:'call', page:1, limit:50 })` |
| 채팅 | `web/user/src/pages/MyChats.tsx` | `historyApi.list({ page:1, limit:50, type:'chat' })` |

- 후기 상태 분기 (프론트):
  - `is_active_chat` → `'noaction'` (재입장 버튼)
  - `review_id != null` → `'written'`
  - `usetm_seconds < 300` → `'noaction'` (5분 후기 정책, 백엔드 reviews.service.ts:520 과 동기화)
  - 그 외 → `'unwritten'`

## E2E

- `e2e/tests/29-my-calls-realdata.spec.ts` — 전화상담 내역 실데이터 전환 검증.

## 관련 메모리

- `[[id-unification-complete]]` (회원 m2net_membid / 상담사 csrid)
- `[[prepaid-chat-plan]]` (채팅 시간 사전선택·차감 모델)
