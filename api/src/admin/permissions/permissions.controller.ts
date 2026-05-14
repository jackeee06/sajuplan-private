import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { PermissionsService } from './permissions.service';
import type { CreateAdminInput } from './permissions.service';

@Controller('admin/permissions')
@UseGuards(AdminAuthGuard)
export class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

  @Get('admins')
  listAdmins() { return this.svc.listAdmins(); }

  /** 신규 관리자 계정 생성 — 기존 회원은 변경하지 않는다. */
  @Post('admins')
  createAdmin(@Body() body: CreateAdminInput) {
    return this.svc.createAdmin(body);
  }

  /** 슈퍼 권한 토글 (이미 admin 계정에 한해서만) */
  @Patch('admins/:id/super')
  setSuper(@Param('id', ParseIntPipe) id: number, @Body() body: { isSuper: boolean }) {
    return this.svc.setSuperFlag(id, !!body.isSuper);
  }

  /** 관리자 계정 비활성화 (left_at 기록, role/level 유지) */
  @Delete('admins/:id')
  removeAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deactivateAdmin(id);
  }

  @Get('admins/:id/matrix')
  getMatrix(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getPermissions(id);
  }

  @Put('admins/:id/matrix')
  saveMatrix(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { items: { resource: string; can_read: boolean; can_write: boolean; can_delete: boolean }[] },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.savePermissions(id, body.items, req.admin.sub);
  }
}
