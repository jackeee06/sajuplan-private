import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserCounselorMypagePayoutService } from './counselor-mypage-payout.service';

/**
 * 상담사 마이페이지 — 선지급(early payout).
 *
 *   GET  /api/user/counselor-mypage/payout/available — 가용 한도 + 등급/계좌/제한 상태
 *   GET  /api/user/counselor-mypage/payout/history?limit=30 — 본인 신청 이력
 *   POST /api/user/counselor-mypage/payout/request — 신청 (트랜잭션 + 동시성 락)
 *   POST /api/user/counselor-mypage/payout/:id/cancel — 본인 취소 (pending 만)
 *   POST /api/user/counselor-mypage/payout/bank — 계좌 등록/변경 (3일 잠금 + 이력)
 *
 * 모든 라우트는 로그인한 상담사 본인 전용.
 */
@Controller('user/counselor-mypage/payout')
@UseGuards(UserAuthGuard)
export class UserCounselorMypagePayoutController {
  constructor(private readonly svc: UserCounselorMypagePayoutService) {}

  @Get('available')
  async getAvailable(@Req() req: UserAuthedRequest) {
    this.assertCounselor(req);
    return this.svc.getMine(req.user.sub);
  }

  @Get('history')
  async getHistory(
    @Req() req: UserAuthedRequest,
    @Query('limit') limit?: string,
  ) {
    this.assertCounselor(req);
    return this.svc.getMyHistory(req.user.sub, Number(limit) || 30);
  }

  @Post('request')
  async createRequest(
    @Req() req: UserAuthedRequest,
    @Body() body: { amount?: number; memo?: string },
  ) {
    this.assertCounselor(req);
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('신청 금액이 올바르지 않습니다.');
    }
    return this.svc.createRequest({
      memberId: req.user.sub,
      amount,
      memo: typeof body?.memo === 'string' ? body.memo.slice(0, 500) : undefined,
    });
  }

  @Post(':id/cancel')
  async cancelRequest(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertCounselor(req);
    return this.svc.cancelRequest(req.user.sub, id);
  }

  @Post('bank')
  async updateBank(
    @Req() req: UserAuthedRequest,
    @Body() body: { bank_name?: string; bank_holder?: string; bank_account?: string },
  ) {
    this.assertCounselor(req);
    return this.svc.updateBank({
      memberId: req.user.sub,
      bank_name: body?.bank_name ?? '',
      bank_holder: body?.bank_holder ?? '',
      bank_account: body?.bank_account ?? '',
      actorIp: (req.headers['x-real-ip'] as string) || req.ip,
    });
  }

  private assertCounselor(req: UserAuthedRequest): void {
    if (req.user?.role !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
  }
}
