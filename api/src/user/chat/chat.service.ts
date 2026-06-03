import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';
import { M2netPushService } from '../../pg-callbacks/m2net-push.service';
import { AlertsService } from '../../shared/alerts/alerts.service';

/**
 * 사용자/상담사용 채팅 데이터 접근.
 *
 * 메시지 송수신·잔여시간 차감 자체는 m2net wss + webhook 에서 처리 (도메인-10 §1).
 * 본 서비스는 자체 보존 데이터(`chat_room`, `chat_message`) 의 조회·백업·종료 마킹만 책임.
 */

export interface ChatRoomListRow {
  id: number;
  roomid: string | null;
  status: string | null;
  /** 상대방(회원이 보면 상담사, 상담사가 보면 회원) 표시 정보 */
  peer_id: number | null;
  peer_name: string | null;
  peer_nickname: string | null;
  peer_profile_image: string | null;
  message_count: number;
  last_message: string | null;
  last_message_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface ChatRoomDetail {
  id: number;
  roomid: string | null;
  status: string | null;
  member_id: number | null;
  counselor_id: number | null;
  member_name: string | null;
  member_nickname: string | null;
  member_profile_image: string | null;
  counselor_name: string | null;
  counselor_nickname: string | null;
  counselor_profile_image: string | null;
  started_at: string | null;
  ended_at: string | null;
  /** 단가 단위(초) — 카운트다운 계산에 사용 (chat_room.unit_seconds 스냅샷) */
  unit_seconds: number | null;
  /** 단가(포인트) — 카운트다운 계산에 사용 (chat_room.unit_cost 스냅샷) */
  unit_cost: number | null;
  /** 시작 시점 회원 잔액 — 카운트다운 계산 기준 (chat_room.snapshot_member_point) */
  snapshot_member_point: number | null;
  /** 마지막 재입장 시각 — 클라가 polling baseline 으로 사용. */
  rejoin_last_at?: string | null;
}

export interface ChatMessageRow {
  id: number;
  sender_id: number | null;
  message: string | null;
  message_type: number;
  created_at: string;
  /** 본인 메시지 여부 — controller 가 me 와 비교 후 채움 */
  is_mine?: boolean;
  /** [2026-05-23] 이전 대화 누적 표시 — 같은 페어의 다른 방 메시지 구분용 */
  chat_room_id?: number;
  /** [2026-05-23] 안 읽음 표시 — read_at IS NULL 이면 상대가 아직 안 봄 */
  read_at?: string | null;
}

@Injectable()
export class UserChatService {
  private readonly logger = new Logger(UserChatService.name);

  /**
   * chat_room.id 단위 m2net 토큰 인메모리 캐시.
   *
   * m2net chat-mgr/csrchat 은 같은 (membid, csrid) 조합으로 다시 호출하면 새 roomid + 새
   * 토큰 쌍을 발급한다. 그러면 한쪽이 새 토큰으로 wss 에 접속하는 순간 m2net 측에서 그 쌍은
   * 새 세션으로 라우팅되고, 이전 토큰으로 붙어 있던 상대 wss 는 옛 세션에 묶인 채로 남아
   * 메시지가 서로 전달되지 않는다.
   *
   * 따라서 **chat_room 당 처음 발급된 (membtoken, csrtoken) 쌍을 캐시**하고, 이후 getRoom
   * 호출은 캐시된 토큰을 그대로 돌려준다. PM2 재시작 시 캐시가 날아가면 그때 한 번 m2net
   * 재호출되어 양쪽이 같은 새 토큰을 받으므로 사고 면적이 작다.
   */
  private readonly tokenCache = new Map<
    number,
    { roomid: string; membtoken: string; csrtoken: string }
  >();

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly config: ConfigService,
    private readonly m2netPush: M2netPushService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * 종료 후 상담사 ready state 매트릭스 (sample/adm/member_form_update.php 동등):
   *  use_phone=Y, use_chat=Y → RDVC
   *  use_phone=Y, use_chat=N → IDLE
   *  use_phone=N, use_chat=Y → RDCH
   *  둘 다 N                 → ABSE
   */
  private computeReadyState(usePhone: boolean, useChat: boolean): string {
    if (usePhone && useChat) return 'RDVC';
    if (usePhone && !useChat) return 'IDLE';
    if (!usePhone && useChat) return 'RDCH';
    return 'ABSE';
  }

  /**
   * 채팅 종료 시 상담사 사주플랜 + m2net 상태를 ready state 로 복귀.
   *  fire-and-forget 호출 패턴 — 종료 흐름의 응답 지연 방지.
   */
  private async restoreCounselorReady(counselorId: number): Promise<void> {
    const rows = await this.sql<{
      csrid: string | null; use_phone: boolean; use_chat: boolean;
    }[]>`
      SELECT csrid, use_phone, use_chat FROM member WHERE id = ${counselorId} LIMIT 1
    `;
    const c = rows[0];
    if (!c) return;
    const target = this.computeReadyState(!!c.use_phone, !!c.use_chat);
    await this.sql`UPDATE member SET state = ${target}, updated_at = now() WHERE id = ${counselorId}`;
    if (c.csrid) {
      this.m2net.updateCounselorState(String(c.csrid).padStart(5, '0'), target).then((r) => {
        if (!r.ok) {
          this.logger.warn(`[restoreCounselorReady] csrstat 실패 csrid=${c.csrid}: ${r.error ?? ''}`);
        }
      }).catch(() => { /* swallow */ });
    }
  }

  private wssUrl(): string {
    return (
      this.config.get<string>('M2NET_WSS_URL') ?? 'wss://passcall.co.kr:28729/wscp'
    ).replace(/\/$/, '');
  }

  /**
   * 본인 채팅 목록.
   *  - role='counselor' 면 counselor_id = me, 그 외엔 member_id = me 로 필터.
   *  - 진행 중(status <> 'DISCONNECT')·종료 모두 포함. 종료된 방은 ended_at 기준 정렬.
   */
  async listRooms(params: {
    me: number;
    role: 'member' | 'counselor';
    page?: number;
    limit?: number;
  }): Promise<{ items: ChatRoomListRow[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 20)));
    const offset = (page - 1) * limit;

    const ownerCol = params.role === 'counselor' ? 'counselor_id' : 'member_id';
    const peerCol = params.role === 'counselor' ? 'member_id' : 'counselor_id';

    const items = await this.sql<ChatRoomListRow[]>`
      SELECT
        r.id, r.roomid, r.status, r.started_at, r.ended_at,
        peer.id AS peer_id,
        peer.name AS peer_name,
        peer.nickname AS peer_nickname,
        (SELECT mf.stored_name FROM member_file mf
          WHERE mf.member_id = peer.id AND mf.kind = 'profile'
          ORDER BY mf.id DESC LIMIT 1) AS peer_profile_image,
        (SELECT count(*)::int FROM chat_message msg WHERE msg.chat_room_id = r.id) AS message_count,
        (SELECT msg.message FROM chat_message msg
           WHERE msg.chat_room_id = r.id
           ORDER BY msg.created_at DESC, msg.id DESC LIMIT 1) AS last_message,
        (SELECT msg.created_at FROM chat_message msg
           WHERE msg.chat_room_id = r.id
           ORDER BY msg.created_at DESC, msg.id DESC LIMIT 1) AS last_message_at
      FROM chat_room r
      LEFT JOIN member peer ON peer.id = r.${this.sql(peerCol)}
      WHERE r.${this.sql(ownerCol)} = ${params.me}
      ORDER BY COALESCE(r.ended_at, r.started_at) DESC, r.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM chat_room r
      WHERE r.${this.sql(ownerCol)} = ${params.me}
    `;

