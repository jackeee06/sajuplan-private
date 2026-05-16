import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { SmsModule } from '../../user/sms/sms.module';
import { AlimtalkBulkController } from './alimtalk-bulk.controller';
import { AlimtalkBulkService } from './alimtalk-bulk.service';

@Module({
  imports: [AdminAuthModule, SmsModule],
  controllers: [AlimtalkBulkController],
  providers: [AlimtalkBulkService],
  exports: [AlimtalkBulkService],
})
export class AlimtalkBulkModule {}
