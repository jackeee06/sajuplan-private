import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { UserNoticesService } from './notices.service';

/**
 * 사용자 공지사항 (인증 불필요).
 *  GET /api/user/notices?page=&limit=&category=&q=
 *  GET /api/user/notices/categories
 *  GET /api/user/notices/:id
 */
@Controller('user/notices')
export class UserNoticesController {
  constructor(private readonly svc: UserNoticesService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category,
      q,
    });
  }

  @Get('categories')
  async categories() {
    const items = await this.svc.categories();
    return { items };
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }
}