    // member_file.stored_name → 풀 경로 변환 (counselors.service 와 동일 규칙)
    for (const it of items) {
      if (it.peer_profile_image) {
        it.peer_profile_image = `/uploads/member/${it.peer_profile_image}`;
      }
    }

    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  /**
   * 방 상세 + 메시지. 본인 소유(회원 또는 상담사) 가 아니면 404.
   *
   * 활성 방(status='STAY' or 'CNCH') 인 경우 wss 접속 토큰을 m2net 에서 발급해 응답에 포함.
   *  - 본인이 회원이면 membtoken, 상담사면 csrtoken — 양쪽이 다른 cid 를 받아야 메시지 isMine
   *    판정이 정확하다 (sample/counsel/chat.php 정답 흐름).
   */
  async getRoom(params: { me: number; chatRoomId: number }): Promise<{
    room: ChatRoomDetail;
    messages: ChatMessageRow[];
    wss?: { url: string; token: string; role: 'member' | 'counselor' };
  }> {
    const rooms = await this.sql<(ChatRoomDetail & {
      member_csrid: string | null;
      counselor_csrid: string | null;
    })[]>`
      SELECT
        r.id, r.roomid, r.status, r.member_id, r.counselor_id, r.started_at, r.ended_at,
        r.unit_seconds, r.unit_cost, r.snapshot_member_point,
        m.name AS member_name, m.nickname AS member_nickname,
        m.m2net_membid AS member_csrid,
        c.name AS counselor_name, c.nickname AS counselor_nickname,
        c.csrid AS counselor_csrid,
        (SELECT mf.stored_name FROM member_file mf
           WHERE mf.member_id = c.id AND mf.kind = 'profile'
           ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
        (SELECT mf.stored_name FROM member_file mf
           WHERE mf.member_id = m.id AND mf.kind = 'profile'
           ORDER BY mf.id DESC LIMIT 1) AS member_profile_image
      FROM chat_room r
      LEFT JOIN member m ON m.id = r.member_id
      LEFT JOIN member c ON c.id = r.counselor_id
      WHERE r.id = ${params.chatRoomId}
        AND (r.member_id = ${params.me} OR r.counselor_id = ${params.me})
      LIMIT 1
    `;
    const room = rooms[0];
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    if (room.counselor_profile_image) {
      room.counselor_profile_image = `/uploads/member/${room.counselor_profile_image}`;
    }
    if (room.member_profile_image) {
      room.member_profile_image = `/uploads/member/${room.member_profile_image}`;
    }

    // [2026-05-23] 이전 대화 누적 표시는 사용자 요청으로 비활성 — 현재 방의 메시지만.
    //   read_at IS NULL = 상대가 아직 안 봄 → 본인 메시지 옆에 "1" 표시.
    const messages = await this.sql<ChatMessageRow[]>`
      SELECT id, sender_id, message, message_type, created_at,
             chat_room_id, read_at
        FROM chat_message
       WHERE chat_room_id = ${params.chatRoomId}
       ORDER BY created_at ASC, id ASC
    `;
    for (const msg of messages) msg.is_mine = Number(msg.sender_id) === Number(params.me);

    // 본인이 방에 입장한 시점 — 현재 방의 상대 메시지 중 안 읽은 것을 read_at = NOW() 마킹.
    void this.sql`
      UPDATE chat_message
         SET read_at = NOW()
       WHERE chat_room_id = ${params.chatRoomId}
         AND sender_id <> ${params.me}
         AND read_at IS NULL
    `.catch(() => { /* swallow — UI 표시에 영향 없음 */ });

    // 활성 방이면 본인 역할에 맞는 wss 토큰 발급.
    //
    // ⚠️ 핵심 — chat_room.roomid 는 절대 덮어쓰지 않는다.
    //   m2net csrchat 은 같은 (membid, csrid) 조합으로 다시 호출하면 새 roomid 와 새 토큰을
    //   발급해 줄 수 있다. 이때 우리 DB 의 roomid 를 갱신해 버리면, 동시에 접속한 회원/상담사가
    //   서로 다른 시점에 csrchat 을 부르면서 chat_room.roomid 가 계속 바뀌고,
    //   결과적으로 두 클라이언트가 서로 다른 m2net 방에 접속해 메시지가 전달되지 않는다.
    //
    //   따라서 토큰만 그대로 클라이언트에 넘기고 chat_room.roomid 는 INSERT 시점의 값 그대로.
    //   m2net 은 같은 (membid, csrid) 조합이면 내부적으로 동일한 채팅 세션으로 라우팅한다.
    let wss: { url: string; token: string; role: 'member' | 'counselor' } | undefined;
    const isActive = room.status === 'STAY' || room.status === 'CNCH';
    const isCounselor = Number(room.counselor_id) === Number(params.me);
    const role: 'member' | 'counselor' = isCounselor ? 'counselor' : 'member';
    if (isActive && room.member_csrid && room.counselor_csrid) {
      // 토큰 캐시 우선 — 같은 chat_room.id 에 대해 첫 발급 토큰 쌍을 재사용한다.
      // (m2net csrchat 을 매번 호출하면 새 토큰 쌍이 발급되어 회원/상담사 wss 가 서로 다른
      //  m2net 세션에 묶인다 — 강제종료 후 재진입 시 메시지 미전달 버그의 핵심 원인.)
      let cached = this.tokenCache.get(room.id);
      if (!cached) {
        const m = await this.m2net.createChatRoom({
          membid: String(room.member_csrid).padStart(6, '0'),
          csrid: String(room.counselor_csrid).padStart(5, '0'),
        });
        if (m.ok && m.membtoken && m.csrtoken) {
          cached = {
            roomid: m.roomid ?? room.roomid ?? '',
            membtoken: m.membtoken,
            csrtoken: m.csrtoken,
          };
          this.tokenCache.set(room.id, cached);
          if (m.roomid && m.roomid !== room.roomid) {
            this.logger.warn(
              `[getRoom] m2net csrchat 응답 roomid=${m.roomid} 가 DB chat_room.roomid=${room.roomid} 와 다름 — DB 는 유지하고 토큰만 사용 (캐시)`,
            );
          }
        }
      }
      if (cached) {
        const token = isCounselor ? cached.csrtoken : cached.membtoken;
        if (token) wss = { url: this.wssUrl(), token, role };
      }
    }

    // 내부 컬럼 응답에서 제거 (csrid 노출 방지)
    delete (room as Partial<{ member_csrid: string | null; counselor_csrid: string | null }>).member_csrid;
    delete (room as Partial<{ member_csrid: string | null; counselor_csrid: string | null }>).counselor_csrid;

    return { room, messages, wss };
  }

