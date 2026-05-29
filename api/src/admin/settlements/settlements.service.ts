import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/settlement_list.php (메뉴 350450 "정산이력") 정확 매핑.
 *
 *   FROM g5_point_end                    →  FROM settlement_monthly s
 *   JOIN g5_member (회원정보)            →  LEFT JOIN member m ON m.id = s.member_id
 *
 *   컬럼:
 *     mb_id         → m.mb_id (or s.mb_id)
 *     mb_name       → m.name
 *     mb_nick       → m.nickname
 *     mb_19         → m.free_royalty_pct  (무료R%)
 *     mb_20         → m.paid_royalty_pct  (유료R%)
 *     month         → s.month
 *     price_free    → s.price_free
 *     price_paid    → s.price_paid
 *     price_other   → s.price_other
 *     price_tot     → s.price_tot
 *     vat_amount    → s.vat_amount
 *     withholding_tax → s.withholding_tax
 *     reply_fee     → s.reply_fee
 *     price         → s.price
 *
 *   검색 (sfl=mb_id, like '%stx%')
 *   기간 (month between fr_yyyy-mm and to_yyyy-mm)
 */

export interface SettlementRow {
  id: number;
  no: number | null;
  member_id: number | null;
  mb_id: string | null;
  member_name: string | null;
  member_nickname: string | null;
  free_royalty_pct: number | null;
  paid_royalty_pct: number | null;
  month: string;
  kind: string | null;
  price_free: number;
  price_paid: number;
  price_other: number;
  price_tot: number;
  vat_amount: number;
  withholding_tax: number;
  reply_fee: number;
  price: number;
  wr_datetime: string | null;
  created_at: string;
  status: 'calculated' | 'paid' | 'voided';
  paid_at: string | null;
  paid_by_id: number | null;
  voided_at: string | null;
  voided_by_id: number | null;
  void_reason: string | null;
}

export type SettlementSfl = 'mb_id' | 'kind';

export interface SettlementFilter {
  sfl?: SettlementSfl;
  stx?: string;
  fr_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SettlementsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async findAll(filter: SettlementFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.stx) {
      const q = `%${filter.stx}%`;
      switch (filter.sfl) {
        case 'kind':
          conds.push(this.sql`s.kind = ${filter.stx}`);
          break;
        case 'mb_id':
        default:
          conds.push(this.sql`(s.mb_id ILIKE ${q} OR m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
      }
    }
    if (filter.fr_date && filter.to_date) {
      // sample: month between substr(fr_date,0,7) and substr(to_date,0,7)
      conds.push(this.sql`s.month BETWEEN ${filter.fr_date.slice(0, 7)} AND ${filter.to_date.slice(0, 7)}`);
    } else if (filter.fr_date) {
      conds.push(this.sql`s.month >= ${filter.fr_date.slice(0, 7)}`);
    } else if (filter.to_date) {
      conds.push(this.sql`s.month <= ${filter.to_date.slice(0, 7)}`);
    }

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce(
          (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`),
          this.sql``,
        );

    const items = await this.sql<SettlementRow[]>`
      SELECT
        s.id, s.no, s.member_id, s.mb_id, s.month, s.kind,
        s.price_free, s.price_paid, s.price_other, s.price_tot,
        s.vat_amount, s.withholding_tax, s.reply_fee, s.price,
        s.wr_datetime, s.created_at,
        s.status, s.paid_at, s.paid_by_id,
        s.voided_at, s.voided_by_id, s.void_reason,
        m.mb_id, m.name AS member_name, m.nickname AS member_nickname,
        m.free_royalty_pct, m.paid_royalty_pct
      FROM settlement_monthly s
      LEFT JOIN member m ON m.id = s.member_id OR m.mb_id = s.mb_id
      ${whereClause}
      ORDER BY s.wr_datetime DESC NULLS LAST, s.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM settlement_monthly s
      LEFT JOIN member m ON m.id = s.member_id OR m.mb_id = s.mb_id
      ${whereClause}
    `;

    const sumRows = await this.sql<{
      total_price: string;
      total_price_tot: string;
      total_vat: string;
      total_withholding: string;
      total_reply_fee: string;
    }[]>`
      SELECT
        COALESCE(SUM(s.price), 0)::text AS total_price,
        COALESCE(SUM(s.price_tot), 0)::text AS total_price_tot,
        COALESCE(SUM(s.vat_amount), 0)::text AS total_vat,
        COALESCE(SUM(s.withholding_tax), 0)::text AS total_withholding,
        COALESCE(SUM(s.reply_fee), 0)::text AS total_reply_fee
      FROM settlement_monthly s
      LEFT JOIN member m ON m.id = s.member_id OR m.mb_id = s.mb_id
      ${whereClause}
    `;

    return {
      items,
      total: Number(totalRows[0].cnt),
      page,
      limit,
      summary: {
        total_price: Number(sumRows[0].total_price),
        total_price_tot: Number(sumRows[0].total_price_tot),
        total_vat: Number(sumRows[0].total_vat),
        total_withholding: Number(sumRows[0].total_withholding),
        total_reply_fee: Number(sumRows[0].total_reply_fee),
      },
    };
  }

  /**
   * 정산 row 를 "지급완료" 로 마킹 — 사장님이 통장 송금 후 호출.
   * 2026-05-29 신설. status 'calculated' → 'paid' 단방향.
   * voided 상태는 마킹 불가 (사고 정정 후 새 row 필요).
   */
  async markPaid(id: number, adminId: number) {
    const rows = await this.sql<{ status: string }[]>`
      SELECT status FROM settlement_monthly WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('정산 row 가 없습니다.');
    if (rows[0].status === 'paid') {
      throw new BadRequestException('이미 지급완료 상태입니다.');
    }
    if (rows[0].status === 'voided') {
      throw new BadRequestException('무효화된 정산은 지급완료로 변경할 수 없습니다.');
    }
    await this.sql`
      UPDATE settlement_monthly
         SET status = 'paid',
             paid_at = NOW(),
             paid_by_id = ${adminId}
       WHERE id = ${id}
    `;
    return { ok: true, id, status: 'paid' };
  }

  /**
   * 정산 row 를 무효화 — 사고/오정산 정정용. 사유 필수.
   * status 'calculated' 또는 'paid' → 'voided'. 한 번 voided 되면 되돌릴 수 없음.
   */
  async markVoided(id: number, adminId: number, reason: string) {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException('무효화 사유는 5자 이상 작성해야 합니다.');
    }
    const rows = await this.sql<{ status: string }[]>`
      SELECT status FROM settlement_monthly WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('정산 row 가 없습니다.');
    if (rows[0].status === 'voided') {
      throw new BadRequestException('이미 무효화 상태입니다.');
    }
    await this.sql`
      UPDATE settlement_monthly
         SET status = 'voided',
             voided_at = NOW(),
             voided_by_id = ${adminId},
             void_reason = ${trimmedReason}
       WHERE id = ${id}
    `;
    return { ok: true, id, status: 'voided' };
  }
}
