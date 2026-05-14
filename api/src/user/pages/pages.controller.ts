import { Controller, Get, Param } from '@nestjs/common';
import { UserPagesService } from './pages.service';

@Controller('user/pages')
export class UserPagesController {
  constructor(private readonly svc: UserPagesService) {}

  /**
   * GET /api/user/pages/:slug
   *  - 활성(is_active=true) 페이지만 반환. 비활성/존재 안 함 → 404
   *  - 모바일 본문 우선, 비면 데스크톱 본문 폴백
   */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.svc.getBySlug(slug);
  }
}
