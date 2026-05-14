# 도메인 분기 / 서버 이전 가이드

## 현재 상태

| 환경 | DEPLOY_TARGET | 사용자 도메인 | API 도메인 |
|---|---|---|---|
| 개발 (현재) | `dev` (기본) | `sajumoon.kr` | `api.sajumoon.kr` |
| 실서버 (향후) | `prod` | `sajumoon.co.kr` | `api.sajumoon.co.kr` |

## 단일 진실 원천

[`deploy.config.sh`](./deploy.config.sh) 한 파일에서 두 환경의 도메인 / 서버 경로 / SSH 호스트를 정의합니다.

배포 명령:

```bash
# 개발 서버 (기본)
./deploy.sh api
./deploy.sh user
./deploy.sh mng

# 실서버
DEPLOY_TARGET=prod ./deploy.sh api
DEPLOY_TARGET=prod ./deploy.sh user
DEPLOY_TARGET=prod ./deploy.sh mng

# 또는 한꺼번에
DEPLOY_TARGET=prod ./deploy.sh
```

## 동작 방식

### 1. 프론트엔드 (Vite, web/user · web/mng)

`deploy.sh` 가 빌드 직전에 `.env.production.local` 을 자동 생성:

```
VITE_API_BASE=https://${API_DOMAIN}/api
```

Vite 는 `.env.production.local` 을 `.env.production` 보다 우선시하므로 빌드 산출물에 `DEPLOY_TARGET` 의 도메인이 박힙니다. 빌드 후 `.local` 파일은 자동 삭제.

### 2. 백엔드 (NestJS, api)

`.env` 는 **각 서버에 직접 배치** (rsync 시 `--exclude '.env'`로 보호). 서버 이전 시 새 서버의 `.env` 에 새 도메인 값을 적어두면 됨.

서버별 `.env` 에서 도메인 영향 받는 키:

```
USER_BASE_URL=https://sajumoon.kr  (또는 .co.kr)
CORS_ORIGINS=https://sajumoon.kr,https://mng.sajumoon.kr  (또는 .co.kr 버전)
PG_RETURN_URL=https://api.sajumoon.kr/api/pg/charge/callback
PG_FORMURL=https://api.sajumoon.kr/api/pg/charge/complete
PG_FORMURL_REDIRECT=https://sajumoon.kr/charge/complete
PG_VBANK_CALLBACK_URL=https://api.sajumoon.kr/api/pg/charge/vbank-callback
PG_AUTOPAY_PUSH_URL=https://api.sajumoon.kr/api/pg/charge/autopay-push
```

### 3. 모바일 (RN)

`mobile/.env` 의 `WEB_URL`, `API_URL` 만 새 도메인으로 교체 후 재빌드.

## 도메인 변경 (서버 이전) 절차

1. **PG (AG9/KSP) 가맹점 등록정보 변경 신청** — `PG_RETURN_URL` / `PG_FORMURL` / `PG_VBANK_CALLBACK_URL` 새 도메인으로 PG 측 등록값 교체 (PG 사 통해서만 가능)

2. **DNS / nginx vhost 세팅** — 새 도메인 (sajumoon.co.kr / api.sajumoon.co.kr) DNS A 레코드 + nginx conf 추가

3. **deploy.config.sh 의 prod 섹션의 `SSH_HOST` 채우기** — 실서버 IP 결정되면 [deploy.config.sh](./deploy.config.sh) `prod` 블록 수정

4. **새 서버에 .env 세팅** — `/data/wwwroot/api.sajumoon.co.kr/.env` 작성 (위 키들 새 도메인 값으로)

5. **DB 세팅** — 새 DB 생성 후 마이그레이션 실행:
   ```bash
   DEPLOY_TARGET=prod ./deploy.sh api      # 서버에 코드 + 빌드 + PM2 기동
   DEPLOY_TARGET=prod ./deploy.sh migrate  # 마이그레이션
   ```

6. **프론트 배포**:
   ```bash
   DEPLOY_TARGET=prod ./deploy.sh user
   DEPLOY_TARGET=prod ./deploy.sh mng
   ```

7. **헬스체크**:
   ```bash
   DEPLOY_TARGET=prod ./deploy.sh status
   DEPLOY_TARGET=prod ./deploy.sh verify
   ```

8. **(기존 회원 데이터 마이그레이션이 필요한 경우만)** — 자동결제 push URL 일괄 갱신:
   ```bash
   curl -X POST https://api.sajumoon.co.kr/api/admin/payments/sync-autopay-urls \
     -b "admin_cookie=..."
   ```
   (회원 데이터 새로 시작이면 불필요)

## 하드코딩 정리 현황

도메인이 박혀있던 곳을 모두 환경변수 분기로 전환:

- ✅ [deploy.sh](./deploy.sh) — 모든 도메인이 `deploy.config.sh` 변수 사용
- ✅ [api/src/user/charge/pg-callback.controller.ts](./api/src/user/charge/pg-callback.controller.ts) — `PG_FORMURL_REDIRECT` 또는 `USER_BASE_URL` 환경변수 사용 (fallback 제거)
- ✅ [web/mng/src/pages/NoticeForm.tsx](./web/mng/src/pages/NoticeForm.tsx) — `VITE_API_BASE` 또는 `window.location.origin` 사용 (fallback 제거)
- ✅ [web/user/.env.development](./web/user/.env.development) / [.env.production](./web/user/.env.production) — 빌드 시 `.env.production.local` 로 override
- ✅ [web/mng/.env.development](./web/mng/.env.development) / [.env.production](./web/mng/.env.production) — 동일

남은 것:
- 📝 `*.md` 문서 — 가독성 위해 도메인 명시. 도메인 변경 시 별도 일괄 치환 필요 (코드 동작엔 영향 X)
- 📝 `api/ecosystem.config.js` — `cwd: '/data/wwwroot/api.sajumoon.kr'` 하드코딩. 실서버는 `api.sajumoon.co.kr` 경로로 별도 ecosystem 또는 deploy 시 sed 치환 필요
