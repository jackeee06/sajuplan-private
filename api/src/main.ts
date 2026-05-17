import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { runtimeEnv } from './shared/env/runtime-env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // [Audit E-C1] nginx reverse proxy (127.0.0.1:3001) 뒷단이므로 X-Forwarded-For 신뢰.
  //   nginx config: proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  //   loopback 키워드는 IPv4-mapped IPv6 (::ffff:127.0.0.1) 를 신뢰 안 해서 명시적 IP 사용.
  //   '1' = 한 단계 hop (nginx 한 대) 의 X-Forwarded-For 마지막 IP 를 req.ip 로.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  // helmet 기본값은 cross-origin resource 차단 — /uploads 이미지는 mng 도메인에서 접근하므로 완화
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // 모든 /api/* 응답에 강제 no-store — 모바일 WebView · 브라우저 · CDN · nginx 가
  // 회원 정보(보유 포인트 등) 응답을 캐시해 옛 값을 노출하는 사고 방지.
  // /uploads 정적 파일은 그대로 캐시 허용.
  app.use((req: { path: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // 업로드 정적 서빙 — /uploads/popup/xxx.png → ./uploads/popup/xxx.png
  const uploadsRoot = join(process.cwd(), 'uploads');
  mkdirSync(uploadsRoot, { recursive: true });
  app.useStaticAssets(uploadsRoot, { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: runtimeEnv().corsOrigins,
    credentials: true,
  });

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port);
}
bootstrap();
