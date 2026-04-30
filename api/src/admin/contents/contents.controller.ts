import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { ContentsService } from './contents.service';
import type { PageInput } from './contents.service';

@Controller('admin/contents')
@UseGuards(AdminAuthGuard)
export class ContentsController {
  constructor(private readonly contentsService: ContentsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.contentsService.findAll(page ? Number(page) : 1, limit ? Number(limit) : 50);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.contentsService.getById(id);
  }

  @Post()
  create(@Body() body: PageInput) {
    return this.contentsService.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<PageInput>) {
    return this.contentsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contentsService.remove(id);
  }
}
