import { Controller, Get, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CaptchaService } from './captcha.service';

@Controller('user/captcha')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  /** GET /api/user/captcha — 새 캡차 발급 (token + 변형된 SVG) */
  @Get()
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async issue() {
    return this.captcha.issue();
  }
}
