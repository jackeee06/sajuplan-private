import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserCouponsService } from './coupons.service';

/**
 * 마이페이지 쿠폰 — /mypage/coupons.
 *  - 사용내역(used) / 쿠폰함(available) 두 탭
 *  - 보유 쿠폰 사용 / 쿠폰코드 입력 / 사용내역 삭제(hidden_at)
 */
@Controller('user/coupons')
@UseGuards(UserAuthGuard)
export class UserCouponsController {
  constructor(private readonly svc: UserCouponsService) {}

  /** GET /api/user/coupons?status=available|used */
  @Get()
  async list(
    @Req() req: UserAuthedRequest,
    @Query('status') status?: string,
  ) {
    const s = status === 'used' ? 'used' : 'available';
    const items = await this.svc.list(req.user.sub, s);
    return { items };
  }

  /** POST /api/user/coupons/redeem  Body: { code } */
  @Post('redeem')
  async redeem(
    @Req() req: UserAuthedRequest,
    @Body() body: { code?: string },
  ) {
    if (!body.code) throw new BadRequestException('쿠폰번호를 입력해주세요.');
    return this.svc.redeem(req.user.sub, body.code);
  }

  /** POST /api/user/coupons/:id/use — 보유 쿠폰 사용 */
  @Post(':id/use')
  async use(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.use(req.user.sub, id);
  }

  /** DELETE /api/user/coupons/:id — 사용내역에서 숨김 */
  @Delete(':id')
  async hide(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.svc.hide(req.user.sub, id);
    return { ok: true };
  }
}
