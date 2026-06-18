import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AlertLogsController } from './alert-logs.controller';
import { AlertLogsService } from './alert-logs.service';

@Module({
  // AdminAuthGuard(JwtService 의존)를 컨트롤러에서 쓰므로 AdminAuthModule import 필수.
  // (누락 시 DI 해결 실패로 앱 부팅 크래시 — 2026-06-12 장애 원인)
  imports: [AdminAuthModule],
  controllers: [AlertLogsController],
  providers: [AlertLogsService],
})
export class AlertLogsModule {}
