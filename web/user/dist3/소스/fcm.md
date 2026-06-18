# FCM 푸시 & 딥링크 연동 명세 (서버 ↔ 앱)

> 푸시 알림에 **이동할 URL**을 실어 보내면, 사용자가 알림을 탭했을 때
> 앱이 **WebView 안에서 그 URL로 자동 이동**한다.
> 이 문서는 ① 서버(웹)단이 FCM 메시지를 어떻게 구성해야 앱이 알아듣는지,
> ② 앱(React Native)단이 토큰을 어떻게 발급·전송하고 이동을 처리하는지 정의한다.

- 대상 앱: `mobile/` (RN 0.78 + react-native-webview + @react-native-firebase/messaging)
- 운영 도메인: `https://sajuplan.com` (API `https://api.sajuplan.com`)
- 테스트 도메인: `https://sajumoon.kr` (API `https://api.sajumoon.kr`)
- 패키지/번들 ID: `com.dmonster.sajumoon`

---

## 1. 핵심 규칙 (TL;DR)

- 이동 URL은 **`data` 페이로드의 `event_url` 키**에 넣는다.
- `data`의 모든 값은 **반드시 문자열(string)** 이어야 한다. (FCM `data` 규격)
- URL은 **절대 URL**(`https://...`) 또는 **경로**(`/event/123`) 둘 다 허용.
- 이동 URL이 없으면 그냥 알림만 뜨고, 탭해도 앱(홈)만 열린다.

```jsonc
"data": {
  "event_url": "https://sajuplan.com/event/123"   // ← 이 값으로 앱이 이동
}
```

> ✅ 더사주 기존 `send_noti_token()` / `send_noti_topic()` 이 이미
> `data['event_url']` 에 넣고 있으므로 **추가 작업 없이 그대로 호환**된다.
> (`web/android_push/send_fcm.php`)

---

## 2. 앱이 읽는 이동 URL 키 (우선순위)

`data`에서 아래 키를 **위에서부터** 찾아 처음 발견된 값을 이동 URL로 쓴다.
서버는 보통 **`event_url` 하나만** 쓰면 된다. 나머지는 레거시/호환용.

| 우선순위 | 키 | 비고 |
|---|---|---|
| 1 | `event_url` | **표준. 이것만 쓰면 됨** |
| 2 | `url` | 레거시 호환 |
| 3 | `link` | |
| 4 | `target_url` | |
| 5 | `move_url` | |
| 6 | `landing_url` | |
| 7 | `path` | |
| 8 | `deeplink` | |

> 구현 위치: `mobile/src/fcm.ts` 의 `extractDeepLink()`

---

## 3. 이동 URL 형식

| 형식 | 예시 | 앱 동작 |
|---|---|---|
| 절대 URL | `https://sajuplan.com/event/123` | 그대로 이동 |
| 외부 절대 URL | `https://other.com/x` | WebView 안에서 그대로 열림 |
| 경로(`/`로 시작) | `/event/123` | `https://sajuplan.com` + 경로 로 이동 |
| 상대 경로 | `event/123` | `https://sajuplan.com/` + 경로 로 이동 |

> **헷갈리면 절대 URL(`https://sajuplan.com/...`)로 보내는 것을 권장.**
> 구현 위치: `mobile/App.tsx` 의 `resolveDeepLink()` / `navigateWebView()`

---

## 4. FCM HTTP v1 페이로드 예시

엔드포인트: `https://fcm.googleapis.com/v1/projects/{project}/messages:send`

```jsonc
{
  "message": {
    "token": "<디바이스 FCM 토큰>",          // 또는 "topic": "chl_2"

    // 화면에 뜨는 알림(제목/본문). 표시용일 뿐 이동과 무관.
    "notification": {
      "title": "이벤트 안내",
      "body": "오늘만 무료 사주 이벤트!"
    },

    // ★ 이동 URL은 여기. 값은 전부 문자열.
    "data": {
      "event_url": "https://sajuplan.com/event/123",
      "push_type": "event",      // (선택) 서버 분류용 — 앱은 무시
      "ref_idx1": "123"          // (선택) 서버용 메타 — 앱은 무시
    },

    "android": {
      "priority": "high",
      "notification": { "channel_id": "default", "default_sound": true }
    },

    "apns": {
      "headers": { "apns-priority": "10" },
      "payload": { "aps": { "sound": "default" } }
    }
  }
}
```

