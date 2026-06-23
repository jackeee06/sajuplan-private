# [AI 전용] 통합 알림함 — 기술 상세 (2026-06-20 통합 인박스 반영)

## DB — `notification_log` (⚠️ 옛 문서의 'notification' 단수 테이블은 오류. 실제는 notification_log)

```
notification_log
- id BIGSERIAL
- member_id INT NULL        — 개별 대상. NULL + mb_id='all' 이면 브로드캐스트
- mb_id VARCHAR             — 'all'(브로드캐스트) 또는 특정 회원 mb_id
- title VARCHAR
- content TEXT
- link_url VARCHAR NULL     — 클릭 시 이동 경로 (내부 '/path' 또는 외부 'https://...')
- category VARCHAR          — '전체공지' | '일반회원' | '상담사' | '개별'
- code VARCHAR NULL         — 이벤트 코드(아이콘/라벨 매핑). 'chat_request'|'call_request'|'qna_ask'|'qna_answer'|'qna_reported'|'review'|'grade'|'absent'|'chat_cancelled'|'settlement'|'payout'|'coupon' ...
- via_inapp BOOLEAN  def t  — 종모양 노출 여부 (목록은 이게 true 만 조회)
- via_push BOOLEAN   def f  — FCM 푸시로도 발송됐는가 (📲푸시 뱃지)
- via_alimtalk BOOLEAN def f — 카카오 알림톡으로도 발송됐는가 (💬카톡 뱃지)  ← 마이그 20260619200000
- viewed_by JSONB          — 읽은 사용자 mb_id 배열(jsonb). per-user read 추적
- actor_member_id BIGINT NULL  — ★보낸 사람(이벤트 유발자) member.id  ← 마이그 20260621000000
- actor_mb_id VARCHAR NULL      — 보낸 사람 mb_id(표시용). 과거행은 NULL(역할로만 추론)
- created_at TIMESTAMPTZ
- INDEX idx_notification_log_member_time (member_id, created_at DESC)  ← 마이그 20260619200000
```

> **보낸 사람(actor) 기록(2026-06-21)**: notification_log 는 원래 **받는 사람만** 저장 → 관리자 알림이력에서 "누가→누구" 중 "누가"를 알 수 없었음. `actor_member_id`/`actor_mb_id` 추가로 **앞으로 발생분은 "회원→상담사" 양쪽 식별** 가능. 과거행은 NULL → 역할 추론으로만 표시.

- 마이그레이션: `20260619000000_notification_channels.sql`(via_inapp/via_push) + `20260619200000_notification_inbox.sql`(via_alimtalk + member_time 인덱스).
- **read 판정은 per-user**: `viewed_by` 에 본인 mb_id 포함 여부 (`read = !!myMbId && viewers.includes(myMbId)`). 전역 is_read 아님. 읽음 처리는 `viewed_by ? mb_id` 추가.
- 비로그인은 mb_id 없음 → 전체공지가 항상 unread 로 보임.

## ★ 통합 인박스 기록 — `InboxService` (2026-06-20)

핵심 설계: **비즈니스 이벤트 발생 지점에서 한 행만 기록**하고, 실제 나간 채널을 플래그로 박는다. → 한 사건 = 한 줄(중복 없음), event_key 플러밍 불필요.

- `api/src/shared/inbox/inbox.service.ts` — `InboxService.record({ memberId, code, title, content?, linkUrl?, viaPush?, viaAlimtalk?, actorMemberId? })`.
  - `via_inapp` 는 항상 true(종모양 노출), `category='개별'`, mb_id 는 member 조회로 채움.
  - **`actorMemberId`(2026-06-21)**: 보낸 사람. 있으면 그 회원 mb_id 조회해 `actor_member_id`/`actor_mb_id` 박제. **actor 전달 5개 이벤트**: review(후기 쓴 회원=`authorMemberId`) / qna_ask(문의한 `memberId`) / qna_answer(답변한 상담사 `counselorId`) / call_request(`params.requesterId`) / chat_request(`cr.member_id` SELECT 추가). 나머지(정산·선지급·쿠폰·등급·부재·취소)는 운영/시스템 발신이라 actor 없음.
  - **best-effort**: 절대 throw 안 함(try/catch + warn). 본 비즈니스/머니 흐름 무영향.
  - `@Global() InboxModule`(`shared/inbox/inbox.module.ts`) → AppModule 1회 import, 어디서든 주입.
