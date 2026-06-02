import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * [2026-05-24] 슈퍼관리자 순이익 시뮬레이터.
 *
 * 시뮬 설정(매출/인원/m2net 협상 변수/운영비 등)을 admin 별로 JSONB 에 저장.
 * 등급별 정산률은 setting(namespace='grade') 에서 항상 fresh 로드 — 시뮬 화면에서는
 * 임시 수정만 가능 (저장 X). 사장님 명시 안전 정책.
 *
 * LTV / 광고 ROI / 위험 신호 같은 자동 추출 데이터는 별도 메서드.
 */

export interface ProfitSimConfigData {
  /** 협상 가능 변수 (m2net 계약 기반) */
  m2net?: {
    monthly_fee?: number;       // 월 이용료 (원, 기본 700000)
    telecom_rate?: number;      // 통신사 수수료율 (%, 기본 10)
    phone_call_rate?: number;   // 휴대폰 통신료율 (%, 기본 5)
    counselor_free_count?: number; // 무료 상담사 인원 (기본 10)
    counselor_extra_fee?: number;  // 추가 상담사 단가 (원, 기본 20000)
  };
  /** 시나리오 (사장님 입력) */
  scenario?: {
    revenue?: number;           // 월 매출 (원)
    counselor_count?: number;   // 총 상담사 수
  };
  /** 등급별 인원 분포 (인원수) — DB 실측에서 가져온 기본값을 사장님이 시뮬 조정 */
  grade_dist?: Record<string, number>;  // { preliminary: 5, partner1: 10, ... }
  /** 등급별 매출 비중 (%, 합 100) */
  grade_revenue_share?: Record<string, number>;
  /** 운영비 항목 리스트 */
  operating_costs?: Array<{
    id?: string;
    name: string;
    amount: number;            // 월 금액 (원)
    auto?: 'pg_rate' | 'vat_rate' | 'corp_tax_rate' | null; // 자동 계산 종류
    rate?: number;             // auto 일 때 비율 (%)
  }>;
  /** Phase 3: LTV / 광고 ROI 입력 변수 */
  ltv?: {
    avg_charge_per_member?: number;  // 회원 1명당 평균 충전액 (원)
    avg_recharge_count?: number;      // 평균 재충전 횟수
    avg_active_months?: number;       // 평균 활성 개월
  };
  ad_roi?: {
    monthly_budget?: number;     // 광고비 (원/월)
    cost_per_acquisition?: number; // 신규 회원 1명 영입 비용 (원)
  };
  /** Phase 4: 월별 매출 (12칸) — 사장님 입력 */
  monthly_revenues?: number[];
  /** Phase 4: 3년 로드맵 가정 — 월 매출 성장률 (%) */
  growth_rate?: number;
}

