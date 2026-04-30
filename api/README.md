# sajumoon API (NestJS)

관리자 / 사용자 / 모바일이 공유하는 API 서버.

## 구조

```
api/src/
├── admin/               # /api/admin/*  (관리자 전용)
│   ├── admin.module.ts
│   └── members/
│       ├── members.controller.ts   → @Controller('admin/members')
│       ├── members.service.ts
│       └── members.module.ts
├── user/                # /api/user/*   (사용자 + 모바일)
│   ├── user.module.ts
│   └── auth/
│       ├── auth.controller.ts      → @Controller('user/auth')
│       └── ...
├── shared/              # 공통 (엔티티/가드/유틸)
│   ├── entities/
│   ├── guards/
│   └── common/
├── app.module.ts
└── main.ts              # globalPrefix 'api', CORS, 포트(env)
```

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run start:dev       # 포트 3001, watch 모드
```

## 엔드포인트 예시

- `GET  /api/health`
- `GET  /api/admin/members`
- `POST /api/user/auth/login`   body: `{ email }`

## 프로덕션 배포 (api.sajumoon.kr)

```bash
# 서버에서 (배포 경로: /data/wwwroot/api.sajumoon.kr)
cd /data/wwwroot/api.sajumoon.kr
git pull                # 또는 rsync로 소스 업로드
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Nginx는 `api.sajumoon.kr` → `http://127.0.0.1:3001` 로 프록시.
