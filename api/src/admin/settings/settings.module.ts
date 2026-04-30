import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
