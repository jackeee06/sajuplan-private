# [AI 전용] FCM 푸시 — 기술 상세 (2026-06-11 전면 업데이트)

## Firebase 프로젝트 정보

| 항목 | 값 |
|---|---|
| 프로젝트 ID | `sajummon-5a4c0` |
| 서비스 계정 키 경로 | `/data/wwwroot/api.sajumoon.co.kr/secrets/fcm-service-account.json` |
| 환경변수 | `FCM_CREDENTIALS_PATH=./secrets/fcm-service-account.json` |
| 키 만료 사고 | 2026-06-08 (invalid_grant) → 2026-06-10 갱신 완료 |
| 키 갱신 방법 | Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → JSON 업로드 후 pm2 reload |

> ⚠️ `FCM_CREDENTIALS_PATH` 미설정 또는 키 파일 없으면 `PushService.enabled=false` → 모든 sendToTokens/sendToTopic 호출이 `{ok:false, error:'FCM 비활성'}` 반환. 알림톡은 별개라 영향 없음.

---

## 핵심 코드 위치

| 파일 | 역할 |
|---|---|
| `api/src/shared/push/push.service.ts` | FCM Admin SDK 래퍼 — sendToTokens, sendToTopic, subscribeToTopic, unsubscribeFromTopic |
| `mobile/src/fcm.ts` | RN 앱 FCM 처리 — 토큰 발급·등록, 포그라운드 메시지, 딥링크 핸들러 |
| `mobile/App.tsx` | initFcm 호출, onForegroundMessage 인앱 배너, onNotificationOpen 딥링크 |
| `api/src/user/auth/auth.service.ts` | 로그인/로그아웃 시 토픽 구독 토글 (updatePushTopics) |
| `api/src/admin/notifications/notifications.service.ts` | 관리자 일괄 발송 + push-test 엔드포인트 |

---

## FCM 토픽 구조

| 토픽 | 대상 | 구독 시점 | 해제 시점 |
|---|---|---|---|
| `chl_all` | 앱 설치한 모든 사용자 | 앱 최초 부팅 시 (`initFcm`) | 없음 (영구) |
| `chl_2` | 일반 회원 | 회원으로 로그인 시 | 상담사로 로그인 시 (토글) |
| `chl_5` | 상담사 | 상담사로 로그인 시 | 회원으로 로그인 시 (토글) |

**토픽 구독 흐름:**
```
앱 부팅 → initFcm() → chl_all 구독 + 토큰 서버 등록
    ↓
로그인 (role=user)  → POST /api/user/auth/push-topics { subscribe: ['chl_2'], unsubscribe: ['chl_5'] }
로그인 (role=counselor) → POST /api/user/auth/push-topics { subscribe: ['chl_5'], unsubscribe: ['chl_2'] }
로그아웃 → chl_2, chl_5 모두 해제 (chl_all 유지)
```

---

## 발송 코드 전수 (2026-06-11 기준)

### 1. 채팅 상담 요청 → 해당 상담사 (토큰, 1:1)
```typescript
// api/src/user/consult/consult.service.ts:notifyCounselorChatRequest
push.sendToTokens(counselorTokens, {
  title: '채팅 상담 요청이 도착했습니다',
  body: `${memberName} 님이 채팅상담을 신청했습니다. 3분 안에 입장해주세요.`,
  data: { type: 'chat_request', counselor_id: '..', chat_room_id: '..', event_url: '/chat/{id}' },
})
```

### 2. 전화 상담 요청 → ⚠️ 전체 상담사 (토픽 브로드캐스트 버그)
```typescript
// api/src/user/counselors/counselors.service.ts:requestConsult
push.sendToTopic('chl_5', {
  title: '상담 요청이 도착했습니다',
  body: `${requesterNick} 님이 상담을 요청했습니다.`,
  data: { type: 'counselor_request', counselor_id: '..', link: '/mypage' },
})
// ⚠️ 버그: chl_5 = 전체 상담사. 특정 상담사만 받아야 함 → sendToTokens로 교체 필요
```

