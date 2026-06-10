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
import { mkdirSync, unlink } from 'node:fs';
import { AdminAuthGuard, type AuthedRequest } from '../auth/admin-auth.guard';
import { MembersService } from './members.service';
import type { CounselorInput, CustomerInput, ListFilter } from './members.service';
import { convertImageToWebp } from '../../shared/common/image-to-webp';

const MEMBER_FILE_DIR = join(process.cwd(), 'uploads', 'member');
mkdirSync(MEMBER_FILE_DIR, { recursive: true });

// [Audit E-I2] MIME 타입도 화이트리스트 — 확장자 위조 (.exe → .jpg 리네임) 차단.
//   브라우저가 보낸 mimetype 만 검사 (서버 magic-byte 검사는 별도 도구 필요).
const FILE_KIND_LIMITS: Record<string, { exts: string[]; mimes: string[]; maxBytes: number }> = {
  profile: {
    exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
  thumbnail: {
    exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
  wide: {
    exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
  contract: {
    exts: ['.pdf', '.jpg', '.jpeg', '.png'],
    mimes: ['application/pdf', 'image/jpeg', 'image/png'],
    maxBytes: 10 * 1024 * 1024,
  },
};

@Controller('admin/members')
@UseGuards(AdminAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * GET /admin/members
   *  - role=user|counselor : 특정 role 만
   *  - q=검색어 : name/nickname/mb_id LIKE 검색 (role 무관 전체 — 상담사 포함)
   *  - 2026-05-28: q 검색 추가 — 푸시 발송 폼의 회원 검색용 (상담사도 회원이므로 같이 검색됨)
   */
  @Get()
  async findAll(
    @Query('role') role?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? Number(limit) : undefined;
    const offsetNum = offset ? Number(offset) : undefined;
    const [items, total] = await Promise.all([
      this.membersService.findAll({ role, q, limit: limitNum, offset: offsetNum }),
      this.membersService.count(role),
    ]);
    return { items, total };
  }

  /** 포인트 정합성 점검 (운영 진단용): GET /admin/members/audit-points?mb_id=ubuub1234 */
  @Get('audit-points')
  auditPoints(@Query('mb_id') mbId: string) {
    return this.membersService.auditPoints(mbId);
  }

  /** 고객 리스트: GET /admin/members/customers */
  @Get('customers')
  customers(@Query() q: Record<string, string>, @Req() req: AuthedRequest) {
    return this.membersService.findCustomers(parseFilter(q), canShowPhone(req, q));
  }

  /** 고객 단건: GET /admin/members/customers/:id */
  @Get('customers/:id')
  customerDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() q: Record<string, string>,
    @Req() req: AuthedRequest,
  ) {
    return this.membersService.getCustomerDetail(id, canShowPhone(req, q));
  }

  /** 고객 생성: POST /admin/members/customers */
  @Post('customers')
  createCustomer(@Body() body: CustomerInput) {
    return this.membersService.createCustomer(body);
  }

  /** 고객 수정: PATCH /admin/members/customers/:id */
  @Patch('customers/:id')
  updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<CustomerInput>,
  ) {
    return this.membersService.updateCustomer(id, body);
  }

  /** 상담사 리스트: GET /admin/members/counselors */
  @Get('counselors')
  counselors(@Query() q: Record<string, string>, @Req() req: AuthedRequest) {
    return this.membersService.findCounselors(parseFilter(q), canShowPhone(req, q));
  }

  /** 상담사 단건 조회: GET /admin/members/counselors/:id */
  @Get('counselors/:id')
  counselorDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() q: Record<string, string>,
    @Req() req: AuthedRequest,
  ) {
    return this.membersService.getCounselorDetail(id, canShowPhone(req, q));
  }

  /** 상담사 생성 + m2net 연동: POST /admin/members/counselors */
  @Post('counselors')
  createCounselor(@Body() body: CounselorInput) {
    return this.membersService.createCounselor(body);
  }

  /** 상담사 수정: PATCH /admin/members/counselors/:id */
  @Patch('counselors/:id')
  updateCounselor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<CounselorInput>,
  ) {
    return this.membersService.updateCounselor(id, body);
  }

  /** 엠투넷 단독 연동/재연동: POST /admin/members/counselors/:id/m2net-link */
  @Post('counselors/:id/m2net-link')
  linkCounselorToM2net(@Param('id', ParseIntPipe) id: number) {
    return this.membersService.linkCounselorToM2net(id);
  }

  /** 상담사 파일 업로드: POST /admin/members/counselors/:id/files/:kind */
  @Post('counselors/:id/files/:kind')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: MEMBER_FILE_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const kind = (req.params as Record<string, string>).kind ?? '';
        const limit = FILE_KIND_LIMITS[kind];
        if (!limit) return cb(new BadRequestException(`알 수 없는 파일 종류: ${kind}`), false);
        const ext = extname(file.originalname).toLowerCase();
        if (!limit.exts.includes(ext)) {
          return cb(new BadRequestException(`허용되지 않은 확장자: ${ext}. (${kind} → ${limit.exts.join(', ')})`), false);
        }
        // [Audit E-I2] MIME 타입 검사 — 확장자만으로는 위조 가능
        if (!limit.mimes.includes(file.mimetype)) {
          return cb(new BadRequestException(`허용되지 않은 파일 형식: ${file.mimetype}`), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadCounselorFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');
    // 이미지 종류만 webp 변환 — contract(pdf 가능)는 비대상
    const isImageKind = kind === 'profile' || kind === 'thumbnail' || kind === 'wide';
    let storedNameWebp: string | null = null;
    if (isImageKind) {
      const { webpFilename } = await convertImageToWebp(file.path);
      storedNameWebp = webpFilename;
    }
    return this.membersService.addMemberFile(id, kind, {
      originalname: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      stored_name_webp: storedNameWebp,
    });
  }

  /** 상담사 파일 삭제: DELETE /admin/members/counselors/:id/files/:fileId */
  @Delete('counselors/:id/files/:fileId')
  async deleteCounselorFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    const { stored_name, stored_name_webp } = await this.membersService.deleteMemberFile(id, fileId);
    if (stored_name) {
      unlink(join(MEMBER_FILE_DIR, stored_name), () => {});
    }
    if (stored_name_webp && stored_name_webp !== stored_name) {
      unlink(join(MEMBER_FILE_DIR, stored_name_webp), () => {});
    }
    return { ok: true };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.membersService.findById(id);
  }

  // ── 상담사 차단 관리 ──────────────────────────────────────────────────

  /** GET /admin/members/counselors/:id/blocks — 차단 목록 */
  @Get('counselors/:id/blocks')
  listBlocks(@Param('id', ParseIntPipe) id: number) {
    return this.membersService.listBlocks(id);
  }

  /** POST /admin/members/counselors/:id/blocks — 차단 추가 */
  @Post('counselors/:id/blocks')
  addBlock(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { member_id?: number; member_phone?: string; reason?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.membersService.addBlock(id, {
      memberId: body.member_id ? Number(body.member_id) : undefined,
      memberPhone: body.member_phone,
      reason: body.reason,
      adminId: req.admin.sub,
    });
  }

  /** DELETE /admin/members/counselors/:id/blocks/:memberId — 차단 해제 */
  @Delete('counselors/:id/blocks/:memberId')
  async removeBlock(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    await this.membersService.removeBlock(id, memberId);
    return { ok: true };
  }
}