@Injectable()
export class ProfitSimService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 슈퍼관리자별 시뮬 설정 로드 + DB 원본 등급률 + 실측 통계 같이 반환.
   *
   * 등급률은 namespace='grade', key='revenue_rate.{grade}' 에서 fresh 로드.
   * 시뮬 화면에서는 절대 저장하지 않음 — 안전 정책.
   */
  async getDashboard(adminId: number): Promise<{
    config: ProfitSimConfigData;
    db_grade_rates: Record<string, number>;       // DB 원본 등급별 정산률 (%)
    db_grade_unit_costs: Record<string, number>;  // DB 원본 등급별 단가 평균 (원/30초)
    db_grade_dist: Record<string, number>;        // 현재 활성 상담사 등급별 인원
    stats: {
      total_members: number;
      active_counselors: number;
      last_month_revenue: number;
      last_month_profit_est: number;
    };
  }> {
    // 1) 시뮬 설정
    const rows = await this.sql<{ data: ProfitSimConfigData }[]>`
      SELECT data FROM profit_simulator_config WHERE admin_id = ${adminId} LIMIT 1
    `;
    const config = rows[0]?.data ?? {};

    // 2) DB 원본 등급별 정산률 (namespace='grade', key='revenue_rate.{grade}')
    const rateRows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'grade' AND key LIKE 'revenue_rate.%'
    `;
    const db_grade_rates: Record<string, number> = {};
    for (const r of rateRows) {
      const grade = r.key.replace('revenue_rate.', '');
      db_grade_rates[grade] = parseFloat((Number(r.value) * 100).toFixed(2));
    }

    // [2026-05-24] 등급별 단가 옵션 평균 — setting.grade.options.{grade} = "800,1000" 형태
    const optionsRows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'grade' AND key LIKE 'options.%'
    `;
    const db_grade_unit_costs: Record<string, number> = {};
    for (const r of optionsRows) {
      const grade = r.key.replace('options.', '');
      const values = String(r.value).split(',').map(v => Number(v.trim())).filter(v => !isNaN(v) && v > 0);
      if (values.length > 0) {
        db_grade_unit_costs[grade] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      }
    }

    // 3) 현재 활성 상담사 등급별 인원
    const distRows = await this.sql<{ grade: string | null; cnt: string }[]>`
      SELECT grade, count(*)::text AS cnt
        FROM member
       WHERE role = 'counselor' AND left_at IS NULL
       GROUP BY grade
    `;
    const db_grade_dist: Record<string, number> = {};
    for (const r of distRows) {
      if (r.grade) db_grade_dist[r.grade] = Number(r.cnt);
    }

    // 4) 실측 통계 (총 회원 / 활성 상담사 / 지난달 매출)
    const totalMembersRow = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM member WHERE role = 'member' AND left_at IS NULL
    `;
    const activeCsrRow = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM member WHERE role = 'counselor' AND left_at IS NULL
    `;
    const lastMonthRow = await this.sql<{ revenue: string }[]>`
      SELECT COALESCE(SUM(amt - COALESCE(refunded_amount,0)), 0)::text AS revenue
        FROM consultation
       WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
         AND ended_at >= date_trunc('month', now() - interval '1 month')
         AND ended_at <  date_trunc('month', now())
    `;
    const last_month_revenue = Number(lastMonthRow[0]?.revenue ?? 0);

    return {
      config,
      db_grade_rates,
      db_grade_unit_costs,
      db_grade_dist,
      stats: {
        total_members: Number(totalMembersRow[0]?.cnt ?? 0),
        active_counselors: Number(activeCsrRow[0]?.cnt ?? 0),
        last_month_revenue,
        last_month_profit_est: 0, // Phase 2 에서 계산 추가
      },
    };
  }

  /** 시뮬 설정 저장 (upsert) — 등급률은 저장 대상 아님. */
  async saveConfig(adminId: number, data: ProfitSimConfigData): Promise<void> {
    await this.sql`
      INSERT INTO profit_simulator_config (admin_id, data, updated_at)
      VALUES (${adminId}, ${this.sql.json(data as never)}::jsonb, NOW())
      ON CONFLICT (admin_id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW()
    `;
  }

  /**
   * [Phase 2/3] 인사이트 데이터 — LTV / 위험 신호 / 월별 실측 매출 / 시즌 패턴 / KPI.
   * 시뮬레이터 페이지의 상단 KPI + 카드들에 표시.
   */
  async getInsights(): Promise<{
    ltv: {
      avg_charge_per_member: number;
      avg_recharge_count: number;
      avg_active_months: number;
      ltv_estimate: number;
    };
    risk: {
      top_counselor_share_pct: number;
      top_counselor_count_at_risk: number;
      new_member_delta_pct: number;
      dormant_rate_pct: number;
    };
    monthly_history: Array<{ month: string; revenue: number }>;
    /** [Phase 3] 컨트롤타워 상단 KPI */
    kpi: {
      this_month_revenue: number;        // 이번달 매출
      last_month_revenue: number;        // 지난달 매출
      revenue_change_pct: number;        // 전월 대비 변동률
      active_members_30d: number;        // 최근 30일 활성 회원수
      new_members_this_month: number;    // 이번달 신규 회원
    };
    /** [Phase 3] 시즌 패턴 — 요일별 매출 평균 */
    season: {
      by_dow: Array<{ dow: number; label: string; revenue: number; count: number }>;
      best_dow: { label: string; revenue: number };
      worst_dow: { label: string; revenue: number };
    };
  }> {
    // LTV — 회원 1명당 누적 충전 (payment 테이블)
    const ltvRow = await this.sql<{
      avg_charge: string | null;
      avg_recharge: string | null;
      avg_months: string | null;
    }[]>`
      WITH per_member AS (
        SELECT
          p.member_id,
          SUM(p.amount) AS total_charge,
          COUNT(*) AS recharge_count,
          EXTRACT(EPOCH FROM (MAX(p.created_at) - MIN(p.created_at))) / 86400 / 30 AS active_months
        FROM payment p
        WHERE p.status = 'completed'
        GROUP BY p.member_id
      )
      SELECT
        AVG(total_charge)::text AS avg_charge,
        AVG(recharge_count)::text AS avg_recharge,
        AVG(GREATEST(active_months, 1))::text AS avg_months
      FROM per_member
    `;
    const ltv = ltvRow[0] ?? { avg_charge: '0', avg_recharge: '0', avg_months: '0' };

    // 상위 상담사 매출 점유율 (최근 30일)
    const topCsrRows = await this.sql<{ counselor_id: number; revenue: string; ratio: string }[]>`
      WITH csr_revenue AS (
        SELECT counselor_id,
               SUM(amt - COALESCE(refunded_amount, 0)) AS revenue
          FROM consultation
         WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
           AND ended_at >= NOW() - INTERVAL '30 days'
         GROUP BY counselor_id
      ),
      total AS (SELECT SUM(revenue) AS total FROM csr_revenue)
      SELECT counselor_id, revenue::text,
             (CASE WHEN (SELECT total FROM total) > 0
                   THEN (revenue::numeric / (SELECT total FROM total)) * 100
                   ELSE 0 END)::text AS ratio
        FROM csr_revenue
       ORDER BY revenue DESC
       LIMIT 10
    `;
    let cumShare = 0;
    let countAtRisk = 0;
    for (const r of topCsrRows) {
      cumShare += Number(r.ratio);
      countAtRisk += 1;
      if (cumShare >= 50) break;
    }
    const top3Share = topCsrRows.slice(0, 3).reduce((s, r) => s + Number(r.ratio), 0);

    // 신규 회원 전월 대비
    const newMemberRow = await this.sql<{ this_month: string; last_month: string }[]>`
      SELECT
        COUNT(CASE WHEN created_at >= date_trunc('month', NOW()) THEN 1 END)::text AS this_month,
        COUNT(CASE WHEN created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
                    AND created_at <  date_trunc('month', NOW()) THEN 1 END)::text AS last_month
        FROM member
       WHERE role = 'member'
    `;
    const thisMonth = Number(newMemberRow[0]?.this_month ?? 0);
    const lastMonth = Number(newMemberRow[0]?.last_month ?? 0);
    const newDelta = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    // 휴면 (30일 미활동) 비율 — member.last_login_at 기준
    const dormantRow = await this.sql<{ dormant: string; total: string }[]>`
      SELECT
        COUNT(CASE WHEN last_login_at < NOW() - INTERVAL '30 days' OR last_login_at IS NULL THEN 1 END)::text AS dormant,
        COUNT(*)::text AS total
        FROM member
       WHERE role = 'member' AND left_at IS NULL
    `;
    const dormant = Number(dormantRow[0]?.dormant ?? 0);
    const totalMembers = Number(dormantRow[0]?.total ?? 1);
    const dormantRate = totalMembers > 0 ? (dormant / totalMembers) * 100 : 0;

    // 월별 매출 (최근 6개월)
    const monthlyRows = await this.sql<{ month: string; revenue: string }[]>`
      SELECT
        to_char(date_trunc('month', ended_at), 'YYYY-MM') AS month,
        SUM(amt - COALESCE(refunded_amount, 0))::text AS revenue
        FROM consultation
       WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
         AND ended_at >= date_trunc('month', NOW() - INTERVAL '6 months')
       GROUP BY 1
       ORDER BY 1
    `;

    const avgCharge = Number(ltv.avg_charge ?? 0);
    const avgRecharge = Number(ltv.avg_recharge ?? 0);
    const avgMonths = Number(ltv.avg_months ?? 0);

    // [Phase 3] KPI — 이번달/지난달 매출, 전월대비, 활성회원, 신규회원
    const kpiRow = await this.sql<{
      this_month_revenue: string;
      last_month_revenue: string;
      new_members_this_month: string;
      active_members_30d: string;
    }[]>`
      SELECT
        COALESCE((
          SELECT SUM(amt - COALESCE(refunded_amount,0))
            FROM consultation
           WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
             AND ended_at >= date_trunc('month', NOW())
        ), 0)::text AS this_month_revenue,
        COALESCE((
          SELECT SUM(amt - COALESCE(refunded_amount,0))
            FROM consultation
           WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
             AND ended_at >= date_trunc('month', NOW() - INTERVAL '1 month')
             AND ended_at <  date_trunc('month', NOW())
        ), 0)::text AS last_month_revenue,
        (SELECT count(*)::text FROM member
          WHERE role = 'member' AND created_at >= date_trunc('month', NOW())
        ) AS new_members_this_month,
        (SELECT count(*)::text FROM member
          WHERE role = 'member' AND left_at IS NULL
            AND last_login_at >= NOW() - INTERVAL '30 days'
        ) AS active_members_30d
    `;
    const thisRev = Number(kpiRow[0]?.this_month_revenue ?? 0);
    const lastRev = Number(kpiRow[0]?.last_month_revenue ?? 0);
    const revChange = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : 0;

    // [Phase 3] 시즌 패턴 — 요일별 평균 매출 (최근 90일)
    const dowRows = await this.sql<{ dow: string; revenue: string; cnt: string }[]>`
      SELECT
        EXTRACT(DOW FROM ended_at)::text AS dow,
        AVG(amt - COALESCE(refunded_amount,0))::text AS revenue,
        count(*)::text AS cnt
        FROM consultation
       WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
         AND ended_at >= NOW() - INTERVAL '90 days'
       GROUP BY EXTRACT(DOW FROM ended_at)
       ORDER BY dow
    `;
    const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토'];
    const byDow = dowRows.map((r) => ({
      dow: Number(r.dow),
      label: DOW_LABEL[Number(r.dow)] ?? '?',
      revenue: Math.round(Number(r.revenue) || 0),
      count: Number(r.cnt),
    }));
    const sortedDow = [...byDow].sort((a, b) => b.revenue - a.revenue);
    const bestDow = sortedDow[0] ?? { label: '-', revenue: 0 };
    const worstDow = sortedDow[sortedDow.length - 1] ?? { label: '-', revenue: 0 };

    return {
      ltv: {
        avg_charge_per_member: Math.round(avgCharge),
        avg_recharge_count: Math.round(avgRecharge * 10) / 10,
        avg_active_months: Math.round(avgMonths * 10) / 10,
        ltv_estimate: Math.round(avgCharge),
      },
      risk: {
        top_counselor_share_pct: Math.round(top3Share * 10) / 10,
        top_counselor_count_at_risk: countAtRisk,
        new_member_delta_pct: Math.round(newDelta * 10) / 10,
        dormant_rate_pct: Math.round(dormantRate * 10) / 10,
      },
      monthly_history: monthlyRows.map((r) => ({
        month: r.month,
        revenue: Number(r.revenue),
      })),
      kpi: {
        this_month_revenue: thisRev,
        last_month_revenue: lastRev,
        revenue_change_pct: Math.round(revChange * 10) / 10,
        active_members_30d: Number(kpiRow[0]?.active_members_30d ?? 0),
        new_members_this_month: Number(kpiRow[0]?.new_members_this_month ?? 0),
      },
      season: {
        by_dow: byDow,
        best_dow: { label: bestDow.label, revenue: bestDow.revenue },
        worst_dow: { label: worstDow.label, revenue: worstDow.revenue },
      },
    };
  }
}
