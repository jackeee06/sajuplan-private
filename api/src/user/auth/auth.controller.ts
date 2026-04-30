import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthService, type UserLoginResult } from './auth.service';
import { SocialAuthService, type SocialProvider } from './social-auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UserAuthGuard, type UserAuthedRequest } from './user-auth.guard';

const STATE_COOKIE_NAME = 'sjm_oauth_state';
const SOCIAL_PENDING_COOKIE = 'sjm_social_pending';

/**
 * 소셜 가입 대기 토큰 페이로드.
 * — 콜백에서 이 토큰을 만들어 쿠키에 심고 /signup 으로 리다이렉트.
 * — 가입 폼 제출 시 컨트롤러가 이 토큰을 검증·소비해 (provider, uid) 와 새 member 를 연결.
 */
interface SocialPendingPayload {
  type: 'social_pending';
  provider: SocialProvider;
  uid: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  phone: string | null;
}

@Controller('user/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly social: SocialAuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────
  // 일반 로그인 (login_id + password)
  // ─────────────────────────────────────────────
  @Post('login')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const member = await this.authService.loginByLocal(
      body.login_id,
      body.password,
    );
    await this.issueLoginCookie(res, member, body.keep_login);
    return { ok: true, member };
  }

  // ─────────────────────────────────────────────
  // 현재 로그인 사용자
  // ─────────────────────────────────────────────
  @Get('me')
  @UseGuards(UserAuthGuard)
  async me(@Req() req: UserAuthedRequest) {
    return this.authService.findActiveById(req.user.sub);
  }

  // ─────────────────────────────────────────────
  // 로그아웃
  // ─────────────────────────────────────────────
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const cookieName = this.cookieName();
    if (req.cookies?.[cookieName]) {
      res.clearCookie(cookieName, this.cookieOptions());
    }
  }

  // ─────────────────────────────────────────────
  // 소셜: 인가 URL로 리다이렉트 (start)
  //   /api/user/auth/social/:provider/start
  // ─────────────────────────────────────────────
  @Get('social/:provider/start')
  async socialStart(
    @Param('provider') provider: string,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    const p = this.assertProvider(provider);
    const settings = await this.social.getSettings();
    const state = this.makeState(redirect);
    const redirectUri = this.callbackUrl(p);
    const authorizeUrl = this.social.buildAuthorizeUrl(
      p,
      settings,
      redirectUri,
      state,
    );

    res.cookie(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 1000,
    });
    res.redirect(authorizeUrl);
  }

  // ─────────────────────────────────────────────
  // 소셜: 콜백 (callback)
  //   /api/user/auth/social/:provider/callback?code=&state=
  // ─────────────────────────────────────────────
  @Get('social/:provider/callback')
  async socialCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const p = this.assertProvider(provider);
    const siteUrl = this.siteUrl();

    if (error) {
      // provider 가 보낸 error (invalid_scope, access_denied 등) — 사용자에게는 노출하지 않고 로그인 페이지로
      res.clearCookie(STATE_COOKIE_NAME, this.cookieOptions('lax'));
      return res.redirect(`${siteUrl}/login`);
    }
    if (!code || !state) {
      // 직접 URL 진입·새로고침 등 — 로그인 페이지로 부드럽게 보냄 (JSON 401 노출 방지)
      return res.redirect(`${siteUrl}/login`);
    }

    const cookieState = req.cookies?.[STATE_COOKIE_NAME];
    if (!cookieState || cookieState !== state) {
      // 뒤로가기·재시도·세션 타임아웃 등 — 로그인 페이지로 보냄 (이미 처리된 콜백을 다시 열었을 가능성 높음)
      res.clearCookie(STATE_COOKIE_NAME, this.cookieOptions('lax'));
      return res.redirect(`${siteUrl}/login`);
    }
    res.clearCookie(STATE_COOKIE_NAME, this.cookieOptions('lax'));

    const settings = await this.social.getSettings();
    let profile;
    try {
      profile = await this.social.fetchProfile(
        p,
        settings,
        code,
        state,
        this.callbackUrl(p),
      );
    } catch {
      // 토큰 교환·프로필 조회 실패 — JSON 노출/쿼리스트링 노출 모두 회피, 그냥 로그인 페이지로
      return res.redirect(`${siteUrl}/login`);
    }

    // 가입 이력이 있으면 → 그대로 로그인 + 메인(또는 redirect 경로) 으로
    const existing = await this.social.findMember(p, profile.uid);
    const next = this.parseRedirectFromState(state) ?? '/';
    if (existing) {
      const member = await this.authService.findActiveById(existing.id);
      await this.issueLoginCookie(res, member, true);
      return res.redirect(`${siteUrl}${next}`);
    }

    // 신규 사용자 → 소셜 프로필을 단기 토큰에 담아 쿠키 → /signup?social=:provider
    const pendingToken = await this.jwt.signAsync(
      {
        type: 'social_pending',
        provider: p,
        uid: profile.uid,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname,
        phone: profile.phone,
      } satisfies SocialPendingPayload,
      { expiresIn: '15m' },
    );
    res.cookie(SOCIAL_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    return res.redirect(`${siteUrl}/signup?social=${p}`);
  }

  // ─────────────────────────────────────────────
  // 소셜 가입 대기 프로필 조회 (가입 폼 prefill 용)
  //   GET /api/user/auth/social/pending
  // ─────────────────────────────────────────────
  @Get('social/pending')
  async socialPending(@Req() req: Request) {
    const payload = await this.readPendingPayload(req);
    if (!payload) return { pending: null };
    return {
      pending: {
        provider: payload.provider,
        email: payload.email,
        name: payload.name,
        nickname: payload.nickname,
        phone: payload.phone,
      },
    };
  }

  // ─────────────────────────────────────────────
  // 아이디 중복확인
  //   GET /api/user/auth/check-login-id?login_id=...
  //   - 가입 폼의 [중복확인] 버튼이 호출
  //   - 형식 검증(영문/숫자/._- 만, 3~60자)도 같이 수행
  // ─────────────────────────────────────────────
  @Get('check-login-id')
  async checkLoginId(@Query('login_id') loginId: string | undefined) {
    const id = (loginId || '').trim();
    if (!id) {
      throw new BadRequestException('아이디를 입력해주세요.');
    }
    if (id.length < 3 || id.length > 60) {
      throw new BadRequestException('아이디는 3~60자여야 합니다.');
    }
    if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      throw new BadRequestException(
        '아이디는 영문/숫자/._- 만 사용 가능합니다.',
      );
    }
    const available = await this.authService.isLoginIdAvailable(id);
    return { available, login_id: id };
  }

  // ─────────────────────────────────────────────
  // 회원가입 — 로컬 / 소셜 둘 다 지원
  //   POST /api/user/auth/signup
  //   - sjm_social_pending 쿠키가 있으면 → 소셜 가입 (login_id/password 무시, social UID 연결)
  //   - 없으면 → 로컬 가입 (login_id + password 필수)
  // ─────────────────────────────────────────────
  @Post('signup')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async signup(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.agree_terms || !body.agree_privacy) {
      throw new BadRequestException('필수 약관에 동의해야 합니다.');
    }

    const pending = await this.readPendingPayload(req);

    // ── 소셜 가입 분기 ─────────────────────────
    if (pending) {
      // 같은 (provider, uid) 가 이미 가입돼 있으면 중복 차단
      const existing = await this.social.findMember(
        pending.provider,
        pending.uid,
      );
      if (existing) {
        throw new BadRequestException('이미 가입된 소셜 계정입니다.');
      }

      const created = await this.social.createSocialMember(
        pending.provider,
        pending.uid,
        pending.email,
        {
          name: body.name,
          nickname: body.nickname,
          email: body.email ?? pending.email,
          phone: body.phone ?? null,
          birth_date: body.birth_date ?? null,
          birth_time: body.birth_time ?? null,
          gender: body.gender ?? null,
          calendar_type: body.calendar_type ?? null,
          zip: body.zip ?? null,
          addr1: body.addr1 ?? null,
          addr2: body.addr2 ?? null,
          acquisition_source: body.acquisition_source ?? null,
        },
      );

      const member = await this.authService.findActiveById(created.id);
      await this.issueLoginCookie(res, member, true);
      res.clearCookie(SOCIAL_PENDING_COOKIE, this.cookieOptions('lax'));
      return { ok: true, member };
    }

    // ── 로컬 가입 분기 ─────────────────────────
    if (!body.login_id || !body.password) {
      throw new BadRequestException('아이디와 비밀번호를 입력해주세요.');
    }

    const created = await this.authService.createLocalMember({
      login_id: body.login_id,
      password: body.password,
      name: body.name,
      nickname: body.nickname,
      email: body.email ?? null,
      phone: body.phone ?? null,
      birth_date: body.birth_date ?? null,
      birth_time: body.birth_time ?? null,
      gender: body.gender ?? null,
      calendar_type: body.calendar_type ?? null,
      zip: body.zip ?? null,
      addr1: body.addr1 ?? null,
      addr2: body.addr2 ?? null,
      acquisition_source: body.acquisition_source ?? null,
    });

    const member = await this.authService.findActiveById(created.id);
    await this.issueLoginCookie(res, member, true);
    return { ok: true, member };
  }

  // ─────────────────────────────────────────────
  // 공개 소셜 설정 조회 (버튼 표시 여부 결정용)
  //   secret 키는 절대 노출하지 않음
  // ─────────────────────────────────────────────
  @Get('social/config')
  async socialConfig() {
    const s = await this.social.getSettings();
    return {
      use: s.use,
      providers: s.service_list.filter((p) => p === 'kakao' || p === 'naver'),
    };
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────

  private assertProvider(p: string): SocialProvider {
    if (p !== 'kakao' && p !== 'naver') {
      throw new UnauthorizedException(`지원하지 않는 소셜 제공자: ${p}`);
    }
    return p;
  }

  private async issueLoginCookie(
    res: Response,
    member: UserLoginResult,
    keepLogin: boolean | undefined,
  ): Promise<void> {
    const token = await this.jwt.signAsync({
      sub: member.id,
      login_id: member.login_id,
      role: member.role,
      level: member.level,
    });
    const maxAgeMs = parseExpiresMs(
      this.config.get<string>('USER_JWT_EXPIRES_IN') ?? '14d',
    );

    res.cookie(this.cookieName(), token, {
      ...this.cookieOptions(),
      // keepLogin=false 면 세션 쿠키(maxAge 미지정 → 브라우저 종료 시 만료)
      ...(keepLogin === false ? {} : { maxAge: maxAgeMs }),
    });
  }

  private cookieName(): string {
    return this.config.get<string>('USER_COOKIE_NAME') ?? 'sjm_user';
  }
  private cookieSecure(): boolean {
    return this.config.get<string>('COOKIE_SECURE') === 'true';
  }
  private cookieOptions(sameSite: 'strict' | 'lax' = 'lax') {
    return {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite,
      path: '/',
    } as const;
  }

  private callbackUrl(provider: SocialProvider): string {
    const base = (
      this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001'
    ).replace(/\/+$/, '');
    return `${base}/api/user/auth/social/${provider}/callback`;
  }
  private siteUrl(): string {
    return (
      this.config.get<string>('USER_SITE_URL') ?? 'http://localhost:5174'
    ).replace(/\/+$/, '');
  }

  /** state = random + base64url(redirect path). CSRF 방어 + 로그인 후 복귀 경로 보존. */
  private makeState(redirect: string | undefined): string {
    const nonce = randomBytes(16).toString('hex');
    const safeRedirect = this.normalizeRedirect(redirect);
    const encoded = Buffer.from(safeRedirect).toString('base64url');
    return `${nonce}.${encoded}`;
  }
  private parseRedirectFromState(state: string): string | null {
    const parts = state.split('.');
    if (parts.length !== 2) return null;
    try {
      const decoded = Buffer.from(parts[1], 'base64url').toString('utf-8');
      return this.normalizeRedirect(decoded);
    } catch {
      return null;
    }
  }
  /** open redirect 차단: 자체 사이트의 경로(/...)만 허용. */
  private normalizeRedirect(input: string | undefined): string {
    if (!input) return '/';
    if (input.startsWith('/') && !input.startsWith('//')) return input;
    return '/';
  }

  /** sjm_social_pending 쿠키에서 페이로드를 꺼내 검증 후 반환. 없거나 만료/위조면 null. */
  private async readPendingPayload(
    req: Request,
  ): Promise<SocialPendingPayload | null> {
    const token = req.cookies?.[SOCIAL_PENDING_COOKIE];
    if (!token || typeof token !== 'string') return null;
    try {
      const payload = await this.jwt.verifyAsync<SocialPendingPayload>(token);
      if (payload.type !== 'social_pending') return null;
      return payload;
    } catch {
      return null;
    }
  }
}

function parseExpiresMs(raw: string): number {
  const m = raw.trim().match(/^(\d+)\s*([smhd]?)$/i);
  if (!m) return 14 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult =
    unit === 's'
      ? 1000
      : unit === 'm'
        ? 60_000
        : unit === 'h'
          ? 3_600_000
          : unit === 'd'
            ? 86_400_000
            : 1000;
  return n * mult;
}
