import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { AdminGradeService, type Grade } from './grade.service';

/**
 * 어드민 등급/단가 운영 라우트 — 일반관리자도 수정 가능 (운영팀 일상 업무).
 *   GET    /admin/grade/distribution
 *   GET    /admin/grade/recent-changes
 *   GET    /admin/grade/counselor/:id
 *   GET    /admin/grade/counselor/:id/unit-cost-history
 *   GET    /admin/grade/counselor/:id/grade-history
 *   PATCH  /admin/grade/counselor/:id/grade          — 강제 등급 수정
 *   PATCH  /admin/grade/counselor/:id/unit-cost      — 강제 단가 수정
 */
@Controller('admin/grade')
@UseGuards(AdminAuthGuard)
export class AdminGradeController {
  constructor(private readonly svc: AdminGradeService) {}

  @Get('distribution')
  async distribution() {
    return { items: await this.svc.getDistribution() };
  }

  @Get('recent-changes')
  async recentChanges(@Query('limit') limit?: string) {
    const lim = limit ? Math.min(200, Math.max(1, Number(limit) || 50)) : 50;
    return { items: await this.svc.getRecentChanges(lim) };
  }

  @Get('counselor/:id')
  async counselorDetail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getCounselorGradeDetail(id);
  }

  @Get('counselor/:id/unit-cost-history')
  async unitCostHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(200, Math.max(1, Number(limit) || 50)) : 50;
    return { items: await this.svc.getUnitCostHistory(id, lim) };
  }

  @Get('counselor/:id/grade-history')
  async gradeHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(200, Math.max(1, Number(limit) || 50)) : 50;
    return { items: await this.svc.getGradeHistory(id, lim) };
  }

  @Patch('counselor/:id/grade')
  async forceGrade(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { grade?: string; reason?: string },
    @Req() req: AuthedRequest,
  ) {
    const grade = body?.grade as Grade | undefined;
    const reason = (body?.reason ?? '').trim();
    if (!grade) throw new BadRequestException('grade 필수');
    if (!reason) throw new BadRequestException('reason 필수');
    return this.svc.forceGrade(id, grade, req.admin.sub, reason);
  }

  @Patch('counselor/:id/unit-cost')
  async forceUnitCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { unit_cost?: number; reason?: string },
    @Req() req: AuthedRequest,
  ) {
    const unit = Number(body?.unit_cost);
    const reason = (body?.reason ?? '').trim();
    if (!Number.isFinite(unit) || unit < 0) throw new BadRequestException('unit_cost 잘못됨');
    if (!reason) throw new BadRequestException('reason 필수');
    return this.svc.forceUnitCost(id, unit, req.admin.sub, reason);
  }
}
