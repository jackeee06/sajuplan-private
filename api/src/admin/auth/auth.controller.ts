import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminAuthService } from './auth.service';
import { AdminAuthGuard, type AuthedRequest } from './admin-auth.guard';
import { LoginDto } from './dto/login.dto';
import { runtimeEnv } from '../../shared/env/runtime-env';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const admin = await this.authService.login(body.mb_id, body.password);

    const token = await this.jwt.signAsync({
      sub: admin.id,
      mb_id: admin.mb_id,
      role: admin.role,
      level: admin.level,
      is_super: admin.is_super,
    });

    const cookieName = this.config.get<string>('ADMIN_COOKIE_NAME') ?? 'sjm_admin';
    const secure = runtimeEnv().cookieSecure;
    const maxAgeMs = parseExpiresMs(
      this.config.get<string>('ADMIN_JWT_EXPIRES_IN') ?? '8h',
    );

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: maxAgeMs,
    });

    return { ok: true, admin };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @SkipThrottle()
  me(@Req() req: AuthedRequest) {
    return {
      id: req.admin.sub,
      mb_id: req.admin.mb_id,
      role: req.admin.role,
      level: req.admin.level,
      is_super: !!req.admin.is_super,
    };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const cookieName = this.config.get<string>('ADMIN_COOKIE_NAME') ?? 'sjm_admin';
    const secure = runtimeEnv().cookieSecure;
    if (req.cookies?.[cookieName]) {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        path: '/',
      });
    }
  }
}

/**
 * "8h", "30m", "7d", "3600" 같은 표현을 ms로 변환.
 */
function parseExpiresMs(raw: string): number {
  const m = raw.trim().match(/^(\d+)\s*([smhd]?)$/i);
  if (!m) return 8 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult =
    unit === 's' ? 1000
    : unit === 'm' ? 60_000
    : unit === 'h' ? 3_600_000
    : unit === 'd' ? 86_400_000
    : 1000;
  return n * mult;
}