> `data` 안에 `event_url` 외 다른 메타(`push_type`, `ref_idx1` 등)를 같이 넣어도
> 무방하다. 앱은 이동 URL 추출에만 `event_url`을 쓰고 나머지는 무시한다.

### 4.1 블록별 역할 (푸시 구조 요약)

| 블록 | 역할 | 이동(딥링크)과의 관계 |
|---|---|---|
| `notification` | OS가 띄우는 **알림 제목/본문/이미지** (표시 전용) | **무관.** 이것만 있고 `data.event_url` 이 없으면 탭해도 이동 안 함 |
| `data` | **앱이 읽는 커스텀 페이로드.** `event_url`(이동 URL) + 서버 메타 | **★ 이동의 근거.** `event_url` 값으로 이동 |
| `android` | Android 채널/우선순위(`channel_id`, `priority`) | 표시 옵션 |
| `apns` | iOS 사운드/우선순위(`aps.sound`, `apns-priority`) | 표시 옵션 |

> 한 줄 요약: **보이는 건 `notification`, 이동시키는 건 `data.event_url`.**
> 둘 다 넣어야 "알림이 뜨고 + 탭하면 이동" 이 완성된다.

---

## 5. 푸시 클릭 시 이동 — 3가지 상황 모두 동작 (필수)

서버는 **`data.event_url` 만 채워 보내면** 아래 **3가지 상황이 모두** 자동으로 동작한다.
앱 상태(백그라운드/포그라운드/종료)에 따라 서버가 다르게 보낼 필요는 **없다.**

#### ① 백그라운드 → 알림 탭
앱이 떠 있지만 뒤로 가 있는 상태. OS 알림이 뜨고, **탭하면 즉시** `event_url` 로 이동.
- 처리: `onNotificationOpenedApp` → `navigateWebView()` (앱이 이미 로드돼 있어 바로 `location.href` 주입)

#### ② 포그라운드 (앱을 보고 있는 중)
OS는 포그라운드 푸시를 자동으로 안 띄우므로, 앱이 **상단 인앱 배너**로 표시.
**배너를 탭하면** `event_url` 로 이동. (사용자가 보던 화면이 갑자기 튀지 않도록 자동이동 X, 탭 시 이동)
- 처리: `onForegroundMessage` → `InAppNotification` 배너 → `onPress` → `navigateWebView()`

#### ③ 앱 종료 상태 → 알림 탭으로 앱 실행 (콜드스타트)
앱이 완전히 죽어 있다가 알림 탭으로 켜지는 경우. 앱 부팅 → 첫 페이지 로드 완료 직후 `event_url` 로 이동.
- 처리: `getInitialNotification` → 보류(`pendingDeepLinkRef`) → `onLoadEnd` 에서 이동
  (첫 로드 전 주입은 홈 로딩에 묻히므로 **로드 완료 후** 이동시켜 누락 방지)

> 구현 위치: `mobile/src/fcm.ts` `onNotificationOpen()` / `mobile/App.tsx` `navigateWebView()`·`onLoadEnd`
> → ①②③ 모두 동일하게 `data.event_url` 을 읽어 **WebView 내부에서** 페이지 전환한다(외부 브라우저 X).

| # | 상황 | 트리거 | 처리 핸들러 |
|---|---|---|---|
| ① | 백그라운드 → 알림 탭 | OS 알림 탭 | `onNotificationOpenedApp` |
| ② | 포그라운드 | 인앱 배너 탭 | `onForegroundMessage` → 배너 `onPress` |
| ③ | 종료 → 앱 실행 | OS 알림 탭(콜드스타트) | `getInitialNotification` → `onLoadEnd` |

---

## 6. 주의사항

1. **`data` 값은 모두 문자열.** 숫자/불리언을 그대로 넣으면 FCM이 거부하거나
   앱에서 깨질 수 있다. `"ref_idx1": "123"` 처럼 문자열로.
2. **`notification` 블록은 표시 전용.** 이동은 오직 `data.event_url` 기준이다.
   `notification`만 보내고 `data.event_url`을 빼면 탭해도 이동하지 않는다.
