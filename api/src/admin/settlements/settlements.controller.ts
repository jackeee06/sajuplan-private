import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { SettlementsService } from './settlements.service';
import type { SettlementFilter, SettlementSfl } from './settlements.service';

const ALLOWED_SFLS: SettlementSfl[] = ['mb_id', 'kind'];

@Controller('admin/settlements')
@UseGuards(AdminAuthGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

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
