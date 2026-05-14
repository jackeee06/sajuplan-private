import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('admin/notifications')
@UseGuards(AdminAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  // 푸시 토큰
  @Get('push-tokens')
  pushTokens(@Query() q: Record<string, string>) {
    return this.svc.pushTokens({
      q: q.q || undefined,
      platform: q.platform || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  // 푸시 발송 이력
  @Get('push-history')
  pushHistory(@Query() q: Record<string, string>) {
    return this.svc.pushHistory({
      q: q.q || undefined,
      category: q.category || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  /** 푸시 발송 이력 전체 삭제 */
  @Delete('push-history')
  clearPushHistory() {
    return this.svc.clearPushHistory();
  }

  /** 푸시 발송: target=all|user|counselor|member_id */
  @Post('push-send')
  pushSend(@Body() body: { target: string; title: string; content?: string; link_url?: string }) {
    return this.svc.sendPush({
      target: body.target,
      title: body.title,
      content: body.content,
      link_url: body.link_url,
    });
  }

  /**
   * 푸시 발송 테스트 — token 또는 topic 직접 지정.
   * notification_log 에 기록하지 않으므로 운영 발송 이력에 노이즈가 남지 않음.
   *
   * Body (둘 중 하나):
   *   { token: string,  title, content?, link_url? }   → 단일 토큰 직접 발송
   *   { topic: string,  title, content?, link_url? }   → 토픽 발송 (예: 'chl_2', 'chl_5', 'chl_all')
   */
  @Post('push-test')
  pushTest(
    @Body() body: {
      token?: string;
      topic?: string;
      title: string;
      content?: string;
      link_url?: string;
    },
  ) {
    return this.svc.sendPushTest(body);
  }

  /**
   * 알림톡 테스트 발송 — 등록 템플릿을 임의 폰으로 즉시 발송 (이력 적재 없음).
   * Body: { template_code: string; phone: string; vars?: Record<string, string|number> }
   */
  @Post('alimtalk-test')
  alimtalkTest(@Body() body: { template_code: string; phone: string; vars?: Record<string, string | number> }) {
    return this.svc.sendAlimtalkTest(body);
  }

  // 알림톡 템플릿
  @Get('alimtalk-templates')
  alimtalkTemplates() { return this.svc.alimtalkTemplates(); }

  @Get('alimtalk-templates/:id')
  alimtalkTemplate(@Param('id', ParseIntPipe) id: number) { return this.svc.getAlimtalkTemplate(id); }

  @Post('alimtalk-templates')
  createAlimtalk(@Body() body: { template_code: string; subject?: string; message: string; primary_btn_name?: string; primary_btn_url?: string; is_active?: boolean }) {
    return this.svc.createAlimtalkTemplate(body);
  }

  @Patch('alimtalk-templates/:id')
  updateAlimtalk(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<{ template_code: string; subject: string; message: string; primary_btn_name: string; primary_btn_url: string; is_active: boolean }>) {
    return this.svc.updateAlimtalkTemplate(id, body);
  }

  @Delete('alimtalk-templates/:id')
  removeAlimtalk(@Param('id', ParseIntPipe) id: number) { return this.svc.removeAlimtalkTemplate(id); }
}
