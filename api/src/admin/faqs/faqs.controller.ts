import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { FaqsService } from './faqs.service';

@Controller('admin/faqs')
@UseGuards(AdminAuthGuard)
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  // ─── 카테고리 ───────────────────
  @Get('categories')
  listCategories() {
    return this.faqsService.listCategories();
  }

  @Get('categories/:id')
  getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.getCategory(id);
  }

  @Post('categories')
  createCategory(@Body() body: { title: string; head_html?: string; tail_html?: string; display_order?: number; is_active?: boolean }) {
    return this.faqsService.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ title: string; head_html: string; tail_html: string; display_order: number; is_active: boolean }>,
  ) {
    return this.faqsService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.removeCategory(id);
  }

  // ─── 항목 ───────────────────
  @Get()
  listFaqs(@Query('category_id') categoryId?: string) {
    return this.faqsService.listFaqs(categoryId ? Number(categoryId) : undefined);
  }

  @Get(':id')
  getFaq(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.getFaq(id);
  }

  @Post()
  createFaq(@Body() body: { category_id: number; question: string; answer?: string; display_order?: number; is_active?: boolean }) {
    return this.faqsService.createFaq(body);
  }

  @Patch(':id')
  updateFaq(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ category_id: number; question: string; answer: string; display_order: number; is_active: boolean }>,
  ) {
    return this.faqsService.updateFaq(id, body);
  }

  @Delete(':id')
  removeFaq(@Param('id', ParseIntPipe) id: number) {
    return this.faqsService.removeFaq(id);
  }
}
