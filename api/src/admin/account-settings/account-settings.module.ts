import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { AccountSettingsController } from './account-settings.controller';
import { AccountSettingsService } from './account-settings.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AccountSettingsController],
  providers: [AccountSettingsService],
  exports: [AccountSettingsService],
})
export class AccountSettingsModule {}
