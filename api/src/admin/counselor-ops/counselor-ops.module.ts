import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminCounselorOpsController } from './counselor-ops.controller';
import { AdminCounselorOpsService } from './counselor-ops.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminCounselorOpsController],
  providers: [AdminCounselorOpsService],
})
export class AdminCounselorOpsModule {}
