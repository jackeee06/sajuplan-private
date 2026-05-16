import { Module } from '@nestjs/common';
import { OpsAlertService } from './ops-alert.service';
import { SmsModule } from '../../user/sms/sms.module';

@Module({
  imports: [SmsModule],
  providers: [OpsAlertService],
  exports: [OpsAlertService],
})
export class OpsAlertModule {}
