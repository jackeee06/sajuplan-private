import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { PostsService } from './posts.service';

/**
 * 어드민 — 후기 신고 관리 (2026-05-15 신설).
 *  - GET    /api/admin/review-reports        : 신고 목록 (status 필터 + 페이지네이션)
 *  - GET    /api/admin/review-reports/:id    : 신고 단건 (신고자·후기 본문 포함)
 *  - PATCH  /api/admin/review-reports/:id    : 처리 (status/admin_memo)
 */
@Controller('admin/review-reports')
@UseGuards(AdminAuthGuard)
export class ReviewReportsController {
  constructor(private readonly svc: PostsService) {}

  @Get()
  async list(@Query() q: Record<string, string>) {
    return this.svc.listReports({
      status: q.status || undefined,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 30,
    });
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getReportById(id);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; admin_memo?: string | null },
  ) {
    return this.svc.updateReportStatus(id, req.admin.sub, {
      status: body.status,
      admin_memo: body.admin_memo ?? null,
    });
  }
}
