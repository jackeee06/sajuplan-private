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
}
