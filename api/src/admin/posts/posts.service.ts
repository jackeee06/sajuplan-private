import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 게시판 통합 service.
 *
 * sample/adm/admin.menu350.php의 게시판 기반 메뉴 매핑:
 *   상담후기 관리        → review      → post_review
 *   소원다락방            → wish        → post_wish
 *   소원다락방 EVENT      → wish_event  → post_wish_event
 *   상담문의              → qa          → post_qa  (category 미설정)
 *   1:1문의(상담사)      → qa_counselor → post_qa  (category='counselor')
 */

export type PostSlug = 'review' | 'wish' | 'wish_event' | 'qa' | 'qa_counselor';

interface SlugConfig {
  table: string;
  /** category 강제 필터 (1:1문의 같이 같은 테이블을 분류로 분리할 때) */
  forceCategory?: string;
  /** review 등 추가 필드 */
  extraFields?: string[];
}

const SLUG_MAP: Record<PostSlug, SlugConfig> = {
  review: {
    table: 'post_review',
    extraFields: ['counselor_id', 'rating'],
  },
  wish: { table: 'post_wish' },
  wish_event: { table: 'post_wish_event' },
  qa: { table: 'post_qa' },
  qa_counselor: { table: 'post_qa', forceCategory: 'counselor' },
};

export interface PostRow {
  id: number;
  wr_id: number | null;
  member_id: number | null;
  mb_id: string | null;
  member_name: string | null;
  member_nickname: string | null;
  title: string;
  content: string | null;
  category: string | null;
  view_count: number;
  like_count: number;
  dislike_count: number;
  is_secret: boolean;
  has_file: boolean;
  ip: string | null;
  extras: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  // review 전용
  counselor_id?: number | null;
  counselor_name?: string | null;
  rating?: number | null;
}

export interface PostFilter {
  q?: string;
  category?: string;
  fr_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class PostsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  private resolveSlug(slug: string): SlugConfig {
    const cfg = SLUG_MAP[slug as PostSlug];
    if (!cfg) throw new BadRequestException(`알 수 없는 slug: ${slug}`);
    return cfg;
  }

  async findAll(slug: string, filter: PostFilter) {
    const cfg = this.resolveSlug(slug);
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (cfg.forceCategory) conds.push(this.sql`p.category = ${cfg.forceCategory}`);
    if (filter.category && !cfg.forceCategory) conds.push(this.sql`p.category = ${filter.category}`);
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(p.title ILIKE ${q} OR p.content ILIKE ${q} OR m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
    }
    if (filter.fr_date) conds.push(this.sql`p.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    if (filter.to_date) conds.push(this.sql`p.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    // table 이름은 화이트리스트로 검증된 cfg.table만 사용 (SQL injection 안전)
    const tableSql = this.sql.unsafe(cfg.table);

    const isReview = slug === 'review';

    const items = isReview
      ? await this.sql<PostRow[]>`
          SELECT p.id, p.wr_id, p.member_id, p.mb_id, p.title, p.content, p.category,
                 p.view_count, p.like_count, p.dislike_count, p.is_secret, p.has_file,
                 p.ip, p.extras, p.created_at,
                 p.counselor_id, p.rating,
                 m.mb_id, m.name AS member_name, m.nickname AS member_nickname,
                 c.name AS counselor_name
          FROM ${tableSql} p
          LEFT JOIN member m ON m.id = p.member_id
          LEFT JOIN member c ON c.id = p.counselor_id
          ${whereClause}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await this.sql<PostRow[]>`
          SELECT p.id, p.wr_id, p.member_id, p.mb_id, p.title, p.content, p.category,
                 p.view_count, p.like_count, p.dislike_count, p.is_secret, p.has_file,
                 p.ip, p.extras, p.created_at,
                 m.mb_id, m.name AS member_name, m.nickname AS member_nickname
          FROM ${tableSql} p
          LEFT JOIN member m ON m.id = p.member_id
          ${whereClause}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM ${tableSql} p
      LEFT JOIN member m ON m.id = p.member_id
      ${whereClause}
    `;

    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  async getById(slug: string, id: number) {
    const cfg = this.resolveSlug(slug);
    const tableSql = this.sql.unsafe(cfg.table);
    const rows = await this.sql<PostRow[]>`
      SELECT p.*, m.mb_id, m.name AS member_name, m.nickname AS member_nickname
      FROM ${tableSql} p
      LEFT JOIN member m ON m.id = p.member_id
      WHERE p.id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return rows[0];
  }

  async remove(slug: string, id: number) {
    const cfg = this.resolveSlug(slug);
    const tableSql = this.sql.unsafe(cfg.table);
    const result = await this.sql`DELETE FROM ${tableSql} WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return { ok: true };
  }
}
