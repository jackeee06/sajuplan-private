import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { MembersModule } from '../members/members.module';
import { AdminCounselorApplyController } from './counselor-apply.controller';
import { AdminCounselorApplyService } from './counselor-apply.service';

@Module({
  imports: [AdminAuthModule, MembersModule],
  controllers: [AdminCounselorApplyController],
  providers: [AdminCounselorApplyService],
})
export class AdminCounselorApplyModule {}
