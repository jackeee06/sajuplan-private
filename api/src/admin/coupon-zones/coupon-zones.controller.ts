import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CouponZonesService } from './coupon-zones.service';
import type { CouponZoneInput } from './coupon-zones.service';

@Controller('admin/coupon-zones')
@UseGuards(AdminAuthGuard)
export class CouponZonesController {
  constructor(private readonly svc: CouponZonesService) {}

  @Get()
  list(@Query('stx') stx?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.findAll(stx, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(id);
  }

  @Post()
  create(@Body() body: CouponZoneInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<CouponZoneInput>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
