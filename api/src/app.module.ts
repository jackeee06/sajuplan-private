import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    // 관리자 페이지는 내부 사용 — 사실상 제한 해제. 로그인만 brute-force 방지 유지.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 1_000_000 }, // 사실상 무제한
      { name: 'login', ttl: 60_000, limit: 100 },         // 로그인만 분당 100회 (brute-force 완화)
    ]),
    SharedModule,
    AdminModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
