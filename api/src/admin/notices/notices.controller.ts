import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { NoticesService, type NoticeInput } from './notices.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const NOTICE_DIR = join(process.cwd(), 'uploads', 'notice');
mkdirSync(NOTICE_DIR, { recursive: true });

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

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

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: NOTICE_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
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
      image_url: `/uploads/notice/${file.filename}`,
      image_url_webp: webpFilename ? `/uploads/notice/${webpFilename}` : null,
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
