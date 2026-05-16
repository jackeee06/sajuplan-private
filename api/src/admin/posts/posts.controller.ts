import { Controller, Delete, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { PostsService } from './posts.service';
import type { PostFilter } from './posts.service';

@Controller('admin/posts')
@UseGuards(AdminAuthGuard)
export class PostsController {
  constructor(private readonly svc: PostsService) {}

  // ※ 후기 신고 관리는 별도 컨트롤러 review-reports.controller.ts 가 처리 (경로: /api/admin/review-reports)

  @Get(':slug')
  list(@Param('slug') slug: string, @Query() q: Record<string, string>) {
    const filter: PostFilter = {
      q: q.q || undefined,
      category: q.category || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.svc.findAll(slug, filter);
  }

  @Get(':slug/:id')
  detail(@Param('slug') slug: string, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(slug, id);
  }

  @Delete(':slug/:id')
  remove(@Param('slug') slug: string, @Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(slug, id);
  }
}
