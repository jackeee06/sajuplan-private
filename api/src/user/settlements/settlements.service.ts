import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface SettlementSummary {
  /** 이번달 누적 — 회원이 본인에게 지급된 코인 (적립 합계, 정산 차감 row 제외) */
  this_month: number;
  /** 전달 누적 — 동일 정의 */
  prev_month: number;
  /** 누적 잔여 (현재 보유 포인트) — member.point */
  balance: number;
  /**
   * 정산 예정 금액 — sample set_con_account_v2 동등 공식.
   * 당월 consultation(END_CHAT/DISCONNECT, 환불 제외) 의 amt_free/amt_pro 누적 →
   * 로열티% 적용 → /1.1 부가세 분리 → -원천세3.3% -회선비.
   */
  estimated_payout: number;
  /** 정산 예정 break-down (디버그/표시용). */
  payout_breakdown: {
    amt_free: number;
    amt_pro: number;
    royalty_free_pct: number;
    royalty_pro_pct: number;
    /** 쿠폰상담 정산비 = amt_free × royalty_free_pct% */
    price_free: number;
    /** 충전+후불 상담 정산비 = amt_pro × royalty_pro_pct% */
    price_paid: number;
    /** 기타정산비 — 이벤트/관리자 적립 등 consultation 매칭 안 되는 point_history 분 (음수 차감 포함) */
    price_other: number;
    /** 정산비 전체 = price_free + price_paid + price_other */
    price_tot: number;
    supply_price: number;
    vat_amount: number;
    withholding_tax: number;
    reply_fee: number;
  };
  /** 정산 기준 월 (YYYY-MM). 요청 시 지정 가능, 미지정 시 이번달. */
  month: string;
}

export interface IncomeItem {
  id: number;
  created_at: string;
  content: string;
  amount: number;
  is_paid: boolean;
  /** 'Y' = 선불, 'N' = 후불, '' = 매핑 정보 없음 */
  preflag: 'Y' | 'N' | '';
  /** 고객 표시명 (마스킹) */
  customer_name: string | null;
  consultation_id: number | null;
}

export interface SettlementMonthRow {
  id: number;
  month: string;            // YYYY-MM
  price_tot: number;        // 정산비 전체
  price_free: number;
  price_paid: number;
  price_other: number;
  vat_amount: number;       // 부가세공제
  withholding_tax: number;  // 원천세공제
  reply_fee: number;        // 회선비
  price: number;            // 총정산금액
  wr_datetime: string | null;
}

/**
 * 상담사 정산 — 사용자 페이지(/mypage/settlement, /mypage/settlement/history) 백엔드.
 *
 * sample 매핑:
 *   - sample/my/counselor_settlement.php       (코인 수익 = point_history 적립 내역)
 *   - sample/my/counselor_settlement_02.php    (코인 정산 = settlement_monthly 월별)
 *
 * 신규 schema:
 *   point_history       : 적립/차감 원장 (m2net-push.service 가 INSERT)
 *   settlement_monthly  : 월별 정산 마감 (admin/cron 이 INSERT)
 */
