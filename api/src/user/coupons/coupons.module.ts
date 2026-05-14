import { Module } from '@nestjs/common';
import { UserCouponsController } from './coupons.controller';
import { UserCouponsService } from './coupons.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserCouponsController],
  providers: [UserCouponsService],
})
export class UserCouponsModule {}
