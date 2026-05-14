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
import { UserReviewsService } from './reviews.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const REVIEW_FILE_DIR = join(process.cwd(), 'uploads', 'review');
mkdirSync(REVIEW_FILE_DIR, { recursive: true });

const REVIEW_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const REVIEW_IMG_MAX_BYTES = 5 * 1024 * 1024;

/**
 * 사용자 메인 페이지 후기 탭 (sample tab06).
 * 최근 후기 N건을 상담사 정보와 함께 반환.
 */
@Controller('user/reviews')
export class UserReviewsController {
  constructor(private readonly svc: UserReviewsService) {}

  /**
   * GET /api/user/reviews/recent?category=사주|타로|신점&limit=13
   * - category 미지정 또는 '전체' → 전체
   * - limit 1~50, 기본 13
   */
  @Get('recent')
  async recent(
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.svc.recent({
      category,
      limit: limit ? Math.min(50, Math.max(1, Number(limit) || 13)) : 13,
    });
    return { items };
  }

  /**
   * GET /api/user/reviews/mine?page=1&limit=10&photo_only=false
   * 로그인한 회원이 작성한 후기 목록 (마이페이지 → 나의 상담 후기).
   */
  @Get('mine')
  @UseGuards(UserAuthGuard)
  async mine(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('photo_only') photoOnly?: string,
  ) {
    return this.svc.mine({
      memberId: req.user.sub,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      photoOnly: photoOnly === 'true' || photoOnly === '1',
    });
  }

  /**
   * POST /api/user/reviews/upload-image — 후기 사진 업로드.
   * multipart/form-data, field name 'file'. 응답: { url: '/uploads/review/...' }.
   * 사진 1장만 등록되도록 프론트에서 제한 — 백엔드는 단일 파일만 처리.
   */
  @Post('upload-image')
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: REVIEW_FILE_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: REVIEW_IMG_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!REVIEW_IMG_EXTS.includes(ext)) {
          return cb(
            new BadRequestException(`허용되지 않은 확장자: ${ext}. (${REVIEW_IMG_EXTS.join(', ')})`),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('파일이 없습니다.');
    // 후기 사진은 jpg/png/gif 업로드라도 동일 디렉토리에 .webp 사이블링을 함께 생성한다.
    // 응답은 원본/webp 둘 다 내려주고, 프론트에서 <picture> 로 webp 우선 노출.
    const { webpFilename } = await convertImageToWebp(file.path);
    const url = `/uploads/review/${file.filename}`;
    const url_webp = webpFilename ? `/uploads/review/${webpFilename}` : null;
    return { url, url_webp };
  }

  /** POST /api/user/reviews — 새 후기 작성 */
  @Post()
  @UseGuards(UserAuthGuard)
  async create(
    @Req() req: UserAuthedRequest,
    @Body() body: {
      counselor_id?: number;
      title?: string;
      content?: string;
      is_secret?: boolean;
      rating?: number | null;
      photo_url?: string | null;
      photo_url_webp?: string | null;
      consultation_id?: number | null;
    },
  ) {
    if (!body.counselor_id) throw new BadRequestException('상담사 정보가 없습니다.');
    return this.svc.createMine(req.user.sub, {
      counselor_id: Number(body.counselor_id),
      title: String(body.title ?? ''),
      content: String(body.content ?? ''),
      is_secret: !!body.is_secret,
      rating: body.rating ?? null,
      photo_url: body.photo_url ?? null,
      photo_url_webp: body.photo_url_webp ?? null,
      consultation_id: body.consultation_id ?? null,
    });
  }

  /** GET /api/user/reviews/:id — 본인이 쓴 후기 단건 (수정 폼 prefill 용) */
  @Get(':id')
  @UseGuards(UserAuthGuard)
  async detail(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getMine(id, req.user.sub);
  }

  /** PATCH /api/user/reviews/:id — 본인 후기 수정 (제목/본문/비밀글) */
  @Patch(':id')
  @UseGuards(UserAuthGuard)
  async update(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; content?: string; is_secret?: boolean; rating?: number; photo_url?: string | null },
  ) {
    return this.svc.updateMine(id, req.user.sub, body);
  }

  /** DELETE /api/user/reviews/:id — 본인 후기 물리 삭제 (hard delete) */
  @Delete(':id')
  @UseGuards(UserAuthGuard)
  async remove(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.svc.deleteMine(id, req.user.sub);
    return { ok: true };
  }
}
