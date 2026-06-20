# ✅ [해결됨] FCM 푸시 전체 발송 실패 — 복구 완료 (2026-06-19)

> **상태: ✅ 해결 (2026-06-19).** 원인 = 서버 secrets에 **옛/죽은 키(`2fdac8e3`)** 가 들어있었음. 개발자가 준 **살아있는 키(`e71c651d02`)를 서버 secrets에 설치 + `pm2 reload`** → 서버 AUTH_OK + 실발송 성공(jackee 토큰 2건 성공 / 119 stale).
> **추정 정정**: 처음 "공개 노출로 구글 자동회수" 단정은 과했음 — 죽은 키는 로컬·private git엔 있었으나 prod 공개 웹루트엔 없었음(저장소도 Private). 더 유력 = **콘솔 키 회전 후 서버 미반영**. 개발자 "키 안 죽음" 말이 맞았다.
> ⛔ **보안**: admin SDK 키는 `web/user/public/`·git에 두지 말 것 → 서버 secrets에만. `.gitignore`에 `web/**/sajummon-*.json`·`**/firebase-adminsdk*.json` 추가함. 남은: jackee 만료 토큰 119개 정리(백로그).
>
> 인앱 알림·알림톡은 처음부터 **정상**이었음.

---
(이하 발견 당시 진단 기록 — 재발 대비 복구 절차 참고용)
---


---

## 1. 증상 (한 줄)
관리자 "알림 보내기 → 푸시" 및 모든 이벤트 푸시(채팅요청·등급승급·문의 등)가 **전부 실패**. 발송 응답이 `pushed: {success:0, failure:<전체>}`.

## 2. 정확한 에러 (직접 확인)
```
app/invalid-credential
invalid_grant: Invalid JWT Signature.
```
- `firebase-admin` 의 `messaging().send()` / `getAccessToken()` 호출 시 발생. **재시도해도 동일**(일시 블립 아님).
- 의미: 우리 서버는 키로 **JWT 서명까지 정상** 수행하는데, **구글이 그 서명을 거부** = 구글 쪽에 이 키의 공개키가 더 이상 없음.

## 3. 환경 / 키 정보
- 프로젝트: `sajummon-5a4c0`
- 키 파일: `/data/wwwroot/api.sajumoon.co.kr/secrets/fcm-service-account.json`
- 키 ID(무효화된 것): `2fdac8e3ecaa74858c18f63bcb5a9b32baedff24`
- 클라이언트: `firebase-adminsdk-fbsvc@sajummon-5a4c0.iam.gserviceaccount.com`
- 파일 mtime: **2026-06-10 08:13** (= 직전 갱신일, 그 뒤 우리쪽 변경 없음)
- 코드: `api/src/shared/push/push.service.ts` (Firebase Admin 초기화 + sendToTokens/sendToTopic)
- 토큰 테이블: `member_push_token`

## 4. 원인 진단 — 배제된 것 / 남은 것
| 가설 | 판정 | 근거 |
|---|---|---|
| git에 키 노출 → 구글 자동회수 | ❌ 아님 | `.gitignore`(`api/secrets/`) 제외, 커밋 이력 0 |
| 서버 시계 오차 | ❌ 아님 | NTP 동기화 O, 서버-기준시각 오차 1초. "서명 오류"는 시간 무관 |
| 일시적 블립 | ❌ 아님 | 재시도 2회 동일 |
| 우리쪽 키 파일 변경 | ❌ 아님 | mtime 6/10 그대로, JWT 서명은 로컬에서 정상 |
| 타임존 변경(6/17) 영향 | ❌ 아님 | 서명은 암호연산, 시간 무관 |
| **구글 콘솔에서 키 삭제/회수 or SA 변경** | ✅ **유력** | 위 전부 배제되고 "구글이 서명 거부"만 남음 |

> 2026-06-08 키 만료 사고(당시 invalid_grant)와 **같은 종류의 재발**. 당시 6/10에 새 키로 갱신했음.
> "며칠 전까진 정상"은 **미확인** — FCM 발송 감시가 없어서 조용히 며칠째 죽어 있었을 가능성도 있음(jackee 토큰 121개가 전부 stale인 정황).

## 5. 확인 (앱 개발자 / Firebase 콘솔 권한자)
**Firebase Console → 프로젝트 `sajummon-5a4c0` → ⚙️ 프로젝트 설정 → 서비스 계정 → "비공개 키 목록"**
- 키 `2fdac8e3…` 가 **없으면** → 누군가 삭제한 것(원인 확정). 새 키 발급이 답.
- 있어도 거부되면(드묾) → 그래도 새 키 발급으로 해결.

## 6. ✅ 복구 절차 (새 키 JSON 받으면 — Claude가 처리)
1. 받은 JSON 을 서버에 업로드(기존 교체):
   - `paramiko sftp.put(새키, "/data/wwwroot/api.sajumoon.co.kr/secrets/fcm-service-account.json")`
   - 권한/소유 기존과 동일(`-rw-r--r-- root`)
2. 앱 재시작: `pm2 reload sajumoon-api`
3. **인증 검증** (api 폴더 안에서 — node_modules 해결됨):
   ```js
   // /data/wwwroot/api.sajumoon.co.kr/_authtest.js (검증 후 삭제)
   const admin=require("firebase-admin");const fs=require("fs");
   const key=JSON.parse(fs.readFileSync("./secrets/fcm-service-account.json","utf8"));
   admin.credential.cert(key).getAccessToken()
     .then(t=>console.log("AUTH OK", String(t.access_token).slice(0,12)))
     .catch(e=>console.log("AUTH FAIL", e.message));
   ```
   → `AUTH OK` 나오면 키 정상.
4. **실발송 검증** — 찬물선생(jackee, id=91)에게만:
   - jackee 폰에서 앱 한 번 열어 **새 토큰 등록** 후
   - `POST /api/admin/notifications/push-send {target:"91", title, channels:{inapp:false,push:true}}`
   - 응답 `pushed.success >= 1` 이면 복구 완료. (개별 91만 — 브로드캐스트는 실사용자 감)

## 7. 🛡 재발 방지 (복구 후 같이 하면 좋음)
- **health-check 에 FCM 인증 감시 추가** (전화 5분 C-24 패턴):
  - 매시간 `getAccessToken()` 1회 시도 → 실패 시 **관리자 문의톡(OpsAlert)** 통보.
  - 이번처럼 "조용히 며칠 죽는" 사태 방지.

## 8. 관련
- 메모리: `reference_fcm_push_down.md`, `[[project-fcm-push-system]]`
- 핸드북: `_HANDBOOK/alert/03-fcm-push.md`
- 정상 동작 영역: 인앱(`notification_log`)·알림톡(BizM)은 영향 없음.
