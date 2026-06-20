import {
  Body,
  Controller,
  Delete,
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
import { UserSupportInquiryService, SUPPORT_CATEGORIES } from './support-inquiry.service';

/**
 * 회원 고객센터 1:1 문의.
 * 라우트:
 *   GET    /api/user/support-inquiries          — 내 문의 목록
 *   GET    /api/user/support-inquiries/categories — 분류 목록
 *   GET    /api/user/support-inquiries/:id       — 단건(본인만)
 *   POST   /api/user/support-inquiries           — 작성
 *   PATCH  /api/user/support-inquiries/:id        — 수정(답변 전)
 *   DELETE /api/user/support-inquiries/:id        — 삭제(답변 전)
 */
@Controller('user/support-inquiries')
export class UserSupportInquiryController {
  constructor(private readonly svc: UserSupportInquiryService) {}

  @Get('categories')
  categories() {
    return { items: SUPPORT_CATEGORIES };
  }

  @Get()
  @UseGuards(UserAuthGuard)
  list(
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
  @UseGuards(UserAuthGuard)
  detail(@Req() req: UserAuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getOneByMember({ memberId: req.user.sub, id });
  }

  @Post()
  @UseGuards(UserAuthGuard)
  create(
    @Req() req: UserAuthedRequest,
    @Body() body: { category?: string; title?: string; content?: string; is_secret?: boolean },
  ) {
    return this.svc.create({
      memberId: req.user.sub,
      category: body.category ?? '기타',
      title: body.title ?? '',
      content: body.content ?? '',
      isSecret: body.is_secret !== false, // 기본 비밀글
    });
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  update(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; content?: string },
  ) {
    return this.svc.update({
      memberId: req.user.sub,
      id,
      title: body.title ?? '',
      content: body.content ?? '',
    });
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  remove(@Req() req: UserAuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.svc.remove({ memberId: req.user.sub, id });
  }
}
