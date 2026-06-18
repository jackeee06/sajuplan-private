import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface PromoterRequest extends Request {
  promoter: { pid: number; phone: string };
}

export const PROMOTER_COOKIE = 'sjm_promoter';

/** 모집인 세션 가드 — sjm_promoter JWT 쿠키 검증. */
@Injectable()
export class PromoterAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<PromoterRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[PROMOTER_COOKIE];
    if (!token) throw new UnauthorizedException('모집인 로그인이 필요합니다.');
    try {
      const payload = await this.jwt.verifyAsync<{ pid: number; phone: string; typ: string }>(token, {
        secret: this.config.get<string>('USER_JWT_SECRET'),
      });
      if (payload.typ !== 'promoter' || !payload.pid) throw new Error('invalid');
      req.promoter = { pid: Number(payload.pid), phone: payload.phone };
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해주세요.');
    }
  }
}
