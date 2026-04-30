import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { CouponZonesController } from './coupon-zones.controller';
import { CouponZonesService } from './coupon-zones.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [CouponZonesController],
  providers: [CouponZonesService],
  exports: [CouponZonesService],
})
export class CouponZonesModule {}
