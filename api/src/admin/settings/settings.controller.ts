import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { SettingsService } from './settings.service';
import type { SettingsByNamespace } from './settings.service';

@Controller('admin/settings')
@UseGuards(AdminAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getAll(): Promise<{ data: SettingsByNamespace }> {
    return { data: await this.settings.getAll() };
  }

  @Get(':namespace')
  async getNamespace(
    @Param('namespace') namespace: string,
  ): Promise<{ data: Record<string, string> }> {
    return { data: await this.settings.getNamespace(namespace) };
  }

  @Patch()
  async update(
    @Body() body: SettingsByNamespace,
    @Req() req: AuthedRequest,
  ): Promise<{ updated: number }> {
    // 슈퍼어드민 권한 전달 — settings.service 가 SUPER_ONLY 키 변경 시 거부.
    return this.settings.update(body, req.admin.sub, !!req.admin.is_super);
  }

  /**
   * 정책 변경 이력 조회.
   *   GET /admin/settings/history?namespace=grade&key=options.partner1&limit=50
   */
  @Get('history/list')
  async history(
    @Query('namespace') namespace?: string,
    @Query('key') key?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : 50;
    const items = await this.settings.getHistory({ namespace, key, limit: lim });
    return { items };
  }
}
