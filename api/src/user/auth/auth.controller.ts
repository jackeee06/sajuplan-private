import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync, unlink } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { AuthService, type UpdateMeBody, type UserLoginResult } from './auth.service';
import { SocialAuthService, type SocialProvider } from './social-auth.service';
import { runtimeEnv } from '../../shared/env/runtime-env';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UserAuthGuard, type UserAuthedRequest } from './user-auth.guard';
import { OptionalUserGuard, type OptionalUserRequest } from './optional-user.guard';
import { SmsService } from '../sms/sms.service';
import { CaptchaService } from '../captcha/captcha.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const MEMBER_FILE_DIR = join(process.cwd(), 'uploads', 'member');
mkdirSync(MEMBER_FILE_DIR, { recursive: true });

const PROFILE_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const PROFILE_IMG_MAX_BYTES = 5 * 1024 * 1024;

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
    private readonly sms: SmsService,
    private readonly captcha: CaptchaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────
  // 일반 로그인 (mb_id + password)
  // ─────────────────────────────────────────────
  @Post('login')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const member = await this.authService.loginByLocal(
      body.mb_id,
      body.password,
    );
    await this.issueLoginCookie(res, member, body.keep_login);
    // 로그인 직후 m2net 잔액을 사주플랜 측 값으로 동기화 — 응답 지연 없도록 비동기 fire-and-forget.
    void this.authService.syncM2netBalanceForMember(member.id);
    return { ok: true, member };
  }

  /**
   * 사주플랜 측 잔액(point) 을 m2net 측 amt 로 강제 동기화.
   * - 메인페이지 진입 시 1회 호출 (앱 켤 때마다 갱신).
   * - 일반 회원만 대상. 상담사 호출 시 ok=false 반환.
   */
  @Post('sync-m2net-balance')
  @HttpCode(200)
  @UseGuards(UserAuthGuard)
  async syncM2netBalance(@Req() req: UserAuthedRequest) {
    return this.authService.syncM2netBalanceForMember(req.user.sub);
  }

  // ─────────────────────────────────────────────
  // 현재 로그인 사용자
  // ─────────────────────────────────────────────
  @Get('me')
  @UseGuards(UserAuthGuard)
  async me(@Req() req: UserAuthedRequest) {
    return this.authService.findActiveById(req.user.sub);
  }

  /**
   * 클라이언트 접속 정보(IP 등) 조회. 로그인 불필요.
   * 사용처: 특정 IP 차단/안내(예: 앱 심사 IP에서 결제 막기) 처리.
   * X-Forwarded-For 가 있으면 첫 항목(원 클라이언트)을 반환.
   */
  @Get('whoami')
  whoami(@Req() req: Request) {
    const xff = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    const ipFromXff = xff ? xff.split(',')[0].trim() : '';
    const ip = ipFromXff || req.ip || '';
    return { ip };
  }

  /** 마이페이지 회원정보 수정 폼 prefill — 풀 프로필 (휴대폰/주소/생년월일 등) */
  @Get('me/profile')
  @UseGuards(UserAuthGuard)
  async getMeProfile(@Req() req: UserAuthedRequest) {
    return this.authService.getMeProfile(req.user.sub);
  }

  /**
   * 회원 정보 수정.
   * Body: 부분 업데이트 (변경 필드만). 자동등록방지(captcha)는 폼에서 수집해 검증.
   */
  @Patch('me/profile')
  @UseGuards(UserAuthGuard)
  async updateMeProfile(
    @Req() req: UserAuthedRequest,
    @Body() body: UpdateMeBody,
  ) {
    // 캡차는 2026-05-21 제거 — 회원정보 수정은 이미 로그인 인증 통과한 요청이라 추가 봇 차단 불필요
    return this.authService.updateMeProfile(req.user.sub, body);
  }

  /** 비밀번호 변경 — 현재 비밀번호 검증 후 새 비밀번호로 교체. */
  @Post('me/password')
  @UseGuards(UserAuthGuard)
  async changePassword(
    @Req() req: UserAuthedRequest,
    @Body() body: { current_password?: string; new_password?: string },
  ) {
    if (!body.current_password || !body.new_password) {
      throw new BadRequestException('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.');
    }
    await this.authService.changePassword(
      req.user.sub,
      body.current_password,
      body.new_password,
    );
    return { ok: true };
  }

  /** 회원탈퇴 — left_at 마킹 후 쿠키 정리. */
  @Delete('me')
  @UseGuards(UserAuthGuard)
  async withdrawMe(
    @Req() req: UserAuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.withdrawMe(req.user.sub);
    res.clearCookie(this.cookieName(), this.cookieOptions());
    return { ok: true };
  }

  /**
   * 프로필 사진 업로드 — multipart/form-data, field name 'file'.
   * 단일 슬롯 (회원당 1장). 기존 이미지는 자동 교체 + storage 정리.
   */
  @Post('me/profile-image')
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: MEMBER_FILE_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: PROFILE_IMG_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!PROFILE_IMG_EXTS.includes(ext)) {
          return cb(new BadRequestException(`허용되지 않은 확장자: ${ext}. (${PROFILE_IMG_EXTS.join(', ')})`), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadProfileImage(
    @Req() req: UserAuthedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');

    // 기존 프로필 파일 목록 — DB 갱신 후 storage unlink 용
    const oldFiles = await this.authService.getCurrentProfileFiles(req.user.sub);

    // WebP 변환
    const { webpFilename } = await convertImageToWebp(file.path);

    // DB 갱신 (단일 슬롯이라 기존 row 자동 삭제 + 새 row INSERT)
    const result = await this.authService.upsertProfileImage(req.user.sub, {
      originalname: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      stored_name_webp: webpFilename,
    });

    // 이전 storage 파일 unlink (실패해도 무시)
    for (const f of oldFiles) {
      if (f.stored_name) unlink(join(MEMBER_FILE_DIR, f.stored_name), () => {});
      if (f.stored_name_webp && f.stored_name_webp !== f.stored_name) {
        unlink(join(MEMBER_FILE_DIR, f.stored_name_webp), () => {});
      }
    }

    return result;
  }

  /** 프로필 사진 삭제 */
  @Delete('me/profile-image')
  @UseGuards(UserAuthGuard)
  async deleteProfileImage(@Req() req: UserAuthedRequest) {
    const removed = await this.authService.removeProfileImage(req.user.sub);
    for (const f of removed) {
      if (f.stored_name) unlink(join(MEMBER_FILE_DIR, f.stored_name), () => {});
      if (f.stored_name_webp && f.stored_name_webp !== f.stored_name) {
        unlink(join(MEMBER_FILE_DIR, f.stored_name_webp), () => {});
      }
    }
    return { ok: true };
  }

  /**
   * 앱 설정 — 푸시알림 전체 수신 ON/OFF.
   * Body: { on: boolean }
   *
   * NOTE: 추후 모바일 앱 연동 시 이 토글이 OFF 면 FCM/APNs 토픽 unsubscribe,
   * ON 이면 device 의 모든 토픽 재구독 처리 필요 (member_push_token 기준).
   */
  @Patch('me/push')
  @UseGuards(UserAuthGuard)
  async updatePush(
    @Req() req: UserAuthedRequest,
    @Body() body: { on?: boolean },
  ) {
    const on = body?.on === true;
    return this.authService.updatePushAll(req.user.sub, on);
  }

  // ─────────────────────────────────────────────
  // FCM 푸시 토큰 / 토픽 (모바일 앱 전용)
  // ─────────────────────────────────────────────

  /**
   * POST /api/user/auth/push-token
   * 앱 부팅 시 디바이스 토큰을 서버에 등록 / 갱신. 비로그인 상태에서도
   * 호출 가능 (member_id 는 로그인된 경우에만 매핑). 로그인 직후 다시
   * 호출되면 자동으로 회원에 매핑된다.
   *
   * Body: { token, platform: 'android'|'ios', mb_id?, device_phone? }
   */
  @Post('push-token')
  @UseGuards(OptionalUserGuard)
  async registerPushToken(
    @Req() req: OptionalUserRequest,
    @Body() body: {
      token?: string;
      platform?: 'android' | 'ios';
      mb_id?: string;
      device_phone?: string;
    },
  ) {
    const token = (body?.token ?? '').trim();
    if (!token) throw new BadRequestException('token required');
    const platform: 'android' | 'ios' =
      body?.platform === 'ios' ? 'ios' : 'android';
    return this.authService.upsertPushToken({
      token,
      platform,
      memberId: req.user?.sub ?? null,
      mbId: body?.mb_id ?? null,
      devicePhone: body?.device_phone ?? null,
    });
  }

  /**
   * POST /api/user/auth/push-token/bind
   * 로그인된 사용자의 토큰을 회원에 매핑. /push-token 이 자동으로 처리하므로
   * 명시적 매핑이 필요할 때만 호출 (예: 토큰은 그대로인데 다른 회원으로 재로그인).
   */
  @Post('push-token/bind')
  @UseGuards(UserAuthGuard)
  async bindPushToken(
    @Req() req: UserAuthedRequest,
    @Body() body: { token?: string },
  ) {
    const token = (body?.token ?? '').trim();
    if (!token) throw new BadRequestException('token required');
    await this.authService.bindPushTokenToMember(req.user.sub, token);
    return { ok: true };
  }

  /**
   * DELETE /api/user/auth/push-token
   * 로그아웃 / 앱 삭제 등에 호출 — token 비활성화.
   */
  @Delete('push-token')
  async deletePushToken(@Body() body: { token?: string }) {
    const token = (body?.token ?? '').trim();
    if (!token) throw new BadRequestException('token required');
    await this.authService.deactivatePushToken(token);
    return { ok: true };
  }

  /**
   * POST /api/user/auth/push-topics
   * 토픽 일괄 구독/해제. unsubscribe 먼저 처리되고 그 다음 subscribe.
   *
   * Body: { token, subscribe?: string[], unsubscribe?: string[] }
   * 예시:
   *  { token, subscribe: ['chl_2','chl_all'], unsubscribe: ['chl_5'] }
   */
  @Post('push-topics')
  @UseGuards(OptionalUserGuard)
  async updatePushTopics(
    @Body() body: {
      token?: string;
      subscribe?: string[];
      unsubscribe?: string[];
    },
  ) {
    const token = (body?.token ?? '').trim();
    if (!token) throw new BadRequestException('token required');
    return this.authService.updatePushTopics({
      token,
      subscribe: body?.subscribe ?? [],
      unsubscribe: body?.unsubscribe ?? [],
    });
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

    // Apple은 response_mode=form_post → 외부 도메인이 우리 콜백으로 cross-site POST 함.
    // SameSite=Lax 쿠키는 cross-site POST 에 실리지 않으므로(Apple 콜백에서 state 누락) None+Secure 사용.
    // kakao/naver 는 GET top-level redirect 라 Lax 로 충분.
    const sameSite: 'lax' | 'none' = p === 'apple' ? 'none' : 'lax';
    res.cookie(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite,
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
    // apple은 GET callback을 쓰지 않고 POST form_post 로 받음 — 잘못된 진입은 로그인으로
    if (p === 'apple') {
      return res.redirect(`${siteUrl}/login`);
    }

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
      // 회원가입 폼은 SMS 인증/캡차/주소검색/약관까지 시간 걸리므로 60분 부여
      { expiresIn: '60m' },
    );
    res.cookie(SOCIAL_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return res.redirect(`${siteUrl}/signup?social=${p}`);
  }

  // ─────────────────────────────────────────────
  // 소셜: 모바일 앱(RN) 네이티브 SDK — GET 콜백 흐름 (권장)
  //   GET /api/user/auth/social/:provider/native_callback?token=...&ret=/...
  //
  // RN 앱 흐름:
  //   1) 웹에서 버튼 클릭 → window.ReactNativeWebView.postMessage({type:'SNS_LOGIN',provider})
  //   2) RN 이 네이티브 SDK (kakao/naver) 로 access_token 획득
  //   3) RN 이 webView 를 이 URL 로 이동 → 서버가 쿠키 발급 후 SPA 로 302
  //
  // 동작:
  //   - 기존 회원 → sjm_user 쿠키 발급 + ${USER_SITE_URL}${ret || '/'} 로 302
  //   - 신규     → sjm_social_pending 쿠키 발급 + ${USER_SITE_URL}/signup?social=:provider 로 302
  //   - 토큰 누락/검증 실패 → ${USER_SITE_URL}/login?error=:provider_xxx 로 302
  //
  // ※ 같은 토큰으로 짧은 시간 안에 여러 번 호출되어도 idempotent — findMember 가 동일 결과.
  // ※ ret 은 normalizeRedirect 로 internal 경로만 허용 (open redirect 방지).
  // ─────────────────────────────────────────────
  @Get('social/:provider/native_callback')
  async socialNativeCallback(
    @Param('provider') provider: string,
    @Query('token') token: string | undefined,
    @Query('ret') ret: string | undefined,
    @Res() res: Response,
  ) {
    const siteUrl = this.siteUrl();
    const safeRet = this.normalizeRedirect(ret);
    const p = this.assertProvider(provider);
    // apple은 GET native_callback 미지원 — POST /apple/native (identity_token) 사용
    if (p === 'apple') {
      return res.redirect(`${siteUrl}/login?error=apple_use_post_native`);
    }
    const access = (token ?? '').trim();
    if (!access) {
      return res.redirect(`${siteUrl}/login?error=${p}_no_token`);
    }

    const settings = await this.social.getSettings();
    if (!settings.use || !settings.service_list.includes(p)) {
      return res.redirect(`${siteUrl}/login?error=${p}_disabled`);
    }

    let profile;
    try {
      profile =
        p === 'kakao'
          ? await this.social.fetchKakaoProfileFromAccessToken(access)
          : await this.social.fetchNaverProfileFromAccessToken(access);
    } catch {
      return res.redirect(`${siteUrl}/login?error=${p}_token_invalid`);
    }

    const existing = await this.social.findMember(p, profile.uid);
    if (existing) {
      const member = await this.authService.findActiveById(existing.id);
      await this.issueLoginCookie(res, member, true);
      return res.redirect(`${siteUrl}${safeRet}`);
    }

    // 신규 → pending 쿠키 발급 후 가입 페이지로
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
      { expiresIn: '60m' },
    );
    res.cookie(SOCIAL_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return res.redirect(`${siteUrl}/signup?social=${p}`);
  }

  // ─────────────────────────────────────────────
  // 소셜: 모바일 앱(RN) 네이티브 SDK — POST/JSON 흐름 (선택, AJAX 사용처용)
  //   POST /api/user/auth/social/kakao/native  { access_token }
  //
  // GET 콜백과 동일 로직이지만 JSON 응답을 받는 클라이언트가 필요할 때 사용.
  // 일반적인 RN webview 흐름에선 native_callback (GET) 이 권장됨.
  // ─────────────────────────────────────────────
  @Post('social/kakao/native')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async kakaoNative(
    @Body() body: { access_token?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (body?.access_token ?? '').trim();
    if (!token) {
      throw new BadRequestException('access_token 이 누락되었습니다.');
    }

    const settings = await this.social.getSettings();
    if (!settings.use) {
      throw new ForbiddenException('소셜 로그인이 비활성화되어 있습니다.');
    }
    if (!settings.service_list.includes('kakao')) {
      throw new ForbiddenException('카카오 로그인이 활성화되어 있지 않습니다.');
    }

    const profile = await this.social.fetchKakaoProfileFromAccessToken(token);

    // 기존 회원이면 즉시 로그인
    const existing = await this.social.findMember('kakao', profile.uid);
    if (existing) {
      const member = await this.authService.findActiveById(existing.id);
      await this.issueLoginCookie(res, member, true);
      return { ok: true, needs_signup: false, member };
    }

    // 신규 → pending 쿠키 발급 (가입 폼에서 소비)
    const pendingToken = await this.jwt.signAsync(
      {
        type: 'social_pending',
        provider: 'kakao',
        uid: profile.uid,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname,
        phone: profile.phone,
      } satisfies SocialPendingPayload,
      { expiresIn: '60m' },
    );
    res.cookie(SOCIAL_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return {
      ok: true,
      needs_signup: true,
      pending: {
        provider: 'kakao' as SocialProvider,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname,
        phone: profile.phone,
      },
    };
  }

  // ─────────────────────────────────────────────
  // 소셜: Apple Sign in — 웹 OAuth form_post 콜백
  //   POST /api/user/auth/social/apple/callback
  //
  // Apple은 response_mode=form_post 로 POST 본문에 code/id_token/state/user 를 보냄.
  //   - id_token: identityToken (JWT, aud=Services ID)
  //   - user: { name: { firstName, lastName }, email } — 첫 동의에서만 옴 (JSON 문자열)
  //   - state: 우리가 보낸 nonce — cookie state 와 일치 검증
  // ─────────────────────────────────────────────
  @Post('social/apple/callback')
  async appleWebCallback(
    @Body()
    body: {
      code?: string;
      id_token?: string;
      state?: string;
      error?: string;
      user?: string;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const siteUrl = this.siteUrl();
    if (body?.error) {
      res.clearCookie(STATE_COOKIE_NAME, this.cookieOptions('lax'));
      return res.redirect(`${siteUrl}/login`);
    }
    if (!body?.id_token || !body?.state) {
      return res.redirect(`${siteUrl}/login`);
    }
    const cookieState = req.cookies?.[STATE_COOKIE_NAME];
    if (!cookieState || cookieState !== body.state) {
      res.clearCookie(STATE_COOKIE_NAME, this.cookieOptions('lax'));
      return res.redirect(`${siteUrl}/login`);
    }
    res.clearCookie(STATE_COOKIE_NAME, this.cookieOptions('lax'));

    const settings = await this.social.getSettings();

    // user 필드는 첫 동의에서만 옴 — 이메일/이름 백필
    type AppleUser = { name?: { firstName?: string; lastName?: string }; email?: string };
    let parsedUser: AppleUser | null = null;
    if (body.user) {
      try {
        parsedUser = JSON.parse(body.user) as AppleUser;
      } catch {
        parsedUser = null;
      }
    }
    const nameFromUser = parsedUser?.name
      ? `${parsedUser.name.lastName ?? ''}${parsedUser.name.firstName ?? ''}`.trim() || null
      : null;
    const emailFromUser = parsedUser?.email ?? null;

    let profile;
    try {
      profile = await this.social.verifyAppleIdentityToken(
        settings,
        body.id_token,
        'web',
        { name: nameFromUser, email: emailFromUser },
      );
    } catch {
      return res.redirect(`${siteUrl}/login?error=apple_token_invalid`);
    }

    const existing = await this.social.findMember('apple', profile.uid);
    const next = this.parseRedirectFromState(body.state) ?? '/';
    if (existing) {
      const member = await this.authService.findActiveById(existing.id);
      await this.issueLoginCookie(res, member, true);
      return res.redirect(`${siteUrl}${next}`);
    }
    const pendingToken = await this.jwt.signAsync(
      {
        type: 'social_pending',
        provider: 'apple',
        uid: profile.uid,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname,
        phone: profile.phone,
      } satisfies SocialPendingPayload,
      { expiresIn: '60m' },
    );
    res.cookie(SOCIAL_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return res.redirect(`${siteUrl}/signup?social=apple`);
  }

  // ─────────────────────────────────────────────
  // 소셜: Apple Sign in — 모바일 앱(RN) 네이티브 SDK
  //   POST /api/user/auth/social/apple/native  { identity_token, name?, email? }
  //
  // RN @invertase/react-native-apple-authentication 로 받은 identityToken을 검증.
  // aud = Bundle ID (com.dmonster.sajumoon).
  // user.name / user.email 은 최초 1회 동의 직후에만 SDK 가 반환 → 클라가 같이 전송해주면 백필.
  // ─────────────────────────────────────────────
  @Post('social/apple/native')
  @HttpCode(200)
  @Throttle({ login: { limit: 30, ttl: 60_000 } })
  async appleNative(
    @Body() body: { identity_token?: string; name?: string; email?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (body?.identity_token ?? '').trim();
    if (!token) {
      throw new BadRequestException('identity_token 이 누락되었습니다.');
    }
    const settings = await this.social.getSettings();
    if (!settings.use) {
      throw new ForbiddenException('소셜 로그인이 비활성화되어 있습니다.');
    }
    if (!settings.service_list.includes('apple')) {
      throw new ForbiddenException('애플 로그인이 활성화되어 있지 않습니다.');
    }

    const profile = await this.social.verifyAppleIdentityToken(
      settings,
      token,
      'native',
      {
        name: body?.name?.trim() || null,
        email: body?.email?.trim() || null,
      },
    );

    const existing = await this.social.findMember('apple', profile.uid);
    if (existing) {
      const member = await this.authService.findActiveById(existing.id);
      await this.issueLoginCookie(res, member, true);
      return { ok: true, needs_signup: false, member };
    }

    const pendingToken = await this.jwt.signAsync(
      {
        type: 'social_pending',
        provider: 'apple',
        uid: profile.uid,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname,
        phone: profile.phone,
      } satisfies SocialPendingPayload,
      { expiresIn: '60m' },
    );
    res.cookie(SOCIAL_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return {
      ok: true,
      needs_signup: true,
      pending: {
        provider: 'apple' as SocialProvider,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname,
        phone: profile.phone,
      },
    };
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
  //   GET /api/user/auth/check-mb-id?mb_id=...
  //   - 가입 폼의 [중복확인] 버튼이 호출
  //   - 형식 검증(영문/숫자/._- 만, 3~60자)도 같이 수행
  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
  // 비밀번호 찾기 (휴대폰) — SMS 인증 통과 후 임시비밀번호 발급 + 알림톡 발송
  //   POST /api/user/auth/find/phone  { phone, code }
  // ─────────────────────────────────────────────
  @Post('find/phone')
  @HttpCode(200)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  async findByPhone(@Body() body: { phone?: string; code?: string }) {
    const phone = String(body.phone ?? '').replace(/[^0-9]/g, '');
    const code = String(body.code ?? '').trim();
    if (!/^01[0-9]{8,9}$/.test(phone)) {
      throw new BadRequestException('휴대폰번호를 올바르게 입력해 주십시오.');
    }
    if (!code) {
      throw new BadRequestException('인증번호를 입력해주세요.');
    }
    // 인증번호 5분 내 매칭 검증 (재검증 — 1회용 아님)
    await this.sms.assertVerified(phone, code);
    await this.authService.findPasswordByPhone(phone);
    return { ok: true };
  }

  // ─────────────────────────────────────────────
  // 비밀번호 찾기 (이메일) — 임시비밀번호 발급 + 메일 발송
  //   POST /api/user/auth/find/email  { email }
  // ─────────────────────────────────────────────
  @Post('find/email')
  @HttpCode(200)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  async findByEmail(@Body() body: { email?: string }) {
    await this.authService.findPasswordByEmail(String(body.email ?? ''));
    return { ok: true };
  }

  @Get('check-mb-id')
  async checkMbId(@Query('mb_id') mbId: string | undefined) {
    const id = (mbId || '').trim();
    if (!id) {
      throw new BadRequestException('아이디를 입력해주세요.');
    }
    if (id.length < 3 || id.length > 20) {
      throw new BadRequestException('아이디는 3~20자여야 합니다.');
    }
    if (!/^[A-Za-z0-9_]+$/.test(id)) {
      throw new BadRequestException(
        '아이디는 영문/숫자/_ 만 사용 가능합니다.',
      );
    }
    if (/_[KN]$/.test(id)) {
      throw new BadRequestException(
        '소셜 가입 형식과 동일한 ID는 사용할 수 없습니다.',
      );
    }
    // 금지 아이디 (admin security 설정) — 중복확인 시점에 즉시 거부
    await this.authService.assertMbIdNotProhibited(id);
    const available = await this.authService.isMbIdAvailable(id);
    return { available, mb_id: id };
  }

  // ─────────────────────────────────────────────
  // 회원가입 — 로컬 / 소셜 둘 다 지원
  //   POST /api/user/auth/signup
  //   - sjm_social_pending 쿠키가 있으면 → 소셜 가입 (mb_id/password 무시, social UID 연결)
  //   - 없으면 → 로컬 가입 (mb_id + password 필수)
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

    // 프론트가 'social=kakao|naver' 를 명시했는데 pending 이 없으면 (쿠키 만료/누락/위조)
    // 사용자가 헷갈리지 않도록 즉시 명확한 에러로 알리고 카카오/네이버 재로그인 유도.
    if (!pending && body.social) {
      throw new BadRequestException(
        '소셜 인증이 만료되었습니다. 카카오/네이버 로그인을 다시 시도해주세요.',
      );
    }
    // (보조 케이스) 쿠키 자체는 있는데 검증 실패한 경우도 동일 안내
    if (!pending && req.cookies?.[SOCIAL_PENDING_COOKIE]) {
      throw new BadRequestException(
        '소셜 인증이 만료되었습니다. 카카오/네이버 로그인을 다시 시도해주세요.',
      );
    }

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

      // 소셜 가입: 휴대폰 SMS 인증으로 봇 차단 (캡차는 2026-05-21 제거 — UX 우선)
      if (!body.phone) {
        throw new BadRequestException('휴대폰번호를 입력해주세요.');
      }
      // [Audit E-W8] 휴대폰 인증 상태 재검증 — 30분 윈도우.
      //   1단계 verify (3분 코드 만료) 만으로 충분하다는 기존 정책 유지하되,
      //   verify 미수행 / 매우 오래된 verify 인 phone 으로 가입 시도하면 거부.
      //   윈도우 30분: 주소검색/약관 정독 시간 충분히 포함 (99%+ 정상 사용자 통과).
      const isVerified = await this.sms.isVerifiedRecently(body.phone, 30);
      if (!isVerified) {
        throw new BadRequestException(
          '휴대폰 인증이 만료되었습니다. 인증번호를 다시 받아주세요.',
        );
      }

      // 같은 휴대폰번호로 다른 경로(카카오/네이버/일반) 가입 차단
      await this.authService.assertPhoneAvailable(body.phone);

      // 금지 이메일 도메인 검사 (소셜에도 동일 적용)
      await this.authService.assertEmailNotProhibited(
        body.email ?? pending.email,
      );

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

      // m2net (AG9/PassCall) 외부 회원 등록 — 로컬과 동일하게 적용
      // 실패 시 회원 row 롤백 + 사용자에게 알림 (sample 정책)
      await this.authService.registerWithM2net(created.id);

      // 회원가입 쿠폰 발급 (소셜 가입도 동일하게) — 발급 실패는 가입을 막지 않음
      try {
        await this.authService.issueSignupCoupon(created.id);
      } catch {
        // 로그는 service 내부에서. 회원가입은 계속 진행.
      }

      const member = await this.authService.findActiveById(created.id);
      await this.issueLoginCookie(res, member, true);
      res.clearCookie(SOCIAL_PENDING_COOKIE, this.cookieOptions('lax'));
      return { ok: true, member };
    }

    // ── 로컬 가입 분기 ─────────────────────────
    if (!body.mb_id || !body.password) {
      throw new BadRequestException('아이디와 비밀번호를 입력해주세요.');
    }
    if (!body.phone) {
      throw new BadRequestException('휴대폰번호를 입력해주세요.');
    }

    // (캡차는 2026-05-21 제거 — 휴대폰 SMS 인증으로 봇 차단 충분, UX 우선)

    // [Audit E-W8] 휴대폰 인증 상태 재검증 — 30분 윈도우.
    //   1단계 verify (3분 코드 만료) 후 30분 안에 가입 완료해야 함.
    //   주소검색/약관 정독 시간 충분히 포함하면서, verify 안 한 phone 으로의 가입 시도 차단.
    const isVerified = await this.sms.isVerifiedRecently(body.phone, 30);
    if (!isVerified) {
      throw new BadRequestException(
        '휴대폰 인증이 만료되었습니다. 인증번호를 다시 받아주세요.',
      );
    }

    // (3) DB 회원 생성 + m2net 외부 등록 (실패 시 롤백)
    const created = await this.authService.createLocalMember({
      mb_id: body.mb_id,
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
      providers: s.service_list.filter(
        (p) => p === 'kakao' || p === 'naver' || p === 'apple',
      ),
    };
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────

  private assertProvider(p: string): SocialProvider {
    if (p !== 'kakao' && p !== 'naver' && p !== 'apple') {
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
      mb_id: member.mb_id,
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
    return runtimeEnv().cookieSecure;
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
    return `${runtimeEnv().apiPublicUrl}/api/user/auth/social/${provider}/callback`;
  }
  private siteUrl(): string {
    return runtimeEnv().userSiteUrl;
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
