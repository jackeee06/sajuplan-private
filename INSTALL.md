# 사주플랜 — 설치 / 배포 가이드

운영 서버 이관 시 필요한 의존성·시크릿·인프라 정리.

---

## 1) 시스템 요구사항

| 항목 | 버전 |
|---|---|
| Node.js | 20.x LTS |
| npm | 10.x (Node 20 번들) |
| PostgreSQL | 18.x (현재 작업 서버 18.1) |
| PM2 | 5.x (전역 설치 권장: `npm i -g pm2`) |
| Nginx | 1.20+ |

**OS**: macOS / Ubuntu 22.04+

---

## 2) Node 패키지

### `api/` (NestJS 백엔드)

`package.json`에 이미 등록된 의존성. 운영 서버에선 `npm ci`로 일괄 설치:

```bash
cd /data/wwwroot/api.sajumoon.kr
npm ci --omit=dev   # 또는 npm ci 후 npm run build
npm run build
```

#### 주요 외부 연동 라이브러리

| 패키지 | 용도 | 시크릿/설정 |
|---|---|---|
| `firebase-admin` | **FCM 푸시 발송** (토큰/토픽) | `secrets/fcm-service-account.json` |
| `bcrypt` | 비밀번호 해시 | - |
| `jsonwebtoken` | 관리자 JWT | `ADMIN_JWT_SECRET` |
| `postgres` (postgres.js) | DB 드라이버 | `DATABASE_URL` |
| `multer` | 파일 업로드 (팝업/회원/계약서) | `uploads/` 디렉터리 쓰기 권한 |

### `web/mng/` (관리자 React)

```bash
cd /data/wwwroot/sajumoon.kr/mng-src   # 또는 로컬에서 빌드 후 dist만 rsync
npm ci
npm run build
```

빌드 산출물(`dist/`)은 정적 파일이므로 nginx에서 서빙. (현재 `deploy.sh mng`가 자동 처리)

---

## 3) 시크릿 / 인증 파일

### 3-1) 환경변수 `.env` (api/)

```
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://sajumoon.kr

# 신규 DB
DATABASE_URL=postgresql://sajumoon:<PASSWORD>@<HOST>:5432/sajumoon
LEGACY_DATABASE_URL=postgresql://sajumoon:<PASSWORD>@<HOST>:5432/sajumoon_db

# 관리자 JWT (openssl rand -hex 64)
ADMIN_JWT_SECRET=<64bytes-hex>
ADMIN_JWT_EXPIRES_IN=8h
ADMIN_COOKIE_NAME=sjm_admin
COOKIE_SECURE=true              # HTTPS 운영 시 true

# 엠투넷 (passcall)
M2NET_API_URL=http://passcall.co.kr:25205
M2NET_CPID=0047
M2NET_HEADER_KEY=<엠투넷-키>
# M2NET_CHAT_URL=http://passcall.co.kr:20102   # chat-mgr csrstat 용 (선택)
# M2NET_CHAT_KEY=<chat-mgr-인증키>             # 별도 키 필요 시

# FCM 푸시 (Firebase Cloud Messaging)
FCM_CREDENTIALS_PATH=./secrets/fcm-service-account.json
```

### 3-2) FCM 서비스 계정 키

레거시 위치에서 복사:
- 출처: `/sample/lib/sajummon_push_key.json` (project: **sajummon-5a4c0**)
- 신규 위치: `api/secrets/fcm-service-account.json`
- **반드시 운영 서버 배포 시 별도 업로드 필요** — 이 파일은 `.gitignore`에 포함됨

```bash
# 운영 서버에 업로드
scp ./fcm-service-account.json root@<PROD>:/data/wwwroot/api.sajumoon.kr/secrets/
```

배포 후 `pm2 restart sajumoon-api`로 키 재로드.

---

## 4) 디렉터리 구조 (런타임 생성)

```
api/
├─ secrets/                 # gitignored. FCM 키 등 시크릿
│  └─ fcm-service-account.json
└─ uploads/                 # gitignored. multer 업로드 저장소
   ├─ popup/                # 팝업 이미지
   └─ member/               # 회원 첨부 (계약서/프로필사진)
```

운영 서버에서 디렉터리 권한:
```bash
chown -R nodeapp:nodeapp uploads/ secrets/
chmod 750 secrets/
chmod 755 uploads/
```

---

## 5) DB 마이그레이션

