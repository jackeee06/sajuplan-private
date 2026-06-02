import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { PermissionsService } from './permissions.service';
import type { CreateAdminInput } from './permissions.service';

/**
 * 권한 관리 — 모든 쓰기 작업은 슈퍼관리자 전용 (2026-05-22 보안 사고 발견 후 가드 추가).
 * READ (목록·매트릭스 조회) 는 일반관리자도 가능. 일반관리자가 자기 권한을 확인할 수 있어야 함.
 * WRITE (생성·슈퍼토글·비활성화·매트릭스 저장) 은 슈퍼만.
 */
function assertSuper(req: AuthedRequest, action: string): void {
  if (!req.admin?.is_super) {
    throw new ForbiddenException(`'${action}' 은(는) 슈퍼관리자만 수행할 수 있습니다.`);
  }
}

@Controller('admin/permissions')
@UseGuards(AdminAuthGuard)
export class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

  @Get('admins')
  listAdmins() { return this.svc.listAdmins(); }

  /** 신규 관리자 계정 생성 — 슈퍼 전용 */
  @Post('admins')
  createAdmin(@Body() body: CreateAdminInput, @Req() req: AuthedRequest) {
    assertSuper(req, '관리자 계정 생성');
    return this.svc.createAdmin(body);
  }

  /** 슈퍼 권한 토글 — 슈퍼 전용 (자기 자신을 슈퍼로 만드는 escalation 차단) */
  @Patch('admins/:id/super')
  setSuper(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isSuper: boolean },
    @Req() req: AuthedRequest,
  ) {
    assertSuper(req, '슈퍼 권한 토글');
    return this.svc.setSuperFlag(id, !!body.isSuper);
  }

  /** 관리자 계정 비활성화 — 슈퍼 전용 (서로 추방 차단) */
  @Delete('admins/:id')
  removeAdmin(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    assertSuper(req, '관리자 계정 비활성화');
    return this.svc.deactivateAdmin(id);
  }

  @Get('admins/:id/matrix')
  getMatrix(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getPermissions(id);
  }

  /** 권한 매트릭스 저장 — 슈퍼 전용 (자기 권한 확장 차단) */
  @Put('admins/:id/matrix')
  saveMatrix(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { items: { resource: string; can_read: boolean; can_write: boolean; can_delete: boolean }[] },
    @Req() req: AuthedRequest,
  ) {
    assertSuper(req, '권한 매트릭스 저장');
    return this.svc.savePermissions(id, body.items, req.admin.sub);
  }
}
