import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserConsultService } from './consult.service';

/**
 * 전화/채팅 상담 시작.
 *  - 전화: m2net 에 발신자(회원) 휴대폰 + 상담사 csrid 미리 등록 후, 사용자가 dial 할 대표번호 반환
 *  - 채팅: chat_room 생성/재사용 후 ID 반환
 */
@Controller('user/consult')
@UseGuards(UserAuthGuard)
export class UserConsultController {
  constructor(private readonly svc: UserConsultService) {}

  /**
   * POST /api/user/consult/phone
   * Body: { counselor_id: number, variant: 'prepaid'|'postpaid' }
   * Resp: { phone_number, counselor_code, variant }
   */
  @Post('phone')
  async phone(
    @Req() req: UserAuthedRequest,
    @Body() body: { counselor_id?: number | string; variant?: 'prepaid' | 'postpaid' },
  ) {
    const counselorId = Number(body.counselor_id);
    const variant = body.variant === 'postpaid' ? 'postpaid' : 'prepaid';
    return this.svc.startPhone({
      memberId: req.user.sub,
      counselorId,
      variant,
    });
  }

  /**
   * POST /api/user/consult/chat
   * Body: { counselor_id: number }
   * Resp: { chat_room_id }
   */
  @Post('chat')
  async chat(
    @Req() req: UserAuthedRequest,
    @Body() body: { counselor_id?: number | string },
  ) {
    const counselorId = Number(body.counselor_id);
    return this.svc.startChat({
      memberId: req.user.sub,
      counselorId,
    });
  }

  /**
   * GET /api/user/consult/history?page=1&limit=10&type=all|call|chat&role=member|counselor
   *  sample/my/history.php 동등 — 종료(DISCONNECT/END_CHAT) 만 통합 조회.
   *  - role 미지정 시 토큰의 role 사용. counselor 면 counselor_id 기준, 그 외엔 member_id 기준.
   *  - 각 row 에 후기 정보 포함:
   *      member  → review_id  ("후기 작성하기" / "후기 보러가기" 분기)
   *      counselor → review_id + reply_id ("후기 답변 작성하기" / "작성한 후기 답변 보기")
   */
  @Get('history')
  async history(
    @Req() req: UserAuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('role') role?: string,
  ) {
    const tokenRole = String(req.user.role ?? 'member');
    const effectiveRole =
      role === 'counselor' || role === 'member'
        ? role
        : tokenRole === 'counselor'
          ? 'counselor'
          : 'member';
    return this.svc.history({
      memberId: req.user.sub,
      role: effectiveRole,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      type: type === 'call' || type === 'chat' ? type : 'all',
    });
  }

  // ─────────────────────────────────────────────
  // 상담 메모 — 상담사 전용
  //   GET  /api/user/consult/memo/:consultationId
  //   POST /api/user/consult/memo/:consultationId  { category?, topic?, memo? }
  // ─────────────────────────────────────────────

  @Get('memo/:consultationId')
  async getMemo(
    @Req() req: UserAuthedRequest,
    @Param('consultationId') consultationIdRaw: string,
  ) {
    if (String(req.user.role ?? '') !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
    const consultationId = Number(consultationIdRaw);
    if (!Number.isFinite(consultationId) || consultationId <= 0) {
      throw new BadRequestException('잘못된 상담 ID 입니다.');
    }
    return this.svc.getMemo({ counselorId: req.user.sub, consultationId });
  }

  @Post('memo/:consultationId')
  async saveMemo(
    @Req() req: UserAuthedRequest,
    @Param('consultationId') consultationIdRaw: string,
    @Body() body: { category?: string; topic?: string; memo?: string },
  ) {
    if (String(req.user.role ?? '') !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
    const consultationId = Number(consultationIdRaw);
    if (!Number.isFinite(consultationId) || consultationId <= 0) {
      throw new BadRequestException('잘못된 상담 ID 입니다.');
    }
    return this.svc.upsertMemo({
      counselorId: req.user.sub,
      consultationId,
      category: body.category?.trim() ? body.category.trim() : null,
      topic: body.topic?.trim() ? body.topic.trim() : null,
      memo: body.memo?.trim() ? body.memo : null,
    });
  }
}
