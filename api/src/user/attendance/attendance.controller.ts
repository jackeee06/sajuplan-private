import { Controller, Get, HttpCode, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SQL, type Sql } from '../../shared/db/db.module';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { AttendanceService } from './attendance.service';

/** X-Forwarded-For 첫 항목(원 클라이언트) 우선, 없으면 req.ip. nginx behind 환경 고려. */
function extractClientIp(req: Request): string | null {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
  const fromXff = xff ? xff.split(',')[0].trim() : '';
  return fromXff || req.ip || null;
}

/**
 * 출석체크 API (2026-05-16 Phase 1).
 *
 *  POST /api/user/attendance/checkin      — 출석 처리 (1일 1회). 프론트가 로그인 직후 자동 호출.
 *  GET  /api/user/attendance/today        — 오늘 출석 상태 + 연속일
 *  GET  /api/user/attendance/history?limit — 최근 출석 이력
 *
 * 백엔드 순환 의존 회피를 위해 로그인 hook 이 아닌 클라이언트 자동 호출 방식.
 * 1일 1회 제약은 DB UNIQUE 제약 + service 의 already-attended 체크로 자동 보장.
 */
@Controller('user/attendance')
export class AttendanceController {
  constructor(
    private readonly svc: AttendanceService,
    @Inject(SQL) private readonly sql: Sql,
  ) {}

  /**
   * 출석 처리 — 프론트가 로그인 직후 자동 호출.
   * 이미 오늘 출석한 경우 attended_now=false + skip_reason='already' 반환 (에러 아님).
   * role 은 DB 의 현재 값을 기준으로 판정 (JWT 캐시와 어긋날 수 있어 매번 조회).
   */
  @Post('checkin')
  @HttpCode(200)
  @UseGuards(UserAuthGuard)
  async checkin(@Req() req: UserAuthedRequest) {
    const memberId = req.user.sub;
    const rows = await this.sql<{ role: string | null }[]>`
      SELECT role FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const target: 'user' | 'counselor' = rows[0]?.role === 'counselor' ? 'counselor' : 'user';
    const ip = extractClientIp(req as unknown as Request);
    return this.svc.checkIn(memberId, target, ip);
  }

  @Get('today')
  @UseGuards(UserAuthGuard)
  async today(@Req() req: UserAuthedRequest) {
    return this.svc.getToday(req.user.sub);
  }

  @Get('history')
  @UseGuards(UserAuthGuard)
  async history(
    @Req() req: UserAuthedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getHistory(req.user.sub, limit ? Number(limit) : 30);
  }
}
