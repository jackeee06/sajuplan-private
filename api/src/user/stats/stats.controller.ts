import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UserStatsService } from './stats.service';

@Controller('user/stats')
export class UserStatsController {
  constructor(private readonly svc: UserStatsService) {}

  /**
   * GET /api/user/stats/main
   * 메인 페이지 통계 카드 2개 — 인증 불필요(공개).
   * 호출 시 방문자 1건 기록(IP+날짜 UNIQUE 로 중복 방지) 및 3개월 초과 로그 정리.
   */
  @Get('main')
  async main(@Req() req: Request) {
    const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    const ip = (xff.split(',')[0] || req.ip || req.socket?.remoteAddress || '0.0.0.0').trim();
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;
    void this.svc.recordVisit(ip, ua).catch(() => undefined);
    return this.svc.getMainStats();
  }
}
