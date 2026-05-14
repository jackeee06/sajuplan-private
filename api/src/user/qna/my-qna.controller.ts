import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserCounselorQnaService } from './qna.service';

/**
 * 마이페이지 — 내가 작성한 상담문의.
 * 라우트:
 *   GET /api/user/my-qnas           — 목록
 *   GET /api/user/my-qnas/:id       — 단건 (본인 소유만)
 */
@Controller('user/my-qnas')
@UseGuards(UserAuthGuard)
export class UserMyQnaController {
  constructor(private readonly svc: UserCounselorQnaService) {}

  @Get()
  async list(
    @Req() req: UserAuthedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listByMember({
      memberId: req.user.sub,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 20)) : 20,
      offset: offset ? Math.max(0, Number(offset) || 0) : 0,
    });
  }

  @Get(':id')
  async detail(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getOneByMember({
      memberId: req.user.sub,
      qnaId: id,
    });
  }
}
