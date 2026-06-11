# [AI 전용] 인앱 알림 — 기술 상세 (2026-06-11 개편 반영)

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
- viewed_by TEXT[]          — 읽은 사용자 mb_id 배열 (per-user read 추적)
- created_at TIMESTAMPTZ
```

- **read 판정은 per-user**: `viewed_by` 배열에 본인 mb_id 포함 여부 (`read = !!myMbId && viewers.includes(myMbId)`). 전역 is_read 아님.
- 비로그인은 mb_id 없음 → 전체공지가 항상 unread 로 보임 (마중배너에 그 수만큼 뜸).

## 노출 규칙 — `api/src/user/notifications/notifications.service.ts`

- 로그인 일반회원: `member_id=본인` OR `(member_id IS NULL AND mb_id='all' AND category = ANY('전체공지','일반회원'))`
- 로그인 상담사: 본인 개별 + 전체공지/상담사 브로드캐스트
- 비로그인: `category='전체공지'` 만
- 최근 6개월(`created_at >= now() - interval '6 months'`), 최신순.

## API — `web/user/src/lib/api.ts` (notificationsApi)

- `list()` → `GET /api/user/notifications` → `{ items: PublicNotificationItem[] }`
  - `PublicNotificationItem = { id, title, content, link_url, category, read, created_at }`
- `read(id)` → `POST /api/user/notifications/:id/read`
- `readAll()` → `POST /api/user/notifications/read-all`

## 화면 3단 (2026-06-11 개편)

### ① 마중 배너 — `web/user/src/components/NotificationGreetBanner.tsx`
- 홈(`Home.tsx`) **점검배너(MaintenanceBanner) 바로 아래** 렌더 (긴급도: 점검 > 알림 마중).
- `notificationsApi.list()` → `items.filter((n) => !n.read).length` = 안 읽은 수. `> 0` 이면 노출, 0이면 null.
- 보라→핑크 그라데이션 카드 + 흔들리는 🔔 + 슬라이드/바운스 등장 (컴포넌트 내 `<style>` 주입: `njbSlide`/`njbRing`).
- 탭 → `<Link to="/notifications">`. X → `sessionStorage('notif_greet_banner_dismissed_v1')` (세션 동안 숨김).

### ② 알림함 — `web/user/src/pages/Notifications.tsx`
- 카드형 `<ul>` (`bg-[#f6f7f9]`, 흰 카드 + 그림자, `space-y-2.5`).
- `catMeta(category)` → `{ label, icon, color, bg }` (**export 됨** → NotificationDetail 이 재사용):
  - 전체공지 📢 `#8259F5` / 상담사 👤 `#00BBA7` / 일반회원 👥 `#3B82F6` / 개별 🔔 `#ec4899`
- 안읽음: 빨간 점(`#ef4444`) + 굵은 제목 / 읽음: `opacity-60` + 흐린 색 + "읽음".
- `onItemClick`: 미읽음+로그인이면 `read(id)` 비동기 + optimistic 갱신 → `navigate('/notifications/'+id, { state:{ notification:{...n, read:true} } })`.

### ③ 알림 상세 — `web/user/src/pages/NotificationDetail.tsx` (라우트 `/notifications/:id`)
- router state 로 알림 객체 받으면 즉시 표시. 없으면(딥링크 진입) `list()` 재조회 후 id 매칭 (**단건 조회 API 없음**).
- 미읽음 진입 시 `read(id)`.
- 본문: `content` 가 `<` 로 시작하면 `dangerouslySetInnerHTML`(`.notice-html`), 아니면 `whitespace-pre-line`.
- `link_url` 있으면 하단 **[바로가기]** → `goLink()`: 내부(`/...`) `navigate` / 외부(`https://` 또는 `도메인.com`) `openExternalUrl` (WebView 대응, `window.open` 금지).

## 발송(쌓기) / 정리

- 발송: `api/src/admin/notifications/notifications.service.ts` → `notification_log` INSERT (관리자 푸시 발송 시).
- **테스트/누적 정리**: 관리자 화면 `PushNotifications`(`/mng`) → "발송 이력 → 내역 비우기" → `DELETE FROM notification_log` (`clearPushHistory`, controller `@Delete('push-history')`).

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
