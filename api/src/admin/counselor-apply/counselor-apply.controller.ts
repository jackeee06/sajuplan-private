import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import {
  AdminCounselorApplyService,
  type ApplyStatus,
} from './counselor-apply.service';

@Controller('admin/counselor-apply')
@UseGuards(AdminAuthGuard)
export class AdminCounselorApplyController {
  constructor(private readonly svc: AdminCounselorApplyService) {}

  /** GET /api/admin/counselor-apply?status=pending&category=application&q=홍길동&page=1&limit=20
   *  category: 'application' | 'inquiry' | 'other' (2026-05-16 추가) */
  @Get()
  list(@Query() q: Record<string, string>) {
    return this.svc.list({
      status: q.status || undefined,
      category: q.category || undefined,
      q: q.q || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  /** GET /api/admin/counselor-apply/:id */
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  /** PATCH /api/admin/counselor-apply/:id/status — pending/cancelled 토글 등 단순 상태 전환 */
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: ApplyStatus },
  ) {
    return this.svc.updateStatus(id, body.status);
  }

  /** POST /api/admin/counselor-apply/:id/approve — 신청 승인 (회원 생성 + m2net 연동) */
  @Post(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.svc.approve(id);
  }

  /** POST /api/admin/counselor-apply/:id/reject — body: { reason: string } */
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
  ) {
    return this.svc.reject(id, body.reason);
  }
}