```bash
cd api
npm run db:migrate
```

`db/migrations/0001~0014.sql` 파일이 순서대로 적용됨. (멱등성 — 재실행 안전)

운영 라이브 DB가 따로 있으면 ETL은 별도 진행.

---

## 6) Nginx (참고)

- `sajumoon.kr` → 정적 (회원 SSR 전용 또는 정적 mng)
- `sajumoon.kr/mng/` → `/data/wwwroot/sajumoon.kr/mng/` 정적
- `api.sajumoon.kr` → 127.0.0.1:3001 (Nest API) 리버스 프록시
- `/uploads/...` 는 API에서 정적 서빙 ([main.ts](api/src/main.ts) `useStaticAssets`)

---

## 7) PM2

```bash
cd /data/wwwroot/api.sajumoon.kr
pm2 start ecosystem.config.js
pm2 save
pm2 startup     # 시스템 부팅 시 자동 기동 등록 (한 번만)
```

프로세스 이름: `sajumoon-api`.

---

## 8) 푸시 알림 — 추가 메모

### Firebase 프로젝트

| 항목 | 값 |
|---|---|
| Project ID | `sajummon-5a4c0` |
| Service Account | `firebase-adminsdk-fbsvc@sajummon-5a4c0.iam.gserviceaccount.com` |

### 사용 가능한 발송 모드

코드에 `firebase-admin@13.x` 기반 `PushService`가 구현되어 있고 다음 메서드를 지원:

| 메서드 | 용도 |
|---|---|
| `sendToTokens(tokens[], payload)` | 다중 토큰 직접 발송 (현재 push-send 엔드포인트에서 사용) |
| `sendToTopic(topic, payload)` | 토픽 (예: `'all'`, `'counselors'`) 일괄 발송 |
| `subscribeToTopic(tokens[], topic)` | 토큰을 토픽에 구독 |
| `unsubscribeFromTopic(tokens[], topic)` | 구독 해제 |

### 추후 작업

1. **앱(클라이언트)에서 토픽 자동 구독**
   - 앱 첫 실행 시 `messaging.subscribeToTopic('all')`, role에 따라 `'users'`/`'counselors'` 추가 구독
   - 또는 서버에서 `subscribeToTopic` 호출
2. **토큰 위생관리(housekeeping)**
   - FCM이 응답하는 `INVALID_REGISTRATION` 등의 실패 토큰을 `is_active=false`로 만드는 cron
3. **APNs 직접 연동**
   - FCM이 iOS도 처리하므로 앱이 FCM SDK를 쓰면 추가 작업 불필요
   - 만약 별도 APNs를 원한다면 `apn` npm 패키지 + `.p8` 키 필요 (현재는 미구현)
4. **Web Push (브라우저)**
   - 별도로 `web-push` 라이브러리 + VAPID 키 발급 필요. 현재는 미구현.

---

## 9) 배포 스크립트

프로젝트 루트의 [`deploy.sh`](deploy.sh) 사용:

```bash
./deploy.sh           # mng + api 둘 다
./deploy.sh mng       # 관리자 프론트만
./deploy.sh api       # API만
./deploy.sh migrate   # DB 마이그레이션만
./deploy.sh status    # PM2/Nginx 상태 + 헬스체크
./deploy.sh verify    # 인증 E2E 검증
```

환경변수:
- `SSH_HOST=root@<PROD-IP>`
- `SSHPASS=<password>` (sshpass 사용 시)

`.env`, `uploads/`, `secrets/` 는 rsync에서 제외되어 운영 서버 값을 보존합니다.

---

## 체크리스트 (운영 이관 시)

- [ ] PostgreSQL 18 설치 + DB `sajumoon` 생성
- [ ] `.env` 파일 작성 (시크릿 채움)
- [ ] `secrets/fcm-service-account.json` 업로드
- [ ] `npm ci` + `npm run build`
- [ ] `npm run db:migrate`
- [ ] `pm2 start ecosystem.config.js && pm2 save`
- [ ] Nginx 리버스 프록시 + SSL (Let's Encrypt)
- [ ] `uploads/`, `secrets/` 디렉터리 권한
- [ ] 헬스체크 `https://api.sajumoon.kr/api/health`
- [ ] mng 빌드/업로드, `https://sajumoon.kr/mng/` 접속 확인
- [ ] FCM 발송 테스트 (관리자 → 푸시 알림 → 자기 자신 토큰으로 시험)
