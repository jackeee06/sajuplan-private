import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 어드민 — 상담사 운영 종합 (Ops Summary).
 *
 * 운영자가 상담사 한 명의 현재 상황을 한 화면에서 보기 위한 종합 조회:
 *   - 회원/등급/단가 기본
 *   - 보유 포인트 (free/paid)
 *   - 오늘/이번달 상담 통계
 *   - 이번달 정산 예상 (settlement-cron 산식 모의)
 *   - 최근 적립 이력 5건
 *
 * 상담사 마이페이지(/mypage)에 보이는 정보를 어드민이 동일하게 확인.
 */
@Injectable()
export class AdminCounselorOpsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async summary(memberId: number): Promise<{
    counselor: {
      id: number;
      mb_id: string | null;
      name: string | null;
      nickname: string | null;
      grade: string | null;
      grade_label: string;
      call_070_unit_cost: number;
      call_060_unit_cost: number;
      chat_unit_cost: number;
      state: string | null;
      use_phone: boolean;
      use_chat: boolean;
    };
    point: {
      free_balance: number;
      paid_balance: number;
      earning_balance: number;
      total: number;
      total_earned: number;
      total_used: number;
    };
    today: { consultations: number };
    month: {
      consultations: number;
      amt_free: number;
      amt_pro: number;
      amt_total: number;
      revenue_rate_pct: number;
      est_price_tot: number;
      est_supply: number;
      est_withholding: number;
      est_payout: number;
    };
    recent_credits: Array<{
      id: number;
      content: string;
      earn_point: number;
      balance_after: number;
      rel_table: string;
      rel_id: string;
      created_at: string;
    }>;
  }> {
    // 1. 상담사 기본
    const m = await this.sql<{
      id: number;
      mb_id: string | null;
      name: string | null;
      nickname: string | null;
      role: string;
      grade: string | null;
      call_070_unit_cost: number | null;
      call_060_unit_cost: number | null;
      chat_unit_cost: number | null;
      state: string | null;
      use_phone: boolean | null;
      use_chat: boolean | null;
    }[]>`
      SELECT id, mb_id, name, nickname, role, grade,
             call_070_unit_cost, call_060_unit_cost, chat_unit_cost,
             state, use_phone, use_chat
        FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (m.length === 0) throw new NotFoundException('상담사를 찾을 수 없습니다.');
    if (m[0].role !== 'counselor') {
      throw new NotFoundException(`회원 #${memberId}는 상담사가 아닙니다 (role=${m[0].role}).`);
    }
    const c = m[0];

    // 2. 보유 포인트 (소비포인트 free/paid + 수익포인트 earning)
    const pt = await this.sql<{
      free_balance: number; paid_balance: number; earning_balance: number;
      total_earned: number; total_used: number;
    }[]>`
      SELECT free_balance, paid_balance, earning_balance, total_earned, total_used
        FROM point WHERE member_id = ${memberId} LIMIT 1
    `;
    const free = pt.length > 0 ? Number(pt[0].free_balance) : 0;
    const paid = pt.length > 0 ? Number(pt[0].paid_balance) : 0;
    const earning = pt.length > 0 ? Number(pt[0].earning_balance) : 0;

    // 3. 오늘 상담 건수 (정상 통화만)
    const today = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM consultation
       WHERE counselor_id = ${memberId}
         AND created_at::date = CURRENT_DATE
         AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
    `;

    // 4. 이번달 정산 대상 + 산식 모의 (preliminary 기본 40%, grade 시드 기준)
    const month = await this.sql<{ cnt: string; sf: string; sp: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(amt_free), 0)::text AS sf,
             COALESCE(SUM(amt_pro), 0)::text AS sp
        FROM consultation c
       WHERE c.counselor_id = ${memberId}
         AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
         AND c.refund_status IS DISTINCT FROM 'full'
         AND c.created_at >= date_trunc('month', CURRENT_DATE)
         AND EXISTS (
           SELECT 1 FROM point_history ph
            WHERE ph.rel_table = 'consultation'
              AND ph.rel_id = c.id::text
              AND ph.member_id = c.counselor_id
         )
    `;
    const monthCnt = Number(month[0]?.cnt ?? 0);
    const sf = Number(month[0]?.sf ?? 0);
    const sp = Number(month[0]?.sp ?? 0);

    let revenueRatePct = 0;
    if (c.grade) {
      const rate = await this.sql<{ value: string }[]>`
        SELECT value FROM setting
         WHERE namespace = 'grade' AND key = ${`revenue_rate.${c.grade}`}
         LIMIT 1
      `;
      if (rate.length > 0) {
        const r = Number(rate[0].value);
        if (Number.isFinite(r) && r >= 0 && r <= 1) revenueRatePct = Math.round(r * 100);
      }
    }
    const estPriceTot = Math.floor(sf * revenueRatePct / 100) + Math.floor(sp * revenueRatePct / 100);
    const estSupply = Math.floor(estPriceTot / 1.1);
    const estWithholding = Math.floor(estSupply * 0.033);
    const estReplyFee = estPriceTot >= 50000 ? 20000 : 0;
    const estPayout = estSupply - estWithholding - estReplyFee;

    // 5. 최근 적립 이력 5건
    type CreditRow = {
      id: number;
      content: string;
      earn_point: number;
      balance_after: number;
      rel_table: string;
      rel_id: string;
      created_at: Date;
    };
    const credits = await this.sql<CreditRow[]>`
      SELECT id, content, earn_point, balance_after, rel_table, rel_id, created_at
        FROM point_history
       WHERE member_id = ${memberId}
         AND earn_point > 0
       ORDER BY id DESC
       LIMIT 5
    `;

    const GRADE_LABELS: Record<string, string> = {
      preliminary: '예비파트너',
      partner1: '파트너1',
      partner2: '파트너2',
      partner3: '파트너3',
      partner4: '파트너4',
      partner5: '파트너5',
    };

    return {
      counselor: {
        id: Number(c.id),
        mb_id: c.mb_id,
        name: c.name,
        nickname: c.nickname,
        grade: c.grade,
        grade_label: c.grade ? (GRADE_LABELS[c.grade] ?? c.grade) : '—',
        call_070_unit_cost: Number(c.call_070_unit_cost ?? 0),
        call_060_unit_cost: Number(c.call_060_unit_cost ?? 0),
        chat_unit_cost: Number(c.chat_unit_cost ?? 0),
        state: c.state,
        use_phone: !!c.use_phone,
        use_chat: !!c.use_chat,
      },
      point: {
        free_balance: free,
        paid_balance: paid,
        earning_balance: earning,
        total: free + paid,
        total_earned: pt.length > 0 ? Number(pt[0].total_earned) : 0,
        total_used: pt.length > 0 ? Number(pt[0].total_used) : 0,
      },
      today: { consultations: Number(today[0]?.cnt ?? 0) },
      month: {
        consultations: monthCnt,
        amt_free: sf,
        amt_pro: sp,
        amt_total: sf + sp,
        revenue_rate_pct: revenueRatePct,
        est_price_tot: estPriceTot,
        est_supply: estSupply,
        est_withholding: estWithholding,
        est_payout: Math.max(0, estPayout),
      },
      recent_credits: credits.map((r) => ({
        id: Number(r.id),
        content: r.content,
        earn_point: Number(r.earn_point),
        balance_after: Number(r.balance_after),
        rel_table: r.rel_table,
        rel_id: r.rel_id,
        created_at: r.created_at.toISOString(),
      })),
    };
  }
}
