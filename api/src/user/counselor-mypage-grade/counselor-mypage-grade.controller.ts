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
import { GradeUpgradeService } from '../../shared/grade-upgrade/grade-upgrade.service';

/**
 * 상담사 마이페이지 — 등급/단가 자가관리.
 *   GET  /api/user/counselor-mypage/grade           — 내 등급/단가/락 상태
 *   GET  /api/user/counselor-mypage/grade/progress  — 당월 상담시간 진행상황 + 실시간 승급 이력
 *   POST /api/user/counselor-mypage/grade/unit-cost — 단가 변경 (월 1일 락 / 신규 즉시)
 *
 * 모든 라우트는 로그인한 상담사 본인 전용.
 */
@Controller('user/counselor-mypage/grade')
@UseGuards(UserAuthGuard)
export class UserCounselorMypageGradeController {
  constructor(
    private readonly svc: UserCounselorMypageGradeService,
    private readonly gradeUpgrade: GradeUpgradeService,
  ) {}

  @Get()
  async getMine(@Req() req: UserAuthedRequest) {
    this.assertCounselor(req);
    return this.svc.getMine(req.user.sub);
  }

  /**
   * 당월 상담시간 진행상황 + 실시간 승급 이력.
   * 프론트 프로그레스 바 + 이번 달 승급 이력 표시용.
   */
  @Get('progress')
  async getProgress(@Req() req: UserAuthedRequest) {
    this.assertCounselor(req);
    return this.gradeUpgrade.getCurrentMonthProgress(req.user.sub);
  }

  /**
   * 미확인 실시간 승급 1건 조회 + 즉시 마킹 (출석 토스트 방식).
   * 클라가 상담 종료 직후 / 마이페이지 진입 / 로그인 시 호출 → 결과 있으면 토스트 1회.
   * 응답: { upgrade: {grade_after, grade_label, hours, upgraded_at} | null }
   */
  // POST 사용 — WebView cross-origin GET 쿠키 전달 불안정 회피. 데이터 변경(notified_at)이므로 POST가 의미상도 맞음.
  @Post('pending-upgrade')
  async pendingUpgrade(@Req() req: UserAuthedRequest) {
    this.assertCounselor(req);
    return { upgrade: await this.gradeUpgrade.consumePendingUpgrade(req.user.sub) };
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
