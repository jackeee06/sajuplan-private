import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminReferralsController } from './referrals.controller';
import { AdminReferralsService } from './referrals.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminReferralsController],
  providers: [AdminReferralsService],
  exports: [AdminReferralsService],
})
export class AdminReferralsModule {}
