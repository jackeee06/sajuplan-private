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
      req.admin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
    }
  }
}
