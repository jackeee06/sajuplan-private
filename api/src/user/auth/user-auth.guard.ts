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
      // [2026-06-11 근본수정] JWT sub 는 런타임에 문자열로 들어와, 숫자 id 와 `===` 직접 비교 시
      //   타입 불일치로 self/소유권 검증이 조용히 무력화되는 버그가 있었다(qna/consult/counselors).
      //   진입점에서 number 로 정규화해 모든 비교·쿼리에서 일관되게 한다. NaN 이면 세션 거부.
      const sub = Number(payload.sub);
      if (!Number.isFinite(sub)) {
        throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
      }
      req.user = { ...payload, sub };
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
    }
  }
}
