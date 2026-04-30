import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/shop_admin/couponlist.php (메뉴 350510 "쿠폰관리") 정확 매핑.
 *
 *   FROM g5_shop_coupon         →  FROM coupon c
 *   cp_no       → c.cp_no (레거시)
 *   cp_id       → c.cp_id (코드)
 *   mb_id       → c.mb_id / c.member_id (회원 FK)
 *   cp_subject  → c.title
 *   cp_method   → c.method (0=상품할인 1=카테고리 2=주문금액 3=배송비 4=포인트)
 *   cp_target   → c.target
 *   cp_start    → c.starts_at
 *   cp_end      → c.ends_at
 *   cp_datetime → c.created_at
 *   사용횟수    → coupon_history JOIN COUNT
 *
 * 검색: mb_id (정확), 그 외 like '%stx%'
 * 기간: cp_datetime (created_at)
 */

export interface CouponRow {
  id: number;
  cp_no: number | null;
  cp_id: string | null;
  member_id: number | null;
  mb_id: string | null;
  login_id: string | null;
  member_name: string | null;
  title: string;
  method: number;
  target: string | null;
  starts_at: string | null;
  ends_at: string | null;
  discount_value: number;
  discount_type: number;
  is_visible: boolean;
  used_count: number;
  created_at: string;
}

export type CouponSfl = 'mb_id' | 'cp_id' | 'cp_subject';

export interface CouponFilter {
  sfl?: CouponSfl;
  stx?: string;
  fr_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface CouponInput {
  cp_id: string;
  member_id?: number | null;
  mb_id?: string | null;
  title: string;
  method: number;
  target?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  discount_value?: number;
  discount_type?: number;
  min_amount?: number;
  max_amount?: number;
  is_visible?: boolean;
}

@Injectable()
export class CouponsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findAll(filter: CouponFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.stx) {
      const q = `%${filter.stx}%`;
      switch (filter.sfl) {
        case 'mb_id':
          conds.push(this.sql`(c.mb_id ILIKE ${q} OR m.login_id ILIKE ${q} OR m.name ILIKE ${q})`);
          break;
        case 'cp_id':
          conds.push(this.sql`c.cp_id ILIKE ${q}`);
          break;
        case 'cp_subject':
          conds.push(this.sql`c.title ILIKE ${q}`);
          break;
        default:
          conds.push(this.sql`(c.cp_id ILIKE ${q} OR c.title ILIKE ${q} OR m.login_id ILIKE ${q})`);
      }
    }
    if (filter.fr_date) conds.push(this.sql`c.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    if (filter.to_date) conds.push(this.sql`c.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    const items = await this.sql<CouponRow[]>`
      SELECT
        c.id, c.cp_no, c.cp_id, c.member_id, c.mb_id,
        c.title, c.method, c.target,
        c.starts_at, c.ends_at, c.discount_value, c.discount_type,
        c.is_visible, c.created_at,
        m.login_id, m.name AS member_name,
        (SELECT count(*)::int FROM coupon_history h WHERE h.coupon_id = c.id) AS used_count
      FROM coupon c
      LEFT JOIN member m ON m.id = c.member_id
      ${whereClause}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM coupon c LEFT JOIN member m ON m.id = c.member_id ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  async getById(id: number): Promise<CouponRow> {
    const rows = await this.sql<CouponRow[]>`
      SELECT
        c.*, m.login_id, m.name AS member_name,
        (SELECT count(*)::int FROM coupon_history h WHERE h.coupon_id = c.id) AS used_count
      FROM coupon c
      LEFT JOIN member m ON m.id = c.member_id
      WHERE c.id = ${id} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: CouponInput) {
    if (!input.cp_id?.trim()) throw new BadRequestException('쿠폰코드는 필수입니다.');
    if (!input.title?.trim()) throw new BadRequestException('쿠폰이름은 필수입니다.');
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO coupon (
        cp_id, member_id, mb_id, title, method, target,
        starts_at, ends_at, discount_value, discount_type,
        min_amount, max_amount, is_visible
      ) VALUES (
        ${input.cp_id.trim()}, ${input.member_id ?? null}, ${input.mb_id ?? null},
        ${input.title.trim()}, ${input.method ?? 0}, ${input.target ?? null},
        ${input.starts_at ?? null}, ${input.ends_at ?? null},
        ${input.discount_value ?? 0}, ${input.discount_type ?? 0},
        ${input.min_amount ?? 0}, ${input.max_amount ?? 0},
        ${input.is_visible ?? true}
      )
      RETURNING id
    `;
    return this.getById(rows[0].id);
  }

  async update(id: number, input: Partial<CouponInput>) {
    const cur = await this.getById(id);
    await this.sql`
      UPDATE coupon SET
        cp_id = ${input.cp_id?.trim() ?? cur.cp_id},
        member_id = ${input.member_id !== undefined ? input.member_id : cur.member_id},
        mb_id = ${input.mb_id !== undefined ? input.mb_id : cur.mb_id},
        title = ${input.title?.trim() ?? cur.title},
        method = ${input.method ?? cur.method},
        target = ${input.target !== undefined ? input.target : cur.target},
        starts_at = ${input.starts_at !== undefined ? input.starts_at : cur.starts_at},
        ends_at = ${input.ends_at !== undefined ? input.ends_at : cur.ends_at},
        discount_value = ${input.discount_value ?? cur.discount_value},
        discount_type = ${input.discount_type ?? cur.discount_type},
        is_visible = ${input.is_visible ?? cur.is_visible}
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  async remove(id: number) {
    const result = await this.sql`DELETE FROM coupon WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    return { ok: true };
  }
}
