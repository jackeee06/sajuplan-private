import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface NoticeRow {
  id: number;
  title: string;
  content: string | null;
  category: string | null;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface NoticeInput {
  title: string;
  content?: string | null;
  category?: string | null;
  is_pinned?: boolean;
}

@Injectable()
export class NoticesService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async list(filter: { q?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(title ILIKE ${q} OR content ILIKE ${q})`);
    }
    const where = conds.length === 0 ? this.sql`` : conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``,
    );

    const items = await this.sql<NoticeRow[]>`
      SELECT id, title, content, category, is_pinned, view_count, created_at, updated_at
        FROM post_notice ${where}
       ORDER BY is_pinned DESC, created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const total = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM post_notice ${where}
    `;
    return { items, total: Number(total[0].cnt), page, limit };
  }

  async detail(id: number): Promise<NoticeRow> {
    const rows = await this.sql<NoticeRow[]>`
      SELECT id, title, content, category, is_pinned, view_count, created_at, updated_at
        FROM post_notice WHERE id = ${id}
    `;
    if (rows.length === 0) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: NoticeInput): Promise<{ id: number; url: string }> {
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO post_notice (title, content, category, is_pinned)
      VALUES (${input.title}, ${input.content ?? null}, ${input.category ?? null}, ${input.is_pinned ?? false})
      RETURNING id
    `;
    const id = inserted[0].id;
    return { id, url: `/notices/${id}` };
  }

  async update(id: number, input: Partial<NoticeInput>): Promise<{ id: number; url: string }> {
    const exists = await this.sql<{ id: number }[]>`SELECT id FROM post_notice WHERE id = ${id}`;
    if (exists.length === 0) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.content !== undefined) updates.content = input.content;
    if (input.category !== undefined) updates.category = input.category;
    if (input.is_pinned !== undefined) updates.is_pinned = input.is_pinned;
    if (Object.keys(updates).length > 0) {
      await this.sql`UPDATE post_notice SET ${this.sql(updates)}, updated_at = now() WHERE id = ${id}`;
    }
    return { id, url: `/notices/${id}` };
  }

  async remove(id: number): Promise<{ ok: boolean }> {
    const r = await this.sql`DELETE FROM post_notice WHERE id = ${id}`;
    if (r.count === 0) throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    return { ok: true };
  }
}
