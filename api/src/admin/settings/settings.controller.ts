import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
    return this.settings.update(body, req.admin.sub);
  }
}