- **이벤트 발송 지점(record 호출처)** — 각 지점은 푸시/알림톡 보낸 직후 1회 호출:
  - 채팅요청 `consult.service.ts notifyCounselorChatRequest`(code `chat_request`)
  - 채팅 자동취소 `consult.service.ts notifyMemberChatAutoCancelled`(`chat_cancelled`)
  - 상담사 부재 `consult.service.ts notifyCounselorAutoAbsent`(`absent`)
  - 문의도착 `qna.service.ts notifyQaAsk`(`qna_ask`) / 답변 `notifyQaAnswer`(`qna_answer`) / 신고 `sendReportPush`(`qna_reported`)
  - 후기 `reviews.service.ts notifyCounselorOfReview`(`review`)
  - 전화요청 `counselors.service.ts requestConsult`(`call_request`, viaPush/viaAlimtalk=실제 발송결과)
  - 등급승급 `grade-upgrade.service.ts checkAndUpgrade`(`grade`)
  - 정산완료 `admin/settlements.service.ts notifySettlementComplete`(`settlement`)
  - 선지급 `admin/payouts.service.ts`(rejected/paid) + `user/counselor-mypage-payout.service.ts`(received) → `payout`
  - 쿠폰 `admin/coupon-zones.service.ts notifyCouponCode`(`coupon`)
- **🔒 보안 — record 미호출(원천 차단)**: 인증번호(`register_num_v2`)·임시비번(`register_idpw1`)·운영자 OpsAlert(`ops_admin_alert`)·가상계좌(PII)는 **record 를 부르지 않는다**. 전화번호 매칭/블랙리스트 필터가 아니라 호출 자체를 안 해서 민감정보가 알림함에 들어올 경로가 없음.

## 노출 규칙 — `api/src/user/notifications/notifications.service.ts`

- 로그인 일반회원: `member_id=본인` OR `(member_id IS NULL AND mb_id='all' AND category = ANY('전체공지','일반회원'))`
- 로그인 상담사: 본인 개별 + 전체공지/상담사 브로드캐스트
- 비로그인: `category='전체공지'` 만
- 최근 6개월(`created_at >= now() - interval '6 months'`), 최신순.

## API — `web/user/src/lib/api.ts` (notificationsApi)

- `list()` → `GET /api/user/notifications` → `{ items: PublicNotificationItem[] }`
  - `PublicNotificationItem = { id, title, content, link_url, category, code, via_push, via_alimtalk, read, created_at }` (code/via_* 는 2026-06-20 추가)
- `unreadCount()` → `GET /api/user/notifications/unread-count` → `{ count }` (종모양 뱃지용, OptionalUserGuard — 비로그인 0). 서비스 `unreadCount()`: list 와 동일 노출 규칙 + `NOT (viewed_by ? mb_id)` COUNT.
- `read(id)` → `POST /api/user/notifications/:id/read`
- `readAll()` → `POST /api/user/notifications/read-all`

## 화면 3단 (2026-06-11 개편)

### ① 마중 배너 — `web/user/src/components/NotificationGreetBanner.tsx`
- 홈(`Home.tsx`) **점검배너(MaintenanceBanner) 바로 아래** 렌더 (긴급도: 점검 > 알림 마중).
- `notificationsApi.list()` → `items.filter((n) => !n.read).length` = 안 읽은 수. `> 0` 이면 노출, 0이면 null.
- 보라→핑크 그라데이션 카드 + 흔들리는 🔔 + 슬라이드/바운스 등장 (컴포넌트 내 `<style>` 주입: `njbSlide`/`njbRing`).
- 탭 → `<Link to="/notifications">`. X → `sessionStorage('notif_greet_banner_dismissed_v1')` (세션 동안 숨김).