@Injectable()
export class UserSettlementsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 상담사 보유 금액 + 전월/당월 누적 + 정산 예정금액.
   *  - this_month        : 이번달 적립(earn_point) 합계
   *  - prev_month        : 전월 적립 합계
   *  - balance           : member.point (현재 보유)
   *  - estimated_payout  : sample set_con_account_v2 공식으로 당월 정산 예정 계산
   */
  /**
   * @param month YYYY-MM (선택). 없으면 현재 월.
   */
  async summary(memberId: number, month?: string): Promise<SettlementSummary> {
    const targetMonth = (month && /^\d{4}-\d{2}$/.test(month))
      ? month
      : new Date().toISOString().slice(0, 7);

    const rows = await this.sql<{
      this_month: string | null;
      prev_month: string | null;
      balance: number | null;
      amt_free: string | null;
      amt_pro: string | null;
      royalty_free_pct: number | null;
      royalty_pro_pct: number | null;
      other_plus: string | null;
      other_minus: string | null;
    }[]>`
      SELECT
        (SELECT COALESCE(SUM(earn_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND earn_point > 0
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS this_month,
        (SELECT COALESCE(SUM(earn_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND earn_point > 0
            AND to_char(created_at, 'YYYY-MM') =
                to_char(to_date(${targetMonth}, 'YYYY-MM') - interval '1 month', 'YYYY-MM')
        )::text AS prev_month,
        (SELECT point FROM member WHERE id = ${memberId}) AS balance,
        -- 선택 월의 consultation 누적 (END_CHAT/DISCONNECT 만).
        -- 핵심 가드: point_history 에 실제 적립된 row 만 합산 (sample 의 EXISTS g5_point 가드 동등).
        -- 두 테이블이 어긋나는 과거 데이터(ON CONFLICT 실패로 point_history INSERT 누락 등)는
        -- 정산 누적에서 자동 제외 → 회원에게 적립되지 않은 금액으로 정산비 부풀어오르는 사고 방지.
        (SELECT COALESCE(SUM(c.amt_free), 0)
           FROM consultation c
          WHERE c.counselor_id = ${memberId}
            AND c.reason IN ('END_CHAT','END_CHAT_LOCAL','DISCONNECT')
            AND to_char(c.created_at, 'YYYY-MM') = ${targetMonth}
            AND EXISTS (
              SELECT 1 FROM point_history ph
               WHERE ph.rel_table = 'consultation'
                 AND ph.rel_id = c.id::text
                 AND ph.member_id = ${memberId}
                 AND ph.earn_point > 0
            )
        )::text AS amt_free,
        (SELECT COALESCE(SUM(c.amt_pro), 0)
           FROM consultation c
          WHERE c.counselor_id = ${memberId}
            AND c.reason IN ('END_CHAT','END_CHAT_LOCAL','DISCONNECT')
            AND to_char(c.created_at, 'YYYY-MM') = ${targetMonth}
            AND EXISTS (
              SELECT 1 FROM point_history ph
               WHERE ph.rel_table = 'consultation'
                 AND ph.rel_id = c.id::text
                 AND ph.member_id = ${memberId}
                 AND ph.earn_point > 0
            )
        )::text AS amt_pro,
        (SELECT free_royalty_pct FROM member WHERE id = ${memberId}) AS royalty_free_pct,
        (SELECT paid_royalty_pct FROM member WHERE id = ${memberId}) AS royalty_pro_pct,
        -- 기타정산비 입력: consultation 매칭 안 되는 point_history (예: 관리자 보너스).
        (SELECT COALESCE(SUM(earn_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND earn_point > 0
            AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS other_plus,
        (SELECT COALESCE(SUM(use_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND use_point > 0
            AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS other_minus
    `;
    const r = rows[0] ?? {
      this_month: '0', prev_month: '0', balance: 0,
      amt_free: '0', amt_pro: '0', royalty_free_pct: 0, royalty_pro_pct: 0,
      other_plus: '0', other_minus: '0',
    };
    // sample set_con_account_v2 공식.
    const amtFree = Number(r.amt_free ?? 0);
    const amtPro = Number(r.amt_pro ?? 0);
    const royFreePct = Number(r.royalty_free_pct ?? 0);
    const royProPct = Number(r.royalty_pro_pct ?? 0);
    const priceFree = Math.floor((amtFree * royFreePct) / 100);
    const pricePaid = Math.floor((amtPro * royProPct) / 100);
    // 기타정산비: sample 처럼 plus 는 royalty_pro 적용, minus 는 그대로 차감.
    const otherPlus = Number(r.other_plus ?? 0);
    const otherMinus = Number(r.other_minus ?? 0);
    const priceOther = Math.floor((otherPlus * royProPct) / 100) - otherMinus;
    const priceTot = priceFree + pricePaid + priceOther;
    const supplyPrice = Math.floor(priceTot / 1.1);
    const vatAmount = priceTot - supplyPrice;
    const withholdingTax = Math.floor(supplyPrice * 0.033);
    const replyFee = priceTot >= 50000 ? 20000 : 0;
    const estimatedPayout = Math.max(0, supplyPrice - withholdingTax - replyFee);

    return {
      this_month: Number(r.this_month ?? 0),
      prev_month: Number(r.prev_month ?? 0),
      balance: Number(r.balance ?? 0),
      estimated_payout: estimatedPayout,
      month: targetMonth,
      payout_breakdown: {
        amt_free: amtFree,
        amt_pro: amtPro,
        royalty_free_pct: royFreePct,
        royalty_pro_pct: royProPct,
        price_free: priceFree,
        price_paid: pricePaid,
        price_other: priceOther,
        price_tot: priceTot,
        supply_price: supplyPrice,
        vat_amount: vatAmount,
        withholding_tax: withholdingTax,
        reply_fee: replyFee,
      },
    };
  }

  /**
   * 코인 수익 내역 (sample counselor_settlement.php 동등).
   *  - 본인 적립/차감 모두. 가장 최근부터.
   *  - consultation 매칭(rel_table='consultation' AND rel_id=consultation.id::text) 으로
   *    고객명/선불후불(preflag) 표시.
   *  - md='Y'/'N' 필터: consultation.preflag 가 일치하는 row 만
   *  - fr_date~to_date 필터: created_at BETWEEN
   */
  async incomeList(params: {
    memberId: number;
    page?: number;
    limit?: number;
    md?: 'Y' | 'N' | null;
    fromDate?: string | null;  // YYYY-MM-DD
    toDate?: string | null;
  }): Promise<{ items: IncomeItem[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 15)));
    const offset = (page - 1) * limit;

    const dateFilter = (params.fromDate && params.toDate)
      ? this.sql`AND ph.created_at BETWEEN ${`${params.fromDate} 00:00:00`}::timestamptz
                                       AND ${`${params.toDate} 23:59:59`}::timestamptz`
      : this.sql``;

    const mdFilter = params.md === 'Y' || params.md === 'N'
      ? this.sql`AND c.preflag = ${params.md}`
      : this.sql``;

    type Row = {
      id: number;
      created_at: Date;
      content: string | null;
      earn_point: number;
      use_point: number;
      is_paid: boolean;
      consultation_id: number | null;
      preflag: string | null;
      customer_nickname: string | null;
      customer_name: string | null;
      total: string;
    };
    const rows = await this.sql<Row[]>`
      SELECT ph.id, ph.created_at, ph.content,
             ph.earn_point, ph.use_point, ph.is_paid,
             c.id AS consultation_id,
             c.preflag,
             cm.nickname AS customer_nickname,
             cm.name     AS customer_name,
             COUNT(*) OVER ()::text AS total
        FROM point_history ph
        LEFT JOIN consultation c
               ON ph.rel_table = 'consultation'
              AND ph.rel_id = c.id::text
        LEFT JOIN member cm ON cm.id = c.member_id
       WHERE ph.member_id = ${params.memberId}
         ${dateFilter}
         ${mdFilter}
       ORDER BY ph.created_at DESC, ph.id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    const items: IncomeItem[] = rows.map((r) => {
      const amount = (r.earn_point ?? 0) - (r.use_point ?? 0);
      const customer = r.customer_nickname || r.customer_name || null;
      return {
        id: r.id,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        content: r.content ?? '',
        amount,
        is_paid: !!r.is_paid,
        preflag: (r.preflag === 'Y' || r.preflag === 'N') ? r.preflag : '',
        customer_name: customer ? maskName(customer) : null,
        consultation_id: r.consultation_id ?? null,
      };
    });
    return { items, total, page, limit };
  }

  /**
   * 월별 정산 마감 내역 (sample counselor_settlement_02.php 동등).
   *  - settlement_monthly 본인 row, 최신 월부터.
   */
  async monthlyList(params: {
    memberId: number;
    page?: number;
    limit?: number;
  }): Promise<{ items: SettlementMonthRow[]; total: number; page: number; limit: number; bank_info: { bank: string; holder: string; account: string } | null }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 15)));
    const offset = (page - 1) * limit;

    type Row = {
      id: number;
      month: string;
      price_free: number;
      price_paid: number;
      price_other: number;
      price_tot: number;
      vat_amount: number;
      withholding_tax: number;
      reply_fee: number;
      price: number;
      wr_datetime: Date | null;
      total: string;
    };
    const rows = await this.sql<Row[]>`
      SELECT id, month,
             price_free, price_paid, price_other, price_tot,
             vat_amount, withholding_tax, reply_fee, price,
             wr_datetime,
             COUNT(*) OVER ()::text AS total
        FROM settlement_monthly
       WHERE member_id = ${params.memberId}
       ORDER BY month DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    const items: SettlementMonthRow[] = rows.map((r) => ({
      id: r.id,
      month: r.month,
      price_free: Number(r.price_free ?? 0),
      price_paid: Number(r.price_paid ?? 0),
      price_other: Number(r.price_other ?? 0),
      price_tot: Number(r.price_tot ?? 0),
      vat_amount: Number(r.vat_amount ?? 0),
      withholding_tax: Number(r.withholding_tax ?? 0),
      reply_fee: Number(r.reply_fee ?? 0),
      price: Number(r.price ?? 0),
      wr_datetime: r.wr_datetime
        ? (r.wr_datetime instanceof Date ? r.wr_datetime.toISOString() : String(r.wr_datetime))
        : null,
    }));

    // 본인 등록된 정산 계좌 정보 — sample 의 mb_8('은행|예금주|계좌번호') 가
    // 신규 schema 에서는 bank_name/bank_holder/bank_account 로 분리됨.
    const me = await this.sql<{
      bank_name: string | null;
      bank_holder: string | null;
      bank_account: string | null;
    }[]>`
      SELECT bank_name, bank_holder, bank_account
        FROM member WHERE id = ${params.memberId} LIMIT 1
    `;
    let bank_info: { bank: string; holder: string; account: string } | null = null;
    const b = me[0];
    if (b && (b.bank_name || b.bank_holder || b.bank_account)) {
      bank_info = {
        bank: b.bank_name ?? '',
        holder: b.bank_holder ?? '',
        account: b.bank_account ?? '',
      };
    }

    return { items, total, page, limit, bank_info };
  }
}

/** "홍길동" → "홍*동", "타애" → "타*". 한 글자면 그대로. */
function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}*${trimmed.slice(-1)}`;
}
