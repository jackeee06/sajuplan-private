import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserSettlementsService } from './settlements.service';
import { AdminReferralsService } from '../../admin/referrals/referrals.service';

/**
 * 상담사 마이페이지 — 정산 / 정산내역.
 *
 * sample 매핑:
 *   GET /api/user/settlements/summary        ← 마이페이지 카드 (이번달/전월/잔여)
 *   GET /api/user/settlements/income         ← counselor_settlement.php (코인 수익)
 *   GET /api/user/settlements/monthly        ← counselor_settlement_02.php (월별 정산)
 *
 * 모두 본인(상담사) 자료만 노출. role 검증은 별도 없이 member_id 기준으로 자기 row 만.
 */
@Controller('user/settlements')
@UseGuards(UserAuthGuard)
export class UserSettlementsController {
  constructor(
    private readonly svc: UserSettlementsService,
    private readonly referralSvc: AdminReferralsService,
  ) {}

  /**
   * 보유 금액 + 이번달/전월 누적 + 정산 예정.
   * ?month=YYYY-MM 로 특정 월 조회 가능 (실시간 코인 정산 탭).
   */
  @Get('summary')
  async summary(
    @Req() req: UserAuthedRequest,
    @Query('month') month?: string,
  ) {
    return this.svc.summary(req.user.sub, month);
  }

  /**
   * 코인 수익 내역.
   *   ?page=1&limit=15&md=Y|N&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
   */
  @Get('income')
  async income(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('md') md?: string,
    @Query('from_date') from?: string,
    @Query('to_date') to?: string,
  ) {
    const validMd: 'Y' | 'N' | null = md === 'Y' || md === 'N' ? md : null;
    // [Audit E-W3] 정규식 통과해도 비현실적인 날짜(2099-99-99, 2024-02-31 등)는 차단
    const validDate = (s: string | undefined): string | null => {
      if (!s) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const [y, mo, d] = s.split('-').map(Number);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (
        dt.getUTCFullYear() !== y ||
        dt.getUTCMonth() !== mo - 1 ||
        dt.getUTCDate() !== d
      ) {
        throw new BadRequestException(`유효하지 않은 날짜: ${s}`);
      }
      return s;
    };
    // [Audit E-W2 후속] page 상한 — offset 오버플로/DB 부하 방지
    const pageNum = page ? Math.max(1, Math.min(Number(page) || 1, 10_000)) : undefined;
    return this.svc.incomeList({
      memberId: req.user.sub,
      page: pageNum,
      limit: limit ? Number(limit) : undefined,
      md: validMd,
      fromDate: validDate(from),
      toDate: validDate(to),
    });
  }

  /** 월별 정산 마감 내역. */
  @Get('monthly')
  async monthly(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // [Audit E-W2 후속] page 상한
    const pageNum = page ? Math.max(1, Math.min(Number(page) || 1, 10_000)) : undefined;
    return this.svc.monthlyList({
      memberId: req.user.sub,
      page: pageNum,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** 상담사 추천 현황 — 내 코드 + 추천한 상담사 목록 + 누적 수당 */
  @Get('referral')
  async myReferral(@Req() req: UserAuthedRequest) {
    return this.referralSvc.getMyCounselorReferral(req.user.sub);
  }
}
