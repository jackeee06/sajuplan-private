import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserAuthGuard, type UserAuthedRequest } from '../auth/user-auth.guard';
import { UserChatService } from './chat.service';

/**
 * 사용자(회원/상담사)용 채팅 데이터 API.
 *
 * 메시지 실시간 송수신은 `wss://passcall.co.kr:28729/wscp/{token}` 직결이며 본 컨트롤러는
 * 자체 보존 데이터(`chat_room`, `chat_message`) 의 조회/백업/종료 마킹만 책임진다.
 *
 * 진입 흐름:
 *  1) 회원이 상담사 상세에서 "채팅상담" → POST /api/user/consult/chat
 *     → `{ chat_room_id, roomid, member_token, wss_url }` 응답
 *  2) React 가 wss 직결 + chat_room_id 를 키로 본 컨트롤러 사용
 */
@Controller('user/chat')
@UseGuards(UserAuthGuard)
export class UserChatController {
  constructor(private readonly svc: UserChatService) {}

  /**
   * GET /api/user/chat/rooms?role=member|counselor&page=&limit=
   * 본인 채팅 목록 (회원: 받은 상담, 상담사: 진행한 상담)
   */
  @Get('rooms')
  async listRooms(
    @Req() req: UserAuthedRequest,
    @Query('role') roleQ?: string,
    @Query('page') pageQ?: string,
    @Query('limit') limitQ?: string,
  ) {
    // 토큰의 role 이 우선이지만, 클라이언트가 명시하면 그것을 사용 (admin 이 양쪽 보고 싶은 경우 등은 제외).
    const tokenRole = req.user.role;
    const requestedRole = roleQ === 'counselor' || roleQ === 'member' ? roleQ : null;
    const role: 'member' | 'counselor' =
      requestedRole === 'counselor' || tokenRole === 'counselor' ? 'counselor' : 'member';
    return this.svc.listRooms({
      me: req.user.sub,
      role,
      page: pageQ ? Number(pageQ) : undefined,
      limit: limitQ ? Number(limitQ) : undefined,
    });
  }

  /**
   * GET /api/user/chat/rooms/:id
   * 방 상세 + 전체 메시지. 본인 소유가 아니면 404.
   */
  @Get('rooms/:id')
  async getRoom(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getRoom({ me: req.user.sub, chatRoomId: id });
  }

  /**
   * GET /api/user/chat/log/:id
   * 채팅 내역 다시보기 (읽기 전용). id 는 consultation.id 또는 chat_room.id.
   * wss 토큰/상태조작 없이 헤더+메시지만 응답. 활성 채팅 흐름과 분리된 안전 경로.
   */
  @Get('log/:id')
  async getChatLog(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getChatLog({ me: req.user.sub, id });
  }

  /**
   * GET /api/user/chat/rooms/:id/messages?since=ISO8601
   * 증분 메시지 — 재연결/백그라운드 복귀 후 누락분만 가져갈 때 사용.
   */
  @Get('rooms/:id/messages')
  async listMessages(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Query('since') since?: string,
  ) {
    const messages = await this.svc.listMessagesSince({
      me: req.user.sub,
      chatRoomId: id,
      since: since ?? null,
    });
    return { items: messages };
  }

  /**
   * POST /api/user/chat/rooms/:id/messages
   * Body: { message: string, message_type?: 1|2 }
   *
   * 메시지 백업 INSERT — wss 로 보낸 메시지를 자체 DB 에 저장하기 위해 호출.
   * **호출 규칙: 보내는 클라이언트만 호출한다 (양쪽 다 호출하면 중복).**
   * 받는 쪽 클라이언트는 wss `conv_msg` 수신만으로 화면에 표시하고, DB 저장은 안 함.
   */
  @Post('rooms/:id/messages')
  async sendMessage(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { message?: string; message_type?: number },
  ) {
    return this.svc.insertMessage({
      me: req.user.sub,
      chatRoomId: id,
      message: String(body?.message ?? ''),
      messageType: body?.message_type,
    });
  }

