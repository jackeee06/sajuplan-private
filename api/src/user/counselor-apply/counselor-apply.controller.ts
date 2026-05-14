import {
  BadRequestException,
  Body,
  Controller,
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
import { OptionalUserGuard, type OptionalUserRequest } from '../auth/optional-user.guard';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { CaptchaService } from '../captcha/captcha.service';
import { SmsService } from '../sms/sms.service';
import { UserCounselorApplyService } from './counselor-apply.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'counselor-apply');
mkdirSync(UPLOAD_DIR, { recursive: true });

// kind 별 허용 확장자 + 크기. 신청 단계라 관리자보다 넉넉히.
//  - profile / wide : 이미지 30MB (모바일 원본 사진 그대로 올려도 OK)
//  - contract       : PDF + 이미지 30MB (사업자등록증/계약서 스캔본)
const APPLY_KIND_LIMITS: Record<string, { exts: string[]; maxBytes: number }> = {
  profile: { exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'], maxBytes: 30 * 1024 * 1024 },
  wide: { exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'], maxBytes: 30 * 1024 * 1024 },
  contract: { exts: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'], maxBytes: 30 * 1024 * 1024 },
};
const MAX_BYTES = 30 * 1024 * 1024;

const fileInterceptor = (field: string) =>
  FileInterceptor(field, {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
      },
    }),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (req, file, cb) => {
      const kindRaw = (req.query as Record<string, string | undefined>).kind ?? 'profile';
      const limit = APPLY_KIND_LIMITS[kindRaw];
      if (!limit) {
        return cb(new BadRequestException(`알 수 없는 파일 종류: ${kindRaw}`), false);
      }
      const ext = extname(file.originalname).toLowerCase();
      if (!limit.exts.includes(ext)) {
        return cb(
          new BadRequestException(`허용되지 않은 확장자: ${ext} (${kindRaw} → ${limit.exts.join(', ')})`),
          false,
        );
      }
      cb(null, true);
    },
  });

@Controller('user/counselor-apply')
export class UserCounselorApplyController {
  constructor(
    private readonly svc: UserCounselorApplyService,
    private readonly captcha: CaptchaService,
    private readonly sms: SmsService,
  ) {}

  /** GET /api/user/counselor-apply/check-phone?phone=01012345678
   *  상담사 신청 중복 차단용. 같은 휴대폰으로 이미 pending/accepted 신청이 있으면 duplicate=true. */
  @Get('check-phone')
  async checkPhone(@Query('phone') phone?: string) {
    return this.svc.checkPhoneDuplicate(phone ?? '');
  }

  /** GET /api/user/counselor-apply/check-mb-id?mb_id=foo
   *  아이디 중복 체크. member 테이블 + 진행중 신청서 양쪽 검사.
   *  available=true 면 사용 가능. */
  @Get('check-mb-id')
  async checkMbId(@Query('mb_id') mbId?: string) {
    return this.svc.checkMbIdAvailable(mbId ?? '');
  }

  /** 첨부 파일 업로드 — kind: 'profile' | 'wide' | 'contract'.
   *  비로그인 허용 — 가입 페이지 자체에 로그인 가드가 없고,
   *  실제 신청(POST /user/counselor-apply) 단계에서 캡차+휴대폰 인증으로 봇 방지.
   *  이미지(profile/wide)는 webp 사이블링 동시 생성 → url_webp 로 함께 반환.
   *  contract 는 PDF 가능 — webp 변환 대상 아님.
   */
  @Post('upload')
  @UseInterceptors(fileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind?: string,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');
    const k: 'profile' | 'wide' | 'contract' =
      kind === 'wide' ? 'wide' : kind === 'contract' ? 'contract' : 'profile';

    let urlWebp: string | null = null;
    if (k === 'profile' || k === 'wide') {
      try {
        const { webpFilename } = await convertImageToWebp(file.path);
        if (webpFilename) urlWebp = `/uploads/counselor-apply/${webpFilename}`;
      } catch {
        // webp 변환 실패는 치명적이지 않음 — 원본만 반환.
      }
    }

    return {
      ok: true,
      kind: k,
      url: `/uploads/counselor-apply/${file.filename}`,
      url_webp: urlWebp,
      filename: file.filename,
      original_name: file.originalname,
      size: file.size,
    };
  }

  /**
   * GET /api/user/counselor-apply
   * 본인 신청 내역 + 전체 공지. 비로그인이면 공지만.
   * Query: page=1, limit=10
   */
  @Get()
  @UseGuards(OptionalUserGuard)
  async list(
    @Req() req: OptionalUserRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      memberId: req.user?.sub,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  /**
   * GET /api/user/counselor-apply/:id
   * 공지면 누구나 / 일반글은 본인만. 그 외엔 403.
   */
  @Get(':id')
  @UseGuards(OptionalUserGuard)
  async detail(
    @Req() req: OptionalUserRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.detail(id, req.user?.sub);
  }

  /**
   * POST /api/user/counselor-apply
   * 상담사 신청 작성 — 비로그인 허용.
   * 봇 방지는 캡차 + 휴대폰 인증 2단으로 충분. 로그인 회원이면 member_id 가 자동 연동되고,
   * 비회원이면 휴대폰 + 이메일로만 식별된다 (관리자 승인 시 신규 회원 가입 처리).
   */
  @Post()
  @UseGuards(OptionalUserGuard)
  async create(
    @Req() req: OptionalUserRequest,
    @Body()
    body: {
      title?: string;
      content?: string;
      applicant_phone?: string;
      applicant_email?: string;
      is_secret?: boolean;
      extras?: Record<string, unknown>;
      captcha_token?: string;
      captcha_input?: string;
      /** 상담사 가입 ID — 승인 시 mb_id 로 사용 */
      mb_id?: string;
      /** 상담사 가입 PW (평문) — 백엔드에서 즉시 bcrypt 해시. 평문은 절대 저장 안 함. */
      password?: string;
    },
  ) {
    // 1) 자동등록방지(캡차) 검증 — 잘못 입력 시 바로 4xx
    await this.captcha.verify(body.captcha_token ?? '', body.captcha_input ?? '');

    // 2) 휴대폰 인증 검증 — sms_auth 에 verified=true 인 row 가 5분 내에 있어야 함
    const phone = (body.applicant_phone ?? '').replace(/[^0-9]/g, '');
    if (!phone) throw new BadRequestException('휴대폰 인증을 완료해주세요.');
    const verified = await this.sms.isVerifiedRecently(phone);
    if (!verified) throw new BadRequestException('휴대폰 인증을 완료해주세요.');

    return this.svc.create({
      memberId: req.user?.sub ?? null,
      mbId: req.user?.mb_id ?? null,
      title: body.title ?? '',
      content: body.content,
      applicant_phone: phone,
      applicant_email: body.applicant_email,
      is_secret: body.is_secret,
      extras: body.extras,
      account_mb_id: body.mb_id,
      account_password: body.password,
    });
  }

  /**
   * PATCH /api/user/counselor-apply/:id/cancel
   * 본인 신청글 취소 (status='pending' 일 때만).
   */
  @Patch(':id/cancel')
  @UseGuards(UserAuthGuard)
  async cancel(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.cancel(id, req.user.sub);
  }
}
