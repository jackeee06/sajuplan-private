import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';

/**
 * 월별 상담사 정산 cron 서비스.
 *
 * 원본: sample/cron/month_pay_end.php → set_con_account_v2() (sample/lib/common.lib.php:4611)
 *
 * 흐름 (전월 기준):
 *   1) 상담사 (member.level=5, left_at IS NULL) 전원 순회
 *   2) consultation 에서 reason IN (DISCONNECT, END_CHAT) + 환불 건 제외 → amt_free / amt_pro 합산
 *      - 환불 건: DISCONNECT && usetm < 30 && amt <= member.call_070_unit_cost
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

  constructor(@Inject(SQL) private readonly sql: Sql) {}

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

    const counselors = mbId
      ? await this.sql<{ id: number; mb_id: string | null }[]>`
          SELECT id, mb_id FROM member
           WHERE level = 5 AND left_at IS NULL AND mb_id = ${mbId}
           LIMIT 1
        `
      : await this.sql<{ id: number; mb_id: string | null }[]>`
          SELECT id, mb_id FROM member
           WHERE level = 5 AND left_at IS NULL
           ORDER BY id
        `;

    const results: Array<{
      memberId: number;
      mb_id: string | null;
      ok: boolean;
      already?: boolean;
      price?: number;
      price_tot?: number;
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
    this.logger.log(`[settlement] month=${targetMonth} total=${results.length} ok=${ok} fail=${fail} test=${testOnly} mb_id=${mbId ?? 'ALL'}`);
    return { month: targetMonth, testOnly, mbId: mbId ?? null, total: results.length, ok, fail, results };
  }

  private async settleOne(
    memberId: number,
    mbId: string | null,
    bmonth: string,
    range: { startday: string; endday: string; pointInsertAt: string },
    testOnly: boolean,
  ): Promise<{ already: boolean; price: number; price_tot: number }> {
    return await this.sql.begin(async (tx) => {
      // 상담사 단위 직렬화 (같은 member_id 중복 실행 차단)
      await tx`SELECT pg_advisory_xact_lock(7777002, ${memberId})`;

      const memberRows = await tx<{
        id: number;
        mb_id: string | null;
        free_royalty_pct: number | null;
        paid_royalty_pct: number | null;
        call_070_unit_cost: number | null;
      }[]>`
        SELECT id, mb_id, free_royalty_pct, paid_royalty_pct, call_070_unit_cost
          FROM member
         WHERE id = ${memberId}
         LIMIT 1
      `;
      if (memberRows.length === 0) return { already: false, price: 0, price_tot: 0 };
      const m = memberRows[0];
      const royaltyFree = Number(m.free_royalty_pct ?? 0);
      const royaltyPaid = Number(m.paid_royalty_pct ?? 0);
      const mb4 = Number(m.call_070_unit_cost ?? 0);

      // 상담 집계 (환불 + 포인트 미지급 제외)
      const consRow = await tx<{ amt_free: string; amt_pro: string }[]>`
        SELECT
          COALESCE(SUM(c.amt_free), 0)::text AS amt_free,
          COALESCE(SUM(c.amt_pro),  0)::text AS amt_pro
        FROM consultation c
        WHERE c.counselor_id = ${memberId}
          AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
          AND c.created_at >= ${range.startday}
          AND c.created_at <  ${range.endday}
          AND NOT (c.reason = 'DISCONNECT' AND c.usetm < 30 AND c.amt <= ${mb4})
          AND EXISTS (
            SELECT 1 FROM point_history ph
             WHERE ph.rel_table = 'consultation'
               AND ph.rel_id = c.id::text
               AND ph.member_id = c.counselor_id
          )
      `;
      const amtFree = Number(consRow[0].amt_free);
      const amtPro = Number(consRow[0].amt_pro);

      // 기타 포인트 (상담/정산차감 제외)
      const otherRow = await tx<{ amt_plus: string; amt_minus: string }[]>`
        SELECT
          COALESCE(SUM(CASE WHEN ph.earn_point > 0 THEN ph.earn_point ELSE 0 END), 0)::text AS amt_plus,
          COALESCE(SUM(CASE WHEN ph.earn_point < 0 THEN ph.earn_point ELSE 0 END), 0)::text AS amt_minus
        FROM point_history ph
        WHERE ph.member_id = ${memberId}
          AND ph.created_at >= ${range.startday}
          AND ph.created_at <  ${range.endday}
          AND (ph.rel_table IS NULL OR ph.rel_table NOT IN ('@member', '@platform_consulting', 'consultation', 'settlement'))
      `;
      const amtOtherPlus = Number(otherRow[0].amt_plus);
      const amtOtherMinus = Number(otherRow[0].amt_minus);

      // 산식
      const priceFree = Math.floor((amtFree * royaltyFree) / 100);
      const pricePaid = Math.floor((amtPro * royaltyPaid) / 100);
      const priceOther = Math.floor((amtOtherPlus * royaltyPaid) / 100) + amtOtherMinus;
      const priceTot = priceFree + pricePaid + priceOther;
      const supply = Math.floor(priceTot / 1.1);
      const vat = priceTot - supply;
      const withholding = Math.floor(supply * 0.033);
      const replyFee = priceTot >= 50000 ? 20000 : 0;
      const price = supply - withholding - replyFee;

      // 기존 row 확인 → UPSERT
      const existing = await tx<{ id: number }[]>`
        SELECT id FROM settlement_monthly
         WHERE month = ${bmonth}
           AND (member_id = ${memberId} OR mb_id = ${mbId})
         LIMIT 1
      `;
      const alreadyExists = existing.length > 0;
      if (alreadyExists) {
        await tx`
          UPDATE settlement_monthly SET
            price           = ${price},
            price_free      = ${priceFree},
            price_paid      = ${pricePaid},
            price_other     = ${priceOther},
            price_tot       = ${priceTot},
            vat_amount      = ${vat},
            withholding_tax = ${withholding},
            reply_fee       = ${replyFee},
            member_id       = ${memberId},
            mb_id           = ${mbId},
            wr_datetime     = COALESCE(wr_datetime, now())
          WHERE id = ${existing[0].id}
        `;
      } else {
        await tx`
          INSERT INTO settlement_monthly
            (member_id, mb_id, month, price, price_free, price_paid, price_other, price_tot,
             vat_amount, withholding_tax, reply_fee, wr_datetime)
          VALUES
            (${memberId}, ${mbId}, ${bmonth}, ${price}, ${priceFree}, ${pricePaid}, ${priceOther}, ${priceTot},
             ${vat}, ${withholding}, ${replyFee}, now())
        `;
      }

      // 부수효과 스킵 조건:
      //   - testOnly: dry-run
      //   - alreadyExists: 이미 정산 완료된 월 → 포인트 중복 차감 방지 (계산값만 갱신)
      if (testOnly || alreadyExists) {
        return { already: alreadyExists, price, price_tot: priceTot };
      }

      // 전월 포인트 합계 (차감 대상)
      const sumRow = await tx<{ total: string }[]>`
        SELECT COALESCE(SUM(earn_point), 0)::text AS total
          FROM point_history
         WHERE member_id = ${memberId}
           AND created_at >= ${range.startday}
           AND created_at <  ${range.endday}
           AND content NOT IN ('[수동] 11월 정산 중복', '[수동]정산 시스템 오류로인한 미지급건')
      `;
      const periodSum = Number(sumRow[0].total);

      if (periodSum > 0) {
        const delta = -periodSum;
        const content = `${bmonth}월 정산`;
        const relAction = price > 0 ? `${bmonth}월 정기정산` : `${bmonth}월 정기정산 10,000원 이하 정산 X`;

        // 잔액 lock & 갱신
        let ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
          SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
        `;
        if (ptRows.length === 0) {
          await tx`
            INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
            VALUES (${memberId}, 0, 0, 0, 0)
            ON CONFLICT (member_id) DO NOTHING
          `;
          ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
            SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
          `;
        }
        const freeBal = Number(ptRows[0].free_balance);
        const paidBal = Number(ptRows[0].paid_balance);
        const balanceAfter = freeBal + paidBal + delta;

        // 정산 차감 이력
        await tx`
          INSERT INTO point_history
            (member_id, mb_id, content, earn_point, use_point, balance_after,
             is_expired, expire_date, rel_table, rel_id, rel_action, is_settled, created_at)
          VALUES
            (${memberId}, ${mbId}, ${content}, ${delta}, ${periodSum}, ${balanceAfter},
             true, ${range.pointInsertAt.slice(0, 10)}, '@member', ${mbId}, ${relAction}, true, ${range.pointInsertAt})
        `;

        // 잔액 0 으로 리셋 (sample 원본 의미)
        await tx`
          UPDATE point SET
            free_balance = 0,
            paid_balance = 0,
            total_used   = total_used + ${freeBal + paidBal},
            updated_at   = now()
          WHERE member_id = ${memberId}
        `;
        await tx`UPDATE member SET point = 0 WHERE id = ${memberId}`;
      }

      // 정산 완료 표시
      await tx`
        UPDATE point_history
           SET is_settled = true
         WHERE member_id = ${memberId}
           AND created_at >= ${range.startday}
           AND created_at <  ${range.endday}
      `;
      await tx`
        UPDATE consultation
           SET calc_flag = 'Y'
         WHERE counselor_id = ${memberId}
           AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
           AND created_at >= ${range.startday}
           AND created_at <  ${range.endday}
      `;

      return { already: false, price, price_tot: priceTot };
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
         AND NOT (c.reason = 'DISCONNECT' AND c.usetm < 30 AND c.amt <= ${mb4})
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
         AND NOT (c.reason = 'DISCONNECT' AND c.usetm < 30 AND c.amt <= ${mb4})
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
