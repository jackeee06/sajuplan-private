import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AdminCounselorOpsController } from './counselor-ops.controller';
import { AdminCounselorOpsService } from './counselor-ops.service';
import { UserSettlementsModule } from '../../user/settlements/settlements.module';
import { UserCounselorMypagePayoutModule } from '../../user/counselor-mypage-payout/counselor-mypage-payout.module';

@Module({
  // 상담사 화면 미러 — 상담사 마이페이지와 '같은 함수'로 숫자 계산(드리프트 0)을 위해
  //   user 측 정산/선지급 서비스를 그대로 주입한다.
  imports: [AdminAuthModule, UserSettlementsModule, UserCounselorMypagePayoutModule],
  controllers: [AdminCounselorOpsController],
  providers: [AdminCounselorOpsService],
})
export class AdminCounselorOpsModule {}
