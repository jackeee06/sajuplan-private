import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { AdminPromotersService } from './promoters.service';

/** 관리자 — 모집인(서포터즈) 관리·정산. */
@Controller('admin/promoters')
@UseGuards(AdminAuthGuard)
export class AdminPromotersController {
  constructor(private readonly svc: AdminPromotersService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    return this.svc.list({
      stx: q.stx || undefined,
      status: q.status || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  // settlements 액션 — :id 보다 먼저 선언 (라우트 충돌 방지)
  @Patch('settlements/:sid/mark-paid')
  markPaid(
    @Param('sid', ParseIntPipe) sid: number,
    @Body() body: { memo?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.markPaid(sid, req.admin.sub, body?.memo);
  }

  @Patch('settlements/:sid/void')
  voidSettlement(@Param('sid', ParseIntPipe) sid: number, @Body() body: { reason?: string }) {
    return this.svc.voidSettlement(sid, body?.reason ?? '');
  }

  // 전역 정책값(보상요율·기간·원천징수율) — :id 보다 먼저 선언
  @Get('settings')
  settings() {
    return this.svc.globalSettings();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  @Post()
  create(
    @Body() body: {
      name: string; phone: string; code?: string;
      bank_name?: string; bank_account?: string; account_holder?: string;
      rrn?: string; reward_rate?: number | null; memo?: string;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.create(body, req.admin.sub);
  }

  // ── 승인/반려: 정적 접두 라우트(approve/:id)로 분리 — :id(update, 같은 PATCH)에 가려지지 않게 ──
  @Patch('approve/:id')
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.svc.approve(id, req.admin.sub);
  }

  @Patch('reject/:id')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.svc.reject(id, body?.reason);
  }

  @Post(':id/settle')
  settle(@Param('id', ParseIntPipe) id: number) {
    return this.svc.createSettlement(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      name?: string; code?: string; bank_name?: string; bank_account?: string;
      account_holder?: string; rrn?: string; reward_rate?: number | null;
      is_active?: boolean; memo?: string;
    },
  ) {
    return this.svc.update(id, body);
  }
}
