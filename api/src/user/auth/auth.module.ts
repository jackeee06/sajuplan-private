import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { UserAuthGuard } from './user-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('USER_JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error(
            'USER_JWT_SECRET 미설정 또는 너무 짧음. api/.env 확인 (>=32자)',
          );
        }
        const expiresIn = config.get<string>('USER_JWT_EXPIRES_IN') ?? '14d';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as unknown as number,
            issuer: 'sajumoon-user',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SocialAuthService, UserAuthGuard],
  exports: [UserAuthGuard, JwtModule],
})
export class AuthModule {}
