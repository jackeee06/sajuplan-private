import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { SmsModule } from '../user/sms/sms.module';
import { PromoterCoreModule } from '../shared/promoter/promoter-core.module';
import { PromoterController } from './promoter.controller';
import { PromoterMemberController } from './promoter-member.controller';
import { PromoterPublicService } from './promoter.service';
import { PromoterAuthGuard } from './promoter-auth.guard';
import { UserAuthGuard } from '../user/auth/user-auth.guard';

/** 공개 모집인(서포터즈) 모듈 — 랜딩·OTP 로그인·대시보드. 앱 불필요. */
@Module({
  imports: [
    SmsModule,
    PromoterCoreModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('USER_JWT_SECRET');
        if (!secret) throw new Error('USER_JWT_SECRET 미설정');
        return { secret, signOptions: { issuer: 'sajumoon-promoter' } };
      },
    }),
  ],
  controllers: [PromoterController, PromoterMemberController],
  providers: [PromoterPublicService, PromoterAuthGuard, UserAuthGuard],
})
export class PromoterPublicModule {}
