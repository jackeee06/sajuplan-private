import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/shop_admin/couponzonelist.php (메뉴 350520 "쿠폰존관리") 정확 매핑.
 *
 * 컬럼: 쿠폰이름 / 쿠폰종류(cz_type) / 적용대상(cp_method) / 포인트추가금액(cz_point + cp_type)
 *      / 쿠폰번호(cp_id) / 쿠폰사용기한(cz_period일) / 다운로드(cz_download) / 사용기한(cz_start~cz_end)
 *
 * 검색: cz_subject like '%stx%'
 */

export interface CouponZoneRow {
  id: number;
  cz_id: number | null;
  subject: string;
  cz_type: number;
  cp_method: number;
  cp_target: string | null;
  cz_point: number;
  cp_type: boolean;
  cp_id: string | null;
  cz_period: number;
  cz_download: number;
  cz_start: string | null;
  cz_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponZoneInput {
  subject: string;
  cz_type: number;
  cp_method: number;
  cp_target?: string | null;
  cz_point: number;
  cp_type?: boolean;
  cp_id?: string | null;
  cz_period?: number;
  cz_start?: string | null;
  cz_end?: string | null;
  is_active?: boolean;
}

@Injectable()
export class CouponZonesService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findAll(stx?: string, page = 1, limit = 20) {
    const safePage = Math.max(1, Math.trunc(page));
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const offset = (safePage - 1) * safeLimit;

    const whereClause = stx
      ? this.sql`WHERE subject ILIKE ${'%' + stx + '%'}`
      : this.sql``;

    const items = await this.sql<CouponZoneRow[]>`
      SELECT * FROM coupon_zone
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM coupon_zone ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page: safePage, limit: safeLimit };
  }

  async getById(id: number): Promise<CouponZoneRow> {
    const rows = await this.sql<CouponZoneRow[]>`SELECT * FROM coupon_zone WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) throw new NotFoundException('쿠폰존을 찾을 수 없습니다.');
    return rows[0];
  }

  async create(input: CouponZoneInput) {
    if (!input.subject?.trim()) throw new BadRequestException('쿠폰이름은 필수입니다.');
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO coupon_zone (
        subject, cz_type, cp_method, cp_target, cz_point, cp_type, cp_id,
        cz_period, cz_start, cz_end, is_active
      ) VALUES (
        ${input.subject.trim()}, ${input.cz_type ?? 0}, ${input.cp_method ?? 0},
        ${input.cp_target ?? null}, ${input.cz_point ?? 0}, ${input.cp_type ?? false},
        ${input.cp_id ?? null}, ${input.cz_period ?? 0},
        ${input.cz_start ?? null}, ${input.cz_end ?? null}, ${input.is_active ?? true}
      ) RETURNING id
    `;
    return this.getById(rows[0].id);
  }

  async update(id: number, input: Partial<CouponZoneInput>) {
    const cur = await this.getById(id);
    await this.sql`
      UPDATE coupon_zone SET
        subject = ${input.subject?.trim() ?? cur.subject},
        cz_type = ${input.cz_type ?? cur.cz_type},
        cp_method = ${input.cp_method ?? cur.cp_method},
        cp_target = ${input.cp_target !== undefined ? input.cp_target : cur.cp_target},
        cz_point = ${input.cz_point ?? cur.cz_point},
        cp_type = ${input.cp_type ?? cur.cp_type},
        cp_id = ${input.cp_id !== undefined ? input.cp_id : cur.cp_id},
        cz_period = ${input.cz_period ?? cur.cz_period},
        cz_start = ${input.cz_start !== undefined ? input.cz_start : cur.cz_start},
        cz_end = ${input.cz_end !== undefined ? input.cz_end : cur.cz_end},
        is_active = ${input.is_active ?? cur.is_active},
        updated_at = now()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  async remove(id: number) {
    const result = await this.sql`DELETE FROM coupon_zone WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('쿠폰존을 찾을 수 없습니다.');
    return { ok: true };
  }
}
