import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserCounselorQnaService } from './qna.service';

/**
 * 상담사 마이페이지 — 고객 문의 관리.
 * 라우트:
 *   GET    /api/user/counselor/customer-qnas         — 내게 들어온 문의 목록
 *   GET    /api/user/counselor/customer-qnas/:id     — 단건
 *   POST   /api/user/counselor/customer-qnas/:id/reply  — 답변 작성 (1문의당 1답변)
 *   PATCH  /api/user/counselor/customer-qnas/:id/reply  — 답변 수정
 *   DELETE /api/user/counselor/customer-qnas/:id/reply  — 답변 삭제
 */
@Controller('user/counselor/customer-qnas')
@UseGuards(UserAuthGuard)
export class UserCounselorCustomerQnaController {
  constructor(private readonly svc: UserCounselorQnaService) {}

  @Get()
  async list(
    @Req() req: UserAuthedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.assertCounselor(req);
    return this.svc.listForCounselor({
      counselorId: req.user.sub,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 20)) : 20,
      offset: offset ? Math.max(0, Number(offset) || 0) : 0,
    });
  }

  @Get(':id')
  async detail(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertCounselor(req);
    return this.svc.getOneForCounselor({
      counselorId: req.user.sub,
      qnaId: id,
    });
  }

  @Post(':id/reply')
  async reply(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
  ) {
    this.assertCounselor(req);
    const content = (body?.content ?? '').trim();
    if (!content) throw new BadRequestException('답변 내용을 입력해주세요.');
    return this.svc.createReply({
      counselorId: req.user.sub,
      qnaId: id,
      content,
    });
  }

  @Patch(':id/reply')
  async updateReply(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
  ) {
    this.assertCounselor(req);
    const content = (body?.content ?? '').trim();
    if (!content) throw new BadRequestException('답변 내용을 입력해주세요.');
    return this.svc.updateReply({
      counselorId: req.user.sub,
      qnaId: id,
      content,
    });
  }

  @Delete(':id/reply')
  async deleteReply(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertCounselor(req);
    return this.svc.deleteReply({
      counselorId: req.user.sub,
      qnaId: id,
    });
  }

  private assertCounselor(req: UserAuthedRequest): void {
    if (req.user?.role !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
  }
}
