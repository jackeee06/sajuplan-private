import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { BannersService } from './banners.service';
import type { BannerFilter, BannerInput } from './banners.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const BANNER_DIR = join(process.cwd(), 'uploads', 'banner');
mkdirSync(BANNER_DIR, { recursive: true });

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

@Controller('admin/banners')
@UseGuards(AdminAuthGuard)
export class BannersController {
  constructor(private readonly svc: BannersService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    const filter: BannerFilter = {
      position: q.position || undefined,
      status: (q.status as 'all' | 'ing' | 'end') || undefined,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    };
    return this.svc.findAll(filter);
  }

  /** 배너 이미지 업로드: 파일 저장 후 image_url(상대 경로) 반환 */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: BANNER_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
          return cb(new BadRequestException(`허용되지 않은 확장자: ${ext} (jpg/png/gif/webp만 허용)`), false);
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
      image_url: `/uploads/banner/${file.filename}`,
      image_url_webp: webpFilename ? `/uploads/banner/${webpFilename}` : null,
      filename: file.filename,
      original_name: file.originalname,
      size: file.size,
    };
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) { return this.svc.getById(id); }

  @Post()
  create(@Body() body: BannerInput) { return this.svc.create(body); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<BannerInput>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}
