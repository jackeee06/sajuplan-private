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
 * 정산 음수 (carry_over_negative) 임계값 — 초과 시 OpsAlert 발송.
 * 사장님이 카톡으로 즉시 인지 → 상담사와 직접 협의.
 */
const CARRY_OVER_ALERT_THRESHOLD = 1_000_000;

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

      const memberRows = await tx<{
        id: number;
        mb_id: string | null;
        grade: string | null;
        free_royalty_pct: number | null;
        paid_royalty_pct: number | null;
        call_070_unit_cost: number | null;
      }[]>`
        SELECT id, mb_id, grade, free_royalty_pct, paid_royalty_pct, call_070_unit_cost
          FROM member
         WHERE id = ${memberId}
         LIMIT 1
      `;
      if (memberRows.length === 0) return {
        already: false, price: 0, price_tot: 0,
        early_payout_total: 0, prev_carry_over: 0, final_payout_amount: 0, carry_over_negative: 0,
      };
      const m = memberRows[0];
      const mb4 = Number(m.call_070_unit_cost ?? 0);

      // ───── 정산률: grade 기반 우선, 없으면 legacy royalty_pct ─────
      // 등급 시스템 도입 (2026-05-16). setting.revenue_rate.<grade> 가 있으면 그 비율로 통일.
      // 단일 비율을 amt_free / amt_pro 양쪽에 동일 적용.
      let royaltyFree: number;
      let royaltyPaid: number;
      const gradeRow = m.grade
        ? await tx<{ value: string }[]>`
            SELECT value FROM setting
             WHERE namespace = 'grade' AND key = ${`revenue_rate.${m.grade}`}
             LIMIT 1
          `
        : [];
      if (gradeRow.length > 0 && gradeRow[0].value) {
        // 0.35 같은 decimal → 35 (percent) 로 환산 (기존 코드가 /100 함)
        // [Audit A-#1] 정산률 형식 검증 — 0.35 대신 35 가 저장되면 ×100 환산 후 3500%
        // 적용되어 회사에 큰 손실. decimal 0~1 범위 강제.
        const rate = Number(gradeRow[0].value);
        if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
          throw new Error(
            `[settlement] 정산률 형식 오류: namespace=grade key=revenue_rate.${m.grade} value="${gradeRow[0].value}" — decimal 0~1 사이여야 함 (예: 0.35). ` +
            `정책 설정 확인 후 재실행하세요.`,
          );
        }
        const ratePct = rate * 100;
        royaltyFree = ratePct;
        royaltyPaid = ratePct;
      } else {
        // legacy 폴백 — 등급 시스템 시드 전 데이터 호환
        royaltyFree = Number(m.free_royalty_pct ?? 0);
        royaltyPaid = Number(m.paid_royalty_pct ?? 0);
      }

      // 상담 집계 (환불 + 포인트 미지급 제외)
      // [Audit C-#6] 환불 차감을 refund_request 의 amount_free/amount_pro 합산으로 정확히 계산.
      // 이전 SQL 은 refunded_amount 만으로 추정 차감 (amt_pro 우선) — 환불 시 실제 분배와
      // 불일치하면 상담사 정산이 과다/과소 산정될 수 있었음.
      // 환불 시 결정된 free/pro 비율을 그대로 빼서 일관성 보장.
      const consRow = await tx<{ amt_free: string; amt_pro: string }[]>`
        SELECT
          COALESCE(SUM(GREATEST(c.amt_free - COALESCE(rr.refunded_free, 0), 0)), 0)::text AS amt_free,
          COALESCE(SUM(GREATEST(c.amt_pro  - COALESCE(rr.refunded_pro,  0), 0)), 0)::text AS amt_pro
        FROM consultation c
        LEFT JOIN (
          SELECT consultation_id,
                 COALESCE(SUM(amount_free), 0)::bigint AS refunded_free,
                 COALESCE(SUM(amount_pro),  0)::bigint AS refunded_pro
            FROM refund_request
           WHERE status = 'approved'
           GROUP BY consultation_id
        ) rr ON rr.consultation_id = c.id
        WHERE c.counselor_id = ${memberId}
          AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
          AND c.created_at >= ${range.startday}
          AND c.created_at <  ${range.endday}
          -- 단기통화 NOT 제외 조건 제거 (2026-05-22) — 상담사 적립 정상 발생하므로 정산도 포함.
          AND c.refund_status IS DISTINCT FROM 'full'
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

      // [Audit B-#12] 부동소수점 정밀도 역산 검증 — 결과가 비정상이면 OpsAlert.
      // floor 누적 손실이 의도된 범위(VAT 10% 이하) 인지 확인. 이상치 발견 시 운영자 인지.
      const expectedSupplyMax = Math.ceil(priceTot / 1.1); // 역산 최대
      const expectedVatRange = priceTot - expectedSupplyMax; // 최소 VAT
      const anomalies: string[] = [];
      if (vat < 0) anomalies.push(`vat 음수 (${vat})`);
      if (vat > Math.ceil(priceTot * 0.12)) anomalies.push(`vat 과다 ${vat} > ${Math.ceil(priceTot * 0.12)}`);
      if (supply > priceTot) anomalies.push(`supply 과다 ${supply} > priceTot ${priceTot}`);
      if (priceTot > 0 && price < 0 && replyFee === 0) {
        // 회신비 없는데 price 가 음수면 부동소수점 오차로 추정
        anomalies.push(`price 음수 ${price} (회신비 없음)`);
      }
      if (anomalies.length > 0) {
        this.logger.error(
          `[settlement] 산식 이상 — memberId=${memberId} month=${bmonth} ` +
          `priceTot=${priceTot} supply=${supply} vat=${vat} withholding=${withholding} ` +
          `replyFee=${replyFee} price=${price} | 이상: ${anomalies.join(', ')}`,
        );
        // 트랜잭션 안에서 OpsAlert 호출 안 함 (외부 호출은 락 시간 늘림) — 로그만.
        // expectedVatRange 는 진단용 변수로만 사용 (디버깅 단서)
        void expectedVatRange;
      }

      // ───── 선지급(early payout) 차감 통합 (Phase 4, 2026-05-21) ─────
      //   1) 그 달 paid 된 선지급 합산 (settlement_month = bmonth)
      //   2) 이전 달의 carry_over_negative (= 이월된 음수 차감)
      //   3) finalPayoutAmount = max(0, price - early - prevCarry)
      //   4) before < 0 이면 carry_over_negative = |before| → 다음 달로 이월
      //
      // 사장님 정책: 음수 정산 시 회사가 임시 메움 + 다음 달 자동 차감 (회수 X).
      // 따라서 finalPayoutAmount 는 0 으로 cap, 음수분은 carry_over_negative 에 박제.
      const earlyRow = await tx<{ total: string }[]>`
        SELECT COALESCE(SUM(requested_amount), 0)::text AS total
          FROM payout_request
         WHERE counselor_id = ${memberId}
           AND status = 'paid'
           AND settlement_month = ${bmonth}
      `;
      const earlyPayoutTotal = Number(earlyRow[0].total);

      const prevMonth = this.calcPrevMonthString(bmonth);
      const prevCarryRow = await tx<{ carry: string }[]>`
        SELECT COALESCE(carry_over_negative, 0)::text AS carry
          FROM settlement_monthly
         WHERE member_id = ${memberId} AND month = ${prevMonth}
         LIMIT 1
      `;
      const prevCarryOver = prevCarryRow.length > 0 ? Number(prevCarryRow[0].carry) : 0;

      const finalBeforeCap = price - earlyPayoutTotal - prevCarryOver;
      const finalPayoutAmount = Math.max(0, finalBeforeCap);
      const carryOverNegative = finalBeforeCap < 0 ? -finalBeforeCap : 0;

      if (carryOverNegative > 0) {
        this.logger.warn(
          `[settlement] 선지급 초과 — memberId=${memberId} month=${bmonth} ` +
          `price=${price} early=${earlyPayoutTotal} prevCarry=${prevCarryOver} ` +
          `→ final=0 carry_over=${carryOverNegative} (다음 달로 이월)`,
        );
        // [carry_over 임계값 OpsAlert] -100만 초과 시 사장님 카톡으로 즉시 알림.
        //   상담사와 직접 협의 (음수 누적 시 회수 정책 사장님 결정 필요).
        //   2026-05-29 도입 (사장님 자율 진행).
        if (carryOverNegative >= CARRY_OVER_ALERT_THRESHOLD) {
          void this.opsAlert.send(
            '정산 음수 임계값 초과',
            `member_id=${memberId} mb_id=${mbId ?? '?'} month=${bmonth}\n` +
            `정산예상 ${price.toLocaleString()}원 - 선지급 ${earlyPayoutTotal.toLocaleString()}원 ` +
            `- 이전이월 ${prevCarryOver.toLocaleString()}원 = ${finalBeforeCap.toLocaleString()}원\n` +
            `→ 음수 이월 ${carryOverNegative.toLocaleString()}원 (임계값 ${CARRY_OVER_ALERT_THRESHOLD.toLocaleString()}원 초과)`,
          );
        }
      }

      // 기존 row 확인 → UPSERT
      // [Audit A-#2] 멱등성 — member_id 만으로 정확히 매칭 (OR 제거).
      // OR 조건은 mb_id 가 변경된 row 가 있을 때 잘못된 매칭 → 중복 INSERT 가능했음.
      // DB 측 UNIQUE 제약 (uq_settlement_member_month, uq_settlement_mb_id_month) 이
      // 최종 방어선. 코드 검색은 member_id 만 사용해 명확화.
      const existing = await tx<{ id: number }[]>`
        SELECT id FROM settlement_monthly
         WHERE month = ${bmonth}
           AND member_id = ${memberId}
         LIMIT 1
      `;
      const alreadyExists = existing.length > 0;

      // [Audit 2026-05-23] dry-run 보호:
      //   testOnly 일 때는 settlement_monthly 에 INSERT/UPDATE 하지 않는다.
      //   기존 버그: dry-run 으로도 row 가 생성되면 다음 실 정산 호출이
      //   alreadyExists=true 로 인식해 부수효과(point 차감) 스킵 → 중복 정산 사고.
      if (testOnly) {
        return {
          already: alreadyExists,
          price,
          price_tot: priceTot,
          early_payout_total: earlyPayoutTotal,
          prev_carry_over: prevCarryOver,
          final_payout_amount: finalPayoutAmount,
          carry_over_negative: carryOverNegative,
        };
      }

      if (alreadyExists) {
        await tx`
          UPDATE settlement_monthly SET
            price                = ${price},
            price_free           = ${priceFree},
            price_paid           = ${pricePaid},
            price_other          = ${priceOther},
            price_tot            = ${priceTot},
            vat_amount           = ${vat},
            withholding_tax      = ${withholding},
            reply_fee            = ${replyFee},
            early_payout_total   = ${earlyPayoutTotal},
            carry_over_negative  = ${carryOverNegative},
            final_payout_amount  = ${finalPayoutAmount},
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
             wr_datetime)
          VALUES
            (${memberId}, ${mbId}, ${bmonth}, ${price}, ${priceFree}, ${pricePaid}, ${priceOther}, ${priceTot},
             ${vat}, ${withholding}, ${replyFee},
             ${earlyPayoutTotal}, ${carryOverNegative}, ${finalPayoutAmount},
             now())
        `;
      }

      // 부수효과 스킵 조건:
      //   - alreadyExists: 이미 정산 완료된 월 → 포인트 중복 차감 방지 (계산값만 갱신)
      if (alreadyExists) {
        return {
          already: alreadyExists,
          price,
          price_tot: priceTot,
          early_payout_total: earlyPayoutTotal,
          prev_carry_over: prevCarryOver,
          final_payout_amount: finalPayoutAmount,
          carry_over_negative: carryOverNegative,
        };
      }

      // 선지급 settled_at 마킹 — 다음 정산에서 또 차감되지 않도록.
      //   ※ 사실 settlement_month 가 bmonth 인 row 만 이번에 차감됐고
      //     다음 달에는 settlement_month = bmonth+1 row 가 따로 카운트됨.
      //     settled_at 은 사후 추적용 (health-check C-20 invariant 가 이걸로 누락 감지).
      if (earlyPayoutTotal > 0) {
        await tx`
          UPDATE payout_request
             SET settled_at = NOW()
           WHERE counselor_id = ${memberId}
             AND status = 'paid'
             AND settlement_month = ${bmonth}
             AND settled_at IS NULL
        `;
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

        // 잔액 lock & 갱신 — 정산 대상은 수익포인트(earning_balance) 만.
        // 회원 표면 잔액(free/paid) 과 member.point 는 건드리지 않는다.
        let ptRows = await tx<{ earning_balance: number }[]>`
          SELECT earning_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
        `;
        if (ptRows.length === 0) {
          await tx`
            INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
            VALUES (${memberId}, 0, 0, 0, 0, 0)
            ON CONFLICT (member_id) DO NOTHING
          `;
          ptRows = await tx<{ earning_balance: number }[]>`
            SELECT earning_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
          `;
        }
        const earningBal = Number(ptRows[0].earning_balance);
        const balanceAfter = earningBal + delta;

        // 정산 차감 이력 (rel_table='settlement_monthly' 로 일관성 통일 — 마이그레이션/감사에서 식별)
        await tx`
          INSERT INTO point_history
            (member_id, mb_id, content, earn_point, use_point, balance_after,
             is_expired, expire_date, rel_table, rel_id, rel_action, is_settled, created_at)
          VALUES
            (${memberId}, ${mbId}, ${content}, 0, ${periodSum}, ${balanceAfter},
             true, ${range.pointInsertAt.slice(0, 10)}, 'settlement_monthly', ${mbId}, ${relAction}, true, ${range.pointInsertAt})
        `;

        // 수익포인트 차감 (정산분 만큼). free/paid 와 member.point 는 회원 표면 잔액이라 무관.
        await tx`
          UPDATE point SET
            earning_balance = GREATEST(earning_balance - ${periodSum}, 0),
            total_used      = total_used + ${periodSum},
            updated_at      = now()
          WHERE member_id = ${memberId}
        `;
      }

      // ─── 추천 수당 처리 (2026-06-04) ────────────────────────────────────────
      // 피추천인(referee)인 경우: 수익금의 rate_snapshot% 를 추천인(referrer)에게 이전.
      // - 회선비 제외 (전화망과 무관), 원천징수는 추천인 정산 시 포함됨.
      // - 3개월(months_snapshot) 이내 active 건만 처리.
      // - 동일 월 중복 처리 방지: counselor_referral_payment (referral_id, pay_month) UNIQUE.
      if (!testOnly && priceTot > 0) {
        const refRows = await tx<{
          id: number;
          referrer_id: number;
          referrer_mb_id: string | null;
          rate_snapshot: string;
        }[]>`
          SELECT r.id, r.referrer_id, rer.mb_id AS referrer_mb_id, r.rate_snapshot
            FROM counselor_referral r
            LEFT JOIN member rer ON rer.id = r.referrer_id
           WHERE r.referee_id  = ${memberId}
             AND r.status      = 'active'
             AND r.expires_at  > NOW()
           LIMIT 1
        `;
        if (refRows.length > 0) {
          const ref = refRows[0];
          const refRate    = parseFloat(ref.rate_snapshot);
          const incentive  = Math.floor(priceTot * refRate);   // 수익금(price_tot) × 요율

          if (incentive > 0) {
            // 중복 방지 — 이미 이 월에 처리됐으면 스킵
            const dupCheck = await tx<{ id: number }[]>`
              SELECT id FROM counselor_referral_payment
               WHERE referral_id = ${ref.id} AND pay_month = ${bmonth}
               LIMIT 1
            `;
            if (dupCheck.length === 0) {
              // 추천인 earning_balance 적립
              const refPtRows = await tx<{ earning_balance: number }[]>`
                SELECT earning_balance FROM point WHERE member_id = ${ref.referrer_id} FOR UPDATE
              `;
              if (refPtRows.length > 0) {
                const refBalAfter = Number(refPtRows[0].earning_balance) + incentive;
                await tx`
                  UPDATE point SET
                    earning_balance = earning_balance + ${incentive},
                    total_earned    = total_earned    + ${incentive},
                    updated_at      = NOW()
                  WHERE member_id = ${ref.referrer_id}
                `;
                await tx`
                  INSERT INTO point_history
                    (member_id, mb_id, content, earn_point, use_point, balance_after,
                     is_expired, rel_table, rel_id, rel_action, is_settled, created_at)
                  VALUES
                    (${ref.referrer_id}, ${ref.referrer_mb_id}, ${'[추천 수당] ' + mbId + ' ' + bmonth},
                     ${incentive}, 0, ${refBalAfter},
                     false, 'counselor_referral', ${String(ref.id)},
                     ${'추천수당_' + bmonth}, false, ${range.pointInsertAt})
                `;
                // 피추천인 수익금에서 차감 (earning_balance 이미 periodSum 으로 차감됨 — price_tot 기준 재차감)
                await tx`
                  UPDATE point SET
                    earning_balance = GREATEST(earning_balance - ${incentive}, 0),
                    total_used      = total_used + ${incentive},
                    updated_at      = NOW()
                  WHERE member_id = ${memberId}
                `;
                await tx`
                  INSERT INTO point_history
                    (member_id, mb_id, content, earn_point, use_point, balance_after,
                     is_expired, rel_table, rel_id, rel_action, is_settled, created_at)
                  VALUES
                    (${memberId}, ${mbId}, ${'[추천 수당 차감] ' + bmonth},
                     0, ${incentive}, ${Math.max(0, Number(refPtRows[0].earning_balance) - incentive)},
                     false, 'counselor_referral', ${String(ref.id)},
                     ${'추천수당차감_' + bmonth}, false, ${range.pointInsertAt})
                `;
                // 지급 이력 기록
                await tx`
                  INSERT INTO counselor_referral_payment (referral_id, pay_month, paid_amount, paid_at)
                  VALUES (${ref.id}, ${bmonth}, ${incentive}, NOW())
                  ON CONFLICT (referral_id, pay_month) DO NOTHING
                `;
              }
            }
          }

          // 만료 체크 — expires_at 지났으면 상태 업데이트
          const refDetail = await tx<{ expires_at: Date }[]>`
            SELECT expires_at FROM counselor_referral WHERE id = ${ref.id}
          `;
          if (refDetail.length > 0 && new Date(refDetail[0].expires_at) <= new Date()) {
            await tx`
              UPDATE counselor_referral SET status = 'expired' WHERE id = ${ref.id}
            `;
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

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

      return {
        already: false,
        price,
        price_tot: priceTot,
        early_payout_total: earlyPayoutTotal,
        prev_carry_over: prevCarryOver,
        final_payout_amount: finalPayoutAmount,
        carry_over_negative: carryOverNegative,
      };
    });
  }

  /** 'YYYY-MM' → 전월 'YYYY-MM' */
  private calcPrevMonthString(month: string): string {
    const [y, m] = month.split('-').map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, '0')}`;
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
