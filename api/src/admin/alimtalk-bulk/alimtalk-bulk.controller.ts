import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { AlimtalkBulkService, type BulkTarget } from './alimtalk-bulk.service';

/**
 * 어드민 일괄 알림톡 발송 + 로그 조회 (Phase 13).
 */
@Controller('admin/alimtalk-bulk')
@UseGuards(AdminAuthGuard)
export class AlimtalkBulkController {
  constructor(private readonly svc: AlimtalkBulkService) {}

  @Get('templates')
  templates() {
    return this.svc.listTemplates();
  }

  @Get('logs')
  logs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('template') template?: string,
    @Query('bulk_only') bulkOnly?: string,
    @Query('fr_date') frDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    return this.svc.listLogs({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
      template,
      bulkOnly: bulkOnly === '1' || bulkOnly === 'true',
      frDate,
      toDate,
    });
  }

  @Get('jobs')
  jobs(@Query('limit') limit?: string) {
    return this.svc.listJobs(limit ? Number(limit) : 20);
  }

  @Post('send')
  async send(
    @Body() body: {
      template_code?: string;
      target?: BulkTarget;
      phones?: string;
      vars?: Record<string, string>;
    },
    @Req() req: AuthedRequest,
  ) {
    if (!body.template_code) throw new BadRequestException('template_code 필수');
    if (!body.target) throw new BadRequestException('target 필수');
    return this.svc.sendBulk({
      templateCode: body.template_code,
      target: body.target,
      phones: body.phones,
      vars: body.vars,
      adminId: req.admin.sub,
    });
  }
}
