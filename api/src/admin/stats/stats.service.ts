import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

@Injectable()
export class StatsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 일별 방문 추이 (visit_summary 기반) */
  async visitDaily(days = 30) {
    const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
    const items = await this.sql`
      SELECT visit_date::text AS date, visit_count::int AS count
      FROM visit_summary
      WHERE visit_date >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)::date
      ORDER BY visit_date ASC
    `;
    return { items, days: safeDays };
  }

  /** 일별 매출 추이 (consultation.amt + payment.amount) */
  async revenueDaily(days = 30) {
    const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
    const items = await this.sql`
      WITH dates AS (
        SELECT generate_series(
          (CURRENT_DATE - (${safeDays}::int || ' days')::interval)::date,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS d
      ),
      cs AS (
        SELECT date_trunc('day', started_at)::date AS d, COALESCE(SUM(amt), 0)::bigint AS amt
        FROM consultation
        WHERE started_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)::date
        GROUP BY 1
      ),
      pm AS (
        SELECT date_trunc('day', created_at)::date AS d, COALESCE(SUM(amount), 0)::bigint AS amt
        FROM payment
        WHERE created_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)::date
          AND status = 'completed'
        GROUP BY 1
      )
      SELECT dates.d::text AS date,
             COALESCE(cs.amt, 0)::int AS consultation_amt,
             COALESCE(pm.amt, 0)::int AS payment_amt
      FROM dates
      LEFT JOIN cs ON cs.d = dates.d
      LEFT JOIN pm ON pm.d = dates.d
      ORDER BY dates.d ASC
    `;
    return { items, days: safeDays };
  }

  /** 월별 매출 (최근 12개월) */
  async revenueMonthly() {
    const items = await this.sql`
      WITH months AS (
        SELECT date_trunc('month', generate_series(
          date_trunc('month', CURRENT_DATE - interval '11 months'),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ))::date AS m
      ),
      cs AS (
        SELECT date_trunc('month', started_at)::date AS m, COALESCE(SUM(amt), 0)::bigint AS amt
        FROM consultation
        WHERE started_at >= date_trunc('month', CURRENT_DATE - interval '11 months')
        GROUP BY 1
      ),
      pm AS (
        SELECT date_trunc('month', created_at)::date AS m, COALESCE(SUM(amount), 0)::bigint AS amt
        FROM payment
        WHERE created_at >= date_trunc('month', CURRENT_DATE - interval '11 months')
          AND status = 'completed'
        GROUP BY 1
      )
      SELECT to_char(months.m, 'YYYY-MM') AS month,
             COALESCE(cs.amt, 0)::int AS consultation_amt,
             COALESCE(pm.amt, 0)::int AS payment_amt
      FROM months
      LEFT JOIN cs ON cs.m = months.m
      LEFT JOIN pm ON pm.m = months.m
      ORDER BY months.m ASC
    `;
    return { items };
  }

  /** 종합 KPI */
  async overview() {
    const rows = await this.sql<{
      member_total: string; counselor_total: string;
      today_visits: string; today_payments: string; today_payment_amt: string;
      month_visits: string; month_payment_amt: string;
    }[]>`
      SELECT
        (SELECT count(*) FROM member WHERE role = 'user')::text AS member_total,
        (SELECT count(*) FROM member WHERE role = 'counselor')::text AS counselor_total,
        (SELECT COALESCE(visit_count, 0) FROM visit_summary WHERE visit_date = CURRENT_DATE)::text AS today_visits,
        (SELECT count(*) FROM payment WHERE created_at::date = CURRENT_DATE AND status = 'completed')::text AS today_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE created_at::date = CURRENT_DATE AND status = 'completed')::text AS today_payment_amt,
        (SELECT COALESCE(SUM(visit_count), 0) FROM visit_summary WHERE visit_date >= date_trunc('month', CURRENT_DATE)::date)::text AS month_visits,
        (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE created_at >= date_trunc('month', CURRENT_DATE) AND status = 'completed')::text AS month_payment_amt
    `;
    return {
      member_total: Number(rows[0].member_total),
      counselor_total: Number(rows[0].counselor_total),
      today_visits: Number(rows[0].today_visits),
      today_payments: Number(rows[0].today_payments),
      today_payment_amt: Number(rows[0].today_payment_amt),
      month_visits: Number(rows[0].month_visits),
      month_payment_amt: Number(rows[0].month_payment_amt),
    };
  }

  /**
   * 운영 KPI — 최근 N일 (Phase 11).
   *   환불률, 평균 통화시간, 전체 통화 건수, 환불액 합계, call/chat 비율
   */
  async opsKpi(days = 30) {
    const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
    const rows = await this.sql<{
      total_count: string;
      call_count: string;
      chat_count: string;
      total_seconds: string;
      total_amt: string;
      total_refunded: string;
      refunded_count: string;
    }[]>`
      SELECT
        COUNT(*)::text AS total_count,
        COUNT(*) FILTER (WHERE reason = 'DISCONNECT')::text AS call_count,
        COUNT(*) FILTER (WHERE reason IN ('END_CHAT', 'END_CHAT_LOCAL'))::text AS chat_count,
        COALESCE(SUM(usetm), 0)::text AS total_seconds,
        COALESCE(SUM(amt), 0)::text AS total_amt,
        COALESCE(SUM(refunded_amount), 0)::text AS total_refunded,
        COUNT(*) FILTER (WHERE refunded_amount > 0)::text AS refunded_count
      FROM consultation
      WHERE created_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)
        AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
    `;
    const r = rows[0];
    const total = Number(r.total_count);
    const refundedCount = Number(r.refunded_count);
    const totalAmt = Number(r.total_amt);
    const totalRefunded = Number(r.total_refunded);
    return {
      days: safeDays,
      total_consultations: total,
      call_count: Number(r.call_count),
      chat_count: Number(r.chat_count),
      avg_duration_sec: total > 0 ? Math.round(Number(r.total_seconds) / total) : 0,
      total_revenue: totalAmt,
      total_refunded: totalRefunded,
      refund_rate_pct: totalAmt > 0 ? Math.round((totalRefunded / totalAmt) * 10000) / 100 : 0,
      refunded_count: refundedCount,
      refund_count_rate_pct: total > 0 ? Math.round((refundedCount / total) * 10000) / 100 : 0,
    };
  }

  /**
   * 상담사 매출 순위 — 최근 N일.
   *   정산 금액 기준 정렬. 환불 차감 반영.
   */
  async counselorRanking(days = 30, limit = 10) {
    const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
    const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
    return await this.sql<Array<{
      counselor_id: number;
      mb_id: string | null;
      nickname: string | null;
      grade: string | null;
      count: string;
      revenue: string;
      refunded: string;
      avg_duration: string;
    }>>`
      SELECT
        c.counselor_id,
        m.mb_id, m.nickname, m.grade,
        COUNT(*)::text AS count,
        COALESCE(SUM(c.amt - c.refunded_amount), 0)::text AS revenue,
        COALESCE(SUM(c.refunded_amount), 0)::text AS refunded,
        COALESCE(AVG(c.usetm), 0)::text AS avg_duration
      FROM consultation c
      JOIN member m ON m.id = c.counselor_id
      WHERE c.created_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)
        AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
        AND c.refund_status IS DISTINCT FROM 'full'
      GROUP BY c.counselor_id, m.mb_id, m.nickname, m.grade
      ORDER BY SUM(c.amt - c.refunded_amount) DESC NULLS LAST
      LIMIT ${safeLimit}
    `;
  }
}
