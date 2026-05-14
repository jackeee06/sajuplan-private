import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { SharedModule } from './shared/shared.module';
import { M2netPushModule } from './pg-callbacks/m2net-push.module';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    // 운영 .env 가 우선, 없으면 .env.defaults (sample 라이브 fallback) 으로 자동 폴백.
    // 외부 서비스 키 (BIZM/M2NET/ALIGO 등) 의 default 는 .env.defaults 한 곳에서 관리.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '.env.defaults'],
    }),
    // 관리자 페이지는 내부 사용 — 사실상 제한 해제. 로그인만 brute-force 방지 유지.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 1_000_000 }, // 사실상 무제한
      { name: 'login', ttl: 60_000, limit: 100 },         // 로그인만 분당 100회 (brute-force 완화)
    ]),
    SharedModule,
    AdminModule,
    UserModule,
    M2netPushModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
