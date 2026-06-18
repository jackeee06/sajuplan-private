import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { OptionalUserGuard, type OptionalUserRequest } from '../auth/optional-user.guard';
import { UserPopupsService } from './popups.service';

/**
 * 사용자 팝업 (선택적 로그인 — 대상 구분 위해 role 판별).
 *   GET /api/user/popups?area=home|counselor
 *     - area=home(기본): 회원 영역(홈) 팝업
 *     - area=counselor: 상담사 마이페이지 팝업
 */
@Controller('user/popups')
@UseGuards(OptionalUserGuard)
export class UserPopupsController {
  constructor(private readonly svc: UserPopupsService) {}

  @Get()
  async list(@Query('area') area: string | undefined, @Req() req: OptionalUserRequest) {
    const a: 'home' | 'counselor' = area === 'counselor' ? 'counselor' : 'home';
    const role = req.user?.role;
    return { items: await this.svc.listActive({ area: a, role }) };
  }
}
