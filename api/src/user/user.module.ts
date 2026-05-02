import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SmsModule } from './sms/sms.module';
import { CaptchaModule } from './captcha/captcha.module';
import { UserBannersModule } from './banners/banners.module';
import { UserStatsModule } from './stats/stats.module';
import { UserSettingsModule } from './settings/settings.module';

@Module({
  imports: [
    AuthModule,
    SmsModule,
    CaptchaModule,
    UserBannersModule,
    UserStatsModule,
    UserSettingsModule,
  ],
})
export class UserModule {}
