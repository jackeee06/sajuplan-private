import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
import { CounselorMypageInquiryService, INQUIRY_CATEGORIES } from './counselor-mypage-inquiry.service';

const INQUIRY_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'counselor-inquiry');
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * 상담사 마이페이지 "문의하기" (상담사 → 운영자 1:1 고객센터 문의).
 *
 * - GET  /api/user/counselor-mypage/inquiry            내 문의 목록
 * - GET  /api/user/counselor-mypage/inquiry/:id        내 문의 단건
 * - POST /api/user/counselor-mypage/inquiry            문의 작성
 * - POST /api/user/counselor-mypage/inquiry/upload     첨부 사진 업로드 (0~5장)
 *
 * 권한: UserAuthGuard + role='counselor' (상담사만)
 */
@Controller('user/counselor-mypage/inquiry')
@UseGuards(UserAuthGuard)
export class CounselorMypageInquiryController {
  constructor(private readonly svc: CounselorMypageInquiryService) {}

  private assertCounselor(req: UserAuthedRequest): number {
    if (req.user.role !== 'counselor' && req.user.role !== 'admin') {
      throw new ForbiddenException('상담사만 접근 가능');
    }
    return req.user.sub;
  }

  @Get()
  async list(
    @Req() req: UserAuthedRequest,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const memberId = this.assertCounselor(req);
    return this.svc.list({
      memberId,
      category: category || null,
      keyword: keyword || null,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 10)) : 10,
      offset: offset ? Math.max(0, Number(offset) || 0) : 0,
    });
  }

  @Get('categories')
  categories() {
    return { categories: INQUIRY_CATEGORIES };
  }

  @Get(':id')
  async detail(@Req() req: UserAuthedRequest, @Param('id', ParseIntPipe) id: number) {
    const memberId = this.assertCounselor(req);
    return this.svc.getOne(memberId, id);
  }

  @Delete(':id')
  async remove(@Req() req: UserAuthedRequest, @Param('id', ParseIntPipe) id: number) {
    const memberId = this.assertCounselor(req);
    return this.svc.remove(memberId, id);
  }

  @Post()
  async create(
    @Req() req: UserAuthedRequest,
    @Body() body: { category?: string; title?: string; content?: string; photos?: string[] },
  ) {
    const memberId = this.assertCounselor(req);
    const category = (body.category ?? '').trim();
    const title = (body.title ?? '').trim();
    const content = (body.content ?? '').trim();
    if (!category) throw new BadRequestException('분류를 선택해주세요.');
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content) throw new BadRequestException('문의 내용을 입력해주세요.');
    if (title.length > 255) throw new BadRequestException('제목이 너무 깁니다. (최대 255자)');

    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p) => typeof p === 'string' && p).slice(0, 5)
      : [];

    return this.svc.create({
      memberId,
      mbId: req.user.mb_id ?? null,
      category,
      title,
      content,
      photos,
      ip: req.ip ?? null,
    });
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const memberId = (req as UserAuthedRequest).user?.sub ?? 0;
          const dir = join(INQUIRY_UPLOAD_ROOT, String(memberId));
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 30 * 1024 * 1024 },
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
    return { url: `/uploads/counselor-inquiry/${memberId}/${file.filename}` };
  }
}
