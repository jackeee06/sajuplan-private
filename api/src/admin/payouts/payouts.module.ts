import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { SmsModule } from '../../user/sms/sms.module';
import { AdminPayoutsController } from './payouts.controller';
import { AdminPayoutsService } from './payouts.service';

@Module({
  imports: [AdminAuthModule, SmsModule],
  controllers: [AdminPayoutsController],
  providers: [AdminPayoutsService],
  exports: [AdminPayoutsService],
})
export class AdminPayoutsModule {}
