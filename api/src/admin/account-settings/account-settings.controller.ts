import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AccountSettingsService } from './account-settings.service';
import type { AccountSettingInput } from './account-settings.service';

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
