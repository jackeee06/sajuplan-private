import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminHandbookService } from './handbook.service';
import { AdminHandbookRagService } from './handbook-rag.service';

interface AdminRequest extends Request {
  admin: { sub: number; mb_id?: string; is_super?: boolean };
}

/**
 * 운영 바이블 (Handbook) API.
 *
 *  GET /api/admin/handbook/index               → 카테고리/항목 목록 (index.json)
 *  GET /api/admin/handbook/item?slug=chat/...  → md 본문 (운영자용만, .tech.md 차단)
 *  GET /api/admin/handbook/search?q=...&limit  → 자연어 질문 키워드 검색
 *
 *  --- RAG (Phase 2-A) ---
 *  POST /api/admin/handbook/ask                → 자연어 질문 → Claude 답변
 *  GET  /api/admin/handbook/sessions           → 본인 대화 세션 목록
 *  GET  /api/admin/handbook/sessions/:id       → 세션 메시지 전체
 *  DELETE /api/admin/handbook/sessions/:id     → 세션 삭제
 *
 *  --- 설정 (슈퍼 전용) ---
 *  GET /api/admin/handbook/config              → API 키 마스킹 + 모델
 *  PUT /api/admin/handbook/config              → API 키 / 모델 / 활성화 토글 (슈퍼만)
 *
 * 권한: 관리자 전체 (슈퍼 + 일반). 설정 변경만 슈퍼.
 */
@Controller('admin/handbook')
@UseGuards(AdminAuthGuard)
export class AdminHandbookController {
  constructor(
    private readonly svc: AdminHandbookService,
    private readonly rag: AdminHandbookRagService,
  ) {}

  @Get('index')
  index() {
    return this.svc.getIndex();
  }

  @Get('item')
  item(@Query('slug') slug: string) {
    return this.svc.getItem(slug ?? '');
  }

  @Get('search')
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    const lim = Math.min(Math.max(parseInt(limit ?? '5', 10) || 5, 1), 20);
    return { query: q ?? '', hits: this.svc.search(q ?? '', lim) };
  }

  // ---- RAG ----

  @Post('ask')
  async ask(
    @Req() req: AdminRequest,
    @Body() body: { query: string; session_id?: number | null },
  ) {
    if (!body?.query) throw new BadRequestException('query 필수');
    return await this.rag.ask({
      adminId: req.admin.sub,
      query: body.query,
      sessionId: body.session_id ?? null,
    });
  }

  @Get('sessions')
  async listSessions(@Req() req: AdminRequest, @Query('limit') limit?: string) {
    const lim = Math.min(Math.max(parseInt(limit ?? '30', 10) || 30, 1), 100);
    const sessions = await this.rag.listSessions(req.admin.sub, lim);
    return { sessions };
  }

  @Get('sessions/:id')
  async getSession(@Req() req: AdminRequest, @Param('id') id: string) {
    const sid = parseInt(id, 10);
    if (!Number.isFinite(sid) || sid <= 0) throw new BadRequestException('잘못된 세션 ID');
    return await this.rag.getSession(req.admin.sub, sid);
  }

  @Delete('sessions/:id')
  async deleteSession(@Req() req: AdminRequest, @Param('id') id: string) {
    const sid = parseInt(id, 10);
    if (!Number.isFinite(sid) || sid <= 0) throw new BadRequestException('잘못된 세션 ID');
    return await this.rag.deleteSession(req.admin.sub, sid);
  }

  // ---- 설정 ----

  @Get('config')
  async getConfig() {
    return await this.rag.getConfig();
  }

  @Put('config')
  async updateConfig(
    @Req() req: AdminRequest,
    @Body() body: { api_key?: string; model?: string; max_tokens?: number; enabled?: boolean },
  ) {
    // 슈퍼관리자만
    if (!req.admin.is_super) throw new BadRequestException('슈퍼관리자만 수정 가능');
    return await this.rag.updateConfig(body, req.admin.sub);
  }
}
