import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../user/auth/user-auth.guard';
import { PromoterCoreService } from '../shared/promoter/promoter-core.service';

/**
 * 회원용 — 추천 코드 사후 입력 (마이페이지).
 *
 * 앱을 새로 깔고 가입하면 링크에 담긴 추천 코드가 앱으로 전달되지 않아(저장소 분리),
 * 가입 시 코드를 못 넣는 경우가 생긴다. 이를 가입 후 7일 이내 1회 마이페이지에서
 * 직접 입력해 구제한다(어뷰징은 기간 가드 + 자기추천 차단 + 1회 UNIQUE 로 차단).
 */
@Controller('user/promoter')
@UseGuards(UserAuthGuard)
export class PromoterMemberController {
  constructor(private readonly core: PromoterCoreService) {}

  /** 사후 입력칸 노출 여부 — 마이페이지에서 조건부 렌더 */
  @Get('referral-status')
  status(@Req() req: UserAuthedRequest) {
    return this.core.getReferralStatus(req.user.sub);
  }

  /** 추천 코드 사후 등록 */
  @Post('referral')
  @HttpCode(200)
  apply(@Req() req: UserAuthedRequest, @Body() body: { code?: string }) {
    return this.core.applyReferralPostSignup(req.user.sub, body?.code ?? '');
  }

  /**
   * 친구초대 활성화 — 코인형 모집인 보장 후 본인 코드/공유링크 반환.
   * 회원이 마이페이지 '친구 초대하기'를 누르면 호출. 멱등(이미 있으면 재사용).
   */
  @Post('invite/enable')
  @HttpCode(200)
  enableInvite(@Req() req: UserAuthedRequest) {
    return this.core.ensureCoinPromoterForMember(req.user.sub);
  }

  /** 내 초대 현황 — 데려온 친구 수·받은 코인·타임라인 (마이페이지) */
  @Get('invite/dashboard')
  inviteDashboard(@Req() req: UserAuthedRequest) {
    return this.core.getMemberInviteDashboard(req.user.sub);
  }

  /**
   * 주인 전용 — '신규 모집인 초대' 카드 데이터(닉네임·서명 초대링크).
   * 이 링크로 들어온 사람은 가입 시 자동승인되어 즉시 활동(서버에서 토큰 검증).
   * is_owner 아니면 403.
   */
  @Get('owner-invite')
  ownerInvite(@Req() req: UserAuthedRequest) {
    return this.core.getOwnerInvite(req.user.sub);
  }
}
