import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { AdminReferralsService } from './referrals.service';

/**
 * 어드민 — 상담사 추천 수당 관리. 일반관리자도 모든 작업 가능 (운영팀 일상 업무).
 *
 *   GET   /admin/referrals?month=YYYY-MM&status=active
 *   POST  /admin/referrals                      { referrer_id, referee_id, memo? }
 *   POST  /admin/referrals/:id/pay              { month?: YYYY-MM }
 *   POST  /admin/referrals/:id/disable          { memo? }
 *   GET   /admin/referrals/counselor-search?q=  — autocomplete
 */
@Controller('admin/referrals')
@UseGuards(AdminAuthGuard)
export class AdminReferralsController {
  constructor(private readonly svc: AdminReferralsService) {}

  @Get()
  async list(
    @Query('month') month?: string,
    @Query('status') status?: string,
  ) {
    const items = await this.svc.list({ month, status });
    return { items };
  }

  @Get('counselor-search')
  async search(@Query('q') q?: string) {
    const items = await this.svc.searchCounselors(q ?? '');
    return { items };
  }

  @Post()
  async create(
    @Body() body: { referrer_id?: number; referee_id?: number; memo?: string },
    @Req() req: AuthedRequest,
  ) {
    const referrer_id = Number(body?.referrer_id);
    const referee_id = Number(body?.referee_id);
    if (!Number.isFinite(referrer_id) || referrer_id <= 0) {
      throw new BadRequestException('referrer_id 필수');
    }
    if (!Number.isFinite(referee_id) || referee_id <= 0) {
      throw new BadRequestException('referee_id 필수');
    }
    return this.svc.create({
      referrer_id,
      referee_id,
      memo: body?.memo ?? null,
      admin_id: req.admin.sub,
    });
  }

  @Post(':id/pay')
  async pay(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { month?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.payCurrentMonth({
      id,
      month: body?.month,
      admin_id: req.admin.sub,
    });
  }

  @Post(':id/disable')
  async disable(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { memo?: string },
  ) {
    await this.svc.disable(id, body?.memo);
    return { ok: true };
  }

  /** GET /admin/referrals/policy — 현재 추천 정책 조회 (슈퍼 전용) */
  @Get('policy')
  async getPolicy(@Req() req: AuthedRequest) {
    if (!req.admin.is_super) throw new BadRequestException('슈퍼관리자 전용입니다.');
    return this.svc.getPolicy();
  }

  /** PUT /admin/referrals/policy — 추천 정책 업데이트 (슈퍼 전용) */
  @Put('policy')
  async updatePolicy(
    @Body() body: { rate?: number; months?: number },
    @Req() req: AuthedRequest,
  ) {
    if (!req.admin.is_super) throw new BadRequestException('슈퍼관리자 전용입니다.');
    return this.svc.updatePolicy({
      rate:   body.rate   !== undefined ? Number(body.rate)   : undefined,
      months: body.months !== undefined ? Number(body.months) : undefined,
      admin_id: req.admin.sub,
    });
  }
}
