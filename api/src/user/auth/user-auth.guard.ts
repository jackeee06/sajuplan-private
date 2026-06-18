import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { SQL, type Sql } from '../../shared/db/db.module';

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
    @Inject(SQL) private readonly sql: Sql,
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

      // [2026-06-13 근본수정] 토큰의 role 은 발급 시점 값으로 최대 14일 고정된다.
      //   회원→상담사 승격 후 재로그인 전까지 토큰 role 이 'user' 로 남아,
      //   role 을 보는 컨트롤러 가드(계좌/등급/문의/후기 저장 등)가 정당한 상담사를 403 으로 막았다.
      //   me()·일부 서비스는 DB live role 을 봐서 화면은 열리는데 저장만 막히는 불일치.
      //   → 권한 판정의 진실원천을 DB live role 로 통일. 조회 실패 시 토큰 role 유지(락아웃 방지).
      try {
        const rows = await this.sql<{ role: string }[]>`
          SELECT role FROM member WHERE id = ${sub} AND left_at IS NULL LIMIT 1
        `;
        if (rows[0]?.role) {
          req.user.role = rows[0].role;
        }
      } catch {
        /* DB 일시 오류 — 토큰 role 그대로 사용 (가용성 우선) */
      }
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다.');
    }
  }
}