  /**
   * 채팅 내역 다시보기 (읽기 전용).
   *  - id 는 consultation.id 또는 chat_room.id 둘 다 허용 (사용자가 어디서 진입하든 동작).
   *  - wss 토큰/상태조작 일체 없음. 헤더 + 전체 메시지만 응답.
   *  - 권한: 본인이 그 chat_room 의 회원 또는 상담사 여야 함.
   */
  async getChatLog(params: { me: number; id: number }): Promise<{
    room: ChatRoomDetail;
    messages: ChatMessageRow[];
  }> {
    // 1) chat_room.id 로 직접 시도
    let rooms = await this.sql<ChatRoomDetail[]>`
      SELECT
        r.id, r.roomid, r.status, r.member_id, r.counselor_id, r.started_at, r.ended_at,
        r.unit_seconds, r.unit_cost, r.snapshot_member_point,
        m.name AS member_name, m.nickname AS member_nickname,
        c.name AS counselor_name, c.nickname AS counselor_nickname,
        (SELECT mf.stored_name FROM member_file mf
           WHERE mf.member_id = c.id AND mf.kind = 'profile'
           ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
        (SELECT mf.stored_name FROM member_file mf
           WHERE mf.member_id = m.id AND mf.kind = 'profile'
           ORDER BY mf.id DESC LIMIT 1) AS member_profile_image
      FROM chat_room r
      LEFT JOIN member m ON m.id = r.member_id
      LEFT JOIN member c ON c.id = r.counselor_id
      WHERE r.id = ${params.id}
        AND (r.member_id = ${params.me} OR r.counselor_id = ${params.me})
      LIMIT 1
    `;

    // 2) 없으면 consultation.id 로 해석 — roomid base 매칭으로 chat_room 찾기
    if (rooms.length === 0) {
      rooms = await this.sql<ChatRoomDetail[]>`
        SELECT
          r.id, r.roomid, r.status, r.member_id, r.counselor_id, r.started_at, r.ended_at,
          r.unit_seconds, r.unit_cost, r.snapshot_member_point,
          m.name AS member_name, m.nickname AS member_nickname,
          c.name AS counselor_name, c.nickname AS counselor_nickname,
          (SELECT mf.stored_name FROM member_file mf
             WHERE mf.member_id = c.id AND mf.kind = 'profile'
             ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
          (SELECT mf.stored_name FROM member_file mf
             WHERE mf.member_id = m.id AND mf.kind = 'profile'
             ORDER BY mf.id DESC LIMIT 1) AS member_profile_image
        FROM consultation cs
        JOIN chat_room r ON
          regexp_replace(r.roomid, '__c_\\d+$', '') = regexp_replace(cs.roomid, '__c_\\d+$', '')
          OR (r.member_id = cs.member_id AND r.counselor_id = cs.counselor_id AND r.started_at = cs.started_at)
        LEFT JOIN member m ON m.id = r.member_id
        LEFT JOIN member c ON c.id = r.counselor_id
        WHERE cs.id = ${params.id}
          AND cs.roomid IS NOT NULL AND cs.roomid <> ''
          AND (cs.member_id = ${params.me} OR cs.counselor_id = ${params.me})
        ORDER BY r.id DESC
        LIMIT 1
      `;
    }

    const room = rooms[0];
    if (!room) throw new NotFoundException('채팅 내역을 찾을 수 없습니다.');

    if (room.counselor_profile_image) {
      room.counselor_profile_image = `/uploads/member/${room.counselor_profile_image}`;
    }
    if (room.member_profile_image) {
      room.member_profile_image = `/uploads/member/${room.member_profile_image}`;
    }

    const messages = await this.sql<ChatMessageRow[]>`
      SELECT id, sender_id, message, message_type, created_at
      FROM chat_message
      WHERE chat_room_id = ${room.id}
      ORDER BY created_at ASC, id ASC
    `;
    for (const msg of messages) msg.is_mine = Number(msg.sender_id) === Number(params.me);

    return { room, messages };
  }

