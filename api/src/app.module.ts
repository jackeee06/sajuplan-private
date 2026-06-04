import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ url?: string; method?: string }>();
    if (req.url?.startsWith('/admin/')) return true;
    // GET은 읽기 전용 — 브라우저 폴링·탭 전환 등에서 대량 발생하나 보안 위협 없음.
    // 로그인(POST)·결제·작성 등 쓰기 작업은 그대로 throttle 적용.
    if (req.method === 'GET') return true;
    return super.shouldSkip(ctx);
  }
}
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
    // [Audit E-W6/I-1] 비정상 트래픽 차단.
    //   GET 요청은 AppThrottlerGuard.shouldSkip 에서 전면 면제 (읽기 전용, 보안 위협 없음).
    //   default(POST·PUT·DELETE): 분당 6000회. 일반 쓰기 작업 보호.
    //   login: 분당 60회. brute-force 차단.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 6_000 },
      { name: 'login', ttl: 60_000, limit: 60 },
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
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
