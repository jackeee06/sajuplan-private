import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpsAlertModule } from '../../shared/ops-alert/ops-alert.module';
import { CounselorMypageInquiryController } from './counselor-mypage-inquiry.controller';
import { CounselorMypageInquiryService } from './counselor-mypage-inquiry.service';

@Module({
  imports: [AuthModule, OpsAlertModule],
  controllers: [CounselorMypageInquiryController],
  providers: [CounselorMypageInquiryService],
})
export class CounselorMypageInquiryModule {}
