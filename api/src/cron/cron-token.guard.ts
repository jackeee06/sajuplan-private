import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Cron 엔드포인트 인증 가드.
 *
 * 외부 crontab 또는 운영자 수동 호출용. CRON_TOKEN env 와 일치해야 통과.
 *
 *   ?token=...       또는
 *   Header X-Cron-Token: ...
 */
@Injectable()
export class CronTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.get<string>('CRON_TOKEN');
    if (!expected) {
      throw new UnauthorizedException('CRON_TOKEN 미설정');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const got =
      (req.query?.token as string | undefined) ||
      (req.headers['x-cron-token'] as string | undefined);
    if (!got || got !== expected) {
      throw new UnauthorizedException('invalid cron token');
    }
    return true;
  }
}
