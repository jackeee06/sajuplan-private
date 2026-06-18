import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AlertLogsService } from './alert-logs.service';

@Controller('admin/alert-logs')
@UseGuards(AdminAuthGuard)
export class AlertLogsController {
  constructor(private readonly svc: AlertLogsService) {}

  /** GET /api/admin/alert-logs — 알림 발송 이력 목록 */
  @Get()
  list(@Query() q: Record<string, string>) {
    return this.svc.list({
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 30,
      template: q.template || undefined,
      onlyFail: q.only_fail === '1',
    });
  }

  /** GET /api/admin/alert-logs/health — 현재 시스템 점검 상세 */
  @Get('health')
  health() {
    return this.svc.healthDetail();
  }
}
