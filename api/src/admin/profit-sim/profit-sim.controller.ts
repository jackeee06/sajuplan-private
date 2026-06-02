import {
  Body, Controller, ForbiddenException, Get, Put, Req, UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { ProfitSimService, type ProfitSimConfigData } from './profit-sim.service';

/**
 * [2026-05-24] 슈퍼관리자 순이익 시뮬레이터 API.
 *
 * GET  /api/admin/profit-sim — 시뮬 설정 + DB 원본 등급률 + 실측 통계
 * PUT  /api/admin/profit-sim — 시뮬 설정 저장 (등급률은 저장 대상 아님)
 *
 * 슈퍼관리자 전용. 일반 관리자는 403.
 */
@Controller('admin/profit-sim')
@UseGuards(AdminAuthGuard)
export class ProfitSimController {
  constructor(private readonly svc: ProfitSimService) {}

  private requireSuper(req: AuthedRequest): void {
    if (!req.admin?.is_super) {
      throw new ForbiddenException('슈퍼관리자 전용 메뉴입니다.');
    }
  }

  @Get()
  async getDashboard(@Req() req: AuthedRequest) {
    this.requireSuper(req);
    return this.svc.getDashboard(req.admin.sub);
  }

  @Get('insights')
  async getInsights(@Req() req: AuthedRequest) {
    this.requireSuper(req);
    return this.svc.getInsights();
  }

  @Put()
  async saveConfig(
    @Req() req: AuthedRequest,
    @Body() body: { data: ProfitSimConfigData },
  ) {
    this.requireSuper(req);
    await this.svc.saveConfig(req.admin.sub, body.data ?? {});
    return { ok: true };
  }
}
