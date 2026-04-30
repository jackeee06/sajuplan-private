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
}
