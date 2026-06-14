import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { UserSettlementsService } from '../../user/settlements/settlements.service';
import { UserCounselorMypagePayoutService } from '../../user/counselor-mypage-payout/counselor-mypage-payout.service';

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
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    // 상담사 화면 미러용 — 상담사 마이페이지가 쓰는 바로 그 서비스(같은 계산)
    private readonly userSettlements: UserSettlementsService,
    private readonly userPayout: UserCounselorMypagePayoutService,
  ) {}

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
      amt_total: number;
      revenue_rate_pct: number;
      est_price_tot: number;
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
    /**
     * 상담사 화면 미러 — 상담사 마이페이지(/counselor/mypage)에 보이는 숫자 그대로.
     * 통화 응대 시 관리자가 상담사와 같은 숫자를 보기 위함. (같은 서비스 호출 = 드리프트 0)
     */
    mirror: {
      balance: number;          // 내 수익금 (총잔여 = earning_balance)
      this_month_net: number;   // 당월 적립 중 (순액)
      pending_settle: number;   // 이번 정산 예정 (전월까지)
      after_tax: number;        // 세후 입금 예상 (약)
      payout_available: number; // 선지급 가능
      payout_blocked: boolean;
      payout_block_reason: string | null;
    };
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

    // 4. 이번달 매출 — 고객 실지출(선결제 포함). 종량제는 amt, 선결제(amt=0)는 m2net 실시간 실과금(mrtn).
    //    [2026-06-14] 기존 amt_free/amt_pro 합은 선결제(amt=0)를 누락 → 실매출 과소집계라 mrtn 기반으로 교정.
    const month = await this.sql<{ cnt: string; sales: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(
               CASE WHEN c.amt > 0 THEN c.amt
                    ELSE COALESCE(NULLIF(c.mrtn::json->>'amt','')::int, 0) END
             ), 0)::text AS sales
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
    const monthSales = Number(month[0]?.sales ?? 0);

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

    // 6. 상담사 화면 미러 — 상담사 마이페이지와 '같은 함수'로 계산 (숫자 절대 안 어긋남).
    const s = await this.userSettlements.summary(memberId);
    const p = await this.userPayout.getMine(memberId).catch(() => null);
    const balanceMirror = Number(s.balance ?? 0);
    const thisMonthNet =
      Number(s.this_month ?? 0) + Number(s.referral_earn ?? 0) - Number(s.referral_deduct ?? 0);
    const pendingSettle = Math.max(0, balanceMirror - thisMonthNet);

    // [2026-06-14] 이번달 정산 예상 — 상담사앱과 100% 동일 (estimated_payout = 상담사앱 '이번달 정산금액').
    //   옛 공식(매출×정산률÷1.1 부가세 − 회선비, base=consultation.amt 라 선결제 누락) 폐기.
    //   새 공식: 이번달 적립 수익금(thisMonthNet, 선결제 포함) − 원천세 3.3%만.
    const estPriceTot = thisMonthNet;                       // 이번달 적립 수익금(세전)
    const estPayout = Number(s.estimated_payout ?? Math.max(0, thisMonthNet - Math.floor(thisMonthNet * 0.033)));
    const estWithholding = Math.max(0, estPriceTot - estPayout); // 원천세(3.3%)
    const afterTax = Math.max(0, balanceMirror - Math.floor(balanceMirror * 0.033));
    const mirror = {
      balance: balanceMirror,
      this_month_net: thisMonthNet,
      pending_settle: pendingSettle,
      after_tax: afterTax,
      payout_available: p ? Number(p.available_amount) : 0,
      payout_blocked: p ? !!p.is_blocked : false,
      payout_block_reason: p ? p.block_reason : null,
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
        amt_total: monthSales,                 // 이번달 매출 = 고객 실지출(선결제 포함)
        revenue_rate_pct: revenueRatePct,
        est_price_tot: estPriceTot,            // 이번달 적립 수익금(세전)
        est_withholding: estWithholding,       // 원천세 3.3%
        est_payout: Math.max(0, estPayout),    // 세후 실수령 예상 (= 상담사앱 '이번달 정산금액')
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
      mirror,
    };
  }
}
