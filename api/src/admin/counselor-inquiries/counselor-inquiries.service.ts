import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

const OPERATOR_LABEL = '사주플랜 운영팀';

/**
 * 상담사 → 운영자 1:1 고객센터 문의 — 관리자 측 (조회·답변).
 * 사용자측 작성/조회는 user/counselor-mypage-inquiry 와 동일 테이블(counselor_inquiry) 공유.
 */
@Injectable()
export class AdminCounselorInquiriesService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async list(filter: {
    status?: string | null;
    category?: string | null;
    q?: string | null;
    page: number;
    limit: number;
  }) {
    const page = Math.max(1, Math.trunc(filter.page || 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit || 20)));
    const offset = (page - 1) * limit;
    const status = filter.status === 'pending' || filter.status === 'answered' ? filter.status : null;
    const category = filter.category?.trim() || null;
    const q = filter.q?.trim() ? `%${filter.q.trim()}%` : null;

    const items = await this.sql<
      {
        id: number;
        member_id: number;
        mb_id: string | null;
        counselor_name: string | null;
        category: string;
        title: string;
        content: string;
        status: string;
        photo_count: number;
        replied_at: Date | null;
        created_at: Date;
        total: number;
      }[]
    >`
      SELECT i.id, i.member_id, i.mb_id,
             COALESCE(m.nickname, m.name, m.mb_id) AS counselor_name,
             i.category, i.title, i.content, i.status,
             COALESCE(jsonb_array_length(i.photos), 0) AS photo_count,
             i.replied_at, i.created_at,
             COUNT(*) OVER() AS total
        FROM counselor_inquiry i
        LEFT JOIN member m ON m.id = i.member_id
       WHERE i.is_hidden = false
         ${status ? this.sql`AND i.status = ${status}` : this.sql``}
         ${category ? this.sql`AND i.category = ${category}` : this.sql``}
         ${q ? this.sql`AND (i.title ILIKE ${q} OR i.content ILIKE ${q} OR m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})` : this.sql``}
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = items.length > 0 ? Number(items[0].total) : 0;
    return {
      items: items.map((r) => ({
        id: Number(r.id),
        member_id: Number(r.member_id),
        mb_id: r.mb_id,
        counselor_name: r.counselor_name,
        category: r.category,
        title: r.title,
        content: r.content,
        status: r.status,
        photo_count: Number(r.photo_count),
        replied_at: r.replied_at?.toISOString() ?? null,
        created_at: r.created_at.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async getById(id: number) {
    const rows = await this.sql<
      {
        id: number;
        member_id: number;
        mb_id: string | null;
        counselor_name: string | null;
        category: string;
        title: string;
        content: string;
        status: string;
        photos: unknown;
        reply_content: string | null;
        reply_admin_name: string | null;
        replied_at: Date | null;
        created_at: Date;
      }[]
    >`
      SELECT i.id, i.member_id, i.mb_id,
             COALESCE(m.nickname, m.name, m.mb_id) AS counselor_name,
             i.category, i.title, i.content, i.status, i.photos,
             i.reply_content, i.reply_admin_name, i.replied_at, i.created_at
        FROM counselor_inquiry i
        LEFT JOIN member m ON m.id = i.member_id
       WHERE i.id = ${id}
       LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    const r = rows[0];
    return {
      id: Number(r.id),
      member_id: Number(r.member_id),
      mb_id: r.mb_id,
      counselor_name: r.counselor_name,
      category: r.category,
      title: r.title,
      content: r.content,
      status: r.status,
      photos: normalizePhotos(r.photos),
      reply_content: r.reply_content,
      reply_admin_name: r.reply_admin_name,
      replied_at: r.replied_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
    };
  }

  /** 답변 등록/수정 */
  async reply(id: number, content: string, adminId: number) {
    const text = (content ?? '').trim();
    if (!text) throw new BadRequestException('답변 내용을 입력해주세요.');
    const rows = await this.sql<{ id: number }[]>`
      UPDATE counselor_inquiry
         SET reply_content = ${text},
             reply_admin_id = ${adminId},
             reply_admin_name = ${OPERATOR_LABEL},
             replied_at = now(),
             status = 'answered',
             updated_at = now()
       WHERE id = ${id}
       RETURNING id
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    return { ok: true as const };
  }

  /** 답변 삭제 (답변대기로 되돌림) */
  async deleteReply(id: number) {
    const rows = await this.sql<{ id: number }[]>`
      UPDATE counselor_inquiry
         SET reply_content = NULL,
             reply_admin_id = NULL,
             reply_admin_name = NULL,
             replied_at = NULL,
             status = 'pending',
             updated_at = now()
       WHERE id = ${id}
       RETURNING id
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    return { ok: true as const };
  }
}

function normalizePhotos(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((p): p is string => typeof p === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}
