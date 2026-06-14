// ════════════════════════════════════════════════════════════════════════════
// ⚠️  MONEY-CRITICAL — 상담사 정산(수익금 합산·원천세). 실수=정산 오지급 사고.
//   · 변경 전 정독: _HANDBOOK/payment/05-settlement.tech.md + CLAUDE.md "돈 불변식"
//   · 변경 후 필수: `python tools/_verify_money_integrity.py` → PASS(exit 0) 확인
//   · 정산은 수익금(earning_balance) − 원천세 3.3% 만. 부가세·회선비는 옛 잔재(제거됨).
// ════════════════════════════════════════════════════════════════════════════
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';

/**
 * 신규 상담사 최소 활동 기간 — 가입 후 N일 미만 상담사는 정산 대상에서 제외.
 * 2026-05-29 도입 (사장님 자율 진행).
 * 0 으로 설정하면 룰 비활성 (가입 직후도 자동 포함).
 */
const COUNSELOR_MIN_ACTIVE_DAYS = 14;

/**
 * 월별 상담사 정산 cron 서비스.
 *
 * 원본: sample/cron/month_pay_end.php → set_con_account_v2() (sample/lib/common.lib.php:4611)
 *
 * 흐름 (전월 기준):
 *   1) 상담사 (member.level=5, left_at IS NULL) 전원 순회
 *   2) consultation 에서 reason IN (DISCONNECT, END_CHAT) + refund_status='full' 제외 → amt_free / amt_pro 합산
 *      - 단기통화환불(usetm<30): 2026-05-22 정책 정정 — **정산에 포함**.
 *        회원 차감은 skip 되지만 상담사 적립은 발생하므로 point_history 가 존재 → 정산 대상.
 *      - 포인트 미지급 건 제외: point_history (rel_table='consultation', rel_id=c.no) 가 있는 건만
 *   3) point_history 에서 상담/정산차감 외 plus/minus 별도 집계 → price_other
 *   4) 산식:
 *        price_free  = floor(amt_free * free_royalty_pct / 100)
 *        price_paid  = floor(amt_pro  * paid_royalty_pct / 100)
 *        price_other = floor(amt_other_plus * paid_royalty_pct / 100) + amt_other_minus
 *        price_tot   = price_free + price_paid + price_other
 *        supply      = floor(price_tot / 1.1)
 *        vat         = price_tot - supply
 *        withholding = floor(supply * 0.033)
 *        reply_fee   = price_tot >= 50000 ? 20000 : 0
 *        price       = supply - withholding - reply_fee   (실 지급액)
 *   5) settlement_monthly UPSERT (mb_id+month 유일)
 *   6) point_history 정산 차감 row INSERT + point 잔액 reset + member.point 갱신
 *   7) 해당 기간 point_history.is_settled=true, consultation.calc_flag='Y'
 *
 * 동시성: pg_advisory_xact_lock(상담사 id) 로 같은 상담사 중복 실행 방지.
 */
@Injectable()
export class SettlementCronService {
  private readonly logger = new Logger(SettlementCronService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly opsAlert: OpsAlertService,
  ) {}

