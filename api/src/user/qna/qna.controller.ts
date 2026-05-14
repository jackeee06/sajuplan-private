import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { OptionalUserGuard, type OptionalUserRequest } from '../auth/optional-user.guard';
import { UserCounselorQnaService } from './qna.service';

/**
 * 상담사별 1:1 문의 게시판.
 * 라우트:
 *   GET  /api/user/counselors/:id/qna           — 목록
 *   GET  /api/user/counselors/:id/qna/:qnaId    — 단건
 *   POST /api/user/counselors/:id/qna           — 작성 (회원 인증 필요)
 */
@Controller('user/counselors/:id/qna')
export class UserCounselorQnaController {
  constructor(private readonly svc: UserCounselorQnaService) {}

  @Get()
  @UseGuards(OptionalUserGuard)
  async list(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: OptionalUserRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listByCounselor({
      counselorId: id,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 20)) : 20,
      offset: offset ? Math.max(0, Number(offset) || 0) : 0,
      requesterId: req.user?.sub,
    });
  }

  @Get(':qnaId')
  @UseGuards(OptionalUserGuard)
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Param('qnaId', ParseIntPipe) qnaId: number,
    @Req() req: OptionalUserRequest,
  ) {
    return this.svc.getOne({
      counselorId: id,
      qnaId,
      requesterId: req.user?.sub,
    });
  }

  @Post()
  @UseGuards(UserAuthGuard)
  async create(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: UserAuthedRequest,
    @Body() body: { title?: string; content?: string; is_secret?: boolean },
  ) {
    const title = (body.title ?? '').trim();
    const content = (body.content ?? '').trim();
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content) throw new BadRequestException('문의 내용을 입력해주세요.');
    if (title.length > 255) throw new BadRequestException('제목이 너무 깁니다. (최대 255자)');

    return this.svc.create({
      counselorId: id,
      memberId: req.user.sub,
      title,
      content,
      isSecret: !!body.is_secret,
    });
  }
}
