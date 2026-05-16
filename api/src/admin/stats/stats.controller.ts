import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { StatsService } from './stats.service';

@Controller('admin/stats')
@UseGuards(AdminAuthGuard)
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get('overview')
  overview() { return this.svc.overview(); }

  @Get('visit-daily')
  visitDaily(@Query('days') days?: string) { return this.svc.visitDaily(days ? Number(days) : 30); }

  @Get('revenue-daily')
  revenueDaily(@Query('days') days?: string) { return this.svc.revenueDaily(days ? Number(days) : 30); }

  @Get('revenue-monthly')
  revenueMonthly() { return this.svc.revenueMonthly(); }

  /** 운영 KPI (Phase 11) — 환불률 / 평균 통화시간 / call·chat 비율 */
  @Get('ops-kpi')
  opsKpi(@Query('days') days?: string) {
    return this.svc.opsKpi(days ? Number(days) : 30);
  }

  /** 상담사 매출 순위 (Phase 11) — TOP N, 환불 차감 반영 */
  @Get('counselor-ranking')
  counselorRanking(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.svc.counselorRanking(
      days ? Number(days) : 30,
      limit ? Number(limit) : 10,
    );
  }
}
