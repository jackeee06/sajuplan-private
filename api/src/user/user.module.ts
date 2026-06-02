import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SmsModule } from './sms/sms.module';
import { CaptchaModule } from './captcha/captcha.module';
import { UserBannersModule } from './banners/banners.module';
import { UserStatsModule } from './stats/stats.module';
import { UserSettingsModule } from './settings/settings.module';
import { UserCounselorsModule } from './counselors/counselors.module';
import { UserReviewsModule } from './reviews/reviews.module';
import { UserCounselorReviewsModule } from './counselor-reviews/counselor-reviews.module';
import { UserCounselorQnaModule } from './qna/qna.module';
import { UserNoticesModule } from './notices/notices.module';
import { UserFaqsModule } from './faqs/faqs.module';
import { UserCouponsModule } from './coupons/coupons.module';
import { UserPagesModule } from './pages/pages.module';
import { UserConsultModule } from './consult/consult.module';
import { UserChatModule } from './chat/chat.module';
import { UserPointsModule } from './points/points.module';
import { UserNotificationsModule } from './notifications/notifications.module';
import { ChargeModule } from './charge/charge.module';
import { UserCounselorApplyModule } from './counselor-apply/counselor-apply.module';
import { UserEventsModule } from './events/events.module';
import { UserSettlementsModule } from './settlements/settlements.module';
import { AttendanceModule } from './attendance/attendance.module';
import { UserCounselorMypageGradeModule } from './counselor-mypage-grade/counselor-mypage-grade.module';
import { UserCounselorMypagePayoutModule } from './counselor-mypage-payout/counselor-mypage-payout.module';
import { CounselorMypageMemoModule } from './counselor-mypage-memo/counselor-mypage-memo.module';
import { AppVersionModule } from './app-version/app-version.module';

@Module({
  imports: [
    AuthModule,
    SmsModule,
    CaptchaModule,
    UserBannersModule,
    UserStatsModule,
    UserSettingsModule,
    UserCounselorsModule,
    UserReviewsModule,
    UserCounselorReviewsModule,
    UserCounselorQnaModule,
    UserNoticesModule,
    UserFaqsModule,
    UserCouponsModule,
    UserPagesModule,
    UserConsultModule,
    UserChatModule,
    UserPointsModule,
    UserNotificationsModule,
    ChargeModule,
    UserCounselorApplyModule,
    UserEventsModule,
    UserSettlementsModule,
    AttendanceModule,
    UserCounselorMypageGradeModule,
    UserCounselorMypagePayoutModule,
    CounselorMypageMemoModule,
    AppVersionModule,
  ],
})
export class UserModule {}
