import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 어드민 이벤트(`post_event`) 관리.
 *
 * sample 의 g5_write_event 게시판을 신 시스템 post_event 테이블로 옮긴 결과,
 * 이벤트는 기간 필드(starts_at/ends_at) 가 있는 공지성 글로 다룬다.
 * 노출/숨김은 starts_at~ends_at 기간으로 사용자측에서 판정한다.
 *
 * 정책 (2026-05): post_event.category 컬럼은 DB엔 남지만 어드민 폼에서
 * 노출 안 함 — 사용자가 "이벤트는 카테고리 분류 없음" 으로 정함. SELECT/INSERT
 * 시 더 이상 다루지 않는다.
 */
export interface EventRow {
  id: number;
  title: string;
  content: string | null;
  thumbnail_url: string | null;
  thumbnail_url_webp: string | null;
  starts_at: string | null;
  ends_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface EventInput {
  title: string;
  content?: string | null;
  thumbnail_url?: string | null;
  thumbnail_url_webp?: string | null;
  /** ISO 8601 (또는 'YYYY-MM-DDTHH:mm') — null/빈 문자열이면 무기한 시작 */
  starts_at?: string | null;
  /** ISO 8601 — null/빈 문자열이면 무기한 종료 */
  ends_at?: string | null;
}

@Injectable()
export class EventsService {
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
    const where =
      conds.length === 0
        ? this.sql``
        : conds.reduce(
            (acc, c, i) =>
              i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`,
            this.sql``,
          );

    const items = await this.sql<EventRow[]>`
      SELECT id, title, content, thumbnail_url, thumbnail_url_webp,
             starts_at, ends_at, view_count, created_at, updated_at
        FROM post_event ${where}
       ORDER BY COALESCE(starts_at, created_at) DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const total = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM post_event ${where}
    `;
    return { items, total: Number(total[0].cnt), page, limit };
  }

  async detail(id: number): Promise<EventRow> {
    const rows = await this.sql<EventRow[]>`
      SELECT id, title, content, thumbnail_url, thumbnail_url_webp,
             starts_at, ends_at, view_count, created_at, updated_at
        FROM post_event WHERE id = ${id}
    `;
    if (rows.length === 0) throw new NotFoundException('이벤트를 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: EventInput): Promise<{ id: number; url: string }> {
    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO post_event (title, content, thumbnail_url, thumbnail_url_webp, starts_at, ends_at)
      VALUES (
        ${input.title},
        ${input.content ?? null},
        ${input.thumbnail_url ?? null},
        ${input.thumbnail_url_webp ?? null},
        ${normalizeTs(input.starts_at)},
        ${normalizeTs(input.ends_at)}
      )
      RETURNING id
    `;
    const id = inserted[0].id;
    return { id, url: `/events/${id}` };
  }

  async update(
    id: number,
    input: Partial<EventInput>,
  ): Promise<{ id: number; url: string }> {
    const exists = await this.sql<{ id: number }[]>`SELECT id FROM post_event WHERE id = ${id}`;
    if (exists.length === 0) throw new NotFoundException('이벤트를 찾을 수 없습니다.');
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.content !== undefined) updates.content = input.content;
    if (input.thumbnail_url !== undefined) updates.thumbnail_url = input.thumbnail_url;
    if (input.thumbnail_url_webp !== undefined) updates.thumbnail_url_webp = input.thumbnail_url_webp;
    if (input.starts_at !== undefined) updates.starts_at = normalizeTs(input.starts_at);
    if (input.ends_at !== undefined) updates.ends_at = normalizeTs(input.ends_at);
    if (Object.keys(updates).length > 0) {
      await this.sql`UPDATE post_event SET ${this.sql(updates)}, updated_at = now() WHERE id = ${id}`;
    }
    return { id, url: `/events/${id}` };
  }

  async remove(id: number): Promise<{ ok: boolean }> {
    const r = await this.sql`DELETE FROM post_event WHERE id = ${id}`;
    if (r.count === 0) throw new NotFoundException('이벤트를 찾을 수 없습니다.');
    return { ok: true };
  }
}

/** 빈 문자열은 NULL 로 — datetime-local 입력의 ''/'YYYY-MM-DDTHH:mm' 모두 허용 */
function normalizeTs(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
