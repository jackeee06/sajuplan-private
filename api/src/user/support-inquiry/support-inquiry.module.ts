import { Module } from '@nestjs/common';
import { UserSupportInquiryController } from './support-inquiry.controller';
import { UserSupportInquiryService } from './support-inquiry.service';
import { AuthModule } from '../auth/auth.module';
import { OpsAlertModule } from '../../shared/ops-alert/ops-alert.module';

@Module({
  imports: [AuthModule, OpsAlertModule],
  controllers: [UserSupportInquiryController],
  providers: [UserSupportInquiryService],
  exports: [UserSupportInquiryService],
})
export class UserSupportInquiryModule {}
