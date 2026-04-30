import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { AdminAuthController } from './auth.controller';
import { AdminAuthService } from './auth.service';
import { AdminAuthGuard } from './admin-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('ADMIN_JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error(
            'ADMIN_JWT_SECRET 미설정 또는 너무 짧음. api/.env 확인 (>=32자)',
          );
        }
        const expiresIn = config.get<string>('ADMIN_JWT_EXPIRES_IN') ?? '8h';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as unknown as number,
            issuer: 'sajumoon-admin',
          },
        };
      },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard],
  exports: [AdminAuthGuard, JwtModule],
})
export class AdminAuthModule {}