  /**
   * 증분 메시지 fetch — 재연결/백그라운드 복귀 시 since 이후만.
   */
  async listMessagesSince(params: {
    me: number;
    chatRoomId: number;
    since?: string | null;
  }): Promise<ChatMessageRow[]> {
    // 권한 검증
    const owner = await this.sql<{ id: number }[]>`
      SELECT id FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    if (owner.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const messages = params.since
      ? await this.sql<ChatMessageRow[]>`
          SELECT id, sender_id, message, message_type, created_at, chat_room_id, read_at
            FROM chat_message
           WHERE chat_room_id = ${params.chatRoomId}
             AND created_at > ${params.since}::timestamptz
           ORDER BY created_at ASC, id ASC
        `
      : await this.sql<ChatMessageRow[]>`
          SELECT id, sender_id, message, message_type, created_at, chat_room_id, read_at
            FROM chat_message
           WHERE chat_room_id = ${params.chatRoomId}
           ORDER BY created_at ASC, id ASC
        `;
    for (const msg of messages) msg.is_mine = Number(msg.sender_id) === Number(params.me);
    return messages;
  }

  /**
   * [2026-05-23] 안 읽음 마킹 — 상대 메시지를 본 시점에 호출.
   *   chat_room_id 의 본인이 아닌 메시지(=상대 메시지) 중 read_at IS NULL 인 모든 row 를
   *   read_at = NOW() 로 마킹. 본인 화면의 "1" 표시는 영향 없음 (본인 메시지는 그대로).
   */
  async markRead(params: { me: number; chatRoomId: number }): Promise<{ updated: number }> {
    const owner = await this.sql<{ member_id: number; counselor_id: number }[]>`
      SELECT member_id, counselor_id FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    if (owner.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    // 현재 방의 상대 메시지만 마킹 (누적 표시 비활성).
    const result = await this.sql<{ id: number }[]>`
      UPDATE chat_message
         SET read_at = NOW()
       WHERE chat_room_id = ${params.chatRoomId}
         AND sender_id <> ${params.me}
         AND read_at IS NULL
      RETURNING id
    `;
    return { updated: result.length };
  }

  /**
   * 메시지 백업 INSERT — wss `conv_msg` 가 m2net 측에서 저장되지만,
   * 사주플랜 자체 화면(관리자 chat-history, 회원 다시보기)에 활용하기 위해
   * React 가 wss `conv_msg` 수신/송신 양쪽 모두 한 번씩 호출한다.
   *
   * 멱등성은 보장 안 함(시간 + 보낸이 + 본문이 동일해도 별도 row). React 측에서
   * 동일 메시지가 양쪽 클라이언트에서 모두 호출될 수 있으므로 멱등 키를 정확히
   * 잡으려면 m2net 의 메시지 ID 가 필요한데 wss 응답에 stable id 가 없음 →
   * 보내는 쪽만 호출하는 규칙으로 운영(컨트롤러 주석 참조).
   */
  async insertMessage(params: {
    me: number;
    chatRoomId: number;
    message: string;
    messageType?: number;
  }): Promise<{ id: number; created_at: string }> {
    const text = (params.message ?? '').trim();
    if (!text) throw new BadRequestException('메시지가 비어 있습니다.');
    if (text.length > 4000) throw new BadRequestException('메시지가 너무 깁니다.');

    // 본인 소유 + 진행 중 검증
    const rooms = await this.sql<{ id: number; status: string | null }[]>`
      SELECT id, status FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    if (rooms.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    if (rooms[0].status === 'DISCONNECT') {
      throw new ForbiddenException('이미 종료된 상담입니다.');
    }

    const inserted = await this.sql<{ id: number; created_at: string }[]>`
      INSERT INTO chat_message (chat_room_id, sender_id, message, message_type)
      VALUES (${params.chatRoomId}, ${params.me}, ${text}, ${params.messageType ?? 1})
      RETURNING id, created_at
    `;
    return inserted[0];
  }

  /**
   * 시스템 메시지 영구 저장 — 입퇴장/재입장 안내 등.
   * chat_message.sender_id=NULL, message_type=3 으로 저장. 재진입 시 다시 로드되어
   * 시스템 메시지 누적이 보장된다 (sample/counsel/chat.php 의 act='storeChat' 동등).
   *
   * 멱등성: dedupKey 가 있으면 같은 chat_room_id 안에서 최근 5분 내 동일 dedupKey 메시지가
   * 있으면 INSERT skip. 클라이언트가 양쪽에서 동시 발화해도 1건만 저장됨.
   */
  async insertSystemMessage(params: {
    me: number;
    chatRoomId: number;
    message: string;
    dedupKey: string | null;
  }): Promise<{ id: number | null; created_at: string | null }> {
    const text = (params.message ?? '').trim();
    if (!text) throw new BadRequestException('메시지가 비어 있습니다.');
    if (text.length > 4000) throw new BadRequestException('메시지가 너무 깁니다.');

    // 본인 소유 검증 (status=DISCONNECT 도 허용 — 종료 메시지도 저장 가능)
    const rooms = await this.sql<{ id: number }[]>`
      SELECT id FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    if (rooms.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    // dedupKey 가 있으면 메시지 본문 prefix 로 사용. 검색은 message LIKE 로.
    // chat_message 에 별도 dedup 컬럼이 없어 message 에 인코딩.
    const storedMsg = params.dedupKey ? `[${params.dedupKey}] ${text}` : text;

    if (params.dedupKey) {
      const dup = await this.sql<{ id: number }[]>`
        SELECT id FROM chat_message
         WHERE chat_room_id = ${params.chatRoomId}
           AND message_type = 3
           AND message = ${storedMsg}
           AND created_at > now() - interval '5 minutes'
         LIMIT 1
      `;
      if (dup.length > 0) {
        return { id: null, created_at: null };
      }
    }

    const inserted = await this.sql<{ id: number; created_at: string }[]>`
      INSERT INTO chat_message (chat_room_id, sender_id, message, message_type)
      VALUES (${params.chatRoomId}, NULL, ${storedMsg}, 3)
      RETURNING id, created_at
    `;
    return inserted[0];
  }

  /**
   * 사용자 측 종료 마킹.
   *  - 회원이면 member_try_out, 상담사면 counselor_try_out 을 TRUE 로.
   *  - 실제 종료 처리(`status='DISCONNECT'`, ended_at 채움, 정산)는
   *    m2net `END_CHAT` webhook 이 도착하면 m2net-push.service 가 수행한다.
   *  - 따라서 본 메서드는 **자기측 의도만 기록**하고, wss `room_out_req` 송신은
   *    React 측 책임.
   */
  async markLeave(params: {
    me: number;
    chatRoomId: number;
    mode: 'soft' | 'close';
  }): Promise<{ ok: true; mode: 'soft' | 'close' }> {
    const rooms = await this.sql<{
      id: number;
      member_id: number | null;
      counselor_id: number | null;
      status: string | null;
    }[]>`
      SELECT id, member_id, counselor_id, status FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    const room = rooms[0];
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const isCounselor = Number(room.counselor_id) === Number(params.me);

    if (params.mode === 'soft') {
      // sample/counsel/ajax.counsel_chat.php act='leaveRoom' — 잠시 이탈(try_out='Y')만.
      // status 는 그대로 유지 → 재진입 시 같은 chat_room/roomid 로 wss 정상 연결.
      const result = isCounselor
        ? await this.sql<{ id: number }[]>`
            UPDATE chat_room
               SET counselor_try_out = TRUE
             WHERE id = ${room.id} AND status <> 'DISCONNECT' AND counselor_try_out = FALSE
             RETURNING id
          `
        : await this.sql<{ id: number }[]>`
            UPDATE chat_room
               SET member_try_out = TRUE
             WHERE id = ${room.id} AND status <> 'DISCONNECT' AND member_try_out = FALSE
             RETURNING id
          `;
      // 실제로 false→true 전환된 경우에만 시스템 메시지 1건 INSERT. 멱등 호출 / 중복 방지.
      // 시스템 메시지는 이 백엔드 경로가 단일 원천 — 클라이언트(onPeerLeft) 는 만들지 않는다.
      if (result.length > 0) {
        await this.insertActorSystemMessage(room.id, params.me, isCounselor, 'leave');
      }
      return { ok: true, mode: 'soft' };
    }

    // mode='close' — 명시적 상담종료. DISCONNECT 마킹 + roomid suffix + 정산.
    // 종료 시 roomid 에 suffix 붙여 UNIQUE 슬롯 비움 (다음 채팅 시 m2net 가 같은 roomid
    // 재발급해도 충돌 안 남).
    if (isCounselor) {
      await this.sql`
        UPDATE chat_room
           SET counselor_try_out = TRUE, try_out = TRUE,
               status = 'DISCONNECT',
               ended_at = COALESCE(ended_at, now()),
               roomid = CASE WHEN status = 'DISCONNECT' OR roomid LIKE '%\\_\\_c\\_%' ESCAPE '\\'
                             THEN roomid
                             ELSE roomid || '__c_' || id END
         WHERE id = ${room.id}
      `;
    } else {
      await this.sql`
        UPDATE chat_room
           SET member_try_out = TRUE, try_out = TRUE,
               status = 'DISCONNECT',
               ended_at = COALESCE(ended_at, now()),
               roomid = CASE WHEN status = 'DISCONNECT' OR roomid LIKE '%\\_\\_c\\_%' ESCAPE '\\'
                             THEN roomid
                             ELSE roomid || '__c_' || id END
         WHERE id = ${room.id}
      `;
    }
    if (room.counselor_id) {
      void this.restoreCounselorReady(room.counselor_id);
    }
    void this.m2netPush.settleChatRoomLocal(room.id).catch((e) => {
      this.logger.warn(
        `[markLeave close] settleChatRoomLocal 실패 chatRoomId=${room.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
    // 종료된 방의 토큰은 더 이상 사용되지 않으므로 캐시에서 제거 (메모리 누수 방지).
    this.tokenCache.delete(room.id);
    return { ok: true, mode: 'close' };
  }

  /**
   * 재입장 — sample/counsel/ajax.counsel_chat.php act='rejoin' 동등.
   * 본인 try_out 플래그를 해제하고 rejoin_count 누적.
   */
  async markRejoin(params: { me: number; chatRoomId: number }): Promise<{ ok: true }> {
    const rooms = await this.sql<{
      id: number;
      member_id: number | null;
      counselor_id: number | null;
      counselor_try_out: boolean;
      member_try_out: boolean;
      rejoin_count: number | null;
      started_at: Date | null;
    }[]>`
      SELECT id, member_id, counselor_id, counselor_try_out, member_try_out,
             rejoin_count, started_at
        FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
         AND status <> 'DISCONNECT'
       LIMIT 1
    `;
    const room = rooms[0];
    if (!room) return { ok: true };
    const isCounselor = Number(room.counselor_id) === Number(params.me);
    // 본인의 try_out 플래그가 TRUE 인 경우 = 명시적 leave/peer-event 가 마킹한 진짜 이탈.
    // 시스템 메시지 INSERT 는 이 경우에만. (첫 입장에서 "다시 입장" 오발화 차단)
    const wasOut = isCounselor ? room.counselor_try_out : room.member_try_out;
    // 강제종료 보강: try_out 이 FALSE 여도 방이 충분히 진행된 뒤 같은 사용자가 다시 진입했다면
    // 강제종료(소켓 abrupt close) 케이스로 본다. 이때는 시스템 메시지는 INSERT 하지 않지만
    // rejoin_last_at 을 갱신해서 **상대방 폴링이 새 wss 토큰을 받아 강제 재연결** 하도록 신호.
    // (한 사람의 첫 입장에서도 30초 이상 지났으면 이 분기를 타지만 시스템 메시지가 안 들어가니
    //  사용자에게 보이는 텍스트 변화는 없고, 상대방 wss 재연결만 일어남 — 부작용 없음)
    const startedMsAgo = room.started_at ? Date.now() - room.started_at.getTime() : 0;
    const isReconnectLikely = wasOut || startedMsAgo > 30_000;
    if (isCounselor) {
      if (isReconnectLikely) {
        await this.sql`
          UPDATE chat_room
             SET counselor_try_out = FALSE,
                 rejoin = TRUE,
                 rejoin_count = COALESCE(rejoin_count, 0) + 1,
                 rejoin_last_at = now()
           WHERE id = ${room.id}
        `;
      } else {
        await this.sql`
          UPDATE chat_room SET counselor_try_out = FALSE WHERE id = ${room.id}
        `;
      }
    } else {
      if (isReconnectLikely) {
        await this.sql`
          UPDATE chat_room
             SET member_try_out = FALSE,
                 rejoin = TRUE,
                 rejoin_count = COALESCE(rejoin_count, 0) + 1,
                 rejoin_last_at = now()
           WHERE id = ${room.id}
        `;
      } else {
        await this.sql`
          UPDATE chat_room SET member_try_out = FALSE WHERE id = ${room.id}
        `;
      }
    }
    // 시스템 메시지 INSERT — 본인이 명시적으로 이탈 마킹된 경우에만.
    // (강제종료 보강 케이스는 wasOut=FALSE 라 메시지 없음. 단, 시스템 메시지는 m2net 측 wss
    //  room_out_noti 가 도착하면 handlePeerEvent 가 try_out 마킹 + INSERT 하므로
    //  강제종료 → 재입장 시 회원 화면에 "상담사가 채팅방을 나갔습니다"가 먼저 떴다가
    //  "상담사가 다시 입장하였습니다" 가 뜨는 순서가 된다.)
    if (wasOut) {
      await this.insertActorSystemMessage(room.id, params.me, isCounselor, 'rejoin');
    }
    return { ok: true };
  }

  /**
   * client wss room_in_noti / room_out_noti 수신 시 backend 동기화.
   *  - actor 의 try_out 마킹
   *  - 시스템 메시지 INSERT (insertActorSystemMessage 의 멱등 가드로 중복 방어)
   *  - leave 이벤트면 30초 후 자동 종료 정책 평가 (정책: 한쪽이라도 30초 이상 try_out 이면
   *    상담 종료 + 정산). 클라이언트 unmount cleanup 이 안 도는 강제종료 케이스 핵심 보강.
   */
  async handlePeerEvent(params: {
    me: number;
    chatRoomId: number;
    event: 'leave' | 'rejoin';
    actor: 'counselor' | 'member';
  }): Promise<{ ok: true }> {
    // me 가 이 chat_room 소속인지만 권한 검증. actor 는 임의 결정 가능.
    const rooms = await this.sql<{
      id: number;
      member_id: number | null;
      counselor_id: number | null;
    }[]>`
      SELECT id, member_id, counselor_id FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
         AND status <> 'DISCONNECT'
       LIMIT 1
    `;
    const room = rooms[0];
    if (!room) return { ok: true };

    const actorIsCounselor = params.actor === 'counselor';
    const actorMemberId = actorIsCounselor ? room.counselor_id : room.member_id;
    if (!actorMemberId) return { ok: true };

    if (params.event === 'leave') {
      const result = actorIsCounselor
        ? await this.sql<{ id: number }[]>`
            UPDATE chat_room SET counselor_try_out = TRUE
             WHERE id = ${room.id} AND status <> 'DISCONNECT' AND counselor_try_out = FALSE
             RETURNING id
          `
        : await this.sql<{ id: number }[]>`
            UPDATE chat_room SET member_try_out = TRUE
             WHERE id = ${room.id} AND status <> 'DISCONNECT' AND member_try_out = FALSE
             RETURNING id
          `;
      if (result.length > 0) {
        await this.insertActorSystemMessage(room.id, actorMemberId, actorIsCounselor, 'leave');
        // 자동 종료 정책: 채팅 시작 직후 wss 재연결로 인한 짧은 이탈에서 오발화가 너무 많아
        // 일단 비활성화. 종료는 명시적 "상담종료" 버튼 또는 잔여시간 소진(tick) 시에만.
      }
    } else {
      // rejoin — try_out=true→false 전환된 경우에만 시스템 메시지 INSERT.
      // (m2net wss echo 로 room_in_noti 가 메시지 입력 등에도 발화될 수 있어 멱등 가드 필수)
      const result = actorIsCounselor
        ? await this.sql<{ id: number }[]>`
            UPDATE chat_room
               SET counselor_try_out = FALSE,
                   rejoin = TRUE,
                   rejoin_count = COALESCE(rejoin_count, 0) + 1,
                   rejoin_last_at = now()
             WHERE id = ${room.id} AND status <> 'DISCONNECT' AND counselor_try_out = TRUE
             RETURNING id
          `
        : await this.sql<{ id: number }[]>`
            UPDATE chat_room
               SET member_try_out = FALSE,
                   rejoin = TRUE,
                   rejoin_count = COALESCE(rejoin_count, 0) + 1,
                   rejoin_last_at = now()
             WHERE id = ${room.id} AND status <> 'DISCONNECT' AND member_try_out = TRUE
             RETURNING id
          `;
      if (result.length > 0) {
        await this.insertActorSystemMessage(room.id, actorMemberId, actorIsCounselor, 'rejoin');
      }
    }
    return { ok: true };
  }

  /**
   * 입퇴장/재입장 시스템 메시지 단일 INSERT 함수 — 강력 멱등.
   *  - 같은 (chatRoomId, actor, event) 가 30초 내 이미 있으면 skip.
   *  - 또한 동일 actor 가 직전 30초 내 반대 event 를 발화한 게 없으면 skip (toggle 가드).
   *    예) leave→rejoin→leave 빠르게 일어나도 leave 가 또 발화 안 됨.
   */
  private async insertActorSystemMessage(
    chatRoomId: number,
    actorMemberId: number,
    isCounselor: boolean,
    event: 'leave' | 'rejoin',
  ): Promise<void> {
    const actorTag = `${event}-${isCounselor ? 'csr' : 'memb'}-${actorMemberId}`;
    const oppositeTag = `${event === 'leave' ? 'rejoin' : 'leave'}-${isCounselor ? 'csr' : 'memb'}-${actorMemberId}`;
    try {
      // 1) 같은 (actor, event) 가 30초 내 있으면 무시
      const dupSame = await this.sql<{ id: number }[]>`
        SELECT id FROM chat_message
         WHERE chat_room_id = ${chatRoomId}
           AND message_type = 3
           AND message LIKE ${'[' + actorTag + '-%'}
           AND created_at > now() - interval '30 seconds'
         LIMIT 1
      `;
      if (dupSame.length > 0) return;

      // 2) toggle 검증 — 직전 동일 actor 의 마지막 시스템 메시지를 보고 같은 event 면 skip.
      // (직전이 같은 event 면 중복, 반대 event 면 정상 토글이라 진행)
      const last = await this.sql<{ message: string }[]>`
        SELECT message FROM chat_message
         WHERE chat_room_id = ${chatRoomId}
           AND message_type = 3
           AND (message LIKE ${'[' + actorTag + '-%'} OR message LIKE ${'[' + oppositeTag + '-%'})
         ORDER BY created_at DESC, id DESC
         LIMIT 1
      `;
      if (last[0] && last[0].message.startsWith('[' + actorTag + '-')) {
        // 마지막이 같은 event 면 또 발화하지 않음
        return;
      }

      // INSERT
      const rows = await this.sql<{ name: string | null; nickname: string | null }[]>`
        SELECT name, nickname FROM member WHERE id = ${actorMemberId} LIMIT 1
      `;
      const r = rows[0];
      const displayName = (r?.nickname || r?.name || '').trim();
      const roleLabel = isCounselor ? '상담사' : '회원';
      const personLabel = displayName
        ? `[${displayName}]${roleLabel} 님`
        : `${roleLabel} 님`;
      const verb = event === 'leave' ? '이 채팅방을 나갔습니다.' : '이 다시 입장하였습니다.';
      const text = `${personLabel}${verb}`;
      const windowSlot = Math.floor(Date.now() / 1000); // 초 단위 unique
      const storedMsg = `[${actorTag}-${windowSlot}] ${text}`;
      await this.sql`
        INSERT INTO chat_message (chat_room_id, sender_id, message, message_type)
        VALUES (${chatRoomId}, NULL, ${storedMsg}, 3)
      `;
    } catch {
      /* swallow */
    }
  }

  // ============================================================
  // 잔여시간 / 폴링 상태 — sample/counsel/ajax.counsel_chat.php 의
  //   sync_room_point_increase + getStatus + updateTime 정확 매핑.
  //
  // 정책:
  //  - chat_room.unit_seconds, unit_cost 가 비어있으면 상담사
  //    (member.chat_unit_seconds, chat_unit_cost) 에서 채워 chat_room 에 스냅샷.
  //  - snapshot_member_point=0 이면 회원 현재 잔액으로 초기 배정 (alloc_seconds_*).
  //  - 잔액이 늘었으면(충전) 증가분만큼 추가 배정 (extra_sec).
  //  - remain = alloc_seconds_member - use_seconds.
  //  - tick: 10초마다 use_seconds += 10. remain<10 이면 status='DISCONNECT'.
  // ============================================================

  /** 회원 잔액 증가분(충전)을 방 배정 초에 동기화 — sample sync_room_point_increase 동등. */
  private async syncRoomPointIncrease(chatRoomId: number): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<{
        id: number;
        member_id: number | null;
        counselor_id: number | null;
        unit_seconds: number | null;
        unit_cost: number | null;
        alloc_seconds_member: number;
        alloc_seconds_counselor: number;
        point_residue: number;
        snapshot_member_point: number;
      }[]>`
        SELECT id, member_id, counselor_id, unit_seconds, unit_cost,
               alloc_seconds_member, alloc_seconds_counselor,
               point_residue, snapshot_member_point
          FROM chat_room
         WHERE id = ${chatRoomId}
         FOR UPDATE
      `;
      const room = rows[0];
      if (!room || room.member_id == null || room.counselor_id == null) return;

      // 단가 부재 시 상담사 마스터에서 보충 (sample 동등 — g5_member.mb_12/mb_13)
      let unitSec = Number(room.unit_seconds ?? 0);
      let unitCost = Number(room.unit_cost ?? 0);
      if (unitSec <= 0 || unitCost <= 0) {
        const csr = await tx<{ unit_seconds: number | null; unit_cost: number | null }[]>`
          SELECT chat_unit_seconds AS unit_seconds, chat_unit_cost AS unit_cost
            FROM member WHERE id = ${room.counselor_id} LIMIT 1
        `;
        unitSec = Number(csr[0]?.unit_seconds ?? 0);
        unitCost = Number(csr[0]?.unit_cost ?? 0);
        await tx`
          UPDATE chat_room SET unit_seconds = ${unitSec}, unit_cost = ${unitCost}
           WHERE id = ${chatRoomId}
        `;
      }
      if (unitSec <= 0 || unitCost <= 0) return; // 단가 정보 없음 → 시간 계산 불가

      // 회원 현재 포인트
      const memberRows = await tx<{ point: number }[]>`
        SELECT point FROM member WHERE id = ${room.member_id} LIMIT 1
      `;
      const currPts = Number(memberRows[0]?.point ?? 0);

      const snap = Number(room.snapshot_member_point ?? 0);
      if (snap <= 0) {
        // 초기 배정
        const allocUnits = Math.max(0, Math.floor(currPts / unitCost));
        const allocSec = allocUnits * unitSec;
        const residue = currPts - allocUnits * unitCost;
        await tx`
          UPDATE chat_room SET
            alloc_seconds_member = GREATEST(alloc_seconds_member, ${allocSec}),
            alloc_seconds_counselor = GREATEST(alloc_seconds_counselor, ${allocSec}),
            point_residue = ${residue},
            snapshot_member_point = ${currPts}
           WHERE id = ${chatRoomId}
        `;
        return;
      }

      // 증가분 동기화 (충전 반영)
      const deltaPts = currPts - snap;
      if (deltaPts <= 0) return;
      const totalPts = deltaPts + Number(room.point_residue ?? 0);
      const extraUnits = Math.floor(totalPts / unitCost);
      const extraSec = extraUnits * unitSec;
      const residue = totalPts - extraUnits * unitCost;
      // [엄격검증 5차 fix 2026-05-27] 충전으로 alloc 증가 시 five_min_alert_sent_at NULL reset.
      //   → 다음 5분 진입 시점에 알림 재발화 가능. 사용자가 충전했으니 두 번째 알림 받아야 함.
      await tx`
        UPDATE chat_room SET
          alloc_seconds_member = alloc_seconds_member + ${extraSec},
          alloc_seconds_counselor = alloc_seconds_counselor + ${extraSec},
          point_residue = ${residue},
          snapshot_member_point = snapshot_member_point + ${deltaPts},
          five_min_alert_sent_at = NULL
         WHERE id = ${chatRoomId}
      `;
    });
  }

