import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { CaptchaService } from './captcha.service';
import { CaptchaController } from './captcha.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        // 회원 영역 JWT 시크릿 재사용 — captcha 토큰도 같은 키로 서명/검증
        secret: config.get<string>('USER_JWT_SECRET'),
        signOptions: { issuer: 'sajumoon-captcha' },
      }),
    }),
  ],
  controllers: [CaptchaController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
