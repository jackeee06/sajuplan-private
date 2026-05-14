import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicNoticeListItem {
  id: number;
  title: string;
  category: string | null;
  is_pinned: boolean;
  /** 최근 7일 이내 작성 — UI 의 "New" 뱃지 노출용 */
  is_new: boolean;
  view_count: number;
  created_at: string;
}

export interface PublicNoticeDetail {
  id: number;
  title: string;
  content: string;
  category: string | null;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 사용자 공지사항 공개 조회.
 * 비밀글(`is_secret = true`) 제외. 고정 공지 우선 정렬.
 */
@Injectable()
export class UserNoticesService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 리스트 조회.
   * @param page  1-based, 기본 1
   * @param limit 1~50, 기본 10
   * @param category 카테고리 정확 일치 (생략 시 전체)
   * @param q 제목 ILIKE 검색 (생략 시 전체)
   */
  async list(params: {
    page?: number;
    limit?: number;
    category?: string;
    q?: string;
  }): Promise<{ items: PublicNoticeListItem[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 10)));
    const offset = (page - 1) * limit;
    const cat = (params.category ?? '').trim();
    const q = (params.q ?? '').trim();

    const conds: ReturnType<Sql>[] = [this.sql`is_secret = false`];
    if (cat) conds.push(this.sql`category = ${cat}`);
    if (q) conds.push(this.sql`title ILIKE ${'%' + q + '%'}`);

    const whereClause = conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`),
      this.sql``,
    );

    type Row = {
      id: number;
      title: string;
      category: string | null;
      is_pinned: boolean;
      view_count: number;
      created_at: Date;
    };

    const rows = await this.sql<Row[]>`
      SELECT id, title, category, is_pinned, view_count, created_at
        FROM post_notice
        ${whereClause}
       ORDER BY is_pinned DESC, created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM post_notice ${whereClause}
    `;

    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const items: PublicNoticeListItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      is_pinned: r.is_pinned,
      is_new: new Date(r.created_at).getTime() >= sevenDaysAgo,
      view_count: r.view_count,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    }));

    return { items, total: Number(totalRows[0]?.count ?? 0), page, limit };
  }

  /** 단건 조회 — 조회수 +1 (비동기 fire-and-forget). 비밀글은 404. */
  async detail(id: number): Promise<PublicNoticeDetail> {
    type Row = {
      id: number;
      title: string;
      content: string | null;
      category: string | null;
      is_pinned: boolean;
      view_count: number;
      created_at: Date;
      updated_at: Date;
    };

    const rows = await this.sql<Row[]>`
      SELECT id, title, content, category, is_pinned, view_count,
             created_at, updated_at
        FROM post_notice
       WHERE id = ${id} AND is_secret = false
       LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }

    // 조회수 증가 — 결과 응답을 막지 않도록 await
    await this.sql`UPDATE post_notice SET view_count = view_count + 1 WHERE id = ${id}`;

    const r = rows[0];
    return {
      id: r.id,
      title: r.title,
      content: r.content ?? '',
      category: r.category,
      is_pinned: r.is_pinned,
      view_count: r.view_count + 1,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      updated_at:
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : String(r.updated_at),
    };
  }

  /** 사용 가능한 카테고리 목록 — 필터 드롭다운용. */
  async categories(): Promise<string[]> {
    const rows = await this.sql<{ category: string | null }[]>`
      SELECT DISTINCT category FROM post_notice
       WHERE is_secret = false AND category IS NOT NULL AND category <> ''
       ORDER BY category
    `;
    return rows.map((r) => r.category!).filter((c): c is string => !!c);
  }
}
