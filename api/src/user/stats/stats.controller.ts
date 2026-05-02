import { Controller, Get } from '@nestjs/common';
import { UserStatsService } from './stats.service';

@Controller('user/stats')
export class UserStatsController {
  constructor(private readonly svc: UserStatsService) {}

  /**
   * GET /api/user/stats/main
   * 메인 페이지 통계 카드 2개 — 인증 불필요(공개)
   */
  @Get('main')
  async main() {
    return this.svc.getMainStats();
  }
}
