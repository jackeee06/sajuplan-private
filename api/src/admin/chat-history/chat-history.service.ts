import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 채팅내역 리스트 — sample /my/chat_record.php 동등.
 *
 *   chat_room: 상담 1건 = 1 room
 *   chat_message: room의 개별 메시지
 *
 *   목록 화면: room별 그룹 (기간/회원/상담사 필터)
 *   상세: 해당 room의 메시지 시계열
 */

export interface ChatRoomRow {
  id: number;
  roomid: string | null;
  member_id: number | null;
  member_mb_id: string | null;
  member_name: string | null;
  counselor_id: number | null;
  counselor_mb_id: string | null;
  counselor_name: string | null;
  counselor_nickname: string | null;
  status: string | null;
  message_count: number;
  last_message: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface ChatMessageRow {
  id: number;
  chat_room_id: number | null;
  sender_id: number | null;
  sender_mb_id: string | null;
  sender_name: string | null;
  message: string | null;
  message_type: number;
  created_at: string;
}

export interface ChatFilter {
  q?: string;
  fr_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ChatHistoryService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findRooms(filter: ChatFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR c.mb_id ILIKE ${q} OR c.nickname ILIKE ${q} OR r.roomid ILIKE ${q})`);
    }
    if (filter.fr_date) conds.push(this.sql`r.started_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    if (filter.to_date) conds.push(this.sql`r.started_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    const items = await this.sql<ChatRoomRow[]>`
      SELECT
        r.id, r.roomid, r.member_id, r.counselor_id, r.status, r.started_at,
        m.mb_id AS member_mb_id, m.name AS member_name,
        c.mb_id AS counselor_mb_id, c.name AS counselor_name, c.nickname AS counselor_nickname,
        (SELECT count(*)::int FROM chat_message msg WHERE msg.chat_room_id = r.id) AS message_count,
        (SELECT msg.message FROM chat_message msg WHERE msg.chat_room_id = r.id ORDER BY msg.created_at DESC LIMIT 1) AS last_message
      FROM chat_room r
      LEFT JOIN member m ON m.id = r.member_id
      LEFT JOIN member c ON c.id = r.counselor_id
      ${whereClause}
      ORDER BY r.started_at DESC, r.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM chat_room r
      LEFT JOIN member m ON m.id = r.member_id
      LEFT JOIN member c ON c.id = r.counselor_id
      ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  async getRoomMessages(roomId: number) {
    const room = await this.sql<ChatRoomRow[]>`
      SELECT r.id, r.roomid, r.member_id, r.counselor_id, r.status, r.started_at, r.ended_at,
             m.mb_id AS member_mb_id, m.name AS member_name,
             c.mb_id AS counselor_mb_id, c.name AS counselor_name, c.nickname AS counselor_nickname
      FROM chat_room r
      LEFT JOIN member m ON m.id = r.member_id
      LEFT JOIN member c ON c.id = r.counselor_id
      WHERE r.id = ${roomId}
      LIMIT 1
    `;
    if (room.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const messages = await this.sql<ChatMessageRow[]>`
      SELECT msg.id, msg.chat_room_id, msg.sender_id, msg.message, msg.message_type, msg.created_at,
             s.mb_id AS sender_mb_id, s.name AS sender_name
      FROM chat_message msg
      LEFT JOIN member s ON s.id = msg.sender_id
      WHERE msg.chat_room_id = ${roomId}
      ORDER BY msg.created_at ASC, msg.id ASC
    `;
    return { room: room[0], messages };
  }

  async getRoomMessagesByRoomid(roomid: string) {
    // 1) 정확 일치 우선
    let rows = await this.sql<{ id: number }[]>`
      SELECT id FROM chat_room WHERE roomid = ${roomid} LIMIT 1
    `;
    // 2) 접미사(__c_<id>) 가공된 형태 / 레거시 `+'1'` 형태 보정
    if (rows.length === 0) {
      rows = await this.sql<{ id: number }[]>`
        SELECT id FROM chat_room
         WHERE roomid LIKE ${roomid + '%'}
         ORDER BY id DESC LIMIT 1
      `;
    }
    if (rows.length === 0) throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    return this.getRoomMessages(rows[0].id);
  }
}
