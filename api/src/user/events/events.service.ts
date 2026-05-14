import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { wrapImgsWithWebp } from '../../shared/common/wrap-img-webp';

export type EventStatus = 'active' | 'ended' | 'upcoming';

export interface PublicEventListItem {
  id: number;
  title: string;
  thumbnail_url: string | null;
  thumbnail_url_webp: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: EventStatus;
}

export interface PublicEventDetail extends PublicEventListItem {
  content: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * 사용자 이벤트 공개 조회.
 *
 * 정책:
 * - 진행중(active): (starts_at IS NULL OR starts_at <= now())
 *                AND (ends_at IS NULL OR ends_at >= now())
 * - 종료(ended)  : ends_at IS NOT NULL AND ends_at < now()
 * - 예정(upcoming): starts_at IS NOT NULL AND starts_at > now()
 *
 * 마이페이지 이벤트 리스트는 진행중을 먼저, 종료를 뒤로 노출 (status 별 정렬).
 */
@Injectable()
export class UserEventsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async list(params: {
    page?: number;
    limit?: number;
    status?: EventStatus;
  }): Promise<{
    items: PublicEventListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (params.status === 'active') {
      conds.push(this.sql`(starts_at IS NULL OR starts_at <= now())`);
      conds.push(this.sql`(ends_at IS NULL OR ends_at >= now())`);
    } else if (params.status === 'ended') {
      conds.push(this.sql`ends_at IS NOT NULL AND ends_at < now()`);
    } else if (params.status === 'upcoming') {
      conds.push(this.sql`starts_at IS NOT NULL AND starts_at > now()`);
    }

    const whereClause =
      conds.length === 0
        ? this.sql``
        : conds.reduce(
            (acc, c, i) =>
              i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`,
            this.sql``,
          );

    type Row = {
      id: number;
      title: string;
      thumbnail_url: string | null;
      thumbnail_url_webp: string | null;
      starts_at: Date | null;
      ends_at: Date | null;
      status: EventStatus;
    };

    // status 계산 + 정렬: active(0) → upcoming(1) → ended(2), 그 안에서 시작일 내림차순.
    const rows = await this.sql<Row[]>`
      SELECT id, title, thumbnail_url, thumbnail_url_webp, starts_at, ends_at,
             CASE
               WHEN ends_at IS NOT NULL AND ends_at < now() THEN 'ended'
               WHEN starts_at IS NOT NULL AND starts_at > now() THEN 'upcoming'
               ELSE 'active'
             END AS status
        FROM post_event
        ${whereClause}
       ORDER BY CASE
                  WHEN ends_at IS NOT NULL AND ends_at < now() THEN 2
                  WHEN starts_at IS NOT NULL AND starts_at > now() THEN 1
                  ELSE 0
                END,
                COALESCE(starts_at, created_at) DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM post_event ${whereClause}
    `;

    const items: PublicEventListItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      thumbnail_url: r.thumbnail_url,
      thumbnail_url_webp: r.thumbnail_url_webp,
      starts_at: toIso(r.starts_at),
      ends_at: toIso(r.ends_at),
      status: r.status,
    }));

    return {
      items,
      total: Number(totalRows[0]?.count ?? 0),
      page,
      limit,
    };
  }

  async detail(id: number): Promise<PublicEventDetail> {
    type Row = {
      id: number;
      title: string;
      content: string | null;
      thumbnail_url: string | null;
      thumbnail_url_webp: string | null;
      starts_at: Date | null;
      ends_at: Date | null;
      view_count: number;
      created_at: Date;
      updated_at: Date;
      status: EventStatus;
    };

    const rows = await this.sql<Row[]>`
      SELECT id, title, content, thumbnail_url, thumbnail_url_webp,
             starts_at, ends_at, view_count, created_at, updated_at,
             CASE
               WHEN ends_at IS NOT NULL AND ends_at < now() THEN 'ended'
               WHEN starts_at IS NOT NULL AND starts_at > now() THEN 'upcoming'
               ELSE 'active'
             END AS status
        FROM post_event
       WHERE id = ${id}
       LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('이벤트를 찾을 수 없습니다.');
    }

    await this.sql`UPDATE post_event SET view_count = view_count + 1 WHERE id = ${id}`;

    const r = rows[0];
    const content = await wrapImgsWithWebp(r.content);
    return {
      id: r.id,
      title: r.title,
      content,
      thumbnail_url: r.thumbnail_url,
      thumbnail_url_webp: r.thumbnail_url_webp,
      starts_at: toIso(r.starts_at),
      ends_at: toIso(r.ends_at),
      view_count: r.view_count + 1,
      created_at: toIso(r.created_at) ?? '',
      updated_at: toIso(r.updated_at) ?? '',
      status: r.status,
    };
  }
}

function toIso(v: Date | string | null): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
