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
import { AdminRefundsService } from './refunds.service';

/**
 * 어드민 환불 관리:
 *   GET  /admin/refunds                 — 리스트 (status, member_mb_id 필터)
 *   POST /admin/refunds                 — 환불 생성 + 즉시 승인 + 포인트 환원 (atomic)
 */
@Controller('admin/refunds')
@UseGuards(AdminAuthGuard)
export class AdminRefundsController {
  constructor(private readonly svc: AdminRefundsService) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('member_mb_id') memberMbId?: string,
    @Query('fr_date') frDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    return this.svc.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
      memberMbId,
      frDate,
      toDate,
    });
  }

  @Post()
  async create(
    @Body() body: {
      consultation_id?: number;
      amount?: number;
      reason?: string;
      idempotent_key?: string;
    },
    @Req() req: AuthedRequest,
  ) {
    const consultationId = Number(body?.consultation_id);
    const amount = Number(body?.amount);
    const reason = (body?.reason ?? '').trim();
    const idempotentKey = (body?.idempotent_key ?? '').trim() || undefined;
    if (!Number.isFinite(consultationId) || consultationId <= 0) {
      throw new BadRequestException('consultation_id 필수');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount 필수 (> 0)');
    }
    if (!reason) throw new BadRequestException('reason 필수');
    return this.svc.createAndApprove({
      consultationId,
      amount,
      reason,
      adminId: req.admin.sub,
      idempotentKey,
    });
  }
}
