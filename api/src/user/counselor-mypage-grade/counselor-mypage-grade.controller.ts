import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserCounselorMypageGradeService } from './counselor-mypage-grade.service';

/**
 * 상담사 마이페이지 — 등급/단가 자가관리.
 *   GET  /api/user/counselor-mypage/grade        — 내 등급/단가/락 상태
 *   POST /api/user/counselor-mypage/grade/unit-cost — 단가 변경 (월 1일 락 / 신규 즉시)
 *
 * 모든 라우트는 로그인한 상담사 본인 전용.
 */
@Controller('user/counselor-mypage/grade')
@UseGuards(UserAuthGuard)
export class UserCounselorMypageGradeController {
  constructor(private readonly svc: UserCounselorMypageGradeService) {}

  @Get()
  async getMine(@Req() req: UserAuthedRequest) {
    this.assertCounselor(req);
    return this.svc.getMine(req.user.sub);
  }

  @Post('unit-cost')
  async changeUnitCost(
    @Req() req: UserAuthedRequest,
    @Body() body: { unit_cost?: number; reason?: string },
  ) {
    this.assertCounselor(req);
    const unitCost = Number(body?.unit_cost);
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      throw new BadRequestException('단가가 올바르지 않습니다.');
    }
    // [Audit E-W1] 비현실적 고액 단가 차단 — 분당 10만원 이상은 거부 (현행 정책상 상한)
    const MAX_UNIT_COST = 100_000;
    if (unitCost > MAX_UNIT_COST) {
      throw new BadRequestException(`단가는 분당 ${MAX_UNIT_COST.toLocaleString()}원 이하여야 합니다.`);
    }
    return this.svc.changeUnitCost({
      memberId: req.user.sub,
      newUnitCost: unitCost,
      reason: body?.reason,
    });
  }

  private assertCounselor(req: UserAuthedRequest): void {
    if (req.user?.role !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
  }
}
