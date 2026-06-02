import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { AdminPayoutsService } from './payouts.service';

/**
 * 어드민 선지급 관리 — 일반관리자도 송금/반려/메모 모두 수행 가능 (운영팀 일상 업무).
 *   GET   /admin/payouts                — 리스트 (status / date / counselor)
 *   GET   /admin/payouts/stats          — 통계 요약 (대기/오늘/이번달/24시간+)
 *   GET   /admin/payouts/csv-pending    — pending CSV 다운로드
 *   POST  /admin/payouts/:id/pay        — 개별 송금 완료
 *   POST  /admin/payouts/bulk-pay       — 일괄 송금 완료 (ids[])
 *   POST  /admin/payouts/:id/reject     — 반려 (사유 필수)
 *   PATCH /admin/payouts/:id/memo       — 어드민 메모
 */
@Controller('admin/payouts')
@UseGuards(AdminAuthGuard)
export class AdminPayoutsController {
  constructor(private readonly svc: AdminPayoutsService) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('counselor_mb_id') counselorMbId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
      counselorMbId,
      from,
      to,
    });
  }

  @Get('stats')
  async stats() {
    return this.svc.stats();
  }

  /**
   * CSV 다운로드 — pending 만. UTF-8 BOM 추가 (엑셀 한글 깨짐 방지).
   * 컬럼: 은행, 예금주, 계좌번호, 실지급, 등급, 상담사mb_id
   */
  @Get('csv-pending')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payout_pending.csv"')
  async csvPending(): Promise<string> {
    const rows = await this.svc.pendingForCsv();
    const lines: string[] = [];
    lines.push('은행,예금주,계좌번호,실지급액,등급,상담사ID');
    for (const r of rows) {
      const esc = (v: string | number | null) => {
        const s = v == null ? '' : String(v);
        // 콤마/따옴표/줄바꿈 있으면 따옴표로 감싸기 + 내부 " 는 ""
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      lines.push([
        esc(r.bank_name_snapshot),
        esc(r.bank_holder_snapshot),
        esc(r.bank_account_snapshot),
        esc(r.actual_payout),
        esc(r.grade_at_request),
        esc(r.counselor_mb_id ?? ''),
      ].join(','));
    }
    return '﻿' + lines.join('\n');  // UTF-8 BOM
  }

  @Post(':id/pay')
  async pay(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { payment_proof?: string; admin_memo?: string },
  ) {
    return this.svc.markPaid({
      id,
      adminId: req.admin.sub,
      paymentProof: body?.payment_proof?.slice(0, 500),
      adminMemo: body?.admin_memo?.slice(0, 500),
    });
  }

  @Post('bulk-pay')
  async bulkPay(
    @Req() req: AuthedRequest,
    @Body() body: { ids?: number[]; payment_proof?: string },
  ) {
    const ids = (body?.ids ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      throw new BadRequestException('처리할 신청 ID 가 없습니다.');
    }
    return this.svc.bulkMarkPaid({
      ids,
      adminId: req.admin.sub,
      paymentProof: body?.payment_proof?.slice(0, 500),
    });
  }

  @Post(':id/reject')
  async reject(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ) {
    return this.svc.reject({
      id,
      adminId: req.admin.sub,
      reason: (body?.reason ?? '').trim(),
    });
  }

  @Patch(':id/memo')
  async updateMemo(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { memo?: string },
  ) {
    return this.svc.updateMemo({
      id,
      adminId: req.admin.sub,
      memo: (body?.memo ?? '').slice(0, 1000),
    });
  }
}
