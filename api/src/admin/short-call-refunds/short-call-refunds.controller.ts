import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminShortCallRefundsService } from './short-call-refunds.service';

/**
 * 고객보호비용(매몰비용) 내역 조회.
 *   GET /admin/short-call-refunds?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50&offset=0
 *   - from/to 미지정 시 이번달 (1일~다음달 1일)
 *   - 응답: items[] + total (건수) + total_amount (합계)
 */
@Controller('admin/short-call-refunds')
@UseGuards(AdminAuthGuard)
export class AdminShortCallRefundsController {
  constructor(private readonly svc: AdminShortCallRefundsService) {}

  @Get()
  async list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
