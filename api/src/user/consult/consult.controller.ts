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

  /**
   * GET /api/user/consult/my-stats?from=YYYY-MM-DD&to=YYYY-MM-DD&type=&page=&limit=
   * 상담사 본인의 기간별 상담 통계 + 상세 리스트.
   *  - from~to 포함 구간 (KST 기준), 최대 6개월(180일)
   *  - type: all | call | chat
   *  - 응답: 상담건/부재건/상담시간 합계 + 파생지표(평균/일평균/부재율) + 페이지된 items
   */
  @Get('my-stats')
  async myStats(
    @Req() req: UserAuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (String(req.user.role ?? '') !== 'counselor') {
      throw new ForbiddenException('상담사만 접근할 수 있습니다.');
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !dateRe.test(from)) {
      throw new BadRequestException('from 은 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (!to || !dateRe.test(to)) {
      throw new BadRequestException('to 는 YYYY-MM-DD 형식이어야 합니다.');
    }
    const fromMs = new Date(`${from}T00:00:00+09:00`).getTime();
    const toMs = new Date(`${to}T00:00:00+09:00`).getTime();
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      throw new BadRequestException('잘못된 날짜입니다.');
    }
    if (fromMs > toMs) {
      throw new BadRequestException('시작일이 종료일보다 늦을 수 없습니다.');
    }
    const spanDays = Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
    if (spanDays > 186) {
      throw new BadRequestException('최대 6개월(186일)까지 조회할 수 있습니다.');
    }
    const effType: 'all' | 'call' | 'chat' =
      type === 'call' || type === 'chat' ? type : 'all';
    return this.svc.myStats({
      counselorId: req.user.sub,
      from,
      to,
      type: effType,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }
}
