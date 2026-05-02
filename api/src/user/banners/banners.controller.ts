import { Controller, Get, Query } from '@nestjs/common';
import { UserBannersService } from './banners.service';

@Controller('user/banners')
export class UserBannersController {
  constructor(private readonly svc: UserBannersService) {}

  /**
   * GET /api/user/banners?position=메인-상단배너
   * 활성 + 기간 내 배너만 반환. 인증 불필요(공개).
   */
  @Get()
  async list(@Query('position') position?: string) {
    const items = await this.svc.listByPosition(position ?? '');
    return { items };
  }
}