3. **포그라운드 자동 이동 안 함(의도된 동작).** 사용자가 앱을 보고 있을 때
   갑자기 화면이 튀지 않도록, 배너를 띄우고 **사용자가 탭하면** 이동한다.
4. **URL 공백 금지.** `event_url` 앞뒤/중간 공백은 제거해서 보낸다.
5. iOS도 동일 규격(`data.event_url`)으로 동작한다. iOS는 `apns` 블록의
   `aps.sound`/`apns-priority`만 추가로 챙기면 된다(위 예시 참고).

---

## 7. PHP 호출 예 (기존 함수 그대로)

`$event_url` 인자에 이동 URL만 넘기면 끝.

```php
// 개별 토큰 전송
send_noti_token(
    $token,                                   // 디바이스 토큰
    "이벤트 안내",                             // title
    "오늘만 무료 사주 이벤트!",                 // body
    "event",                                  // push_type (서버 분류용)
    "123", "",                                // ref_idx1, ref_idx2
    "https://sajuplan.com/event/123"          // ★ event_url ← 앱이 이동할 주소
);

// 토픽 전송
send_noti_topic(
    "chl_2", "공지", "점검 안내", "notice",
    "", "",
    "/notice/45"                              // 경로만 줘도 sajuplan.com 기준 이동
);
```

---

## 8. 채널(토픽) 푸시 — 상담사 / 일반회원 / 전체

특정 대상 그룹에게 한 번에 보내는 푸시는 FCM **토픽(topic)** 으로 관리한다.
서버가 어떤 토픽으로 메시지를 보내면, 그 토픽을 **구독 중인 모든 디바이스**가 받는다.
(개별 디바이스 토큰 전송과는 별개의 발송 방식)

### 8.1 채널 ↔ 토픽 매핑

| 채널 | 토픽 이름 | 대상 | 구독 시점 |
|---|---|---|---|
| **전체** | `chl_all` | 앱을 설치한 **모든 사용자**(로그인·역할 무관) | **앱 실행(부팅) 시** 항상 구독 |
| **일반회원** | `chl_2` | 로그인한 **일반회원** | **일반회원 로그인** 시 구독 |
| **상담사** | `chl_5` | 로그인한 **상담사** | **상담사 로그인** 시 구독 |

### 8.2 구독 규칙 (중요)

1. **앱 실행 시 → `chl_all` 구독.** 전체회원 = 앱을 설치한 모든 사용자라고 보면 된다.
   - 로그인 여부·역할과 **무관하게 항상 구독**. **로그아웃해도 유지.**
2. **로그인 시 — 역할에 따라 `chl_2` / `chl_5` 중 하나만:**
   - **일반회원** → `chl_2` 구독 + `chl_5` 해제 (상담사 채널은 구독하지 않음)
   - **상담사** → `chl_5` 구독 + `chl_2` 해제 (일반회원 채널은 구독하지 않음)
   - 즉 `chl_2` 와 `chl_5` 는 **상호배타** — 한 디바이스가 둘 다 구독되면 안 된다.
3. **로그아웃 시 → `chl_2`·`chl_5` 모두 해제, `chl_all` 은 유지.**

> 정리하면 한 디바이스의 최종 구독 상태는 항상 다음 중 하나:
>
> | 상태 | 구독 토픽 |
> |---|---|
> | 비로그인 | `chl_all` |
> | 일반회원 | `chl_all` + `chl_2` |
> | 상담사 | `chl_all` + `chl_5` |

### 8.3 서버에서 채널로 보내기

`token` 대신 `topic` 을 타겟으로 지정한다. `data.event_url` 규격은 동일하게 적용된다.

```jsonc
{ "message": {
    "topic": "chl_2",                                  // 대상 채널 토픽
    "notification": { "title": "공지", "body": "..." },
    "data": { "event_url": "https://sajuplan.com/notice/45" }
}}
```

| 보내고 싶은 대상 | `topic` 값 |
|---|---|
| 전체회원(앱 사용자 전부) | `chl_all` |
| 일반회원 | `chl_2` |
| 상담사 | `chl_5` |

