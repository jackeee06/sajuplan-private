import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AccountSettingsService } from './account-settings.service';
import type { AccountSettingInput } from './account-settings.service';

/**
 * 충전금액 설정 — 일반관리자도 수정 가능 (운영팀 일상 업무).
 */
@Controller('admin/account-settings')
@UseGuards(AdminAuthGuard)
export class AccountSettingsController {
  constructor(private readonly svc: AccountSettingsService) {}

  @Get()
  list() { return this.svc.list(); }

  @Put()
  upsert(@Body() body: { items: AccountSettingInput[] }) {
    return this.svc.upsert(body.items ?? []);
  }
}
