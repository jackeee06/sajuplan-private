import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserSettlementsService } from './settlements.service';

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
  constructor(private readonly svc: UserSettlementsService) {}

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
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    return this.svc.incomeList({
      memberId: req.user.sub,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      md: validMd,
      fromDate: from && dateRe.test(from) ? from : null,
      toDate: to && dateRe.test(to) ? to : null,
    });
  }

  /** 월별 정산 마감 내역. */
  @Get('monthly')
  async monthly(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.monthlyList({
      memberId: req.user.sub,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
