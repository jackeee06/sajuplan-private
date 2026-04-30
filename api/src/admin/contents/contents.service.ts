import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/contentlist.php (메뉴 700600 "내용관리") 정확 매핑.
 *
 *   FROM g5_content    →  FROM page
 *   co_id             →  page.co_id (레거시) + page.slug (신규 PK용)
 *   co_subject        →  page.title
 *   co_content        →  page.content
 *   co_html           →  page.use_html
 *   co_include_head   →  page.head_html
 *   co_include_tail   →  page.tail_html
 *   (신규 추가)        →  page.mobile_content, page.is_active
 */

export interface PageRow {
  id: number;
  co_id: string | null;
  slug: string;
  title: string;
  content: string | null;
  mobile_content: string | null;
  use_html: boolean;
  head_html: string | null;
  tail_html: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageInput {
  slug: string;
  title: string;
  content?: string | null;
  mobile_content?: string | null;
  use_html?: boolean;
  head_html?: string | null;
  tail_html?: string | null;
  is_active?: boolean;
}

@Injectable()
export class ContentsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findAll(page = 1, limit = 50) {
    const safePage = Math.max(1, Math.trunc(page));
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const offset = (safePage - 1) * safeLimit;

    const items = await this.sql<PageRow[]>`
      SELECT * FROM page ORDER BY slug ASC LIMIT ${safeLimit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`SELECT count(*)::text AS cnt FROM page`;
    return { items, total: Number(totalRows[0].cnt), page: safePage, limit: safeLimit };
  }

  async getById(id: number): Promise<PageRow> {
    const rows = await this.sql<PageRow[]>`SELECT * FROM page WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) throw new NotFoundException('해당 콘텐츠를 찾을 수 없습니다.');
    return rows[0];
  }

  async getBySlug(slug: string): Promise<PageRow | null> {
    const rows = await this.sql<PageRow[]>`SELECT * FROM page WHERE slug = ${slug} LIMIT 1`;
    return rows[0] ?? null;
  }

  async create(input: PageInput): Promise<PageRow> {
    const slug = (input.slug ?? '').trim();
    if (!slug) throw new BadRequestException('slug(URL 식별자)는 필수입니다.');
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      throw new BadRequestException('slug는 영문/숫자/_/- 만 허용됩니다.');
    }
    if (!input.title?.trim()) throw new BadRequestException('제목은 필수입니다.');

    const exists = await this.sql<{ id: number }[]>`SELECT id FROM page WHERE slug = ${slug} LIMIT 1`;
    if (exists.length > 0) throw new BadRequestException(`이미 존재하는 slug입니다: ${slug}`);

    const rows = await this.sql<PageRow[]>`
      INSERT INTO page (slug, co_id, title, content, mobile_content, use_html, head_html, tail_html, is_active)
      VALUES (
        ${slug}, ${slug}, ${input.title.trim()}, ${input.content ?? ''}, ${input.mobile_content ?? null},
        ${input.use_html ?? true}, ${input.head_html ?? null}, ${input.tail_html ?? null}, ${input.is_active ?? true}
      )
      RETURNING *
    `;
    return rows[0];
  }

  async update(id: number, input: Partial<PageInput>): Promise<PageRow> {
    const cur = await this.getById(id);
    const slug = input.slug?.trim() ?? cur.slug;
    if (slug !== cur.slug) {
      if (!/^[a-zA-Z0-9_-]+$/.test(slug)) throw new BadRequestException('slug는 영문/숫자/_/- 만 허용됩니다.');
      const exists = await this.sql<{ id: number }[]>`SELECT id FROM page WHERE slug = ${slug} AND id <> ${id} LIMIT 1`;
      if (exists.length > 0) throw new BadRequestException(`이미 존재하는 slug입니다: ${slug}`);
    }

    const rows = await this.sql<PageRow[]>`
      UPDATE page SET
        slug = ${slug},
        title = ${input.title?.trim() ?? cur.title},
        content = ${input.content ?? cur.content},
        mobile_content = ${input.mobile_content ?? cur.mobile_content},
        use_html = ${input.use_html ?? cur.use_html},
        head_html = ${input.head_html ?? cur.head_html},
        tail_html = ${input.tail_html ?? cur.tail_html},
        is_active = ${input.is_active ?? cur.is_active},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0];
  }

  async remove(id: number) {
    const result = await this.sql`DELETE FROM page WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('해당 콘텐츠를 찾을 수 없습니다.');
    return { ok: true };
  }
}
