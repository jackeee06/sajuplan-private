import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserSettlementsController } from './settlements.controller';
import { UserSettlementsService } from './settlements.service';
import { AdminReferralsService } from '../../admin/referrals/referrals.service';

@Module({
  imports: [AuthModule],
  controllers: [UserSettlementsController],
  providers: [UserSettlementsService, AdminReferralsService],
})
export class UserSettlementsModule {}