  /**
   * 방 상태 폴링용 — sample/counsel/ajax.counsel_chat.php act='getStatus' 동등.
   * - sync 호출(충전 반영) 후 잔여 초/상태/try_out 반환.
   */
  async getRoomStatus(params: { me: number; chatRoomId: number }): Promise<{
    success: true;
    status: string;
    started_at: string | null;
    use_seconds: number;
    alloc_seconds: number;
    remain_seconds: number;
    counselor_joined: boolean;
    member_try_out: boolean;
    counselor_try_out: boolean;
    unit_seconds: number;
    unit_cost: number;
    rejoin_last_at: string | null;
  }> {
    // 권한 검증 + 충전 반영
    const owner = await this.sql<{ id: number }[]>`
      SELECT id FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    if (owner.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    await this.syncRoomPointIncrease(params.chatRoomId);

    const rows = await this.sql<{
      status: string;
      started_at: Date | null;
      use_seconds: number;
      alloc_seconds_member: number;
      member_try_out: boolean;
      counselor_try_out: boolean;
      unit_seconds: number | null;
      unit_cost: number | null;
      rejoin_last_at: Date | null;
    }[]>`
      SELECT status, started_at, use_seconds, alloc_seconds_member,
             member_try_out, counselor_try_out, unit_seconds, unit_cost,
             rejoin_last_at
        FROM chat_room WHERE id = ${params.chatRoomId} LIMIT 1
    `;
    const r = rows[0]!;
    const remain = Math.max(0, Number(r.alloc_seconds_member) - Number(r.use_seconds));
    return {
      success: true,
      status: r.status,
      started_at: r.started_at ? r.started_at.toISOString() : null,
      use_seconds: Number(r.use_seconds),
      alloc_seconds: Number(r.alloc_seconds_member),
      remain_seconds: remain,
      // 상담사 입장 여부 — m2net START_CHAT/CONNECT_CSR 도착 시 status='CNCH' 가 됨
      counselor_joined: r.status === 'CNCH',
      member_try_out: !!r.member_try_out,
      counselor_try_out: !!r.counselor_try_out,
      unit_seconds: Number(r.unit_seconds ?? 0),
      unit_cost: Number(r.unit_cost ?? 0),
      // 상대방 재입장 시 갱신됨 — 클라이언트가 이 값 변경 감지하면 wss 재연결 트리거
      rejoin_last_at: r.rejoin_last_at ? r.rejoin_last_at.toISOString() : null,
    };
  }

  /**
   * [엄격검증 5차 fix 2026-05-27] 채팅 5분 알림 안전망 cron.
   *
   * 회원이 ChatRoom 페이지를 떠나면 tickRoom 호출이 멈춰 5분 진입 감지가 안 됨.
   * 이 cron 이 매분 active chat_room 검사 → 잔여 ≤ 5분 진입 감지 → alerts 발화.
   *
   *  - five_min_alert_sent_at IS NULL 인 방만 대상 (멱등성)
   *  - 잔여 = alloc_seconds_member - use_seconds, 0 < 잔여 ≤ 300 인 경우 발화
   *  - tickRoom 과 race 없음 — UPDATE...RETURNING 으로 first-write-wins
   */
  async scanFiveMinAlerts(): Promise<{ fired: number; rooms: number[] }> {
    const candidates = await this.sql<{
      id: number;
      member_id: number | null;
      counselor_id: number | null;
      alloc_seconds_member: number;
    }[]>`
      UPDATE chat_room
         SET five_min_alert_sent_at = now()
       WHERE id IN (
         SELECT id FROM chat_room
          WHERE status = 'CNCH'
            AND ended_at IS NULL
            AND five_min_alert_sent_at IS NULL
            AND alloc_seconds_member - use_seconds > 0
            AND (
              -- 짧은 alloc (1분 등): 30초 이하 임계
              (alloc_seconds_member < 300 AND alloc_seconds_member - use_seconds <= 30)
              -- 일반 alloc (5분 이상): 5분 이하 임계
              OR (alloc_seconds_member >= 300 AND alloc_seconds_member - use_seconds <= 300)
            )
       )
      RETURNING id, member_id, counselor_id, alloc_seconds_member
    `;
    const fired: number[] = [];
    for (const r of candidates) {
      try {
        // [2026-05-30] 짧은 alloc(1분 등) 대응 — 본문도 동적
        const alertMsg = Number(r.alloc_seconds_member) < 300
          ? '[ALERT_5MIN]잔여 시간 30초 안내'
          : '[ALERT_5MIN]잔여 시간 5분 안내';
        await this.sql`
          INSERT INTO chat_message (chat_room_id, sender_id, message, message_type)
          VALUES (${r.id}, NULL, ${alertMsg}, 3)
        `;
      } catch (e) {
        this.logger.warn(
          `[scanFiveMinAlerts] chat_message INSERT 실패 chat_room_id=${r.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      const dedupKey = `${r.id}-${Date.now()}`;
      if (r.member_id) {
        this.alerts.enqueue(r.member_id, {
          type: 'consult_5min_warning' as const,
          title: '⏰ 5분 남았어요',
          body: '충전하시면 끊김 없이 계속 상담 가능합니다',
          link: `/chat/${r.id}`,
          data: {
            consult_id: dedupKey,
            consult_type: 'chat',
            audience: 'member',
            chat_room_id: String(r.id),
          },
        });
      }
      if (r.counselor_id) {
        this.alerts.enqueue(r.counselor_id, {
          type: 'consult_5min_warning' as const,
          title: '⏰ 회원 5분 남았어요',
          body: '마무리 멘트 안내 부탁드립니다',
          link: `/chat/${r.id}`,
          data: {
            consult_id: dedupKey,
            consult_type: 'chat',
            audience: 'counselor',
            chat_room_id: String(r.id),
          },
        });
      }
      fired.push(r.id);
    }
    if (fired.length > 0) {
      this.logger.log(`[scanFiveMinAlerts] 발화 ${fired.length}건: [${fired.join(',')}]`);
    }
    return { fired: fired.length, rooms: fired };
  }

