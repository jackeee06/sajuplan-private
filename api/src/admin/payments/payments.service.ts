import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL, type Sql } from '../../shared/db/db.module';
import { M2netService } from '../../shared/m2net/m2net.service';
import { runtimeEnv } from '../../shared/env/runtime-env';

/**
 * sample/adm/coin_pay_history.php (메뉴 350420, "결제 내역") 정확 매핑.
 *
 *   sample SQL:                              신규 매핑:
 *   ───────────────────────────────────────────────────────────
 *   FROM saju_payment a                      FROM payment p
 *   LEFT JOIN g5_member b ON a.mb_id=b.mb_id LEFT JOIN member m ON m.id = p.member_id
 *
 *   od_time (날짜)                           p.created_at
 *   PayMethod (결제방법)                     p.pay_method
 *   Membid (사용자코드)                      p.membid
 *   mb_id (아이디)                           m.mb_id
 *   mb_nick (닉네임)                         m.nickname
 *   mb_hp (핸드폰)                           m.phone
 *   Amount (결제금액)                        p.amount
 *   Coin_Amount (충전금액)                   p.coin_amount
 *   ResultMsg (결과)                         p.result_message
 *   Tid                                      p.tid
 *   Oid                                      p.oid
 *
 *   탭 (smode):
 *     card        : PayMethod NOT IN (가상결제 4종)
 *     vbank       : PayMethod IN (GNR_VRBANK / GNR_PC_PAVC / GNR_MOB_PAVC / VRBANK_PAY)
 *     card_cancle : card + ResultMsg='취소완료'
 *
 *   상단 요약:
 *     - 전체목록 / 총건수 / 카드 건수 / 가상결제 건수
 *     - 총결제금액 = SUM(Amount) WHERE ResultMsg NOT IN ('취소완료','정상처리','입금전')
 *
 *   검색 (sfl):
 *     mb_id         : like 'stx%'
 *     mb_name/nick  : like 'stx%'
 *     mb_hp / mb_tel: like '%stx'
 *     mb_point      : >= stx
 *     mb_level      : = stx
 */

/** sample 가상결제 PG 코드 그대로 */
const VBANK_METHODS = ['GNR_VRBANK', 'GNR_PC_PAVC', 'GNR_MOB_PAVC', 'VRBANK_PAY'];

export interface PaymentRow {
  id: number;
  no: number | null;
  member_id: number | null;
  mb_id: string | null;
  member_name: string | null;
  member_nickname: string | null;
  member_phone: string | null;
  membid: string | null;
  oid: string;
  tid: string | null;
  pay_method: string | null;
  amount: number;
  coin_amount: number;
  cancelled_amount: number;
  cancel_count: number;
  status: string;
  req_result: string | null;
  result_message: string | null;
  bank_name: string | null;
  vr_account: string | null;
  deposit_name: string | null;
  deposit_time: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface PaymentDetail extends PaymentRow {
  cancel_logs: PaymentCancelLogRow[];
}

export interface PaymentCancelLogRow {
  id: number;
  log_date: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  is_success: boolean;
  req_result: string | null;
  result_message: string | null;
  http_status: number | null;
  oid: string | null;
  tid: string | null;
  refund_amount: number;
  refund_coin: number;
  refund_reason: string | null;
  is_partial: boolean;
  cancel_method: string;
  actor_admin_id: number | null;
  actor_admin_mb_id: string | null;
  actor_ip: string | null;
}

export type PaymentSfl =
  | 'mb_id'
  | 'mb_name'
  | 'mb_nick'
  | 'mb_hp'
  | 'mb_tel'
  | 'mb_level'
  | 'mb_point';

export type PaymentSmode = 'card' | 'vbank' | 'card_cancle';

export interface PaymentFilter {
  sfl?: PaymentSfl;
  stx?: string;
  fr_date?: string;
  to_date?: string;
  smode?: PaymentSmode;
  page?: number;
  limit?: number;
}

export interface CancelInput {
  refundAmount: number;
  refundCoin: number;
  refundReason: string;
  isPartial?: boolean;
  cancelMethod?: 'full' | 'partial' | 'recharge';
}

export interface CancelActor {
  adminId: number;
  ip: string | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // 자동결제 push URL 일괄 갱신 (도메인 변경 등 대응)
  //   - .env PG_AUTOPAY_PUSH_URL 을 새 도메인으로 바꾼 뒤 호출하면
  //     활성 카드 + auto_enabled=true 회원 모두에게 m2net.updateAutoPayConfig 재PUT.
  //   - auto_enabled=false 회원은 m2net에 push URL이 의미 없으므로 skip
  //     (다음번 자동충전 ON 시 setAutoConfig가 자동으로 새 URL 적용함).
  //   - 한 회원 실패해도 다른 회원 처리 계속, 결과를 요약 반환.
  // ============================================================
  async syncAutopayUrls() {
    const newPushUrl = runtimeEnv().pgAutopayPushUrl;

    type Row = {
      pm_id: number;
      member_id: number;
      mb_1: string | null;
      name: string | null;
      phone: string | null;
      billkey: string;
      amount: number;
      coin_amount: number;
    };
    const rows = await this.sql<Row[]>`
      SELECT pm.id AS pm_id, pm.member_id,
             m.csrid AS mb_1, m.name, m.phone,
             pm.billkey, pm.amount, pm.coin_amount
        FROM payment_method pm
        JOIN member m ON m.id = pm.member_id
       WHERE pm.is_active = TRUE
         AND pm.auto_enabled = TRUE
         AND m.csrid IS NOT NULL
       ORDER BY pm.id
    `;

    const successes: number[] = [];
    const failures: { memberId: number; error: string }[] = [];

    for (const r of rows) {
      const telno = (r.phone ?? '').replace(/-/g, '');
      const result = await this.m2net.updateAutoPayConfig(r.mb_1!, {
        membnm: r.name ?? '',
        telno,
        autopaypin: r.billkey,
        autopayflag: 'Y',
        autopayamt: Number(r.amount),
        autopaycoinamt: Number(r.coin_amount),
        autopaypushurl: newPushUrl,
      });
      if (result.ok) {
        successes.push(r.member_id);
      } else {
        failures.push({ memberId: r.member_id, error: result.error ?? 'unknown' });
        this.logger.warn(
          `[syncAutopayUrls] member_id=${r.member_id} 실패: ${result.error}`,
        );
      }
    }

    return {
      pushUrl: newPushUrl,
      total: rows.length,
      success: successes.length,
      failed: failures.length,
      failures, // [{memberId, error}] — 운영자가 수동 재시도 참고
    };
  }