  /**
   * 정산 진입점.
   *
   * 멱등성:
   *   - settlement_monthly 에 이미 같은 (member_id, month) row 가 있으면 → 계산값만 UPDATE.
   *     포인트 차감 / point_history.is_settled / consultation.calc_flag 갱신은 스킵.
   *     (PHP v2 의 $already_exists 분기와 동일. 두 번 돌려도 포인트 중복 차감 없음)
   *   - testOnly=true 면 row 가 없어도 INSERT 후 차감/플래그 갱신 모두 스킵.
   *
   * @param month   YYYY-MM. 생략 시 KST 전월.
   * @param testOnly true 면 settlement_monthly 만 계산. 부수효과 0.
   * @param mbId     특정 상담사 mb_id 한 명만 (생략 시 전체 level=5).
   */
  async runMonthly(month?: string, testOnly = false, mbId?: string) {
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : this.prevMonthKst();
    const range = this.monthRange(targetMonth);

    // [role/level 정리] level=5 → role='counselor' 로 통일.
    //   이중 진실원천 위험 제거 (level 만 수정/role 만 수정되는 동기화 누락 방지).
    //   현재 데이터는 둘 다 일치하지만 향후 안정성을 위해 role 기준.
    // [신규 상담사 14일 룰] 가입 직후 상담사는 그 다음 달 정산 자동 포함되던 동작 변경.
    //   가입 후 COUNSELOR_MIN_ACTIVE_DAYS 일 이상 경과한 상담사만 대상.
    //   목적: 가입 후 1~2일 활동만으로 정산 시스템 악용 방지 + 신규 상담사 검증 기간.
    //   2026-05-29 도입 (사장님 자율 진행).
    const minAgeCutoff = COUNSELOR_MIN_ACTIVE_DAYS > 0
      ? new Date(Date.now() - COUNSELOR_MIN_ACTIVE_DAYS * 86400 * 1000).toISOString()
      : null;
    const minAgeFilter = minAgeCutoff
      ? this.sql`AND created_at < ${minAgeCutoff}`
      : this.sql``;
    const counselors = mbId
      ? await this.sql<{ id: number; mb_id: string | null }[]>`
          SELECT id, mb_id FROM member
           WHERE role = 'counselor' AND left_at IS NULL AND mb_id = ${mbId}
           LIMIT 1
        `
      : await this.sql<{ id: number; mb_id: string | null }[]>`
          SELECT id, mb_id FROM member
           WHERE role = 'counselor' AND left_at IS NULL
             ${minAgeFilter}
           ORDER BY id
        `;

    const results: Array<{
      memberId: number;
      mb_id: string | null;
      ok: boolean;
      already?: boolean;
      price?: number;
      price_tot?: number;
      early_payout_total?: number;
      prev_carry_over?: number;
      final_payout_amount?: number;
      carry_over_negative?: number;
      reason?: string;
    }> = [];
    for (const c of counselors) {
      try {
        const r = await this.settleOne(c.id, c.mb_id, targetMonth, range, testOnly);
        results.push({ memberId: c.id, mb_id: c.mb_id, ok: true, ...r });
      } catch (e) {
        this.logger.error(`정산 실패 mb_id=${c.mb_id} member_id=${c.id}: ${(e as Error).message}`);
        results.push({ memberId: c.id, mb_id: c.mb_id, ok: false, reason: (e as Error).message });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;

    // 추천 관계 만료 일괄 정리 — 정산 계산(settleOne)과 분리. 실제 실행(testOnly=false) 시 1회.
    //   추천수익금 적립은 상담 종료 시점에 실시간으로 끝나므로, 여기서는 만료된 추천 관계의
    //   상태(active→expired)만 정리한다.
    if (!testOnly) {
      try {
        const expired = await this.sql<{ id: number }[]>`
          UPDATE counselor_referral
             SET status = 'expired'
           WHERE status = 'active' AND expires_at <= NOW()
          RETURNING id
        `;
        if (expired.length > 0) {
          this.logger.log(`[settlement] 추천관계 만료 정리 ${expired.length}건 (month=${targetMonth})`);
        }
      } catch (e) {
        this.logger.warn(`[settlement] 추천관계 만료 정리 실패: ${(e as Error).message}`);
      }
    }

    this.logger.log(`[settlement] month=${targetMonth} total=${results.length} ok=${ok} fail=${fail} test=${testOnly} mb_id=${mbId ?? 'ALL'}`);
    return { month: targetMonth, testOnly, mbId: mbId ?? null, total: results.length, ok, fail, results };
  }

  private async settleOne(
    memberId: number,
    mbId: string | null,
    bmonth: string,
    range: { startday: string; endday: string; pointInsertAt: string },
    testOnly: boolean,
  ): Promise<{
    already: boolean;
    price: number;
    price_tot: number;
    early_payout_total: number;
    prev_carry_over: number;
    final_payout_amount: number;
    carry_over_negative: number;
  }> {
    return await this.sql.begin(async (tx) => {
      // 상담사 단위 직렬화 (같은 member_id 중복 실행 차단)
      await tx`SELECT pg_advisory_xact_lock(7777002, ${memberId})`;

      // ───── 정산예상금액 = 전달 말일까지 미정산 수익금(earning) 순액 합산 ─────
      // [2026-06-10 정산 단순화] 사장님 직접 결정.
      //   상담수익 + 추천수익금이 모두 balance_kind='earning' 으로 흐르므로 그냥 합산한다.
      //   상담 종료 시점에 이미 effectiveAmt(=amt×정산률)로 earning 에 적립됐기 때문에,
      //   consultation.amt 에 정산률을 다시 곱하던 기존 재계산(이중계산)을 폐지한다.
      //   cutoff = range.endday (= 정산대상월 다음달 1일 00:00 KST) → "전달 말일까지".
      //   제거: 부가세 / 회선비 / 등급 구간 재계산 / 무료·유료 구분 / carry_over (사장님 미지시 임의계산).
      const settleRow = await tx<{ amount: string }[]>`
        SELECT COALESCE(SUM(earn_point) - SUM(use_point), 0)::text AS amount
          FROM point_history
         WHERE member_id = ${memberId}
           AND balance_kind = 'earning'
           AND is_settled = false
           AND created_at < ${range.endday}
      `;
      const settleAmount = Math.max(0, Number(settleRow[0].amount));

      // 미정산 선지급 — 아직 어느 정산에도 물리지 않은(status='paid' AND settled_at IS NULL) 선지급.
      const earlyRow = await tx<{ total: string }[]>`
        SELECT COALESCE(SUM(requested_amount), 0)::text AS total
          FROM payout_request
         WHERE counselor_id = ${memberId}
           AND status = 'paid'
           AND settled_at IS NULL
      `;
      const earlyPayoutTotal = Number(earlyRow[0].total);

      const netSettle = Math.max(0, settleAmount - earlyPayoutTotal);
      const withholding = Math.floor(netSettle * 0.033); // 원천세 3.3% 만
      const price = netSettle - withholding;              // 실지급액
      const priceTot = settleAmount;                       // 정산예상(원금)

      // 기존 row 확인 → UPSERT (status='calculated'). 차감/플래그는 [정산하기](markPaid)가 수행.
      // [Audit A-#2] 멱등성 — member_id 만으로 매칭 (DB UNIQUE 제약이 최종 방어선).
      const existing = await tx<{ id: number; status: string }[]>`
        SELECT id, status FROM settlement_monthly
         WHERE month = ${bmonth}
           AND member_id = ${memberId}
         LIMIT 1
      `;
      const alreadyExists = existing.length > 0;

      // testOnly: 계산만, 저장/부수효과 0.
      if (testOnly) {
        return {
          already: alreadyExists, price, price_tot: priceTot,
          early_payout_total: earlyPayoutTotal, prev_carry_over: 0,
          final_payout_amount: price, carry_over_negative: 0,
        };
      }

      // 이미 지급완료(paid)된 월은 절대 덮어쓰지 않음 (정산 후 재계산 차단).
      if (alreadyExists && existing[0].status === 'paid') {
        return {
          already: true, price, price_tot: priceTot,
          early_payout_total: earlyPayoutTotal, prev_carry_over: 0,
          final_payout_amount: price, carry_over_negative: 0,
        };
      }

      // 제거된 항목(price_free/paid/other, vat, reply_fee, carry_over)은 0 으로 박제.
      if (alreadyExists) {
        await tx`
          UPDATE settlement_monthly SET
            price                = ${price},
            price_free           = 0,
            price_paid           = 0,
            price_other          = 0,
            price_tot            = ${priceTot},
            vat_amount           = 0,
            withholding_tax      = ${withholding},
            reply_fee            = 0,
            early_payout_total   = ${earlyPayoutTotal},
            carry_over_negative  = 0,
            final_payout_amount  = ${price},
            status               = 'calculated',
            member_id            = ${memberId},
            mb_id                = ${mbId},
            wr_datetime          = COALESCE(wr_datetime, now())
          WHERE id = ${existing[0].id}
        `;
      } else {
        await tx`
          INSERT INTO settlement_monthly
            (member_id, mb_id, month, price, price_free, price_paid, price_other, price_tot,
             vat_amount, withholding_tax, reply_fee,
             early_payout_total, carry_over_negative, final_payout_amount,
             status, wr_datetime)
          VALUES
            (${memberId}, ${mbId}, ${bmonth}, ${price}, 0, 0, 0, ${priceTot},
             0, ${withholding}, 0,
             ${earlyPayoutTotal}, 0, ${price},
             'calculated', now())
        `;
      }

      // ★ 차감 안 함! [정산하기] 버튼(markPaid)이 earning 차감 + is_settled 마킹 + 선지급 settled 마킹을 수행.
      return {
        already: alreadyExists, price, price_tot: priceTot,
        early_payout_total: earlyPayoutTotal, prev_carry_over: 0,
        final_payout_amount: price, carry_over_negative: 0,
      };
    });
  }

  /**
   * 진단: 특정 상담사의 특정 월에 대해 각 WHERE 절이 어떻게 걸리는지 단계별 카운트/합계.
   * 0원 정산 원인 추적용.
   */
  async diagnose(mbId: string, month: string) {
    const range = this.monthRange(month);

    const memberRow = await this.sql<{
      id: number;
      mb_id: string;
      free_royalty_pct: number | null;
      paid_royalty_pct: number | null;
      call_070_unit_cost: number | null;
    }[]>`
      SELECT id, mb_id, free_royalty_pct, paid_royalty_pct, call_070_unit_cost
        FROM member WHERE mb_id = ${mbId} LIMIT 1
    `;
    if (memberRow.length === 0) return { error: 'member not found', mbId };
    const memberId = memberRow[0].id;
    const mb4 = Number(memberRow[0].call_070_unit_cost ?? 0);

    // 단계별 카운트
    const consAll = await this.sql<{ cnt: string; sum_free: string; sum_pro: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(amt_free),0)::text AS sum_free,
             COALESCE(SUM(amt_pro),0)::text  AS sum_pro
        FROM consultation
       WHERE counselor_id = ${memberId}
         AND created_at >= ${range.startday}
         AND created_at <  ${range.endday}
    `;
    const consWithReason = await this.sql<{ cnt: string; sum_free: string; sum_pro: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(amt_free),0)::text AS sum_free,
             COALESCE(SUM(amt_pro),0)::text  AS sum_pro
        FROM consultation
       WHERE counselor_id = ${memberId}
         AND created_at >= ${range.startday}
         AND created_at <  ${range.endday}
         AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
    `;
    const consWithReasonExceptRefund = await this.sql<{ cnt: string; sum_free: string; sum_pro: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(amt_free),0)::text AS sum_free,
             COALESCE(SUM(amt_pro),0)::text  AS sum_pro
        FROM consultation c
       WHERE c.counselor_id = ${memberId}
         AND c.created_at >= ${range.startday}
         AND c.created_at <  ${range.endday}
         AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
         -- 단기통화 NOT 제외 조건 제거 (2026-05-22) — 상담사 적립 정상 발생하므로 정산 포함.
    `;
    const consFinal = await this.sql<{ cnt: string; sum_free: string; sum_pro: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(c.amt_free),0)::text AS sum_free,
             COALESCE(SUM(c.amt_pro),0)::text  AS sum_pro
        FROM consultation c
       WHERE c.counselor_id = ${memberId}
         AND c.created_at >= ${range.startday}
         AND c.created_at <  ${range.endday}
         AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
         -- 단기통화 NOT 제외 조건 제거 (2026-05-22)
         AND EXISTS (
           SELECT 1 FROM point_history ph
            WHERE ph.rel_table = 'consultation'
              AND ph.rel_id = c.id::text
              AND ph.member_id = c.counselor_id
         )
    `;

    // point_history 자체 진단
    const phAll = await this.sql<{ cnt: string; sum_plus: string; sum_minus: string }[]>`
      SELECT COUNT(*)::text AS cnt,
             COALESCE(SUM(CASE WHEN earn_point > 0 THEN earn_point ELSE 0 END), 0)::text AS sum_plus,
             COALESCE(SUM(CASE WHEN earn_point < 0 THEN earn_point ELSE 0 END), 0)::text AS sum_minus
        FROM point_history
       WHERE member_id = ${memberId}
         AND created_at >= ${range.startday}
         AND created_at <  ${range.endday}
    `;

    // rel_table 분포
    const phByRel = await this.sql<{ rel_table: string | null; cnt: string; sum_earn: string }[]>`
      SELECT rel_table,
             COUNT(*)::text AS cnt,
             COALESCE(SUM(earn_point),0)::text AS sum_earn
        FROM point_history
       WHERE member_id = ${memberId}
         AND created_at >= ${range.startday}
         AND created_at <  ${range.endday}
       GROUP BY rel_table
       ORDER BY rel_table NULLS FIRST
    `;

    // consultation.no 가 NULL 인지 / point_history.consultation_no 가 매칭되는지 샘플
    const consSample = await this.sql<{
      id: string; no: number | null; reason: string | null;
      amt_free: number; amt_pro: number; amt: number; usetm: number;
      created_at: string;
    }[]>`
      SELECT id::text, no, reason, amt_free, amt_pro, amt, usetm, created_at::text
        FROM consultation
       WHERE counselor_id = ${memberId}
         AND created_at >= ${range.startday}
         AND created_at <  ${range.endday}
       ORDER BY created_at DESC LIMIT 5
    `;

    return {
      member: { id: memberId, mb_id: mbId, mb4, free_royalty_pct: memberRow[0].free_royalty_pct, paid_royalty_pct: memberRow[0].paid_royalty_pct },
      range,
      consultation: {
        all: consAll[0],
        with_reason: consWithReason[0],
        with_reason_except_refund: consWithReasonExceptRefund[0],
        final_with_point_match: consFinal[0],
      },
      point_history: {
        all: phAll[0],
        by_rel_table: phByRel,
      },
      cons_sample: consSample,
    };
  }

  /**
   * 롤백: 특정 월의 settlement_monthly row 전체 삭제 + 해당 기간 point_history 정산 차감 row 삭제 +
   * point_history.is_settled / consultation.calc_flag 되돌리기.
   *
   * 주의: 운영 데이터를 되돌리는 작업. 디버그/재실행 용도로만.
   */
  async rollbackMonth(month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { ok: false, error: 'invalid month' };
    }
    const range = this.monthRange(month);

    return await this.sql.begin(async (tx) => {
      // 1) 정산 차감으로 인한 point_history row 삭제 (rel_table='@member' + content like '%월 정산')
      const deletedPh = await tx<{ id: number }[]>`
        DELETE FROM point_history
         WHERE rel_table = '@member'
           AND content = ${month + '월 정산'}
        RETURNING id
      `;

      // 2) settlement_monthly row 삭제
      const deletedSettle = await tx<{ id: number; mb_id: string | null; price: number }[]>`
        DELETE FROM settlement_monthly
         WHERE month = ${month}
        RETURNING id, mb_id, price
      `;

      // 3) 해당 월 point_history.is_settled 되돌리기 (정산 차감 row 는 위에서 이미 삭제됨)
      const updatedPh = await tx<{ id: number }[]>`
        UPDATE point_history
           SET is_settled = false
         WHERE created_at >= ${range.startday}
           AND created_at <  ${range.endday}
           AND is_settled = true
        RETURNING id
      `;

      // 4) consultation.calc_flag 되돌리기
      const updatedCons = await tx<{ id: number }[]>`
        UPDATE consultation
           SET calc_flag = NULL
         WHERE created_at >= ${range.startday}
           AND created_at <  ${range.endday}
           AND calc_flag = 'Y'
        RETURNING id
      `;

      // 주의: point 잔액(point.free_balance/paid_balance/member.point)은 자동 복구하지 않음.
      // 잔액을 0 으로 리셋했던 상담사들은 별도 보정 필요. 5월 정산은 모두 price=0 이었으므로
      // 실제 잔액 차감 INSERT 가 일어났는지는 periodSum>0 인 상담사 한정. 로그로 확인 가능.

      return {
        ok: true,
        month,
        deleted_settlement_rows: deletedSettle.length,
        deleted_point_deduction_rows: deletedPh.length,
        reverted_point_history_settled: updatedPh.length,
        reverted_consultation_calc_flag: updatedCons.length,
        deleted_settlement_sample: deletedSettle.slice(0, 5),
      };
    });
  }

  /** KST 기준 전월 YYYY-MM. */
  private prevMonthKst(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth(); // 0~11. 전월 = m-1
    const prev = new Date(Date.UTC(y, m - 1, 1));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private monthRange(month: string) {
    // KST 자정 기준 — TIMESTAMPTZ 비교용 ISO 문자열
    const [y, m] = month.split('-').map((x) => Number(x));
    const startKst = new Date(Date.UTC(y, m - 1, 1) - 9 * 60 * 60 * 1000);
    const endKst = new Date(Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const pointInsertAt = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);
    return {
      startday: startKst.toISOString(),
      endday: endKst.toISOString(),
      pointInsertAt: pointInsertAt.toISOString(),
    };
  }
}
