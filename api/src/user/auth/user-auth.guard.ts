import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface UserJwtPayload {
  sub: number;
  mb_id: string | null;
  role: string;
  level: number;
}

export interface UserAuthedRequest extends Request {
  user: UserJwtPayload;
}

/**
 * 사용자(회원) JWT 가드.
 * — sjm_user 쿠키를 검증하고 req.user 에 payload 부착.
 */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<UserAuthedRequest>();
    const cookieName =
      this.config.get<string>('USER_COOKIE_NAME') ?? 'sjm_user';
    const token = req.cookies?.[cookieName];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }
    try {
      const payload = await this.jwt.verifyAsync<UserJwtPayload>(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
    }
  }
}
