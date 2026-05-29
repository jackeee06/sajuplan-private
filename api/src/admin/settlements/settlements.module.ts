import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SmsModule } from '../../user/sms/sms.module';

@Module({
  imports: [AdminAuthModule, SmsModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
