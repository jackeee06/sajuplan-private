import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { SettlementsService } from './settlements.service';
import type { SettlementFilter, SettlementSfl } from './settlements.service';

const ALLOWED_SFLS: SettlementSfl[] = ['mb_id', 'kind'];

@Controller('admin/settlements')
@UseGuards(AdminAuthGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  /** 정산 예정 미리보기 — 선택 월의 전체 상담사 예상 정산액 (차감 없음). */
  @Get('preview')
  preview(@Query('month') month?: string) {
    const m = month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : this.settlementsService.currentMonthKst();
    return this.settlementsService.preview(m);
  }

  @Get()
  list(@Query() q: Record<string, string>) {
    const sfl = ALLOWED_SFLS.includes(q.sfl as SettlementSfl) ? (q.sfl as SettlementSfl) : undefined;
    const filter: SettlementFilter = {
      sfl,
      stx: q.stx || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.settlementsService.findAll(filter);
  }

  /** 회원 1명 즉시 정산 — 미리보기 [정산하기]. 계산+생성+차감+지급완료 한 번에. */
  @Post(':memberId/settle-now')
  settleNow(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Query('month') month: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const m = month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : this.settlementsService.currentMonthKst();
    return this.settlementsService.settleNow(memberId, m, req.admin.sub);
  }

  /** 정산 지급완료 마킹 — 사장님 통장 송금 후. */
  @Patch(':id/mark-paid')
  markPaid(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.settlementsService.markPaid(id, req.admin.sub);
  }

  /** 정산 무효화 — 사고 정정. 사유 필수 (5자 이상). */
  @Patch(':id/mark-voided')
  markVoided(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.settlementsService.markVoided(id, req.admin.sub, body.reason ?? '');
  }
}
