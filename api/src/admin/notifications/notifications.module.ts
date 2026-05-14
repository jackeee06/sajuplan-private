import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsModule } from '../../user/sms/sms.module';

@Module({
  imports: [AdminAuthModule, SmsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
