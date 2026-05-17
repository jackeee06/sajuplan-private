import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserPointsService } from './points.service';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';

/**
 * 마이페이지 포인트 내역 (https://sajumoon.kr/mypage/points).
 *
 *  GET /api/user/points/balance      → 보유 포인트 카드 상단
 *  GET /api/user/points/history?page=&limit=  → 적립/사용 리스트
 *
 * 모두 로그인 필요 (UserAuthGuard 가 sjm_user 쿠키 검증 + 401).
 * 본인 내역만 — req.user.sub 만 사용, query 로 다른 회원 ID 받지 않는다.
 */
@Controller('user/points')
@UseGuards(UserAuthGuard)
export class UserPointsController {
  constructor(private readonly svc: UserPointsService) {}

  @Get('balance')
  async balance(@Req() req: UserAuthedRequest) {
    return this.svc.getBalance(req.user.sub);
  }

  @Get('history')
  async history(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // [Audit E-W2] page 상한 — offset 오버플로/DB 부하 방지
    const p = page ? Math.max(1, Math.min(Number(page) || 1, 10_000)) : 1;
    const l = limit ? Math.min(100, Math.max(1, Number(limit) || 30)) : 30;
    return this.svc.getHistory(req.user.sub, p, l);
  }
}
