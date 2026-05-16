import { BadRequestException, Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminAttendanceService, type AttendanceTargetKind } from './attendance.service';

/**
 * 어드민 출석 관리 API (2026-05-16 Phase 2).
 *
 *  GET   /api/admin/attendance/policy/:target   — 정책 조회 (target=user|counselor)
 *  PATCH /api/admin/attendance/policy/:target   — 정책 부분 갱신
 *  GET   /api/admin/attendance/stats/:target    — 일별 통계 (from/to 옵션)
 *  GET   /api/admin/attendance/history          — 회원별 이력 (member_id 또는 q 검색)
 */
@Controller('admin/attendance')
@UseGuards(AdminAuthGuard)
export class AdminAttendanceController {
  constructor(private readonly svc: AdminAttendanceService) {}

  @Get('policy/:target')
  getPolicy(@Param('target') target: string) {
    return this.svc.getPolicy(this.assertTarget(target));
  }

  @Patch('policy/:target')
  updatePolicy(
    @Param('target') target: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.svc.updatePolicy(this.assertTarget(target), body as never);
  }

  @Get('stats/:target')
  getStats(
    @Param('target') target: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getStats(this.assertTarget(target), from, to);
  }

  @Get('history')
  getHistory(@Query() q: Record<string, string>) {
    return this.svc.getHistoryByMember({
      member_id: q.member_id ? Number(q.member_id) : undefined,
      q: q.q || undefined,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 20,
    });
  }

  private assertTarget(t: string): AttendanceTargetKind {
    if (t !== 'user' && t !== 'counselor') {
      throw new BadRequestException(`target 은 'user' 또는 'counselor' 여야 합니다.`);
    }
    return t;
  }
}