### ⓪ 종모양 뱃지 — `web/user/src/components/NotificationBell.tsx` (2026-06-20)
- 헤더 종모양🔔 + 안읽음 빨간 숫자 뱃지(`99+` cap) + 안읽음>0 시 `nbBounce` 까딱.
- `notificationsApi.unreadCount()` 폴링(마운트 + `setInterval 60s` + `useRefreshOnFocus`).
- 헤더 7곳 인라인 벨을 이 컴포넌트로 교체: Home(`containerClassName="w-10 h-10"`), MemberMyPage, CounselorMyPage, MyPage, CounselorList, Favorites, CounselorApply.

### ② 알림함 — `web/user/src/pages/Notifications.tsx`
- 카드형 `<ul>` (`bg-[#f6f7f9]`, 흰 카드 + 그림자, `space-y-2.5`).
- `metaFor(n) = codeMeta(n.code) ?? catMeta(n.category)` — **code 우선**, 없으면 category.
  - `codeMeta(code)`(**export**): chat_request 💬 / call_request 📞 / qna_ask ❓ / qna_answer 💡 / qna_reported 🚨 / review ⭐ / grade 🎉 / absent 🌙 / chat_cancelled ⏱️ / settlement 💰 / payout 💸 / coupon 🎁
  - `catMeta(category)`(**export**): 전체공지 📢 `#8259F5` / 상담사 👤 `#00BBA7` / 일반회원 👥 `#3B82F6` / 개별 🔔 `#ec4899`
- **채널 뱃지**: `n.via_push && <ChannelBadge '푸시'>` / `n.via_alimtalk && <ChannelBadge '카톡'>` (라벨 행에 회색 pill).
- 안읽음: 빨간 점(`#ef4444`) + 굵은 제목 / 읽음: `opacity-60` + 흐린 색 + "읽음".
- `onItemClick`: 미읽음+로그인이면 `read(id)` 비동기 + optimistic 갱신 → `navigate('/notifications/'+id, { state:{ notification:{...n, read:true} } })`.
- 상세(`NotificationDetail.tsx`)도 `codeMeta(code) ?? catMeta(category)` + `📲 푸시`/`💬 카톡` 뱃지 표시.

### ③ 알림 상세 — `web/user/src/pages/NotificationDetail.tsx` (라우트 `/notifications/:id`)
- router state 로 알림 객체 받으면 즉시 표시. 없으면(딥링크 진입) `list()` 재조회 후 id 매칭 (**단건 조회 API 없음**).
- 미읽음 진입 시 `read(id)`.
- 본문: `content` 가 `<` 로 시작하면 `dangerouslySetInnerHTML`(`.notice-html`), 아니면 `whitespace-pre-line`.
- `link_url` 있으면 하단 **[바로가기]** → `goLink()`: 내부(`/...`) `navigate` / 외부(`https://` 또는 `도메인.com`) `openExternalUrl` (WebView 대응, `window.open` 금지).

## 발송(쌓기) / 정리

