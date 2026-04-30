import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { PopupLayersService } from './popup-layers.service';
import type { PopupLayerInput } from './popup-layers.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'popup');
mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

@Controller('admin/popup-layers')
@UseGuards(AdminAuthGuard)
export class PopupLayersController {
  constructor(private readonly svc: PopupLayersService) {}

  @Get()
  async findAll() {
    return { items: await this.svc.findAll() };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() body: PopupLayerInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<PopupLayerInput>,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
          return cb(
            new BadRequestException(
              `허용되지 않은 확장자: ${ext} (jpg/png/gif/webp만 가능)`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일이 비어있습니다.');
    const url = `/uploads/popup/${file.filename}`;
    return this.svc.setImage(id, url);
  }
}
