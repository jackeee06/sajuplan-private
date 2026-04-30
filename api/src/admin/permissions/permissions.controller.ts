import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { PermissionsService } from './permissions.service';

@Controller('admin/permissions')
@UseGuards(AdminAuthGuard)
export class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

  @Get('admins')
  listAdmins() { return this.svc.listAdmins(); }

  @Patch('admins/:id/role')
  setRole(@Param('id', ParseIntPipe) id: number, @Body() body: { isAdmin: boolean; isSuper?: boolean }) {
    return this.svc.setAdminRole(id, body.isAdmin, body.isSuper ?? false);
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

  @Get('search-member')
  search(@Query('q') q: string) {
    return this.svc.searchMember(q);
  }
}