### 3. 문의(QnA) 도착 → ⚠️ 전체 상담사 (토픽 브로드캐스트 버그)
```typescript
// api/src/user/qna/qna.service.ts:notifyQaAsk
push.sendToTopic('chl_5', {
  title: '새 문의가 도착했습니다',
  body: '상담 문의가 접수되었습니다.',
  data: { type: 'qa_ask', counselor_id: '..', qna_id: '..', link: '/counselor/mypage/customer-qnas/{id}' },
})
// ⚠️ 버그: chl_5 = 전체 상담사. 특정 상담사만 받아야 함 → sendToTokens로 교체 필요
```

### 4. 등급 승급 → 해당 상담사 (토큰, 1:1)
```typescript
// api/src/shared/grade-upgrade/grade-upgrade.service.ts
push.sendToTokens(counselorTokens, {
  title: `${gradeName}으로 승급되었습니다!`,
  body: '마이페이지에서 단가를 변경하실 수 있습니다.',
  data: { type: 'grade_upgraded', counselor_id: '..', event_url: '/counselor/mypage/grade' },
})
```

### 5. 문의 신고 알림 → 신고당한 회원 (토큰, 1:1)
```typescript
// api/src/user/qna/qna.service.ts:sendReportPush
push.sendToTokens(memberTokens, {
  title: '내 문의가 신고됐습니다',
  body: '게시된 문의에 신고가 접수되었습니다.',
  data: { type: 'qna_reported', qna_id: '..', link: '/mypage/my-qnas' },
})
```

### 6. 관리자 일괄 발송
```typescript
// api/src/admin/notifications/notifications.service.ts:sendPush
// target='all'   → sendToTopic('chl_all', ...)
// target='user'  → sendToTopic('chl_2', ...)
// target='counselor' → sendToTopic('chl_5', ...)
// 또는 개별 토큰 → sendToTokens([tokens], ...)
```

---

## data 페이로드 컨벤션

서버가 FCM data에 항상 포함해야 하는 필드:

| 필드 | 용도 | 예시 |
|---|---|---|
| `type` | 이벤트 종류 식별 | `chat_request`, `counselor_request`, `qa_ask`, `grade_upgraded` |
| `event_url` | 딥링크 (최우선) | `/chat/123`, `/counselor/mypage/grade` |
| `link` | 딥링크 (event_url 없을 때 폴백) | `/mypage` |
| `counselor_id` | 수신자 상담사 ID | `'91'` |
| `chat_room_id` | 채팅방 ID (chat_request 한정) | `'456'` |

> **딥링크 키 우선순위** (mobile/src/fcm.ts `extractDeepLink`):
> `event_url` → `url` → `link` → `target_url` → `move_url` → `landing_url` → `path` → `deeplink`
> 서버 표준은 `event_url` 사용. 없으면 `link` 폴백.

---

## 모바일 앱 FCM 처리 흐름

```
앱 부팅
  └── initFcm()                          (mobile/src/fcm.ts)
        ├── 알림 권한 요청 (Android 13+ / iOS)
        ├── FCM 토큰 발급
        ├── chl_all 구독
        └── 서버에 토큰 등록 (POST /api/user/auth/push-token)

포그라운드 메시지 수신
  └── onForegroundMessage()              (App.tsx useEffect)
        └── 인앱 배너 표시 (InAppNotification 컴포넌트)
              └── 배너 탭 → extractDeepLink → navigateWebView(url)

백그라운드 → 알림 탭
  └── onNotificationOpenedApp()          (mobile/src/fcm.ts onNotificationOpen)
        └── extractDeepLink → cb(url) → App.tsx navigateWebView(url)

앱 종료 → 알림 탭 (콜드스타트)
  └── getInitialNotification()           (mobile/src/fcm.ts onNotificationOpen)
        └── extractDeepLink → cb(url) → App.tsx navigateWebView(url)
```

> ✅ **딥링크 완전 구현됨** (2026-06-10 App.tsx 확인). 앱 어떤 상태에서든 알림 탭 → 해당 화면 자동 이동.

---

