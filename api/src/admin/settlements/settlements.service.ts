import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { SmsService } from '../../user/sms/sms.service';
import { SettlementCronService } from '../../cron/settlement-cron.service';

/**
 * sample/adm/settlement_list.php (메뉴 350450 "정산이력") 정확 매핑.
 *
 *   FROM g5_point_end                    →  FROM settlement_monthly s
 *   JOIN g5_member (회원정보)            →  LEFT JOIN member m ON m.id = s.member_id
 *
 *   컬럼:
 *     mb_id         → m.mb_id (or s.mb_id)
 *     mb_name       → m.name
 *     mb_nick       → m.nickname
 *     mb_19         → m.free_royalty_pct  (무료R%)
 *     mb_20         → m.paid_royalty_pct  (유료R%)
 *     month         → s.month
 *     price_free    → s.price_free
 *     price_paid    → s.price_paid
 *     price_other   → s.price_other
 *     price_tot     → s.price_tot
 *     vat_amount    → s.vat_amount
 *     withholding_tax → s.withholding_tax
 *     reply_fee     → s.reply_fee
 *     price         → s.price
 *
 *   검색 (sfl=mb_id, like '%stx%')
 *   기간 (month between fr_yyyy-mm and to_yyyy-mm)
 */

export interface SettlementRow {
  id: number;
  no: number | null;
  member_id: number | null;
  mb_id: string | null;
  member_name: string | null;
  member_nickname: string | null;
  free_royalty_pct: number | null;
  paid_royalty_pct: number | null;
  month: string;
  kind: string | null;
  price_free: number;
  price_paid: number;
  price_other: number;
  price_tot: number;
  vat_amount: number;
  withholding_tax: number;
  reply_fee: number;
  price: number;
  early_payout_total: number;
  wr_datetime: string | null;
  created_at: string;
  status: 'calculated' | 'paid' | 'voided';
  paid_at: string | null;
  paid_by_id: number | null;
  voided_at: string | null;
  voided_by_id: number | null;
  voided_by_name: string | null;
  void_reason: string | null;
}

export type SettlementSfl = 'mb_id' | 'kind';

