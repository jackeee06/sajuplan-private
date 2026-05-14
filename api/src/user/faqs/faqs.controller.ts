import { Controller, Get, Query } from '@nestjs/common';
import { UserFaqsService } from './faqs.service';

/**
 * 사용자 FAQ 공개 조회 (인증 불필요).
 *  GET /api/user/faqs/categories
 *  GET /api/user/faqs?category_id=N
 */
@Controller('user/faqs')
export class UserFaqsController {
  constructor(private readonly svc: UserFaqsService) {}

  @Get('categories')
  async categories() {
    const items = await this.svc.listCategories();
    return { items };
  }

  @Get()
  async list(@Query('category_id') categoryId?: string) {
    const id = categoryId ? Number(categoryId) : undefined;
    const items = await this.svc.listFaqs(id);
    return { items };
  }
}
