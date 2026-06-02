import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import {
  OptionalUserGuard,
  type OptionalUserRequest,
} from '../auth/optional-user.guard';
import { UserNotificationsService } from './notifications.service';
import { AlertsService } from '../../shared/alerts/alerts.service';

/**
 * 사용자 알림 내역 — /api/user/notifications.
 *  - GET: 로그인하면 역할별(role) 매칭 + 개별 알림. 비로그인은 전체공지(category='전체공지')만.
 *  - POST .../read, .../read-all: 로그인 필수.
 *  - 최근 6개월. 정렬: 최신순.
 */
@Controller('user/notifications')
export class UserNotificationsController {
  constructor(
    private readonly svc: UserNotificationsService,
    private readonly alerts: AlertsService,
  ) {}

  @Get()
  @UseGuards(OptionalUserGuard)
  list(@Req() req: OptionalUserRequest) {
    const memberId = req.user?.sub ?? null;
    return this.svc.list(memberId);
  }

  /**
   * [2026-05-27] 실시간 알림 polling — 채팅/전화 5분 잔여 등.
   *  - 클라이언트가 30초 주기로 호출.
   *  - 큐에서 모든 알림 꺼내고 비움 (한 번만 표시).
   *  - 백그라운드 도달은 FCM 빌드 후 보완.
   */
  @Get('pending')
  @UseGuards(UserAuthGuard)
  pending(@Req() req: UserAuthedRequest) {
    const memberId = req.user?.sub;
    if (!memberId) throw new UnauthorizedException();
    return { alerts: this.alerts.dequeueAll(memberId) };
  }

  @Post(':id/read')
  @UseGuards(UserAuthGuard)
  markRead(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!req.user?.sub) throw new UnauthorizedException();
    return this.svc.markRead(req.user.sub, id);
  }

  @Post('read-all')
  @UseGuards(UserAuthGuard)
  markAllRead(@Req() req: UserAuthedRequest) {
    if (!req.user?.sub) throw new UnauthorizedException();
    return this.svc.markAllRead(req.user.sub);
  }
}
