import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserJwtPayload } from './user-auth.guard';

export interface OptionalUserRequest extends Request {
  user?: UserJwtPayload;
}

/**
 * 선택적 회원 인증 가드.
 * — sjm_user 쿠키가 있으면 검증해서 req.user 부착, 없거나 invalid 면 그냥 통과.
 * — 비로그인도 허용해야 하지만 로그인 상태에서는 본인 데이터(비밀글 본문 등)도 노출해야 할 때 사용.
 */
@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<OptionalUserRequest>();
    const cookieName =
      this.config.get<string>('USER_COOKIE_NAME') ?? 'sjm_user';
    const token = req.cookies?.[cookieName];
    if (token && typeof token === 'string') {
      try {
        const payload = await this.jwt.verifyAsync<UserJwtPayload>(token);
        req.user = payload;
      } catch {
        // 만료/위조 — 비로그인 상태로 처리
      }
    }
    return true;
  }
}