## DB 스키마

```sql
-- FCM 토큰 저장
member_push_token (
  id           SERIAL PRIMARY KEY,
  member_id    INT REFERENCES member(id),
  token        VARCHAR NOT NULL,  -- Firebase FCM 토큰
  platform     VARCHAR,           -- 'ios' / 'android'
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
)
```

---

## 테스트 방법

### 관리자 push-test API (권장)

```bash
# 1. 서버에서 직접 curl (CORS 없이)
# admin 로그인
curl -c /tmp/cookie.txt -X POST http://localhost:3001/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"mb_id":"admin_e2e","password":"1234!"}'

# 토픽으로 발송
curl -b /tmp/cookie.txt -X POST http://localhost:3001/api/admin/notifications/push-test \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/payload.json   # 한글은 반드시 UTF-8 파일로 작성

# payload.json 예시
{"topic":"chl_5","title":"테스트","content":"내용"}
{"token":"FCM_TOKEN_HERE","title":"개인 테스트","content":"내용"}
```

> ⚠️ **PowerShell에서 한글 직접 입력 금지** — cp949 인코딩으로 글자 깨짐 발생.
> 반드시 Python/SFTP로 UTF-8 JSON 파일을 서버에 올린 후 `--data-binary @file` 방식 사용.

### PM2 로그로 발송 성공 확인

```bash
pm2 logs sajumoon-api --lines 30 | grep -E "FCM|sendToTopic|sendToTokens|invalid_grant"
```

성공: `messageId: projects/sajummon-5a4c0/messages/XXXXX`
실패: `sendToTopic(chl_5) 실패: invalid_grant: Invalid JWT Signature` → 키 갱신 필요

---

## 서비스 계정 키 갱신 절차 (장애 대응)

```
1. Firebase 콘솔 → sajummon-5a4c0 → 프로젝트 설정 → 서비스 계정
2. "새 비공개 키 생성" → JSON 다운로드
3. JSON 파일 → /data/wwwroot/api.sajumoon.co.kr/secrets/fcm-service-account.json 업로드
   (기존 파일은 .bak으로 백업 권장)
4. pm2 reload sajumoon-api
5. 로그 확인: "Firebase Admin 초기화 완료 (project=sajummon-5a4c0)"
```

> **키 유효기간 없음** — 직접 삭제하거나 Firebase 콘솔에서 revoke하지 않는 한 만료 없음.
> 2026-06-08 사고는 이전 세션에서 키 파일이 손상/삭제됐던 것으로 추정.

---

## 알려진 버그 및 개선 필요 항목

| 버그 | 위치 | 심각도 | 개선 방법 |
|---|---|---|---|
| 전화 요청 브로드캐스트 | `counselors.service.ts:requestConsult` | ⚠️ 중 | sendToTopic('chl_5') → sendToTokens(해당 상담사 토큰) |
| QnA 브로드캐스트 | `qna.service.ts:notifyQaAsk` | ⚠️ 중 | 동일 |
| 토큰 만료 정리 없음 | member_push_token | 🔵 낮 | 30일 이상 미갱신 토큰 is_active=false 처리 cron 추가 |

---

## 운영 SQL

```sql
-- 푸시 토큰 보유 회원 수
SELECT COUNT(DISTINCT member_id) FROM member_push_token WHERE is_active = TRUE;

-- 특정 회원의 FCM 토큰 (최신순)
SELECT token, platform, is_active, updated_at
FROM member_push_token
WHERE member_id = {id} ORDER BY updated_at DESC;

-- 30일 이상 미갱신 토큰 (만료 의심)
SELECT COUNT(*) FROM member_push_token
WHERE updated_at < NOW() - INTERVAL '30 days' AND is_active = TRUE;

-- 토픽 구독 현황은 Firebase 콘솔에서만 확인 가능 (DB에 없음)
```

---

## 관련 메모리/문서

- `[[fcm-push-system]]`
- `[[alert-channel-policy]]`
- `[[alert-system-complete]]`
- [ALERT_MAPPING.md](../../ALERT_MAPPING.md)
