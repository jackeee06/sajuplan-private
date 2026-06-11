import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AdminJwtPayload {
  sub: number;
  mb_id: string;
  role: 'admin';
  level: number;
  is_super: boolean;
}

export interface AuthedRequest extends Request {
  admin: AdminJwtPayload;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const cookieName = this.config.get<string>('ADMIN_COOKIE_NAME') ?? 'sjm_admin';
    const token = req.cookies?.[cookieName];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('인증이 필요합니다.');
    }
    try {
      const payload = await this.jwt.verifyAsync<AdminJwtPayload>(token);
      if (payload.role !== 'admin') {
        throw new UnauthorizedException();
      }
      // [2026-06-11 근본수정] JWT sub 는 런타임에 문자열로 들어온다. user-auth.guard 와 동일하게
      //   진입점에서 number 로 정규화해, 향후 권한/소유 비교(=== 숫자 id)에서 타입 불일치로
      //   조용히 무력화되는 버그를 원천 차단한다. NaN 이면 세션 거부.
      const sub = Number(payload.sub);
      if (!Number.isFinite(sub)) {
        throw new UnauthorizedException();
      }
      req.admin = { ...payload, sub };
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
    }
  }
}
