import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminCounselorInquiriesService } from './counselor-inquiries.service';

interface AdminRequest extends Request {
  admin: { sub: number; mb_id?: string; is_super?: boolean };
}

/**
 * 상담사 → 운영자 1:1 고객센터 문의 관리 (조회·답변).
 *
 * - GET    /api/admin/counselor-inquiries              목록
 * - GET    /api/admin/counselor-inquiries/:id          단건
 * - POST   /api/admin/counselor-inquiries/:id/reply    답변 등록/수정
 * - DELETE /api/admin/counselor-inquiries/:id/reply    답변 삭제
 *
 * 권한: AdminAuthGuard (일반관리자 OK — 일상 운영 문의 응대)
 */
@Controller('admin/counselor-inquiries')
@UseGuards(AdminAuthGuard)
export class AdminCounselorInquiriesController {
  constructor(private readonly svc: AdminCounselorInquiriesService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      status: status || null,
      category: category || null,
      q: q || null,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(id);
  }

  @Post(':id/reply')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string },
    @Req() req: AdminRequest,
  ) {
    return this.svc.reply(id, body.content ?? '', req.admin.sub);
  }

  @Delete(':id/reply')
  removeReply(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteReply(id);
  }
}
