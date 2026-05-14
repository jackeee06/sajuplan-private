import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { EventsService, type EventInput } from './events.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const EVENT_DIR = join(process.cwd(), 'uploads', 'event');
mkdirSync(EVENT_DIR, { recursive: true });

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

@Controller('admin/events')
@UseGuards(AdminAuthGuard)
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    return this.svc.list({
      q: q.q || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }

  /**
   * 이벤트 이미지 업로드 — 썸네일/본문 인라인 이미지 공용.
   * banners/upload 와 동일한 패턴: 디스크에 저장 후 WebP 변환본도 같이 만들어
   * 두 URL 을 함께 반환한다. Toast UI Editor 의 addImageBlobHook 에서도
   * `image_url` 만 가져다 쓰면 본문 이미지 삽입 가능.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: EVENT_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
          return cb(
            new BadRequestException(`허용되지 않은 확장자: ${ext} (jpg/png/gif/webp만 허용)`),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('파일이 없습니다.');
    const { webpFilename } = await convertImageToWebp(file.path);
    return {
      ok: true,
      image_url: `/uploads/event/${file.filename}`,
      image_url_webp: webpFilename ? `/uploads/event/${webpFilename}` : null,
      filename: file.filename,
      original_name: file.originalname,
      size: file.size,
    };
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.svc.detail(id);
  }

  @Post()
  create(@Body() body: EventInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<EventInput>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
