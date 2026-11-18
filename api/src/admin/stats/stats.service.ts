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
      ),
      -- 선결제 채팅은 consultation.amt=0 이라 cs 에서 누락 → point_history(rel_table='chat_room')의
      -- 실차감(use_point)을 매출로 보강. rel_id = chat_room.id (문자매칭으로 캐스트 회피).
      pp AS (
        SELECT date_trunc('day', cr.started_at)::date AS d, COALESCE(SUM(ph.use_point), 0)::bigint AS amt
        FROM point_history ph
        JOIN chat_room cr ON cr.id::text = ph.rel_id
        WHERE ph.rel_table = 'chat_room'
          AND cr.started_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)::date
        GROUP BY 1
      )
      SELECT dates.d::text AS date,
             (COALESCE(cs.amt, 0) + COALESCE(pp.amt, 0))::int AS consultation_amt,
             COALESCE(pm.amt, 0)::int AS payment_amt
      FROM dates
      LEFT JOIN cs ON cs.d = dates.d
      LEFT JOIN pm ON pm.d = dates.d
      LEFT JOIN pp ON pp.d = dates.d
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
      ),
      -- 선결제 채팅(consultation.amt=0) 매출 보강 — point_history(rel_table='chat_room') 실차감액
      pp AS (
        SELECT date_trunc('month', cr.started_at)::date AS m, COALESCE(SUM(ph.use_point), 0)::bigint AS amt
        FROM point_history ph
        JOIN chat_room cr ON cr.id::text = ph.rel_id
        WHERE ph.rel_table = 'chat_room'
          AND cr.started_at >= date_trunc('month', CURRENT_DATE - interval '11 months')
        GROUP BY 1
      )
      SELECT to_char(months.m, 'YYYY-MM') AS month,
             (COALESCE(cs.amt, 0) + COALESCE(pp.amt, 0))::int AS consultation_amt,
             COALESCE(pm.amt, 0)::int AS payment_amt
      FROM months
      LEFT JOIN cs ON cs.m = months.m
      LEFT JOIN pm ON pm.m = months.m
      LEFT JOIN pp ON pp.m = months.m
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
   * 운영 KPI — 기간 지정 (fr_date/to_date) 또는 최근 N일 (days 폴백).
   */
  async opsKpi(days = 30, frDate?: string, toDate?: string) {
    const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
    const dateFilter = frDate && toDate
      ? this.sql`created_at >= ${frDate + ' 00:00:00'}::timestamptz AND created_at <= ${toDate + ' 23:59:59'}::timestamptz`
      : this.sql`created_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)`;
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
      WHERE ${dateFilter}
        AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
    `;
    // 선결제 채팅 매출 보강 — consultation.amt=0 이라 위 SUM(amt)에서 빠짐.
    //   실차감(use_point)을 gross 로 더한다. 환불은 consultation.refunded_amount 에 이미 반영돼 있어 그대로 둔다.
    const ppFilter = frDate && toDate
      ? this.sql`cr.started_at >= ${frDate + ' 00:00:00'}::timestamptz AND cr.started_at <= ${toDate + ' 23:59:59'}::timestamptz`
      : this.sql`cr.started_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)`;
    const ppRows = await this.sql<{ gross: string }[]>`
      SELECT COALESCE(SUM(ph.use_point), 0)::text AS gross
      FROM point_history ph
      JOIN chat_room cr ON cr.id::text = ph.rel_id
      WHERE ph.rel_table = 'chat_room' AND ${ppFilter}
    `;
    const prepaidGross = Number(ppRows[0]?.gross ?? 0);

    const r = rows[0];
    const total = Number(r.total_count);
    const refundedCount = Number(r.refunded_count);
    const totalAmt = Number(r.total_amt) + prepaidGross;
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
   * 상담사 매출 순위 — 기간 지정 또는 최근 N일 폴백.
   */
  async counselorRanking(days = 30, limit = 10, frDate?: string, toDate?: string) {
    const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
    const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
    const dateFilter = frDate && toDate
      ? this.sql`c.created_at >= ${frDate + ' 00:00:00'}::timestamptz AND c.created_at <= ${toDate + ' 23:59:59'}::timestamptz`
      : this.sql`c.created_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)`;
    // 선결제 채팅 순매출(실차감 use_point − 환불 earn_point) — 상담사(chat_room.counselor_id) 귀속.
    //   consultation.amt=0 이라 아래 SUM 에선 0 → 이 값을 더해야 실매출이 잡힌다.
    const ppFilter = frDate && toDate
      ? this.sql`cr.started_at >= ${frDate + ' 00:00:00'}::timestamptz AND cr.started_at <= ${toDate + ' 23:59:59'}::timestamptz`
      : this.sql`cr.started_at >= (CURRENT_DATE - (${safeDays}::int || ' days')::interval)`;
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
        -- 종량제: GREATEST 로 선결제(amt=0, 환불>0)의 음수화 방지. 선결제 순매출은 pp 에서 합산.
        (COALESCE(SUM(GREATEST(c.amt - c.refunded_amount, 0)), 0) + COALESCE(pp.prepaid_rev, 0))::text AS revenue,
        COALESCE(SUM(c.refunded_amount), 0)::text AS refunded,
        COALESCE(AVG(c.usetm), 0)::text AS avg_duration
      FROM consultation c
      JOIN member m ON m.id = c.counselor_id
      LEFT JOIN (
        SELECT cr.counselor_id, COALESCE(SUM(ph.use_point - ph.earn_point), 0) AS prepaid_rev
        FROM point_history ph
        JOIN chat_room cr ON cr.id::text = ph.rel_id
        WHERE ph.rel_table = 'chat_room' AND ${ppFilter}
        GROUP BY cr.counselor_id
      ) pp ON pp.counselor_id = c.counselor_id
      WHERE ${dateFilter}
        AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
        AND c.refund_status IS DISTINCT FROM 'full'
      GROUP BY c.counselor_id, m.mb_id, m.nickname, m.grade, pp.prepaid_rev
      ORDER BY (COALESCE(SUM(GREATEST(c.amt - c.refunded_amount, 0)), 0) + COALESCE(pp.prepaid_rev, 0)) DESC NULLS LAST
      LIMIT ${safeLimit}
    `;
  }
}
