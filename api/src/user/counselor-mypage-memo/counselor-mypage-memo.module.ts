import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CounselorMypageMemoController } from './counselor-mypage-memo.controller';
import { CounselorMypageMemoService } from './counselor-mypage-memo.service';

@Module({
  imports: [AuthModule],
  controllers: [CounselorMypageMemoController],
  providers: [CounselorMypageMemoService],
})
export class CounselorMypageMemoModule {}
