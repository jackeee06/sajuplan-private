import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminCounselorOpsService } from './counselor-ops.service';

/**
 *   GET /admin/counselors/:id/ops-summary
 *   상담사 운영 종합 정보 — 마이페이지에 보이는 내용을 어드민 뷰로.
 */
@Controller('admin/counselors')
@UseGuards(AdminAuthGuard)
export class AdminCounselorOpsController {
  constructor(private readonly svc: AdminCounselorOpsService) {}

  @Get(':id/ops-summary')
  async summary(@Param('id') idStr: string) {
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException('잘못된 상담사 id');
    }
    return this.svc.summary(id);
  }
}
