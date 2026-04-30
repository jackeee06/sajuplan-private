import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 게시판 운영 — 인기검색어/댓글/신고 통합 service.
 */

const POST_TABLES = [
  'post_review', 'post_wish', 'post_wish_event', 'post_qa',
  'post_counselor', 'post_fortune', 'post_charm', 'post_column',
  'post_notice', 'post_event', 'post_apply', 'post_chat_room',
  'post_benefit', 'post_history', 'post_tip', 'post_c_notice',
  'post_c_faq', 'post_new', 'post_way',
];

@Injectable()
export class BoardOpsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  // ─── 인기검색어 (search_log) ────────────────────────────
  async searchKeywords(filter: { fr_date?: string; to_date?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 30)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.fr_date) conds.push(this.sql`s.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    if (filter.to_date) conds.push(this.sql`s.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);
    const whereClause = conds.length === 0 ? this.sql`` : conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``,
    );

    const items = await this.sql`
      SELECT s.id, s.keyword, s.search_ip, s.result_count, s.created_at,
             s.member_id, m.login_id AS member_login_id, m.name AS member_name
      FROM search_log s
      LEFT JOIN member m ON m.id = s.member_id
      ${whereClause}
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM search_log s ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  // ─── 인기검색어 순위 (search_popular_daily) ────────────────
  async popularRanking(filter: { date?: string; days?: number }) {
    const days = Math.min(90, Math.max(1, Math.trunc(filter.days ?? 7)));
    const items = await this.sql`
      SELECT word,
             SUM(search_count)::int AS total_count,
             MAX(log_date) AS last_date
      FROM search_popular_daily
      WHERE log_date >= (CURRENT_DATE - (${days}::int || ' days')::interval)::date
      GROUP BY word
      ORDER BY total_count DESC, word ASC
      LIMIT 100
    `;
    return { items, days };
  }

  // ─── 댓글 통합 (post_comment) ────────────────────────────
  async commentsAll(filter: { q?: string; board_slug?: string; fr_date?: string; to_date?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 30)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(c.content ILIKE ${q} OR m.login_id ILIKE ${q} OR m.name ILIKE ${q})`);
    }
    if (filter.board_slug) conds.push(this.sql`c.board_slug = ${filter.board_slug}`);
    if (filter.fr_date) conds.push(this.sql`c.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    if (filter.to_date) conds.push(this.sql`c.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);

    const whereClause = conds.length === 0 ? this.sql`` : conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``,
    );

    const items = await this.sql`
      SELECT c.id, c.board_slug, c.post_id, c.parent_id, c.member_id, c.content,
             c.like_count, c.dislike_count, c.is_secret, c.created_at,
             m.login_id AS member_login_id, m.name AS member_name, m.nickname AS member_nickname,
             c.author_name
      FROM post_comment c
      LEFT JOIN member m ON m.id = c.member_id
      ${whereClause}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM post_comment c LEFT JOIN member m ON m.id = c.member_id ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  async removeComment(id: number) {
    const r = await this.sql`DELETE FROM post_comment WHERE id = ${id}`;
    if (r.count === 0) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    return { ok: true };
  }

  // ─── 글/댓글 게시판별 통계 ────────────────────────────
  async postsOverview() {
    const results: { slug: string; post_count: number; comment_count: number; latest_at: string | null }[] = [];
    for (const table of POST_TABLES) {
      try {
        const tableSql = this.sql.unsafe(table);
        const slug = table.replace(/^post_/, '');
        const postRows = await this.sql<{ cnt: string; latest_at: string | null }[]>`
          SELECT count(*)::text AS cnt, MAX(created_at)::text AS latest_at FROM ${tableSql}
        `;
        const commentRows = await this.sql<{ cnt: string }[]>`
          SELECT count(*)::text AS cnt FROM post_comment WHERE board_slug = ${slug}
        `;
        results.push({
          slug,
          post_count: Number(postRows[0].cnt),
          comment_count: Number(commentRows[0].cnt),
          latest_at: postRows[0].latest_at,
        });
      } catch {
        // 테이블 없으면 skip
      }
    }
    return { items: results.sort((a, b) => b.post_count - a.post_count) };
  }

  // ─── 신고 (post_report) ────────────────────────────
  async reports(filter: { status?: number; board_slug?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 30)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.status !== undefined) conds.push(this.sql`r.status = ${filter.status}`);
    if (filter.board_slug) conds.push(this.sql`r.board_slug = ${filter.board_slug}`);
    const whereClause = conds.length === 0 ? this.sql`` : conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``,
    );

    const items = await this.sql`
      SELECT r.id, r.board_slug, r.post_id, r.reporter_id, r.target_member_id,
             r.mode, r.reason, r.status, r.created_at,
             rep.login_id AS reporter_login_id, rep.name AS reporter_name,
             tgt.login_id AS target_login_id, tgt.name AS target_name
      FROM post_report r
      LEFT JOIN member rep ON rep.id = r.reporter_id
      LEFT JOIN member tgt ON tgt.id = r.target_member_id
      ${whereClause}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM post_report r ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  async updateReportStatus(id: number, status: number) {
    const r = await this.sql`UPDATE post_report SET status = ${status} WHERE id = ${id}`;
    if (r.count === 0) throw new NotFoundException('신고를 찾을 수 없습니다.');
    return { ok: true };
  }
}
