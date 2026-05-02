import { Module } from '@nestjs/common';
import { UserSettingsController } from './settings.controller';
import { UserSettingsService } from './settings.service';

@Module({
  controllers: [UserSettingsController],
  providers: [UserSettingsService],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
