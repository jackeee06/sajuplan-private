import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SmsModule } from '../../user/sms/sms.module';
import { CronModule } from '../../cron/cron.module';
import { PushModule } from '../../shared/push/push.module';

@Module({
  imports: [AdminAuthModule, SmsModule, CronModule, PushModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
