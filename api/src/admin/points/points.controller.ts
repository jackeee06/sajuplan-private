import {
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
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { PointsService } from './points.service';
import type { AdjustByLoginIdInput, AdjustInput, HistoryFilter, PointSfl } from './points.service';

const ALLOWED_SFLS: PointSfl[] = ['mb_id', 'po_content'];

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  /** 회원 상세에서 포인트 조정: POST /admin/members/customers/:id/point-adjust */
  @Post('members/customers/:id/point-adjust')
  adjust(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdjustInput,
    @Req() req: AuthedRequest,
  ) {
    return this.pointsService.adjust(id, body, {
      adminId: req.admin.sub,
      ip: req.ip ?? null,
    });
  }

  /** 포인트 관리 화면 하단 폼: POST /admin/points/adjust-by-login-id */
  @Post('points/adjust-by-login-id')
  adjustByLoginId(@Body() body: AdjustByLoginIdInput, @Req() req: AuthedRequest) {
    return this.pointsService.adjustByLoginId(body, {
      adminId: req.admin.sub,
      ip: req.ip ?? null,
    });
  }

  /** 회원별 포인트 이력: GET /admin/members/customers/:id/point-history */
  @Get('members/customers/:id/point-history')
  memberHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pointsService.getMemberHistory(
      id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  /** 포인트 관리(전체 이력): GET /admin/points/history (sample point_list.php와 동일 파라미터) */
  @Get('points/history')
  allHistory(@Query() q: Record<string, string>) {
    const sfl = ALLOWED_SFLS.includes(q.sfl as PointSfl) ? (q.sfl as PointSfl) : undefined;
    const filter: HistoryFilter = {
      sfl,
      stx: q.stx || undefined,
      fr_date: q.fr_date || undefined,
      to_date: q.to_date || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.pointsService.findHistory(filter);
  }
}
