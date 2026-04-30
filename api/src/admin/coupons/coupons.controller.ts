import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CouponsService } from './coupons.service';
import type { CouponFilter, CouponInput, CouponSfl } from './coupons.service';

const ALLOWED_SFLS: CouponSfl[] = ['mb_id', 'cp_id', 'cp_subject'];

@Controller('admin/coupons')
@UseGuards(AdminAuthGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    const sfl = ALLOWED_SFLS.includes(q.sfl as CouponSfl) ? (q.sfl as CouponSfl) : undefined;
    const filter: CouponFilter = {
      sfl,
      stx: q.stx || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.couponsService.findAll(filter);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.couponsService.getById(id);
  }

  @Post()
  create(@Body() body: CouponInput) {
    return this.couponsService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<CouponInput>) {
    return this.couponsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.couponsService.remove(id);
  }
}
