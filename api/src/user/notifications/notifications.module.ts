import { Module } from '@nestjs/common';
import { UserNotificationsController } from './notifications.controller';
import { UserNotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserNotificationsController],
  providers: [UserNotificationsService],
})
export class UserNotificationsModule {}
