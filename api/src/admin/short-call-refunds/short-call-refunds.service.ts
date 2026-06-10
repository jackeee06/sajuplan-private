import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 고객보호비용(매몰비용) 조회 — 30초 미만 자동 환원된 통화 리스트.
 *
 * 정책 (2026-05-22):
 *   30초 미만 통화는 회원 잔액 자동 환원 (회사 정책) →
 *   m2net 측 차감액은 사주플랜이 부담하는 매몰비용으로 누적.
 *   매월 m2net 청구서와 1:1 대조하기 위해 callid/csrid/membid 등 모든 메타 노출.
 */
@Injectable()
export class AdminShortCallRefundsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async list(params: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Array<{
      id: number;
      created_at: string;
      usetm: number;
      refunded_amount: number;
      unit_cost_snapshot: number | null;
      reason: string;
      callid: string | null;
      csrid: string | null;
      membid: string | null;
      counselor_id: number | null;
      counselor_mb_id: string | null;
      counselor_nickname: string | null;
      member_id: number | null;
      member_mb_id: string | null;
      member_name: string | null;
    }>;
    total: number;
    total_amount: number;
  }> {
    const limit = Math.min(500, Math.max(1, params.limit ?? 50));
    const offset = Math.max(0, params.offset ?? 0);

    // 기본: 이번달 (1일 00:00 ~ 다음달 1일 00:00). from/to 둘 다 'YYYY-MM-DD' 가정.
    const now = new Date();
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const defaultTo = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : defaultFrom;
    const to   = params.to   && /^\d{4}-\d{2}-\d{2}$/.test(params.to)   ? params.to   : defaultTo;

    type Row = {
      id: number;
      created_at: Date;
      usetm: number;
      refunded_amount: number;
      unit_cost_snapshot: number | null;
      reason: string;
      callid: string | null;
      csrid: string | null;
      membid: string | null;
      counselor_id: number | null;
      counselor_mb_id: string | null;
      counselor_nickname: string | null;
      member_id: number | null;
      member_mb_id: string | null;
      member_name: string | null;
    };

    const rows = await this.sql<Row[]>`
      SELECT c.id, c.created_at, c.usetm, c.refunded_amount, c.unit_cost_snapshot,
             c.reason, c.callid, c.csrid, c.membid,
             c.counselor_id, csr.mb_id AS counselor_mb_id, csr.nickname AS counselor_nickname,
             c.member_id,   m.mb_id   AS member_mb_id,    m.name       AS member_name
        FROM consultation c
        LEFT JOIN member csr ON csr.id = c.counselor_id
        LEFT JOIN member m   ON m.id   = c.member_id
       WHERE c.refund_status = 'short_call_refund'
         AND c.created_at >= ${from}::date
         AND c.created_at <  (${to}::date + INTERVAL '1 day')
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string; sum: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(refunded_amount), 0)::text AS sum
        FROM consultation
       WHERE refund_status = 'short_call_refund'
         AND created_at >= ${from}::date
         AND created_at <  (${to}::date + INTERVAL '1 day')
    `;

    return {
      items: rows.map((r) => ({
        id: Number(r.id),
        created_at: r.created_at.toISOString(),
        usetm: Number(r.usetm),
        refunded_amount: Number(r.refunded_amount),
        unit_cost_snapshot: r.unit_cost_snapshot !== null ? Number(r.unit_cost_snapshot) : null,
        reason: r.reason,
        callid: r.callid,
        csrid: r.csrid,
        membid: r.membid,
        counselor_id: r.counselor_id !== null ? Number(r.counselor_id) : null,
        counselor_mb_id: r.counselor_mb_id,
        counselor_nickname: r.counselor_nickname,
        member_id: r.member_id !== null ? Number(r.member_id) : null,
        member_mb_id: r.member_mb_id,
        member_name: r.member_name,
      })),
      total: Number(totalRows[0]?.cnt ?? 0),
      total_amount: Number(totalRows[0]?.sum ?? 0),
    };
  }
}