/**
 * [PII 보호] 전화번호 평문 노출 조건.
 *   - 슈퍼관리자: 평소 항상 평문 (사장님 정책 2026-06-02)
 *   - 일반관리자: show_phone=1 토글 ON 일 때만 (헤더 슈퍼관리자 설정)
 *
 * 사장님 정책 (2026-06-02 명시): "슈퍼관리자는 평소에 전화번호가 다 보여야 한다"
 *   → 슈퍼관리자는 토글 없이 항상 평문 — 별도 액션 불필요.
 *   → 일반관리자는 슈퍼가 설정한 시간 제한 토글 활성 시만 평문.
 */
function canShowPhone(req: AuthedRequest, q: Record<string, string>): boolean {
  // 슈퍼관리자: 평소 항상 평문 (정책)
  if (req.admin?.is_super) return true;
  // 일반관리자: 토글 ON 시만 평문
  return q.show_phone === '1';
}

function parseFilter(q: Record<string, string>): ListFilter {
  return {
    q: q.q || undefined,
    fr_date: q.fr_date || undefined,
    to_date: q.to_date || undefined,
    status: (q.status as ListFilter['status']) || undefined,
    state: q.state || undefined,
    category: q.category || undefined,
    segment: (q.segment as ListFilter['segment']) || undefined,
    channel: (q.channel as ListFilter['channel']) || undefined,
    social: q.social || undefined,
    gender: (q.gender as ListFilter['gender']) || undefined,
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
  };
}