- 관리자 발송: `admin/notifications.service.ts sendPush({channels:{inapp,push}})` → `notification_log` INSERT(**`via_inapp`/`via_push` 플래그**). 관리자 "알림 보내기"(`/push-notifications`)에서 [🔔인앱][📲푸시] 채널 선택(2026-06-19, 마이그 `20260619000000_notification_channels`).
- **이벤트 발송(2026-06-20)**: 위 §통합 인박스 12종 이벤트는 발송 지점에서 `InboxService.record(...)` 로 `notification_log` 에 개별행 INSERT(`category='개별'`, `code`, `via_push`/`via_alimtalk` 플래그). 종모양이 "모든 알림 한 곳"이 된 핵심.
- **종모양 노출 필터(★)**: 사용자 조회(`user/notifications.service.ts list()`)는 `WHERE via_inapp = true` → **푸시-only(via_inapp=false)는 종모양에서 제외**. 이벤트성 인앱(플래그 미지정)은 default `via_inapp=true` → 정상 노출.
- 관리자 이력 채널 필터: `pushHistory({channel:'inapp'|'push'})`. 검증 스펙 `e2e/tests/109-notification-channels.spec.ts` + 통합 인박스 `e2e/tests/110-notification-inbox.spec.ts`(안읽음카운트 API·채널/코드 필드·벨 이동·문의→상담사 알림함 기록 양방향).
- **테스트/누적 정리**: 관리자 "알림 보내기" → "보낸 이력 → 내역 비우기" → `DELETE FROM notification_log` (`clearPushHistory`, `@Delete('push-history')`).

## 관리자 알림 이력 화면 (NotificationHistory, `/mng/notification-history`) — 2026-06-21 개편

- 데이터 = `notification_log`(인앱·푸시 보낸 기록). 카카오 **알림톡 발송 이력**(`alimtalk_log`)은 별도 메뉴 [`/mng/alert-logs`](alert/08-alert-logs).
- 조회 API `admin/notifications.service.ts pushHistory()` — SELECT 에 `n.code, n.viewed_by, n.actor_member_id, n.actor_mb_id` + 받는이 `m` · 보낸이 `am` **2중 LEFT JOIN**(name/nickname/role).
- **컬럼**: 일시 · 종류 · 분류 · 채널 · 제목 · **보낸 → 받는** · 아이디 · 읽음 · 관리.
  - **종류**: `code` → 아이콘+라벨(📢공지/💬채팅요청/📞전화요청/❓문의/💡답변/⭐후기/🎉등급/💰정산/💸선지급/🎁쿠폰/🚨신고/⏱️취소). 미매핑은 원본.
  - **보낸→받는(방향)**: actor 기록 있으면 **실명**(예 "홍길동 → 선샤인선생"), 없으면(과거/시스템) **역할 추론**. FLOW: review/qna_ask/call_request/chat_request=회원→상담사, qna_answer=상담사→회원, settlement/payout/coupon=운영→…, grade/absent/chat_cancelled=시스템→…. 색: 회원=파랑·상담사=청록·운영=보라·시스템=회색. 화살표 진하게(gray-600 bold).
  - **읽음**: 개별(member_id 있음)만 — `viewed_by` 에 수신자 mb_id 포함이면 "읽음" 아니면 "안읽음". 브로드캐스트는 `—`.
  - **아이디**: 받는이 mb_id, 짧게 truncate(회색·툴팁 전체값).
- **200줄/페이지 + 하단 페이지네이션**(`PaginationBar`), 행 조밀(`[&_td]:!py-0.5`).
- **URL 컬럼 제거**(2026-06-21): 단건 내용은 제목 클릭 모달이 담당, 중복이라 제거.
- 상단: 한 줄 타이틀(인라인 카운트) + 납작 툴바(검색+내역비우기) + 분류·채널 칩 (상담후기관리 표준).
- ⚠️ 데이터 한계: actor 는 **앞으로 발생분만** 채워짐. 과거행(2026-06-21 이전)은 actor NULL → "회원 → 선샤인선생"처럼 보낸쪽이 역할로만 표시.

## 운영 SQL

```sql
-- 비로그인 마중배너에 뜨는 숫자 = 전체공지(6개월) 수
SELECT count(*) FROM notification_log
 WHERE category='전체공지' AND created_at >= now() - interval '6 months';

-- 카테고리 분포
SELECT category, count(*) FROM notification_log GROUP BY category ORDER BY count(*) DESC;
```

## 백로그
- 30일 이상 옛 알림 자동 정리 cron 미구현. DB 증가 시 도입 검토.

## 관련
- `[[alert-system-complete]]` / [iOS 알림톡 OS 분기](alert/07-ios-alimtalk-crash)
