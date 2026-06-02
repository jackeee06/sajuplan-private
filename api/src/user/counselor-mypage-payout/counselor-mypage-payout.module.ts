import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { UserCounselorMypagePayoutController } from './counselor-mypage-payout.controller';
import { UserCounselorMypagePayoutService } from './counselor-mypage-payout.service';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [UserCounselorMypagePayoutController],
  providers: [UserCounselorMypagePayoutService],
  exports: [UserCounselorMypagePayoutService],
})
export class UserCounselorMypagePayoutModule {}
