import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
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
}
