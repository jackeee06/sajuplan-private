import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/bannerlist.php + bannerform.php (메뉴 350600 "배너관리") 정확 매핑.
 *
 *   원본 g5_shop_banner → 신규 shop_banner
 *     bn_id        → bn_id (레거시), id (신규 PK)
 *     bn_position  → position (출력 위치 enum)
 *     bn_alt       → title (이미지 설명)
 *     bn_url       → link_url (링크)
 *     bn_bimg      → image_url (이미지 URL)
 *     bn_begin_time → starts_at
 *     bn_end_time  → ends_at
 *     bn_order     → display_order
 *     hit          → hit_count
 *
 *   위치 enum (16개):
 *     회원가입완료 / 메인-상단배너 / 메인-중앙배너 /
 *     로그인-상단띠배너 / 마이페이지 / 일반-상담후기 / 일반-이용안내 /
 *     일반-상담사신청 / 상담사-코인내역 / 상담사-공지사항 /
 *     이벤트1 / 이벤트2 / 이벤트3 / 오늘의운세 /
 *     소원다락방-상단 / 소원다락방-하단 / 사주문의길
 *
 *   ※ 변경 이력:
 *     - '메인-비주얼' → '메인-상단배너' 명칭 변경 (사용자 메인 페이지의 메인 배너)
 *     - '메인-상단띠배너' 삭제
 */

export const BANNER_POSITIONS = [
  '회원가입완료',
  '메인-상단배너',
  '메인-중앙배너',
] as const;

export interface BannerRow {
  id: number;
  bn_id: number | null;
  position: string | null;
  title: string | null;
  link_url: string | null;
  image_url: string | null;
  image_url_webp: string | null;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  hit_count: number;
  created_at: string;
}

export interface BannerInput {
  position: string;
  title?: string | null;
  link_url?: string | null;
  image_url?: string | null;
  image_url_webp?: string | null;
  display_order?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
}

export interface BannerFilter {
  position?: string;
  status?: 'all' | 'ing' | 'end';
  page?: number;
  limit?: number;
}

@Injectable()
export class BannersService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findAll(filter: BannerFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 50)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.position) conds.push(this.sql`position = ${filter.position}`);
    if (filter.status === 'ing') conds.push(this.sql`(starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())`);
    if (filter.status === 'end') conds.push(this.sql`ends_at IS NOT NULL AND ends_at < now()`);

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    const items = await this.sql<BannerRow[]>`
      SELECT id, bn_id, position, title, link_url, image_url, image_url_webp,
             display_order, starts_at, ends_at, is_active, hit_count, created_at
      FROM shop_banner
      ${whereClause}
      ORDER BY display_order ASC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM shop_banner ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  async getById(id: number): Promise<BannerRow> {
    const rows = await this.sql<BannerRow[]>`SELECT * FROM shop_banner WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) throw new NotFoundException('배너를 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: BannerInput) {
    if (!input.position?.trim()) throw new BadRequestException('출력 위치는 필수입니다.');
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO shop_banner (
        position, title, link_url, image_url, image_url_webp,
        display_order, starts_at, ends_at, is_active
      )
      VALUES (
        ${input.position}, ${input.title ?? null}, ${input.link_url ?? null},
        ${input.image_url ?? null}, ${input.image_url_webp ?? null},
        ${input.display_order ?? 0}, ${input.starts_at ?? null}, ${input.ends_at ?? null}, ${input.is_active ?? true}
      ) RETURNING id
    `;
    return this.getById(rows[0].id);
  }

  async update(id: number, input: Partial<BannerInput>) {
    const cur = await this.getById(id);
    await this.sql`
      UPDATE shop_banner SET
        position = ${input.position ?? cur.position},
        title = ${input.title !== undefined ? input.title : cur.title},
        link_url = ${input.link_url !== undefined ? input.link_url : cur.link_url},
        image_url = ${input.image_url !== undefined ? input.image_url : cur.image_url},
        image_url_webp = ${input.image_url_webp !== undefined ? input.image_url_webp : cur.image_url_webp},
        display_order = ${input.display_order ?? cur.display_order},
        starts_at = ${input.starts_at !== undefined ? input.starts_at : cur.starts_at},
        ends_at = ${input.ends_at !== undefined ? input.ends_at : cur.ends_at},
        is_active = ${input.is_active ?? cur.is_active}
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  async remove(id: number) {
    const result = await this.sql`DELETE FROM shop_banner WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('배너를 찾을 수 없습니다.');
    return { ok: true };
  }
}
