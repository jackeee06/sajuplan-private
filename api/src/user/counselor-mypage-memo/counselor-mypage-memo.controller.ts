import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { CounselorMypageMemoService } from './counselor-mypage-memo.service';

const COUNSELOR_MEMO_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'counselor-memo');
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * 상담사 개인 메모장 API.
 *
 * - GET  /api/user/counselor-mypage/memo            본인 메모 조회
 * - PUT  /api/user/counselor-mypage/memo            본인 메모 저장 (UPSERT)
 * - POST /api/user/counselor-mypage/memo/upload     본문 인라인 이미지 업로드
 *
 * 권한: UserAuthGuard + role='counselor' (상담사만)
 */
@Controller('user/counselor-mypage/memo')
@UseGuards(UserAuthGuard)
export class CounselorMypageMemoController {
  constructor(private readonly svc: CounselorMypageMemoService) {}

  private assertCounselor(req: UserAuthedRequest): number {
    if (req.user.role !== 'counselor' && req.user.role !== 'admin') {
      throw new ForbiddenException('상담사만 접근 가능');
    }
    return req.user.sub;
  }

  @Get()
  async get(@Req() req: UserAuthedRequest) {
    const memberId = this.assertCounselor(req);
    return this.svc.get(memberId);
  }

  @Put()
  async save(@Req() req: UserAuthedRequest, @Body() body: { content?: string }) {
    const memberId = this.assertCounselor(req);
    if (typeof body.content !== 'string') {
      throw new BadRequestException('content (string) 필수');
    }
    return this.svc.save(memberId, body.content);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const memberId = (req as UserAuthedRequest).user?.sub ?? 0;
          const dir = join(COUNSELOR_MEMO_UPLOAD_ROOT, String(memberId));
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTS.includes(ext)) {
          return cb(new BadRequestException(`허용되지 않은 확장자: ${ext}`), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@Req() req: UserAuthedRequest, @UploadedFile() file: Express.Multer.File) {
    const memberId = this.assertCounselor(req);
    if (!file) throw new BadRequestException('파일 누락');
    return {
      image_url: `/uploads/counselor-memo/${memberId}/${file.filename}`,
    };
  }
}
