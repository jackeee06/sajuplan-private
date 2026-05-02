import { Controller, Get } from '@nestjs/common';
import { UserSettingsService } from './settings.service';

@Controller('user/settings')
export class UserSettingsController {
  constructor(private readonly svc: UserSettingsService) {}

  /**
   * GET /api/user/settings/public
   * 푸터 + 카카오 채널 등 공개 가능한 setting. 인증 불필요.
   */
  @Get('public')
  async public() {
    return this.svc.getPublicSettings();
  }
}
