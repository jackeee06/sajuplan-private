import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Request } from 'express';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AdminMemoService } from './memo.service';

const MEMO_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'admin-memo');
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

interface AdminRequest extends Request {
  admin: { sub: number; mb_id?: string; is_super?: boolean };
}

/**
 * 관리자 개인 메모장 API.
 *
 * - GET  /api/admin/memo            본인 메모 조회 (없으면 빈 content)
 * - PUT  /api/admin/memo            본인 메모 저장 (UPSERT)
 * - POST /api/admin/memo/upload     본문 인라인 이미지 업로드 (Toast UI Editor 가 호출)
 *
 * 권한: AdminAuthGuard — admin 만. admin 인증 시 admin.sub 가 member.id 와 동등 (member.role='admin').
 */
@Controller('admin/memo')
@UseGuards(AdminAuthGuard)
export class AdminMemoController {
  constructor(private readonly svc: AdminMemoService) {}

  @Get()
  async get(@Req() req: AdminRequest) {
    return this.svc.get(req.admin.sub);
  }

  @Put()
  async save(@Req() req: AdminRequest, @Body() body: { content?: string }) {
    if (typeof body.content !== 'string') {
      throw new BadRequestException('content (string) 필수');
    }
    return this.svc.save(req.admin.sub, body.content);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const adminId = (req as AdminRequest).admin?.sub ?? 0;
          const dir = join(MEMO_UPLOAD_ROOT, String(adminId));
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
          return cb(new BadRequestException(`허용되지 않은 확장자: ${ext}`), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@Req() req: AdminRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('파일 누락');
    return {
      image_url: `/uploads/admin-memo/${req.admin.sub}/${file.filename}`,
    };
  }
}
