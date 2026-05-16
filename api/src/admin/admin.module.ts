import { Module } from '@nestjs/common';
import { AccountSettingsModule } from './account-settings/account-settings.module';
import { AdminAuthModule } from './auth/auth.module';
import { BannersModule } from './banners/banners.module';
import { BoardOpsModule } from './board-ops/board-ops.module';
import { ChatHistoryModule } from './chat-history/chat-history.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { ContentsModule } from './contents/contents.module';
import { AdminCounselorApplyModule } from './counselor-apply/counselor-apply.module';
import { CouponZonesModule } from './coupon-zones/coupon-zones.module';
import { CouponsModule } from './coupons/coupons.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { FaqsModule } from './faqs/faqs.module';
import { MembersModule } from './members/members.module';
import { NoticesModule } from './notices/notices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PointsModule } from './points/points.module';
import { PopupLayersModule } from './popup-layers/popup-layers.module';
import { PostsModule } from './posts/posts.module';
import { SettingsModule } from './settings/settings.module';
import { SettlementsModule } from './settlements/settlements.module';
import { StatsModule } from './stats/stats.module';
import { AdminAttendanceModule } from './attendance/attendance.module';
import { AdminGradeModule } from './grade/grade.module';

@Module({
  imports: [
    AdminAuthModule,
    DashboardModule,
    MembersModule,
    PointsModule,
    PaymentsModule,
    ConsultationsModule,
    SettlementsModule,
    AccountSettingsModule,
    BannersModule,
    PostsModule,
    ChatHistoryModule,
    BoardOpsModule,
    NoticesModule,
    EventsModule,
    NotificationsModule,
    StatsModule,
    PermissionsModule,
    ContentsModule,
    FaqsModule,
    SettingsModule,
    PopupLayersModule,
    CouponsModule,
    CouponZonesModule,
    AdminCounselorApplyModule,
    AdminAttendanceModule,
    AdminGradeModule,
  ],
})
export class AdminModule {}
