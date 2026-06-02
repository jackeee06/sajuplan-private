import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { SharedModule } from './shared/shared.module';
import { AlertsModule } from './shared/alerts/alerts.module';
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
    // [Audit E-W6/I-1] 비정상 트래픽 차단 — 정상 사용자(페이지당 ajax 다중 호출 포함)는 절대 안 닿는 수준.
    //   default: 분당 1200회 = 초당 20회. 한 페이지 로드에 ajax 30개 가정해도 분당 40페이지 가능.
    //   login: 분당 20회 (정상 사용자는 1~5회. 20회면 brute-force 차단 충분).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 1_200 },
      { name: 'login', ttl: 60_000, limit: 20 },
    ]),
    SharedModule,
    AlertsModule,
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
