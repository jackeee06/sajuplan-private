import {
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
import { UserCounselorReviewsService } from './counselor-reviews.service';

/**
 * 상담사 마이페이지 → 후기 관리.
 *   GET    /api/user/counselor-mypage/reviews          — 내가 받은 후기 목록 (필터: unanswered, photo)
 *   GET    /api/user/counselor-mypage/reviews/:id      — 단건 + 답변
 *   POST   /api/user/counselor-mypage/reviews/:id/reply— 답변 작성 (1:1)
 *   PATCH  /api/user/counselor-mypage/reviews/:id/reply— 답변 수정
 *   DELETE /api/user/counselor-mypage/reviews/:id/reply— 답변 삭제
 *
 * 모든 라우트는 로그인한 상담사 본인(role='counselor') 전용.
 */
@Controller('user/counselor-mypage/reviews')
@UseGuards(UserAuthGuard)
export class UserCounselorReviewsController {
  constructor(private readonly svc: UserCounselorReviewsService) {}

  @Get()
  async list(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unanswered_only') unanswered?: string,
    @Query('photo_only') photo?: string,
  ) {
    this.assertCounselor(req);
    return this.svc.listMine({
      counselorId: req.user.sub,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      unansweredOnly: unanswered === 'true' || unanswered === '1',
      photoOnly: photo === 'true' || photo === '1',
    });
  }

  @Get(':id')
  async detail(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertCounselor(req);
    return this.svc.getMine(req.user.sub, id);
  }

  @Post(':id/reply')
  async createReply(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
  ) {
    this.assertCounselor(req);
    return this.svc.createReply(req.user.sub, id, body?.content ?? '');
  }

  @Patch(':id/reply')
  async updateReply(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
  ) {
    this.assertCounselor(req);
    return this.svc.updateReply(req.user.sub, id, body?.content ?? '');
  }

  @Delete(':id/reply')
  async deleteReply(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertCounselor(req);
    await this.svc.deleteReply(req.user.sub, id);
    return { ok: true };
  }

  private assertCounselor(req: UserAuthedRequest): void {
    if (req.user?.role !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
  }
}