  /**
   * POST /api/user/chat/rooms/:id/leave
   * sample/counsel/chat.php 의 두 가지 분기를 매핑:
   *   - mode='soft' (또는 미지정·sendBeacon)  → try_out 만 마킹, status='STAY' 유지.
   *                                              백키/탭 이탈/백그라운드 → 재진입 가능.
   *   - mode='close'                          → status='DISCONNECT' + 정산 (명시적 상담종료).
   *
   * 정산(settleChatRoomLocal) 은 close 시에만 발동. soft 는 단순 일시 이탈 마킹.
   */
  @Post('rooms/:id/leave')
  @HttpCode(200)
  async leave(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { mode?: 'soft' | 'close' } = {},
  ) {
    return this.svc.markLeave({
      me: req.user.sub,
      chatRoomId: id,
      mode: body?.mode ?? 'soft',
    });
  }

  /**
   * POST /api/user/chat/rooms/:id/system-message
   * 시스템 메시지(입장/퇴장/재입장 등) 영구 저장.
   * sample/counsel/chat.php 의 storeChat(mbid='SYSTEM', msg_type=3) 동등.
   * chat_message 에 sender_id=NULL, message_type=3 으로 INSERT. 멱등성은 호출자가 책임
   * (key=`${event}-${actor}-${roomid}` 단위로 dedup 권장).
   */
  @Post('rooms/:id/system-message')
  @HttpCode(200)
  async insertSystemMessage(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { message?: string; dedup_key?: string } = {},
  ) {
    return this.svc.insertSystemMessage({
      me: req.user.sub,
      chatRoomId: id,
      message: String(body?.message ?? ''),
      dedupKey: body?.dedup_key ?? null,
    });
  }

  /**
   * POST /api/user/chat/rooms/:id/peer-event
   * wss 측 room_in_noti / room_out_noti 수신 시 호출 — backend 가 actor 의 try_out 마킹 +
   * 시스템 메시지를 단일 원천으로 INSERT. m2net push 만으로는 강제종료 케이스가 안 잡혀
   * 클라이언트의 wss 이벤트가 보조 신호 역할.
   *
   * body: { event: 'leave' | 'rejoin', actor: 'counselor' | 'member' }
   */
  @Post('rooms/:id/peer-event')
  @HttpCode(200)
  async peerEvent(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { event?: 'leave' | 'rejoin'; actor?: 'counselor' | 'member' } = {},
  ) {
    return this.svc.handlePeerEvent({
      me: req.user.sub,
      chatRoomId: id,
      event: body?.event ?? 'leave',
      actor: body?.actor ?? 'counselor',
    });
  }

  /**
   * POST /api/user/chat/rooms/:id/rejoin
   * sample 의 act='rejoin' — try_out 해제 + rejoin_count 누적.
   * 재진입 시 본 엔드포인트를 호출해야 다른 사용자에게 m2net room_in_noti 가 정확히 전파됨.
   */
  @Post('rooms/:id/rejoin')
  @HttpCode(200)
  async rejoin(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.markRejoin({ me: req.user.sub, chatRoomId: id });
  }

  /**
   * GET /api/user/chat/rooms/:id/status
   * 폴링용 — 잔여시간/상태/상담사 입장 여부 반환.
   *  sample/counsel/ajax.counsel_chat.php act='getStatus' 동등.
   *  내부적으로 회원 잔액 증가분(충전)을 alloc_seconds 에 동기화.
   */
  @Get('rooms/:id/status')
  async getStatus(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.getRoomStatus({ me: req.user.sub, chatRoomId: id });
  }

  /**
   * POST /api/user/chat/rooms/:id/tick
   * 사용시간 +10초 누적. 잔여 < 10 이면 즉시 status='DISCONNECT'.
   *  sample act='updateTime' 동등. 클라이언트가 10초 간격으로 호출.
   */
  @Post('rooms/:id/tick')
  @HttpCode(200)
  async tick(
    @Req() req: UserAuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.tickRoom({ me: req.user.sub, chatRoomId: id });
  }
}
