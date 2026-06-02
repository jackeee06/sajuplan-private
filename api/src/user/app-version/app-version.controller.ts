import { Controller, Get } from '@nestjs/common';
import { AppVersionService } from './app-version.service';

@Controller('app')
export class AppVersionController {
  constructor(private readonly svc: AppVersionService) {}

  /**
   * GET /api/app/version
   * 앱 부팅 시 호출 — 인증 불필요.
   * setting 테이블 namespace='app' 의 모든 key-value 를 반환.
   * 예: { "aos_latest_version": "1.1.1", "ios_latest_version": "1.1" }
   */
  @Get('version')
  async version() {
    return this.svc.get();
  }
}
