import {
  BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { runtimeEnv } from '../shared/env/runtime-env';
import { PromoterPublicService } from './promoter.service';
import { PromoterAuthGuard, PROMOTER_COOKIE, type PromoterRequest } from './promoter-auth.guard';

/** 공개 모집인 API — 가드 없는 공개 엔드포인트 + OTP 세션(PromoterAuthGuard). */
@Controller('promoter')
export class PromoterController {
  constructor(
    private readonly svc: PromoterPublicService,
    private readonly config: ConfigService,
  ) {}

  /** 코드 유효성 — 가입 화면에서 prefill 검증 (이름 미반환). */
  @Get('by-code/:code')
  byCode(@Param('code') code: string) {
    return this.svc.byCode(code);
  }

  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  otpRequest(@Body() body: { phone?: string }) {
    if (!body?.phone) throw new BadRequestException('휴대폰번호를 입력해주세요.');
    return this.svc.otpRequest(body.phone);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  async otpVerify(
    @Body() body: { phone?: string; code?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.phone || !body?.code) throw new BadRequestException('휴대폰번호와 인증번호를 입력해주세요.');
    const r = await this.svc.otpVerify(body.phone, body.code);
    // 승인된 모집인만 세션 쿠키 발급(로그인). 그 외(대기/반려/신규)는 상태만 반환.
    if (r.status === 'active' && r.token) {
      res.cookie(PROMOTER_COOKIE, r.token, {
        httpOnly: true,
        secure: runtimeEnv().cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    return { status: r.status, promoterId: r.promoterId, memberName: r.memberName ?? null };
  }

  /** 자가 신청 — 휴대폰 인증 후 이름·계좌 제출 → 승인 대기 등록 */
  @Post('apply')
  @HttpCode(200)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  apply(
    @Body() body: {
      phone?: string; name?: string;
      bank_name?: string; bank_account?: string; account_holder?: string;
    },
  ) {
    if (!body?.phone || !body?.name?.trim()) {
      throw new BadRequestException('이름과 휴대폰번호를 입력해주세요.');
    }
    return this.svc.apply({
      phone: body.phone,
      name: body.name,
      bankName: body.bank_name,
      bankAccount: body.bank_account,
      accountHolder: body.account_holder,
    });
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(PROMOTER_COOKIE, {
      httpOnly: true,
      secure: runtimeEnv().cookieSecure,
      sameSite: 'lax',
      path: '/',
    });
  }

  @Get('me/dashboard')
  @UseGuards(PromoterAuthGuard)
  dashboard(@Req() req: PromoterRequest) {
    return this.svc.dashboard(req.promoter.pid);
  }
}
