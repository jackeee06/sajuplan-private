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
