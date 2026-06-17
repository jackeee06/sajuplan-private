import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface SettlementSummary {
  /** 이번달 누적 — 회원이 본인에게 지급된 코인 (적립 합계, 정산 차감 row 제외) */
  this_month: number;
  /** 전달 누적 — 동일 정의 */
  prev_month: number;
  /** 누적 잔여 (현재 수익포인트) — point.earning_balance (매월 1일 정산 대상) */
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
  /** 추천인 수당 적립액 (이번달, 없으면 0) */
  referral_earn: number;
  /** 피추천 수당 차감액 (이번달, 없으면 0) */
  referral_deduct: number;
  /** 정산비전체 (계산식 표시용 최상위 필드) — 이미 추천수당 차감(price_other)이 반영된 순액 */
  price_tot: number;
  /**
   * 세금 공제 = 원천세 3.3% 하나뿐. (부가세·회선비는 2026-06-10 정산 단순화로 폐지 → vat/replyFee=0)
   * ⚠️ 추천수당은 여기 포함 안 됨 — 이미 price_tot 안에 (−)로 빠져 있어 이중차감 방지.
   *    실수령(estimated_payout) = price_tot − tax_deduction.
   */
  tax_deduction: number;
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
  /** counselor_referral 항목 구분용 */
  rel_table: string | null;
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
      referral_earn: string | null;    // 추천인 수당 적립 (이번달)
      referral_deduct: string | null;  // 피추천 수당 차감 (이번달)
    }[]>`
      SELECT
        -- [2026-05-28 강한 분리 정책] 상담사 누적 수익금 = 상담 적립 row 만.
        --   후기 적립/추천인 보상 등 회원 영역 적립은 제외 (rel_table='consultation' + content 필터).
        (SELECT COALESCE(SUM(earn_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND earn_point > 0
            AND rel_table = 'consultation'
            AND content LIKE '%상담코인 증가%'
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS this_month,
        (SELECT COALESCE(SUM(earn_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND earn_point > 0
            AND rel_table = 'consultation'
            AND content LIKE '%상담코인 증가%'
            AND to_char(created_at, 'YYYY-MM') =
                to_char(to_date(${targetMonth}, 'YYYY-MM') - interval '1 month', 'YYYY-MM')
        )::text AS prev_month,
        (SELECT COALESCE(earning_balance, 0) FROM point WHERE member_id = ${memberId}) AS balance,
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
            -- [2026-06-12 fix] 상담사 정산 수익(earning)만. balance_kind 미필터 시 회원용 무료코인
            --   (출석/가입 적립 = consumer)까지 기타정산비로 끌려와 정산금액이 부풀려지는 버그.
            AND balance_kind = 'earning'
            AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS other_plus,
        (SELECT COALESCE(SUM(use_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND use_point > 0
            -- [2026-06-12 fix] other_plus 와 동일 — 상담사 정산 수익(earning) 차감분만.
            AND balance_kind = 'earning'
            AND (rel_table IS NULL OR rel_table NOT IN ('consultation','member','@member','@thesaju_consulting','@platform_consulting'))
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS other_minus,
        -- 추천 수당 (별도 표시용 — 계산은 other_plus/minus에 이미 포함)
        (SELECT COALESCE(SUM(earn_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND earn_point > 0
            AND rel_table = 'counselor_referral'
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS referral_earn,
        (SELECT COALESCE(SUM(use_point), 0) FROM point_history
          WHERE member_id = ${memberId}
            AND use_point > 0
            AND rel_table = 'counselor_referral'
            AND to_char(created_at, 'YYYY-MM') = ${targetMonth}
        )::text AS referral_deduct
    `;
    const r = rows[0] ?? {
      this_month: '0', prev_month: '0', balance: 0,
      amt_free: '0', amt_pro: '0', royalty_free_pct: 0, royalty_pro_pct: 0,
      other_plus: '0', other_minus: '0',
    };
    // [A안 2026-06-02] this_month = point_history.earn_point 합계 = 이미 revenue_rate 적용된 상담사 몫.
    // 따라서 priceTot = this_month (추가 rate 적용 불필요).
    // 기존 royalty_pct 컬럼은 grade 시스템 도입 후 NULL → 계산 오류 원인이었음.
    const thisMonthEarning = Number(r.this_month ?? 0);
    const otherPlus = Number(r.other_plus ?? 0);
    const otherMinus = Number(r.other_minus ?? 0);
    // 기타정산비: 수익률 적용 기준이 불명확하므로 그대로 합산
    const priceOther = otherPlus - otherMinus;
    const priceTot = thisMonthEarning + priceOther;
    // [2026-06-12] 마이페이지 정산금액 미리보기를 실제 정산(settlement-cron, 2026-06-10 단순화)과 일치시킴.
    //   실제 정산 = 수익금 − 원천세 3.3% 만. (부가세 ÷1.1 · 회선비는 사장님 지시로 이미 폐지됨)
    //   기존 미리보기는 ÷1.1·회선비를 더 깎아 카드가 실수령보다 ~9% 적게 표시되는 버그였음.
    const withholdingTax = Math.floor(priceTot * 0.033); // 원천세 3.3% 만
    const estimatedPayout = Math.max(0, priceTot - withholdingTax);
    const supplyPrice = priceTot; // 부가세 분리 폐지 → 공급가 = 원금
    const vatAmount = 0;
    const replyFee = 0;
    // 하위 호환용 (breakdown UI 표시용 — 실제 정산은 cron 기준)
    const amtFree = Number(r.amt_free ?? 0);
    const amtPro = Number(r.amt_pro ?? 0);
    const royFreePct = Number(r.royalty_free_pct ?? 0);
    const royProPct = Number(r.royalty_pro_pct ?? 0);

    return {
      this_month: Number(r.this_month ?? 0),
      prev_month: Number(r.prev_month ?? 0),
      balance: Number(r.balance ?? 0),
      estimated_payout: estimatedPayout,
      month: targetMonth,
      referral_earn: Number(r.referral_earn ?? 0),       // 추천인 수당 적립
      referral_deduct: Number(r.referral_deduct ?? 0),   // 피추천 수당 차감
      price_tot: priceTot,
      tax_deduction: vatAmount + withholdingTax + replyFee,
      payout_breakdown: {
        amt_free: amtFree,
        amt_pro: amtPro,
        royalty_free_pct: royFreePct,
        royalty_pro_pct: royProPct,
        price_free: 0,
        price_paid: thisMonthEarning,   // 상담 수익 (차감 전 순수 상담분)
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
  }): Promise<{ items: IncomeItem[]; total: number; page: number; limit: number; monthly: { month: string; count: number; earn: number }[] }> {
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

    // [2026-06-14] 추천수익금 표시 정책 (handbook promotion/02-referral: 상담할 때마다 실시간 적립/차감).
    //   · 실시간 추천(적립/차감)은 rel_table='consultation' + rel_id=상담ID 라 그 상담에 묶임
    //     → 그 상담의 preflag(선불/후불) 로 자연히 분류됨. mdFilter 를 그대로 적용해 전화/채팅 칸에 정확히 표시.
    //   · 옛 월합산 추천(rel_table='counselor_referral')은 한 달치를 한 줄로 몰아 특정 상담ID가 없음.
    //     → 그래도 "그 달에 그 유형(선불/후불) 상담이 있었으면 그 탭에 노출"하도록 추론한다.
    //       (content 의 'YYYY-MM' = 추천 대상 월. 그 달 해당 상담사의 preflag=md 상담이 존재하면 그 탭에 표시.)
    //       예) 5월 상담이 전부 선불인 상담사 → 선불 탭엔 보이고 후불 탭엔 안 보임. '전체'는 항상 표시.
    //       양쪽 유형이 섞인 달이면 양 탭에 다 보임(근사) — 정밀 분류는 실시간 행이 담당.
    const legacyReferralBranch = (params.md === 'Y' || params.md === 'N')
      ? this.sql`(ph.rel_table = 'counselor_referral' AND EXISTS (
          SELECT 1 FROM consultation cc
           WHERE cc.counselor_id = ph.member_id
             AND to_char(cc.created_at, 'YYYY-MM') = substring(ph.content from '[0-9]{4}-[0-9]{2}')
             AND cc.preflag = ${params.md}
        ))`
      : this.sql`ph.rel_table = 'counselor_referral'`;

    type Row = {
      id: number;
      created_at: Date;
      content: string | null;
      earn_point: number;
      use_point: number;
      is_paid: boolean;
      consultation_id: number | null;
      preflag: string | null;
      grade_at_session: string | null;
      customer_nickname: string | null;
      customer_name: string | null;
      rel_table: string | null;
      total: string;
    };
    const rows = await this.sql<Row[]>`
      SELECT ph.id, ph.created_at, ph.content,
             ph.earn_point, ph.use_point, ph.is_paid,
             ph.rel_table,
             c.id AS consultation_id,
             c.preflag,
             c.grade_at_session,
             cm.nickname AS customer_nickname,
             cm.name     AS customer_name,
             COUNT(*) OVER ()::text AS total
        FROM point_history ph
        LEFT JOIN consultation c
               ON ph.rel_table = 'consultation'
              AND ph.rel_id = c.id::text
        LEFT JOIN member cm ON cm.id = c.member_id
       WHERE ph.member_id = ${params.memberId}
         AND (
           -- 상담 수익 (기존)
           (ph.rel_table = 'consultation'
            AND ph.earn_point > 0
            AND ph.content LIKE '%상담코인 증가%'
            ${mdFilter})
           OR
           -- 실시간 추천수익금 (적립 +/차감 −) — 상담에 묶여 같은 선불/후불로 분류 (2026-06-14)
           (ph.rel_table = 'consultation'
            AND ph.content LIKE '%추천수익금%'
            ${mdFilter})
           OR
           -- 옛 월합산 추천수당 (counselor_referral) — 분류 없음 → '전체' 탭에서만
           (${legacyReferralBranch})
         )
         ${dateFilter}
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
        grade_at_session: r.grade_at_session ?? null,
        rel_table: r.rel_table ?? null,  // 추천 수당 구분용
      };
    });

    // [2026-06-17] 월별 소계 — 페이지네이션과 무관하게 "전체" 기준 월별 적립 합(순액).
    //   상담사 본인 정산 증빙: "5월 합 N원" 이 바로 보이게 (관리자 타임라인 월소계와 동일 개념).
    //   balance_kind='earning' 전체(상담수익+추천±) 순액 = 그 달 정산 대상액. KST 기준 월.
    const monthlyRows = await this.sql<{ month: string; cnt: string; earn: string }[]>`
      SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS month,
             COUNT(*)::text AS cnt,
             COALESCE(SUM(earn_point - use_point), 0)::text AS earn
        FROM point_history
       WHERE member_id = ${params.memberId} AND balance_kind = 'earning'
       GROUP BY 1
       ORDER BY 1 DESC
    `;
    const monthly = monthlyRows.map((m) => ({
      month: m.month,
      count: Number(m.cnt),
      earn: Number(m.earn),
    }));

    return { items, total, page, limit, monthly };
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
