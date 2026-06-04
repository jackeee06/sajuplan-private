import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { BoardOpsService } from './board-ops.service';

@Controller('admin/board-ops')
@UseGuards(AdminAuthGuard)
export class BoardOpsController {
  constructor(private readonly svc: BoardOpsService) {}

  @Get('search-keywords')
  searchKeywords(@Query() q: Record<string, string>) {
    return this.svc.searchKeywords({
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get('popular-ranking')
  popular(@Query() q: Record<string, string>) {
    return this.svc.popularRanking({ days: q.days ? Number(q.days) : undefined });
  }

  @Get('comments')
  comments(@Query() q: Record<string, string>) {
    return this.svc.commentsAll({
      q: q.q || undefined,
      board_slug: q.board_slug || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Delete('comments/:id')
  removeComment(@Param('id', ParseIntPipe) id: number) {
    return this.svc.removeComment(id);
  }

  @Get('posts-overview')
  postsOverview() {
    return this.svc.postsOverview();
  }

  @Get('reports')
  reports(@Query() q: Record<string, string>) {
    return this.svc.reports({
      status: q.status ? Number(q.status) : undefined,
      board_slug: q.board_slug || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Patch('reports/:id')
  updateReport(@Param('id', ParseIntPipe) id: number, @Body() body: { status: number }) {
    return this.svc.updateReportStatus(id, body.status);
  }

  /** 인기검색어 핀 목록 조회 */
  @Get('keyword-pins')
  getKeywordPins() {
    return this.svc.getKeywordPins();
  }

  /** 인기검색어 핀 저장 (전체 교체) */
  @Put('keyword-pins')
  saveKeywordPins(@Body() body: { pins: { rank: number; keyword: string }[] }) {
    return this.svc.saveKeywordPins(body.pins ?? []);
  }

  /** counselor_qna 숨김 상태 일괄 조회 */
  @Get('qna-hidden-status')
  getQnaHiddenStatus(@Query('ids') ids: string) {
    const qnaIds = (ids ?? '').split(',').map(Number).filter((n) => n > 0 && Number.isFinite(n));
    return this.svc.getQnaHiddenStatus(qnaIds);
  }

  /** counselor_qna 숨김/복원 */
  @Patch('qna/:qnaId/hidden')
  setQnaHidden(@Param('qnaId', ParseIntPipe) qnaId: number, @Body() body: { hidden: boolean }) {
    return this.svc.setQnaHidden(qnaId, !!body.hidden);
  }
}