  /**
   * 사용시간 +10초 — sample updateTime 동등. 잔여<10 이면 status='DISCONNECT'.
   * 클라이언트가 10초 간격으로 호출.
   */
  async tickRoom(params: { me: number; chatRoomId: number }): Promise<{
    success: boolean;
    used: number;
    remain: number;
    reason?: string;
  }> {
    // 권한 검증
    const owner = await this.sql<{ id: number }[]>`
      SELECT id FROM chat_room
       WHERE id = ${params.chatRoomId}
         AND (member_id = ${params.me} OR counselor_id = ${params.me})
       LIMIT 1
    `;
    if (owner.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    // [엄격검증 3차 fix 2026-05-27 T-2] tx 안에서 데이터만 채취, alerts.enqueue 는 commit 후
    let pendingFiveMinMemberId: number | null = null;
    let pendingFiveMinCounselorId: number | null = null;

    return this.sql.begin(async (tx) => {
      const rows = await tx<{
        status: string;
        alloc_seconds_member: number;
        use_seconds: number;
        member_try_out: boolean;
      }[]>`
        SELECT status, alloc_seconds_member, use_seconds, member_try_out
          FROM chat_room WHERE id = ${params.chatRoomId} FOR UPDATE
      `;
      const r = rows[0];
      if (!r) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
      // 이미 종료된 방
      if (r.status === 'DISCONNECT') {
        return { success: false, used: 0, remain: 0, reason: 'disconnected' };
      }
      // [2026-05-24] 상담사 미입장(STAY) 상태에서는 차감 금지 — 회원이 결제한 시간 보호.
      // 상담사 입장 시 m2net START_CHAT push 가 도착해 status='CNCH' 로 전환되면 누적 시작.
      // 3분 자동 취소 cron 이 STAY 무한 대기도 별도 처리.
      if (r.status === 'STAY') {
        const remain = Number(r.alloc_seconds_member) - Number(r.use_seconds);
        return { success: false, used: 0, remain: Math.max(0, remain), reason: 'awaiting_counselor' };
      }
      // 회원이 채팅방 이탈 상태(soft leave) 면 use_seconds 누적 거부 — 차감 발생 안 함.
      // 재입장 시 markRejoin 이 try_out 해제하면 다시 누적 시작.
      if (r.member_try_out) {
        const remain = Number(r.alloc_seconds_member) - Number(r.use_seconds);
        return { success: false, used: 0, remain: Math.max(0, remain), reason: 'member_paused' };
      }
      const remain = Number(r.alloc_seconds_member) - Number(r.use_seconds);
      if (remain >= 10) {
        await tx`UPDATE chat_room SET use_seconds = use_seconds + 10 WHERE id = ${params.chatRoomId}`;

        // [2026-05-27] 5분 잔여 진입 시 시스템 메시지 INSERT + 전역 alerts 큐 push.
        //
        // [엄격검증 5차 fix 2026-05-27] chat_room.five_min_alert_sent_at 컬럼으로 발화 멱등성.
        //   - tickRoom (회원 ChatRoom 안) + chat-alert-cron (회원 이탈 시 안전망) 양쪽 동작.
        //   - 충전으로 alloc 증가 시 NULL reset (markRejoin / consult extendChat 등) → 재발화.
        //   - tickRoom 이 빠르므로 즉시성 우선, cron 은 회원 떠난 채팅방 안전망.
        const newRemain = remain - 10;
        const FIVE_MIN = 300;
        // [2026-05-29] 짧은 alloc (1분 테스트 옵션 등) 대응 — alloc 자체가 5분 미만이면 30초 임계.
        //   _PREPAID_CHAT_POLICY.md §7.2 참조. 운영에서 1분 옵션 제거 후 자동으로 5분 임계 복귀.
        const allocSec = Number(r.alloc_seconds_member);
        const alertThreshold = allocSec < FIVE_MIN ? 30 : FIVE_MIN;
        // 임계 진입 또는 이미 임계 미만 + 아직 알림 안 보낸 경우 모두 발화 (tick 미세 race 방어)
        if (newRemain > 0 && newRemain <= alertThreshold) {
          const sentCheck = await tx<{ already: boolean; member_id: number | null; counselor_id: number | null }[]>`
            UPDATE chat_room
               SET five_min_alert_sent_at = now()
             WHERE id = ${params.chatRoomId}
               AND five_min_alert_sent_at IS NULL
             RETURNING (false) AS already, member_id, counselor_id
          `;
          if (sentCheck.length > 0) {
            // 본 트랜잭션이 이 채팅방의 첫 5분 알림 발화 권한 획득
            // [2026-05-30] 짧은 alloc (1분 등) 대응 — 메시지 본문도 임계에 맞게 동적.
            const alertMsg =
              alertThreshold === 30
                ? '[ALERT_5MIN]잔여 시간 30초 안내'
                : '[ALERT_5MIN]잔여 시간 5분 안내';
            await tx`
              INSERT INTO chat_message (chat_room_id, sender_id, message, message_type)
              VALUES (${params.chatRoomId}, NULL, ${alertMsg}, 3)
            `.catch((e) => {
              this.logger.warn(
                `[ALERT_5MIN] INSERT 실패 chatRoomId=${params.chatRoomId}: ${e instanceof Error ? e.message : String(e)}`,
              );
            });
            pendingFiveMinMemberId = sentCheck[0].member_id ?? null;
            pendingFiveMinCounselorId = sentCheck[0].counselor_id ?? null;
          }
        }

        return { success: true, used: 10, remain: newRemain };
      }
      // 잔여 부족 → 즉시 종료. roomid 에 suffix 붙여 다음 채팅 시 충돌 방지.
      await tx`
        UPDATE chat_room
           SET status = 'DISCONNECT',
               ended_at = COALESCE(ended_at, now()),
               roomid = CASE WHEN roomid LIKE '%\\_\\_c\\_%' ESCAPE '\\'
                             THEN roomid
                             ELSE roomid || '__c_' || id END
         WHERE id = ${params.chatRoomId}
      `;
      // 상담사 ready 상태 복귀 (counselor_id 조회 후)
      const cid = await tx<{ counselor_id: number | null }[]>`
        SELECT counselor_id FROM chat_room WHERE id = ${params.chatRoomId} LIMIT 1
      `;
      if (cid[0]?.counselor_id) {
        void this.restoreCounselorReady(cid[0].counselor_id);
      }
      return { success: false, used: 0, remain: 0, reason: 'no_remain' as const };
    }).then(async (res) => {
      // [엄격검증 3차 fix 2026-05-27 T-2] tx commit 성공 후에만 alerts 큐 push.
      // tx rollback (DB 예외) 시엔 pending 변수 무시 — 정합성 보장.
      // 충전 후 두 번째 5분 진입 시 alerts dedup 충돌 회피 위해 consult_id 에 timestamp suffix.
      if (pendingFiveMinMemberId || pendingFiveMinCounselorId) {
        const dedupKey = `${params.chatRoomId}-${Date.now()}`;
        if (pendingFiveMinMemberId) {
          this.alerts.enqueue(pendingFiveMinMemberId, {
            type: 'consult_5min_warning' as const,
            title: '⏰ 5분 남았어요',
            body: '충전하시면 끊김 없이 계속 상담 가능합니다',
            link: `/chat/${params.chatRoomId}`,
            data: {
              consult_id: dedupKey,
              consult_type: 'chat',
              audience: 'member',
              chat_room_id: String(params.chatRoomId),
            },
          });
        }
        if (pendingFiveMinCounselorId) {
          this.alerts.enqueue(pendingFiveMinCounselorId, {
            type: 'consult_5min_warning' as const,
            title: '⏰ 회원 5분 남았어요',
            body: '마무리 멘트 안내 부탁드립니다',
            link: `/chat/${params.chatRoomId}`,
            data: {
              consult_id: dedupKey,
              consult_type: 'chat',
              audience: 'counselor',
              chat_room_id: String(params.chatRoomId),
            },
          });
        }
      }
      // 자동 종료(잔여 부족) 시점에 m2net END_CHAT push 가 안 올 수 있으니 자체 정산 트리거.
      // settleChatRoomLocal 은 consultation.roomid + reason 멱등 가드가 있어 중복 안전.
      if (!res.success && res.reason === 'no_remain') {
        void this.m2netPush.settleChatRoomLocal(params.chatRoomId).catch((e) => {
          this.logger.warn(
            `[tickRoom] settleChatRoomLocal 실패 chatRoomId=${params.chatRoomId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }
      return res;
    });
  }
}
