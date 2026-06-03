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
  qa_counselor: { table: 'counselor_qna' }, // 새 테이블 — 별도 쿼리 분기
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
  /** 신고 누적 (2026-05-15) — review slug 응답에만 포함 */
  report_count?: number;
  /** 미처리(pending) 신고 — review slug 응답에만 포함 */
  report_pending_count?: number;
  // qa_counselor 전용
  is_hidden?: boolean;
  has_reply?: boolean;
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
    // counselor_qna 는 별도 테이블 구조 — 전용 쿼리
    if (slug === 'qa_counselor') return this.findAllCounselorQna(filter);

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
                 c.name AS counselor_name,
                 -- 후기 신고 카운트 (2026-05-15) — 미처리(pending) 와 전체 분리해서 UI 에 노출
                 COALESCE((SELECT COUNT(*) FROM post_review_report rr WHERE rr.review_id = p.id), 0)::int AS report_count,
                 COALESCE((SELECT COUNT(*) FROM post_review_report rr WHERE rr.review_id = p.id AND rr.status = 'pending'), 0)::int AS report_pending_count
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

  /** counselor_qna 전용 목록 — qa_counselor slug */
  private async findAllCounselorQna(filter: PostFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(q.title ILIKE ${q} OR q.content ILIKE ${q} OR m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
    }
    if (filter.fr_date) conds.push(this.sql`q.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    if (filter.to_date) conds.push(this.sql`q.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);
    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    const items = await this.sql<PostRow[]>`
      SELECT q.id,
             NULL::bigint AS wr_id,
             q.member_id,
             m.mb_id,
             m.name      AS member_name,
             m.nickname  AS member_nickname,
             q.title,
             q.content,
             'counselor' AS category,
             0           AS view_count,
             0           AS like_count,
             0           AS dislike_count,
             q.is_secret,
             q.is_hidden,
             FALSE       AS has_file,
             NULL        AS ip,
             '{}'::jsonb AS extras,
             q.created_at,
             q.counselor_id,
             c.name      AS counselor_name,
             (SELECT r.id FROM counselor_qna_reply r WHERE r.qna_id = q.id LIMIT 1) IS NOT NULL AS has_reply
        FROM counselor_qna q
        LEFT JOIN member m ON m.id = q.member_id
        LEFT JOIN member c ON c.id = q.counselor_id
        ${whereClause}
        ORDER BY q.created_at DESC, q.id DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM counselor_qna q
        LEFT JOIN member m ON m.id = q.member_id
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

  /**
   * 어드민 1:1 문의 답변 (Phase 12).
   *
   * 답변은 post_qa.extras.admin_reply 필드에 박제:
   *   { content, replied_at, replied_by, replied_by_id }
   *
   * 동일 게시글에 새 답변이 오면 덮어쓰기 (수정). 이력은 별도로 안 남김 — 운영팀 1회성 응대 가정.
   * 추후 수정 이력 필요해지면 admin_reply_history 배열로 확장.
   */
  async replyToQa(
    slug: string,
    id: number,
    content: string,
    adminId: number,
    adminName?: string,
  ) {
    if (slug !== 'qa' && slug !== 'qa_counselor') {
      throw new BadRequestException('답변은 1:1 문의(qa / qa_counselor)에서만 가능합니다.');
    }
    if (!content || !content.trim()) {
      throw new BadRequestException('답변 내용을 입력하세요.');
    }
    const reply = {
      content: content.trim(),
      replied_at: new Date().toISOString(),
      replied_by: adminName ?? `admin:${adminId}`,
      replied_by_id: adminId,
    };
    const result = await this.sql`
      UPDATE post_qa
         SET extras = COALESCE(extras, '{}'::jsonb) || jsonb_build_object('admin_reply', ${this.sql.json(reply)}::jsonb),
             updated_at = now()
       WHERE id = ${id}
    `;
    if (result.count === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    return { ok: true, reply };
  }

  /** 어드민 답변 삭제 — extras.admin_reply 제거. */
  async deleteQaReply(slug: string, id: number) {
    if (slug !== 'qa' && slug !== 'qa_counselor') {
      throw new BadRequestException('1:1 문의에서만 가능합니다.');
    }
    const result = await this.sql`
      UPDATE post_qa
         SET extras = extras - 'admin_reply',
             updated_at = now()
       WHERE id = ${id}
    `;
    if (result.count === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // 후기 신고 관리 (2026-05-15 신설) — post_review_report 테이블
  // ─────────────────────────────────────────────────────────────────

  /** 후기 신고 목록 — status 필터 + 페이지네이션. 후기 제목·신고자 닉네임 함께 반환. */
  async listReports(filter: { status?: string; page: number; limit: number }) {
    const page = Math.max(1, filter.page);
    const limit = Math.min(100, Math.max(1, filter.limit));
    const offset = (page - 1) * limit;
    const statusFilter = filter.status && filter.status !== 'all' ? filter.status : null;

    const rows = await this.sql<{
      id: number;
      review_id: number;
      reporter_member_id: number;
      reason_category: string;
      reason: string | null;
      status: string;
      admin_memo: string | null;
      created_at: Date;
      resolved_at: Date | null;
      review_title: string | null;
      reporter_nickname: string | null;
      reporter_mb_id: string | null;
    }[]>`
      SELECT rr.id, rr.review_id, rr.reporter_member_id, rr.reason_category, rr.reason,
             rr.status, rr.admin_memo, rr.created_at, rr.resolved_at,
             pr.title AS review_title,
             m.nickname AS reporter_nickname, m.mb_id AS reporter_mb_id
        FROM post_review_report rr
        LEFT JOIN post_review pr ON pr.id = rr.review_id
        LEFT JOIN member m ON m.id = rr.reporter_member_id
       WHERE ${statusFilter ? this.sql`rr.status = ${statusFilter}` : this.sql`TRUE`}
       ORDER BY rr.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM post_review_report
       WHERE ${statusFilter ? this.sql`status = ${statusFilter}` : this.sql`TRUE`}
    `;

    return {
      items: rows,
      total: Number(totalRows[0]?.count ?? 0),
      page,
      limit,
    };
  }

  /** 신고 단건 — 후기 본문/작성자도 함께. */
  async getReportById(id: number) {
    const rows = await this.sql<{
      id: number;
      review_id: number;
      reporter_member_id: number;
      reason_category: string;
      reason: string | null;
      status: string;
      admin_memo: string | null;
      created_at: Date;
      resolved_at: Date | null;
      resolved_by: number | null;
      review_title: string | null;
      review_content: string | null;
      review_member_id: number | null;
      review_member_nickname: string | null;
      review_member_mb_id: string | null;
      reporter_nickname: string | null;
      reporter_mb_id: string | null;
    }[]>`
      SELECT rr.id, rr.review_id, rr.reporter_member_id, rr.reason_category, rr.reason,
             rr.status, rr.admin_memo, rr.created_at, rr.resolved_at, rr.resolved_by,
             pr.title AS review_title, pr.content AS review_content, pr.member_id AS review_member_id,
             rm.nickname AS review_member_nickname, rm.mb_id AS review_member_mb_id,
             m.nickname AS reporter_nickname, m.mb_id AS reporter_mb_id
        FROM post_review_report rr
        LEFT JOIN post_review pr ON pr.id = rr.review_id
        LEFT JOIN member rm ON rm.id = pr.member_id
        LEFT JOIN member m ON m.id = rr.reporter_member_id
       WHERE rr.id = ${id}
       LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('신고를 찾을 수 없습니다.');
    return rows[0];
  }

  /**
   * 신고 처리.
   *  - status 변경: 'pending'/'reviewed'/'hidden'/'dismissed'
   *  - 'hidden' 으로 변경 시 어드민이 해당 후기를 별도로 삭제하거나 숨김 처리 필요 (이 API 는 신고 상태만 변경)
   *  - resolved_at/resolved_by 자동 세팅 (pending 외 상태로 갈 때)
   */
  async updateReportStatus(
    id: number,
    adminId: number,
    input: { status?: string; admin_memo?: string | null },
  ) {
    const allowedStatus = new Set(['pending', 'reviewed', 'hidden', 'dismissed']);
    const updates: Record<string, unknown> = {};
    if (input.status !== undefined) {
      if (!allowedStatus.has(input.status)) {
        throw new BadRequestException('status 값이 유효하지 않습니다.');
      }
      updates.status = input.status;
      if (input.status !== 'pending') {
        updates.resolved_at = new Date();
        updates.resolved_by = adminId;
      } else {
        updates.resolved_at = null;
        updates.resolved_by = null;
      }
    }
    if (input.admin_memo !== undefined) updates.admin_memo = input.admin_memo;
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('변경할 필드가 없습니다.');
    }
    const r = await this.sql`
      UPDATE post_review_report SET ${this.sql(updates)} WHERE id = ${id}
    `;
    if (r.count === 0) throw new NotFoundException('신고를 찾을 수 없습니다.');
    return this.getReportById(id);
  }
}
