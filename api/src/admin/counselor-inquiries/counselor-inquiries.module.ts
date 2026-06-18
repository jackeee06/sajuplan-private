import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminCounselorInquiriesController } from './counselor-inquiries.controller';
import { AdminCounselorInquiriesService } from './counselor-inquiries.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminCounselorInquiriesController],
  providers: [AdminCounselorInquiriesService],
})
export class AdminCounselorInquiriesModule {}
