import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { NoticesService, type NoticeInput } from './notices.service';

@Controller('admin/notices')
@UseGuards(AdminAuthGuard)
export class NoticesController {
  constructor(private readonly svc: NoticesService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    return this.svc.list({
      q: q.q || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  @Post()
  create(@Body() body: NoticeInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<NoticeInput>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
