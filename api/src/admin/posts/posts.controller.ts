import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
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

  /** 어드민 1:1 문의 답변 (qa / qa_counselor 만 허용) (Phase 12) */
  @Post(':slug/:id/reply')
  reply(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
    @Req() req: AuthedRequest,
  ) {
    const content = (body?.content ?? '').trim();
    if (!content) throw new BadRequestException('답변 내용 필수');
    return this.svc.replyToQa(slug, id, content, req.admin.sub);
  }

  @Delete(':slug/:id/reply')
  removeReply(@Param('slug') slug: string, @Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteQaReply(slug, id);
  }
}
