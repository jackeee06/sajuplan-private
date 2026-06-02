import { Module } from '@nestjs/common';
import { UserCounselorApplyController } from './counselor-apply.controller';
import { UserCounselorApplyService } from './counselor-apply.service';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [UserCounselorApplyController],
  providers: [UserCounselorApplyService],
  exports: [UserCounselorApplyService],
})
export class UserCounselorApplyModule {}