export interface SettlementFilter {
  sfl?: SettlementSfl;
  stx?: string;
  fr_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
    private readonly settlementCron: SettlementCronService,
  ) {}

  /**
   * 회원 1명 즉시 정산 — 미리보기 화면 [정산하기] 버튼.
   * [2026-06-10] cron 없이 사장님이 원할 때 회원별 직접 정산.
   *   1) 그 회원의 해당 월 정산 row 를 계산·생성(settleOne, status='calculated')
   *   2) 곧바로 markPaid (수익금 차감 + 지급완료 기록 + 선지급 settled 마킹 + 알림톡)
   * 이미 'paid' 면 중복 차단. 정산할 수익금이 0 이면 거부.
   */
  async settleNow(memberId: number, month: string, adminId: number) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month=YYYY-MM');

    const mrows = await this.sql<{ mb_id: string | null }[]>`
      SELECT mb_id FROM member WHERE id = ${memberId} AND role = 'counselor' LIMIT 1
    `;
    if (mrows.length === 0) throw new NotFoundException('상담사를 찾을 수 없습니다.');

    // 1) 계산 + calculated row 생성 (cron 산식 재사용 — 단건). 부수효과는 markPaid 가 수행.
    await this.settlementCron.runMonthly(month, false, mrows[0].mb_id ?? undefined);

    const srows = await this.sql<{ id: number; status: string; price_tot: number }[]>`
      SELECT id, status, price_tot FROM settlement_monthly
       WHERE member_id = ${memberId} AND month = ${month} LIMIT 1
    `;
    if (srows.length === 0 || Number(srows[0].price_tot) <= 0) {
      throw new BadRequestException('정산할 수익금이 없습니다.');
    }
    if (srows[0].status === 'paid') {
      throw new BadRequestException('이미 정산완료된 회원입니다.');
    }
    if (srows[0].status === 'voided') {
      throw new BadRequestException('무효화된 정산입니다. 새로 생성이 필요합니다.');
    }

    // 2) 즉시 지급완료 (차감 + is_settled + 선지급 settled + 알림톡)
    return this.markPaid(srows[0].id, adminId);
  }

  async findAll(filter: SettlementFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.stx) {
      const q = `%${filter.stx}%`;
      switch (filter.sfl) {
        case 'kind':
          conds.push(this.sql`s.kind = ${filter.stx}`);
          break;
        case 'mb_id':
        default:
          conds.push(this.sql`(s.mb_id ILIKE ${q} OR m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
      }
    }
    if (filter.fr_date && filter.to_date) {
      // sample: month between substr(fr_date,0,7) and substr(to_date,0,7)
      conds.push(this.sql`s.month BETWEEN ${filter.fr_date.slice(0, 7)} AND ${filter.to_date.slice(0, 7)}`);
    } else if (filter.fr_date) {
      conds.push(this.sql`s.month >= ${filter.fr_date.slice(0, 7)}`);
    } else if (filter.to_date) {
      conds.push(this.sql`s.month <= ${filter.to_date.slice(0, 7)}`);
    }

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce(
          (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`),
          this.sql``,
        );

    const items = await this.sql<SettlementRow[]>`
      SELECT
        s.id, s.no, s.member_id, s.mb_id, s.month, s.kind,
        s.price_free, s.price_paid, s.price_other, s.price_tot,
        s.vat_amount, s.withholding_tax, s.reply_fee, s.price,
        s.early_payout_total,
        s.wr_datetime, s.created_at,
        s.status, s.paid_at, s.paid_by_id,
        s.voided_at, s.voided_by_id, s.void_reason,
        COALESCE(va.nickname, va.name, va.mb_id) AS voided_by_name,
        m.mb_id, m.name AS member_name, m.nickname AS member_nickname,
        m.free_royalty_pct, m.paid_royalty_pct
      FROM settlement_monthly s
      LEFT JOIN member m ON m.id = s.member_id OR m.mb_id = s.mb_id
      LEFT JOIN member va ON va.id = s.voided_by_id
      ${whereClause}
      ORDER BY s.wr_datetime DESC NULLS LAST, s.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM settlement_monthly s
      LEFT JOIN member m ON m.id = s.member_id OR m.mb_id = s.mb_id
      ${whereClause}
    `;

    const sumRows = await this.sql<{
      total_price: string;
      total_price_tot: string;
      total_vat: string;
      total_withholding: string;
      total_reply_fee: string;
    }[]>`
      SELECT
        COALESCE(SUM(s.price), 0)::text AS total_price,
        COALESCE(SUM(s.price_tot), 0)::text AS total_price_tot,
        COALESCE(SUM(s.vat_amount), 0)::text AS total_vat,
        COALESCE(SUM(s.withholding_tax), 0)::text AS total_withholding,
        COALESCE(SUM(s.reply_fee), 0)::text AS total_reply_fee
      FROM settlement_monthly s
      LEFT JOIN member m ON m.id = s.member_id OR m.mb_id = s.mb_id
      ${whereClause}
    `;

    return {
      items,
      total: Number(totalRows[0].cnt),
      page,
      limit,
      summary: {
        total_price: Number(sumRows[0].total_price),
        total_price_tot: Number(sumRows[0].total_price_tot),
        total_vat: Number(sumRows[0].total_vat),
        total_withholding: Number(sumRows[0].total_withholding),
        total_reply_fee: Number(sumRows[0].total_reply_fee),
      },
    };
  }

  /**
   * 정산 예정 미리보기 — 선택한 월의 전체 상담사 예상 정산액을 차감 없이 계산.
   * [2026-06-10] cron(매월 9일)을 기다리지 않고도 "이번 달 누가 얼마 받을지" 표로 확인.
   *
   * settleOne(cron) 과 동일 산식:
   *   정산예상   = 전달 말일까지 미정산 수익금(earning) 순액
   *   선지급차감 = 미정산 선지급(status='paid' AND settled_at IS NULL) 합
   *   실지급     = max(0, 정산예상 - 선지급) × (1 - 0.033)
   * 부수효과 0 (읽기 전용). 이미 정산 row 가 있으면 그 status 를 함께 표시.
   */
  async preview(month: string) {
    const endday = this.monthEndKst(month);
    const rows = await this.sql<{
      member_id: number;
      mb_id: string | null;
      name: string | null;
      nickname: string | null;
      settle_amount: string;
      early_payout: string;
      existing_status: 'calculated' | 'paid' | 'voided' | null;
      settlement_id: number | null;
      voided_at: string | null;
      voided_by_name: string | null;
      void_reason: string | null;
    }[]>`
      SELECT
        m.id AS member_id, m.mb_id, m.name, m.nickname,
        COALESCE((
          SELECT SUM(ph.earn_point) - SUM(ph.use_point)
            FROM point_history ph
           WHERE ph.member_id = m.id AND ph.balance_kind = 'earning'
             AND ph.is_settled = false AND ph.created_at < ${endday}
        ), 0)::text AS settle_amount,
        COALESCE((
          SELECT SUM(pr.requested_amount)
            FROM payout_request pr
           WHERE pr.counselor_id = m.id AND pr.status = 'paid' AND pr.settled_at IS NULL
        ), 0)::text AS early_payout,
        sm.status AS existing_status,
        sm.id AS settlement_id,
        sm.voided_at,
        sm.void_reason,
        COALESCE(va.nickname, va.name, va.mb_id) AS voided_by_name
      FROM member m
      LEFT JOIN settlement_monthly sm ON sm.member_id = m.id AND sm.month = ${month}
      LEFT JOIN member va ON va.id = sm.voided_by_id
      WHERE m.role = 'counselor' AND m.left_at IS NULL
    `;

    const items = rows
      .map((r) => {
        const settleAmount = Math.max(0, Number(r.settle_amount));
        const early = Number(r.early_payout);
        const net = Math.max(0, settleAmount - early);
        const withholding = Math.floor(net * 0.033);
        const price = net - withholding;
        return {
          member_id: r.member_id,
          mb_id: r.mb_id,
          member_name: r.name,
          member_nickname: r.nickname,
          settle_amount: settleAmount,      // 정산예상(원금)
          early_payout_total: early,        // 선지급 당겨감
          withholding_tax: withholding,     // 원천세 3.3%
          price,                            // 실지급액
          status: r.existing_status ?? 'pending', // 정산 row 없으면 pending(미정산)
          settlement_id: r.settlement_id,
          voided_at: r.voided_at,
          voided_by_name: r.voided_by_name,
          void_reason: r.void_reason,
        };
      })
      // 정산예상 또는 선지급이 있거나 이미 정산 row 가 있는 상담사만 (활동 없는 상담사 숨김)
      .filter((x) => x.settle_amount > 0 || x.early_payout_total > 0 || x.settlement_id !== null)
      .sort((a, b) => b.settle_amount - a.settle_amount);

    return {
      month,
      items,
      summary: {
        count: items.length,
        total_settle: items.reduce((s, x) => s + x.settle_amount, 0),
        total_early_payout: items.reduce((s, x) => s + x.early_payout_total, 0),
        total_withholding: items.reduce((s, x) => s + x.withholding_tax, 0),
        total_price: items.reduce((s, x) => s + x.price, 0),
      },
    };
  }

  /** KST 현재월 'YYYY-MM' (preview 기본값용). */
  currentMonthKst(): string {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * 정산 row 를 "정산하기"(지급완료) 처리 — 사장님이 통장 송금 후 호출.
   *
   * [2026-06-10 정산 단순화] 차감을 cron→이 버튼으로 이동.
   *   settleOne(cron)은 계산만 하고(status='calculated'), 실제 수익금 차감은 여기서 한다.
   *   - earning_balance 에서 price_tot(정산예상=원금) 만큼 차감 (원천세는 회사가 세무서 납부분이라
   *     상담사 earning 에서는 원금 전체가 빠진다).
   *   - 정산 대상 earning 이력(전달 말일까지 미정산분)을 is_settled=true 로 마킹 → 다음 정산 중복 방지.
   *   - 미정산 선지급(payout) 도 settled_at 마킹.
   *   status 'calculated' → 'paid' 단방향. voided 는 마킹 불가.
   */
  async markPaid(id: number, adminId: number) {
    const result = await this.sql.begin(async (tx) => {
      const rows = await tx<{
        member_id: number | null;
        mb_id: string | null;
        month: string;
        price_tot: number;
        status: string;
      }[]>`
        SELECT member_id, mb_id, month, price_tot, status
          FROM settlement_monthly WHERE id = ${id} FOR UPDATE
      `;
      if (rows.length === 0) throw new NotFoundException('정산 row 가 없습니다.');
      const row = rows[0];
      if (row.status === 'paid') throw new BadRequestException('이미 지급완료 상태입니다.');
      if (row.status === 'voided') throw new BadRequestException('무효화된 정산은 지급완료로 변경할 수 없습니다.');

      const memberId = row.member_id;
      const settleAmount = Math.max(0, Number(row.price_tot)); // 정산예상(원금) = 수익금 차감액

      if (memberId !== null && settleAmount > 0) {
        // 정산 대상 cutoff = 정산월 다음달 1일 00:00 KST (settleOne 의 range.endday 와 반드시 동일해야 함).
        const endday = this.monthEndKst(row.month);

        // 상담사 수익포인트(earning) lock & 차감. 회원 표면 잔액(free/paid)·member.point 는 무관.
        let ptRows = await tx<{ earning_balance: number }[]>`
          SELECT earning_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
        `;
        if (ptRows.length === 0) {
          await tx`
            INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
            VALUES (${memberId}, 0, 0, 0, 0, 0) ON CONFLICT (member_id) DO NOTHING
          `;
          ptRows = await tx<{ earning_balance: number }[]>`
            SELECT earning_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
          `;
        }
        const earningBal = Number(ptRows[0].earning_balance);
        const balanceAfter = Math.max(0, earningBal - settleAmount);

        // 정산 차감 이력 (is_settled=true, balance_kind='earning', rel_table='settlement_monthly')
        await tx`
          INSERT INTO point_history
            (member_id, mb_id, content, earn_point, use_point, balance_after,
             rel_table, rel_id, rel_action, is_settled, actor_type, balance_kind)
          VALUES
            (${memberId}, ${row.mb_id}, ${row.month + '월 정산'}, 0, ${settleAmount}, ${balanceAfter},
             'settlement_monthly', ${String(id)}, ${row.month + '월 정기정산'}, true, 'admin', 'earning')
        `;

        await tx`
          UPDATE point SET
            earning_balance = GREATEST(earning_balance - ${settleAmount}, 0),
            total_used      = total_used + ${settleAmount},
            updated_at      = now()
          WHERE member_id = ${memberId}
        `;

        // 정산 대상 earning 이력 '정산됨' 마킹 (전달 말일까지 미정산분). 위 차감 이력은 created_at=now()
        // (정산월 다음달 이후)이라 endday cutoff 밖이므로 영향받지 않음.
        await tx`
          UPDATE point_history SET is_settled = true
           WHERE member_id = ${memberId}
             AND balance_kind = 'earning'
             AND is_settled = false
             AND created_at < ${endday}
        `;

        // 미정산 선지급 settled 마킹 (정산예상 계산 시 차감했으므로 다음 정산에서 중복 차감 방지)
        await tx`
          UPDATE payout_request SET settled_at = NOW()
           WHERE counselor_id = ${memberId}
             AND status = 'paid'
             AND settled_at IS NULL
        `;
      }

      await tx`
        UPDATE settlement_monthly
           SET status = 'paid', paid_at = NOW(), paid_by_id = ${adminId}
         WHERE id = ${id}
      `;
      return { memberId, settleAmount };
    });

    this.logger.log(`[markPaid] id=${id} member=${result.memberId} earning차감=${result.settleAmount} admin=${adminId}`);
    // 상담사에게 정산완료 알림톡 (실패해도 본 작업 안 막음 — void)
    void this.notifySettlementComplete(id).catch((e) => {
      this.logger.warn(`[notifySettlementComplete] id=${id}: ${e instanceof Error ? e.message : String(e)}`);
    });
    return { ok: true, id, status: 'paid' };
  }

  /** 'YYYY-MM' → 그 달 다음달 1일 00:00 KST 의 ISO (정산 cutoff). settlement-cron.monthRange.endday 와 동일. */
  private monthEndKst(month: string): string {
    const [y, m] = month.split('-').map((x) => Number(x));
    const endKst = new Date(Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000);
    return endKst.toISOString();
  }

  /**
   * 정산완료 알림톡 발송 — 상담사에게 본인 정산 결과 통보.
   * BizM 템플릿: settlement_complete (사장님 신규 등록 필요, 카카오 검수 1~3일)
   * 변수: 상담사명 / 정산월 / 실지급액
   *
   * 템플릿 미등록 상태에서도 호출 → sms.service 가 template_not_found 로 reject + alimtalk_log 기록.
   * 사장님이 BizM 등록 + 검수 통과 후 자동 작동.
   */
  private async notifySettlementComplete(id: number): Promise<void> {
    const rows = await this.sql<{
      mb_id: string | null;
      month: string;
      price: number;
      phone: string | null;
      nickname: string | null;
      name: string | null;
    }[]>`
      SELECT s.mb_id, s.month, s.price, m.phone, m.nickname, m.name
        FROM settlement_monthly s
        LEFT JOIN member m ON m.id = s.member_id
       WHERE s.id = ${id}
       LIMIT 1
    `;
    const r = rows[0];
    if (!r?.phone) {
      this.logger.warn(`[notifySettlementComplete] phone 없음 id=${id} mb_id=${r?.mb_id}`);
      return;
    }
    const displayName = (r.nickname || r.name || '상담사').trim();
    await this.sms.sendAlimtalkByCode(
      'settlement_complete',
      r.phone,
      { 상담사명: displayName, 정산월: r.month, 실지급액: r.price.toLocaleString() },
      '정산 완료 안내',
    );
  }

  /**
   * 정산 row 를 무효화 — 사고/오정산 정정용. 사유 필수.
   * status 'calculated' 또는 'paid' → 'voided'. 한 번 voided 되면 되돌릴 수 없음.
   */
  async markVoided(id: number, adminId: number, reason: string) {
    const trimmedReason = (reason ?? '').trim();
    if (trimmedReason.length < 5) {
      throw new BadRequestException('무효화 사유는 5자 이상 작성해야 합니다.');
    }

    await this.sql.begin(async (tx) => {
      const rows = await tx<{
        member_id: number | null;
        mb_id: string | null;
        month: string;
        price_tot: number;
        status: string;
        paid_at: string | null;
      }[]>`
        SELECT member_id, mb_id, month, price_tot, status, paid_at
          FROM settlement_monthly WHERE id = ${id} FOR UPDATE
      `;
      if (rows.length === 0) throw new NotFoundException('정산 row 가 없습니다.');
      const row = rows[0];
      if (row.status === 'voided') throw new BadRequestException('이미 무효화 상태입니다.');

      // [2026-06-10] paid 였던 정산을 무효화하면 차감했던 수익금을 되돌린다.
      //   (calculated 상태는 아직 차감 전이므로 복구 불필요 — status 만 변경)
      if (row.status === 'paid' && row.member_id !== null && Number(row.price_tot) > 0) {
        const memberId = row.member_id;
        const settleAmount = Number(row.price_tot);
        const endday = this.monthEndKst(row.month);

        // 1) 차감 흔적(정산 차감 point_history) 제거
        await tx`
          DELETE FROM point_history
           WHERE rel_table = 'settlement_monthly' AND rel_id = ${String(id)} AND member_id = ${memberId}
        `;

        // 2) 수익금 복구 (차감분 되돌림)
        await tx`
          UPDATE point SET
            earning_balance = earning_balance + ${settleAmount},
            total_used      = GREATEST(total_used - ${settleAmount}, 0),
            updated_at      = now()
          WHERE member_id = ${memberId}
        `;

        // 3) 이 정산이 '정산됨' 마킹한 수익금 이력을 다시 '미정산'으로 복구.
        //    이 회원의 직전 paid 정산(더 이른 달)의 cutoff 이후 ~ 이 정산 cutoff 사이만 풀어
        //    이전 달 정산분까지 과도하게 풀리는 것을 방지.
        const prevPaid = await tx<{ month: string }[]>`
          SELECT month FROM settlement_monthly
           WHERE member_id = ${memberId} AND status = 'paid' AND month < ${row.month}
           ORDER BY month DESC LIMIT 1
        `;
        const lowerBound = prevPaid.length > 0 ? this.monthEndKst(prevPaid[0].month) : '1970-01-01T00:00:00.000Z';
        await tx`
          UPDATE point_history SET is_settled = false
           WHERE member_id = ${memberId}
             AND balance_kind = 'earning'
             AND is_settled = true
             AND (rel_table IS DISTINCT FROM 'settlement_monthly')
             AND created_at >= ${lowerBound}
             AND created_at <  ${endday}
        `;

        // 4) 이 정산이 'settled' 처리한 선지급을 다시 미정산으로 (다음 정산에서 재차감되도록)
        if (row.paid_at) {
          await tx`
            UPDATE payout_request SET settled_at = NULL
             WHERE counselor_id = ${memberId}
               AND status = 'paid'
               AND settled_at IS NOT NULL
               AND settled_at >= ${row.paid_at}
          `;
        }

        this.logger.log(`[markVoided] id=${id} member=${memberId} 수익금복구=${settleAmount} admin=${adminId}`);
      }

      await tx`
        UPDATE settlement_monthly
           SET status = 'voided',
               voided_at = NOW(),
               voided_by_id = ${adminId},
               void_reason = ${trimmedReason}
         WHERE id = ${id}
      `;
    });

    return { ok: true, id, status: 'voided' };
  }
}