  private buildWhere(filter: PaymentFilter, withSmode: boolean) {
    const conds: ReturnType<Sql>[] = [];
    if (filter.stx) {
      const stx = filter.stx;
      const q = `%${stx}%`;
      switch (filter.sfl) {
        case 'mb_id':
          conds.push(this.sql`(m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
          break;
        case 'mb_name':
          conds.push(this.sql`m.name ILIKE ${q}`);
          break;
        case 'mb_nick':
          conds.push(this.sql`m.nickname ILIKE ${q}`);
          break;
        case 'mb_hp':
        case 'mb_tel':
          conds.push(this.sql`REGEXP_REPLACE(COALESCE(m.phone,m.tel,''), '[^0-9]', '', 'g') ILIKE ${'%' + stx.replace(/[^0-9]/g, '') + '%'}`);
          break;
        case 'mb_point':
          conds.push(this.sql`m.point >= ${Number(stx) || 0}`);
          break;
        case 'mb_level':
          conds.push(this.sql`m.level = ${Number(stx) || 0}`);
          break;
        default:
          conds.push(this.sql`(m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q} OR p.oid ILIKE ${q})`);
      }
    }
    if (filter.fr_date) {
      conds.push(this.sql`p.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    }
    if (filter.to_date) {
      conds.push(this.sql`p.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);
    }
    if (withSmode && filter.smode) {
      if (filter.smode === 'vbank') {
        conds.push(this.sql`p.pay_method = ANY(${VBANK_METHODS})`);
      } else if (filter.smode === 'card') {
        conds.push(this.sql`(p.pay_method IS NULL OR NOT (p.pay_method = ANY(${VBANK_METHODS})))`);
      } else if (filter.smode === 'card_cancle') {
        conds.push(this.sql`(p.pay_method IS NULL OR NOT (p.pay_method = ANY(${VBANK_METHODS}))) AND p.result_message = '취소완료'`);
      }
    }

    return conds.length === 0
      ? this.sql``
      : conds.reduce(
          (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`),
          this.sql``,
        );
  }

  async findAll(filter: PaymentFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const whereClause = this.buildWhere(filter, true);

    const items = await this.sql<PaymentRow[]>`
      SELECT
        p.id, p.no, p.member_id, p.membid,
        p.oid, p.tid, p.pay_method,
        p.amount, p.coin_amount, p.cancelled_amount, p.cancel_count,
        p.status, p.req_result, p.result_message,
        p.bank_name, p.vr_account, p.deposit_name, p.deposit_time,
        p.cancelled_at, p.created_at,
        m.mb_id, m.name AS member_name, m.nickname AS member_nickname,
        m.phone AS member_phone
      FROM payment p
      LEFT JOIN member m ON m.id = p.member_id
      ${whereClause}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM payment p
      LEFT JOIN member m ON m.id = p.member_id
      ${whereClause}
    `;

    // 카운트 배지 (smode 없는 베이스 + smode별 추가 조건)
    const baseWhere = this.buildWhere({ ...filter, smode: undefined }, false);

    const summaryRows = await this.sql<{
      cnt_card: string;
      cnt_vbank: string;
      cnt_cancle: string;
      total_price: string;
    }[]>`
      SELECT
        count(*) FILTER (WHERE p.pay_method IS NULL OR NOT (p.pay_method = ANY(${VBANK_METHODS})))::text AS cnt_card,
        count(*) FILTER (WHERE p.pay_method = ANY(${VBANK_METHODS}))::text AS cnt_vbank,
        count(*) FILTER (
          WHERE (p.pay_method IS NULL OR NOT (p.pay_method = ANY(${VBANK_METHODS})))
            AND p.result_message = '취소완료'
        )::text AS cnt_cancle,
        COALESCE(SUM(
          CASE WHEN p.result_message NOT IN ('취소완료','정상처리','입금전')
                 OR p.result_message IS NULL
            THEN p.amount ELSE 0 END
        ), 0)::text AS total_price
      FROM payment p
      LEFT JOIN member m ON m.id = p.member_id
      ${baseWhere}
    `;

    return {
      items,
      total: Number(totalRows[0].cnt),
      page,
      limit,
      summary: {
        cnt_card: Number(summaryRows[0].cnt_card),
        cnt_vbank: Number(summaryRows[0].cnt_vbank),
        cnt_cancle: Number(summaryRows[0].cnt_cancle),
        total_price: Number(summaryRows[0].total_price),
      },
    };
  }

  async getDetail(id: number): Promise<PaymentDetail> {
    const rows = await this.sql<PaymentRow[]>`
      SELECT
        p.id, p.no, p.member_id, p.membid,
        p.oid, p.tid, p.pay_method,
        p.amount, p.coin_amount, p.cancelled_amount, p.cancel_count,
        p.status, p.req_result, p.result_message,
        p.bank_name, p.vr_account, p.deposit_name, p.deposit_time,
        p.cancelled_at, p.created_at,
        m.mb_id, m.name AS member_name, m.nickname AS member_nickname,
        m.phone AS member_phone
      FROM payment p
      LEFT JOIN member m ON m.id = p.member_id
      WHERE p.id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('해당 결제를 찾을 수 없습니다.');
    }

    const cancel_logs = await this.sql<PaymentCancelLogRow[]>`
      SELECT
        l.id, l.log_date, l.started_at, l.finished_at, l.duration_ms,
        l.is_success, l.req_result, l.result_message, l.http_status,
        l.oid, l.tid,
        l.refund_amount, l.refund_coin, l.refund_reason, l.is_partial, l.cancel_method,
        l.actor_admin_id, l.actor_ip,
        a.mb_id AS actor_admin_mb_id
      FROM payment_cancel_log l
      LEFT JOIN member a ON a.id = l.actor_admin_id
      WHERE l.payment_id = ${id}
         OR (l.payment_id IS NULL AND l.oid = ${rows[0].oid})
      ORDER BY l.started_at DESC
    `;

    return { ...rows[0], cancel_logs };
  }

  async cancel(paymentId: number, input: CancelInput, actor: CancelActor) {
    const refundAmount = Math.trunc(Number(input.refundAmount));
    const refundCoin = Math.trunc(Number(input.refundCoin));
    if (!Number.isFinite(refundAmount) || refundAmount < 0) {
      throw new BadRequestException('환불 금액은 0 이상의 정수여야 합니다.');
    }
    if (!Number.isFinite(refundCoin) || refundCoin < 0) {
      throw new BadRequestException('환불 코인은 0 이상의 정수여야 합니다.');
    }
    if (refundAmount === 0 && refundCoin === 0) {
      throw new BadRequestException('환불 금액 또는 환불 코인 중 하나는 0보다 커야 합니다.');
    }
    const reason = (input.refundReason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('환불 사유는 필수입니다.');
    }
    if (reason.length > 500) {
      throw new BadRequestException('환불 사유는 500자 이하로 입력해주세요.');
    }

    return await this.sql.begin(async (tx) => {
      const payRows = await tx<{
        id: number;
        member_id: number | null;
        oid: string;
        tid: string | null;
        amount: number;
        coin_amount: number;
        cancelled_amount: number;
        cancel_count: number;
        status: string;
      }[]>`
        SELECT id, member_id, oid, tid, amount, coin_amount, cancelled_amount, cancel_count, status
          FROM payment
         WHERE id = ${paymentId}
         FOR UPDATE
      `;
      if (payRows.length === 0) {
        throw new NotFoundException('해당 결제를 찾을 수 없습니다.');
      }
      const pay = payRows[0];

      if (pay.status === 'cancelled') {
        throw new BadRequestException('이미 전액 취소된 결제입니다.');
      }
      const remaining = pay.amount - pay.cancelled_amount;
      if (refundAmount > remaining) {
        throw new BadRequestException(
          `환불 가능 금액을 초과합니다. 결제: ${pay.amount.toLocaleString()}원, 이미 환불: ${pay.cancelled_amount.toLocaleString()}원, 환불 가능: ${remaining.toLocaleString()}원`,
        );
      }

      const isPartial = !!input.isPartial || refundAmount < remaining;
      const cancelMethod = input.cancelMethod ?? (isPartial ? 'partial' : 'full');
      const startedAt = new Date();

      const pgResult = {
        is_success: true,
        req_result: '0000',
        result_message: 'PG 연동 미구현 (테스트 stub) — 실제 카드/계좌 환불은 발생하지 않습니다.',
        http_status: 200,
        url: '(미연동)',
        request_body: JSON.stringify({ oid: pay.oid, tid: pay.tid, amount: refundAmount }),
        response_body: '(미연동)',
      };
      const finishedAt = new Date();

      await tx`
        INSERT INTO payment_cancel_log (
          log_date, started_at, finished_at, duration_ms,
          is_success, req_result, result_message, http_status,
          url, oid, tid, request_body, response_body,
          payment_id, refund_amount, refund_coin, refund_reason,
          is_partial, cancel_method, actor_admin_id, actor_ip
        ) VALUES (
          CURRENT_DATE, ${startedAt}, ${finishedAt}, ${finishedAt.getTime() - startedAt.getTime()},
          ${pgResult.is_success}, ${pgResult.req_result}, ${pgResult.result_message}, ${pgResult.http_status},
          ${pgResult.url}, ${pay.oid}, ${pay.tid}, ${pgResult.request_body}, ${pgResult.response_body},
          ${paymentId}, ${refundAmount}, ${refundCoin}, ${reason},
          ${isPartial}, ${cancelMethod}, ${actor.adminId}, ${actor.ip}
        )
      `;

      const newCancelled = pay.cancelled_amount + refundAmount;
      const newStatus = newCancelled >= pay.amount ? 'cancelled' : pay.status;
      await tx`
        UPDATE payment
           SET cancelled_amount = ${newCancelled},
               cancel_count = ${pay.cancel_count + 1},
               status = ${newStatus},
               result_message = CASE WHEN ${newStatus} = 'cancelled' THEN '취소완료' ELSE result_message END,
               cancelled_at = CASE WHEN ${newStatus} = 'cancelled' THEN now() ELSE cancelled_at END,
               updated_at = now()
         WHERE id = ${paymentId}
      `;

      if (refundCoin > 0 && pay.member_id) {
        let ptRows = await tx<{ paid_balance: number; free_balance: number }[]>`
          SELECT paid_balance, free_balance FROM point WHERE member_id = ${pay.member_id} FOR UPDATE
        `;
        if (ptRows.length === 0) {
          await tx`INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used) VALUES (${pay.member_id}, 0, 0, 0, 0) ON CONFLICT (member_id) DO NOTHING`;
          ptRows = await tx<{ paid_balance: number; free_balance: number }[]>`
            SELECT paid_balance, free_balance FROM point WHERE member_id = ${pay.member_id} FOR UPDATE
          `;
        }
        const paidBalance = Number(ptRows[0].paid_balance);
        if (paidBalance < refundCoin) {
          throw new BadRequestException(
            `유료 포인트 잔액이 부족하여 회수할 수 없습니다. 잔액: ${paidBalance.toLocaleString()}P, 회수 요청: ${refundCoin.toLocaleString()}P`,
          );
        }
        const newBalance = paidBalance - refundCoin + Number(ptRows[0].free_balance);

        await tx`
          INSERT INTO point_history (
            member_id, content, earn_point, use_point, balance_after,
            is_paid, rel_action, rel_table, rel_id,
            actor_admin_id, actor_ip, actor_type
          ) VALUES (
            ${pay.member_id},
            ${`결제 환불 회수 (oid=${pay.oid}, ${reason})`},
            0, ${refundCoin}, ${newBalance},
            TRUE, 'payment_cancel', 'payment', ${String(paymentId)},
            ${actor.adminId}, ${actor.ip}, 'payment'
          )
        `;
        await tx`UPDATE point SET paid_balance = paid_balance - ${refundCoin}, total_used = total_used + ${refundCoin}, updated_at = now() WHERE member_id = ${pay.member_id}`;
        await tx`UPDATE member SET point = ${newBalance} WHERE id = ${pay.member_id}`;
      }

      return {
        ok: true,
        paymentId,
        refundAmount,
        refundCoin,
        cancelMethod,
        isPartial,
        newStatus,
        cancelledAmount: newCancelled,
      };
    });
  }
}