> PHP: `send_noti_topic("chl_2", $title, $msg, $push_type, $ref1, $ref2, $event_url)` 형태로 호출.
> → "전체로 보내려면 `chl_all`, 일반회원 `chl_2`, 상담사 `chl_5` 로 쏴 주세요" 라고 요청하면 된다.

### 8.4 현재 구현 상태 / 변경 필요

현재 토픽 구독은 **로그인/로그아웃 시점에만 토글하는 "전환 형태"** 다.

- 웹: `web/user/src/lib/native-push.ts` 의 `syncNativePushForMember()`
  - 로그인 시 `topicsForMember()` → `['chl_all', chl_2|chl_5]` 구독, 나머지 해제.
  - **문제 ①** `chl_all` 이 로그인에 묶여 있다 → 비로그인 사용자는 `chl_all` 미구독.
  - **문제 ②** 로그아웃 시 `chl_all` 까지 해제된다 (`ALL_AUTH_TOPICS` 에 포함).
  - → 위 8.2 규칙과 **불일치.**
- 브릿지: `window.SajumoonBridge.fcmTopicUpdate(subscribe[], unsubscribe[])`
  → 앱 `App.tsx` `FCM_TOPIC_UPDATE` → `fcmSubscribe`/`fcmUnsubscribe` (unsubscribe 먼저, subscribe 다음).

**변경 방향 (8.2 규칙에 맞추려면):**

1. **`chl_all` 구독을 앱 부팅 로직으로 이동** — `mobile/src/fcm.ts` `initFcm()` 안에서
   토큰 발급 직후 `subscribeToTopic('chl_all')` 호출. 로그인과 무관하게 항상 구독.
2. **로그인 동기화는 역할 토글만** — `syncNativePushForMember()` 는 `chl_2`/`chl_5` 만 다루고,
   `topicsForMember()` 에서 `chl_all` 제거.
3. **로그아웃 시 `chl_all` 보존** — 해제 목록을 `['chl_2', 'chl_5']` 로만 (현재 `ALL_AUTH_TOPICS` 에서 `chl_all` 제외).

> 이 변경은 별도 작업 항목. 본 문서는 목표 규격(8.2)을 기준으로 작성됐다.

---

## 9. 앱 → 서버: 토큰 등록 (참고)

앱은 부팅 시 FCM 토큰을 발급받아 **자동으로 서버에 등록**한다. 서버는 이 토큰을
저장해 두었다가 개별 전송(§4) 또는 토픽 전송(§8)으로 푸시를 보낸다.

- 등록 엔드포인트: `POST {API_URL}/api/user/auth/push-token`
- 요청 바디:
  ```json
  { "token": "<FCM 토큰>", "platform": "android" | "ios" }
  ```
- `credentials: include` 로 호출 → 로그인 쿠키(`sjm_user`)가 있으면 회원에 매핑,
  비로그인 상태면 토큰만 선등록 후 로그인 시 자동 매핑.
- 토큰 회전(onTokenRefresh) 시 동일 엔드포인트로 갱신 재전송.

> 구현 위치: `mobile/src/fcm.ts` 의 `initFcm()` → `registerTokenOnServer()`

---

## 10. 테스트 체크리스트

### 딥링크 이동
- [ ] `data.event_url` 에 URL이 **문자열**로 들어갔는가?
- [ ] URL이 절대 URL이거나 `/`로 시작하는 경로인가?
- [ ] (앱 백그라운드 상태) 알림 탭 → 해당 페이지로 이동하는가?
- [ ] (앱 종료 상태) 알림 탭 → 앱 켜진 뒤 해당 페이지로 이동하는가?
- [ ] (앱 켠 상태) 배너 탭 → 해당 페이지로 이동하는가?

### 토큰 / 채널
- [ ] 토큰이 `POST /api/user/auth/push-token` 으로 등록되는가?
- [ ] 앱 실행만 한 비로그인 상태에서 `chl_all` 로 보낸 푸시가 오는가?
- [ ] 일반회원 로그인 후 `chl_2` 푸시가 오고, `chl_5` 푸시는 안 오는가?
- [ ] 상담사 로그인 후 `chl_5` 푸시가 오고, `chl_2` 푸시는 안 오는가?
- [ ] 로그아웃 후에도 `chl_all` 푸시는 계속 오는가? (`chl_2`/`chl_5` 는 안 와야 함)
