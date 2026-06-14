// ════════════════════════════════════════════════════════════════════════════
// ⚠️  MONEY-CRITICAL — 상담사 선지급(가불·실제 통장 입금). 실수=실제 돈 오송금.
//   · 변경 전 정독: _HANDBOOK/payment/06-payout.tech.md + CLAUDE.md "돈 불변식"
//   · 변경 후 필수: `python tools/_verify_money_integrity.py` → PASS(exit 0) 확인
//   · 수익금70%·수수료5%·원천세3.3%·최소3만원·일1회. 정산과 이중지급 방지 연동.
// ════════════════════════════════════════════════════════════════════════════
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql, type TxSql } from '../../shared/db/db.module';
import { SmsService } from '../../user/sms/sms.service';

/**
 * 어드민 — 선지급(early payout) 일괄 처리 (Phase 3).
 *
 * 운영 흐름:
 *   상담사 신청 → 어드민 대기 큐 → 일과 종료 시 일괄 확인 + CSV 다운로드
 *   → 운영자가 은행 앱에서 직접 송금 → 어드민에서 "송금 완료" 마킹 → 카톡 자동 발송
 *
 * 안전장치:
 *   - 단일 트랜잭션 + 동시성 락 (요청 row + counselor)
 *   - 상태 머신 강제 (pending 만 paid/rejected 가능)
 *   - 이력 자동 (payout_request_log)
 *   - 카톡은 트랜잭션 외부 (실패해도 paid 는 유효)
 */
@Injectable()
export class AdminPayoutsService {
  private readonly logger = new Logger(AdminPayoutsService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
  ) {}

  /**
   * 신청 리스트 (filter: status / 날짜 / 상담사).
   */
  async list(params: {
    limit?: number;
    offset?: number;
    status?: string;
    counselorMbId?: string;
    from?: string;
    to?: string;
  }) {
    const lim = Math.min(200, Math.max(1, params.limit ?? 50));
    const off = Math.max(0, params.offset ?? 0);
    const statusFilter = params.status
      ? this.sql`AND r.status = ${params.status}`
      : this.sql``;
    const counselorFilter = params.counselorMbId
      ? this.sql`AND m.mb_id ILIKE ${'%' + params.counselorMbId + '%'}`
      : this.sql``;
    const fromFilter = params.from
      ? this.sql`AND r.requested_at >= ${params.from}::timestamptz`
      : this.sql``;
    const toFilter = params.to
      ? this.sql`AND r.requested_at < (${params.to}::date + 1)::timestamptz`
      : this.sql``;

    const items = await this.sql<Array<{
      id: number;
      counselor_id: number;
      counselor_mb_id: string | null;
      counselor_name: string | null;
      counselor_nickname: string | null;
      counselor_phone: string | null;
      grade_at_request: string;
      requested_amount: number;
      fee_amount: number;
      withholding_amount: number;
      actual_payout: number;
      fee_rate_snapshot: string;
      status: string;
      request_memo: string | null;
      admin_memo: string | null;
      reject_reason: string | null;
      bank_name_snapshot: string;
      bank_holder_snapshot: string;
      bank_account_snapshot: string;
      requested_at: string;
      decided_at: string | null;
      paid_at: string | null;
      settlement_month: string | null;
    }>>`
      SELECT r.id, r.counselor_id,
             m.mb_id AS counselor_mb_id, m.name AS counselor_name,
             m.nickname AS counselor_nickname, m.phone AS counselor_phone,
             r.grade_at_request,
             r.requested_amount, r.fee_amount, r.withholding_amount, r.actual_payout,
             r.fee_rate_snapshot::text,
             r.status, r.request_memo, r.admin_memo, r.reject_reason,
             r.bank_name_snapshot, r.bank_holder_snapshot, r.bank_account_snapshot,
             r.requested_at::text, r.decided_at::text, r.paid_at::text,
             r.settlement_month
        FROM payout_request r
        LEFT JOIN member m ON m.id = r.counselor_id
       WHERE 1=1
         ${statusFilter}
         ${counselorFilter}
         ${fromFilter}
         ${toFilter}
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
         r.requested_at DESC
       LIMIT ${lim} OFFSET ${off}
    `;
    const totalRow = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
        FROM payout_request r
        LEFT JOIN member m ON m.id = r.counselor_id
       WHERE 1=1
         ${statusFilter}
         ${counselorFilter}
         ${fromFilter}
         ${toFilter}
    `;
    return {
      items,
      total: Number(totalRow[0].count),
      limit: lim,
      offset: off,
    };
  }

  /**
   * 통계 요약 — 대시보드/페이지 상단 카드용.
   */
  async stats() {
    const rows = await this.sql<{
      pending_count: string;
      pending_amount: string;
      today_paid_count: string;
      today_paid_amount: string;
      month_paid_count: string;
      month_paid_amount: string;
      stale_pending_count: string;
    }[]>`
      SELECT
        COUNT(*) FILTER (WHERE status='pending')::text AS pending_count,
        COALESCE(SUM(requested_amount) FILTER (WHERE status='pending'),0)::text AS pending_amount,
        COUNT(*) FILTER (WHERE status='paid'
          AND paid_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
        )::text AS today_paid_count,
        COALESCE(SUM(requested_amount) FILTER (WHERE status='paid'
          AND paid_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
        ),0)::text AS today_paid_amount,
        COUNT(*) FILTER (WHERE status='paid'
          AND paid_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
        )::text AS month_paid_count,
        COALESCE(SUM(requested_amount) FILTER (WHERE status='paid'
          AND paid_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
        ),0)::text AS month_paid_amount,
        COUNT(*) FILTER (WHERE status='pending'
          AND requested_at < NOW() - interval '24 hours'
        )::text AS stale_pending_count
        FROM payout_request
    `;
    const r = rows[0];
    return {
      pending_count: Number(r.pending_count),
      pending_amount: Number(r.pending_amount),
      today_paid_count: Number(r.today_paid_count),
      today_paid_amount: Number(r.today_paid_amount),
      month_paid_count: Number(r.month_paid_count),
      month_paid_amount: Number(r.month_paid_amount),
      stale_pending_count: Number(r.stale_pending_count),  // 24시간+ 미처리 (운영자 알림 후보)
    };
  }

  /**
   * 개별 송금 완료 마킹.
   */
  async markPaid(params: {
    id: number;
    adminId: number;
    paymentProof?: string;
    adminMemo?: string;
  }): Promise<{ ok: true }> {
    const result = await this.sql.begin(async (tx) => {
      return await this.payOneTx(tx, params);
    });

    // 트랜잭션 외부 카톡 발송
    if (result.phone) {
      this.sendPaidAlimtalk(result).catch((e) =>
        this.logger.warn(`payout_request_paid 알림톡 실패: ${(e as Error).message}`),
      );
    }
    return { ok: true };
  }

  /**
   * 일괄 송금 완료 마킹 — 체크박스로 선택된 여러 건 한 번에.
   * 각 건은 개별 트랜잭션으로 처리 (한 건 실패가 다른 건 막지 않게).
   */
  async bulkMarkPaid(params: {
    ids: number[];
    adminId: number;
    paymentProof?: string;
  }): Promise<{ ok: number; failed: number; errors: Array<{ id: number; error: string }> }> {
    const { ids, adminId, paymentProof } = params;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('처리할 신청을 선택해주세요.');
    }
    if (ids.length > 100) {
      throw new BadRequestException('한 번에 100건 이하만 처리 가능합니다.');
    }

    let ok = 0;
    let failed = 0;
    const errors: Array<{ id: number; error: string }> = [];
    for (const id of ids) {
      try {
        const result = await this.sql.begin(async (tx) =>
          this.payOneTx(tx, { id: Number(id), adminId, paymentProof }),
        );
        ok++;
        if (result.phone) {
          this.sendPaidAlimtalk(result).catch((e) =>
            this.logger.warn(`payout_request_paid 알림톡 실패 id=${id}: ${(e as Error).message}`),
          );
        }
      } catch (e) {
        failed++;
        errors.push({ id, error: e instanceof Error ? e.message : 'unknown' });
        this.logger.error(`bulkMarkPaid 실패 id=${id}: ${(e as Error).message}`);
      }
    }
    return { ok, failed, errors };
  }

  /**
   * 반려 처리 — 사유 필수.
   */
  async reject(params: {
    id: number;
    adminId: number;
    reason: string;
  }): Promise<{ ok: true }> {
    const reason = (params.reason ?? '').trim();
    if (!reason) throw new BadRequestException('반려 사유는 필수입니다.');

    const result = await this.sql.begin(async (tx) => {
      const rows = await tx<{
        id: number;
        counselor_id: number;
        status: string;
        requested_amount: number;
        phone: string | null;
      }[]>`
        SELECT r.id, r.counselor_id, r.status, r.requested_amount,
               m.phone
          FROM payout_request r
          LEFT JOIN member m ON m.id = r.counselor_id
         WHERE r.id = ${params.id}
         FOR UPDATE
      `;
      if (rows.length === 0) throw new NotFoundException('신청을 찾을 수 없습니다.');
      const r = rows[0];
      if (r.status !== 'pending') {
        throw new BadRequestException(`'${r.status}' 상태의 신청은 반려할 수 없습니다.`);
      }

      await tx`
        UPDATE payout_request
           SET status = 'rejected',
               reject_reason = ${reason},
               decided_by = ${params.adminId},
               decided_at = NOW(),
               updated_at = NOW()
         WHERE id = ${params.id}
      `;
      await tx`
        INSERT INTO payout_request_log (request_id, from_status, to_status, changed_by, reason)
        VALUES (${params.id}, 'pending', 'rejected', ${`admin:${params.adminId}`}, ${reason})
      `;
      return { phone: r.phone, amount: r.requested_amount, reason };
    });

    // 카톡 발송 (트랜잭션 외부)
    if (result.phone) {
      this.sms.sendAlimtalkByCode('payout_request_rejected', result.phone, {
        amount: result.amount.toLocaleString(),
        reason: result.reason,
      }).catch((e) => this.logger.warn(`payout_request_rejected 알림톡 실패: ${(e as Error).message}`));
    }
    return { ok: true };
  }

  /**
   * 어드민 메모 저장 (paid/reject 와 별도, 단순 메모만).
   */
  async updateMemo(params: { id: number; adminId: number; memo: string }): Promise<{ ok: true }> {
    await this.sql`
      UPDATE payout_request
         SET admin_memo = ${params.memo},
             updated_at = NOW()
       WHERE id = ${params.id}
    `;
    return { ok: true };
  }

  /**
   * CSV 다운로드용 데이터 — 은행 일괄이체 포맷.
   * 헤더: 은행,예금주,계좌번호,금액,비고
   */
  async pendingForCsv(): Promise<Array<{
    counselor_mb_id: string | null;
    bank_name_snapshot: string;
    bank_holder_snapshot: string;
    bank_account_snapshot: string;
    actual_payout: number;
    grade_at_request: string;
  }>> {
    return await this.sql<Array<{
      counselor_mb_id: string | null;
      bank_name_snapshot: string;
      bank_holder_snapshot: string;
      bank_account_snapshot: string;
      actual_payout: number;
      grade_at_request: string;
    }>>`
      SELECT m.mb_id AS counselor_mb_id,
             r.bank_name_snapshot, r.bank_holder_snapshot, r.bank_account_snapshot,
             r.actual_payout, r.grade_at_request
        FROM payout_request r
        LEFT JOIN member m ON m.id = r.counselor_id
       WHERE r.status = 'pending'
       ORDER BY r.requested_at ASC
    `;
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────

  /**
   * 단일 신청 paid 마킹 (트랜잭션 안에서).
   * 카톡 발송 정보는 트랜잭션 외부에서 사용할 수 있도록 phone/amount/fee/withholding/actual/bank 반환.
   */
  private async payOneTx(tx: TxSql, params: {
    id: number;
    adminId: number;
    paymentProof?: string;
    adminMemo?: string;
  }): Promise<{
    phone: string | null;
    amount: number;
    fee: number;
    withholding: number;
    actual: number;
    bankName: string;
    bankAccountMasked: string;
  }> {
    const rows = await tx<{
      id: number;
      counselor_id: number;
      status: string;
      requested_amount: number;
      fee_amount: number;
      withholding_amount: number;
      actual_payout: number;
      bank_name_snapshot: string;
      bank_account_snapshot: string;
      phone: string | null;
    }[]>`
      SELECT r.id, r.counselor_id, r.status,
             r.requested_amount, r.fee_amount, r.withholding_amount, r.actual_payout,
             r.bank_name_snapshot, r.bank_account_snapshot,
             m.phone
        FROM payout_request r
        LEFT JOIN member m ON m.id = r.counselor_id
       WHERE r.id = ${params.id}
       FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException(`신청 #${params.id} 없음`);
    const r = rows[0];
    if (r.status !== 'pending') {
      throw new BadRequestException(`'${r.status}' 상태의 신청은 송금 완료 처리할 수 없습니다.`);
    }

    // 다음 달 정산에서 차감되도록 settlement_month 설정 = 이번 달 (YYYY-MM, KST)
    // 정산 cron 은 다음 달 1일에 전월 settlement_month 의 paid 들을 합산해서 차감.
    const monthRow = await tx<{ month: string }[]>`
      SELECT to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS month
    `;
    const settlementMonth = monthRow[0].month;

    await tx`
      UPDATE payout_request
         SET status = 'paid',
             paid_at = NOW(),
             decided_by = ${params.adminId},
             decided_at = NOW(),
             settlement_month = ${settlementMonth},
             payment_proof = COALESCE(${params.paymentProof ?? null}, payment_proof),
             admin_memo = COALESCE(${params.adminMemo ?? null}, admin_memo),
             updated_at = NOW()
       WHERE id = ${params.id}
    `;
    await tx`
      INSERT INTO payout_request_log (request_id, from_status, to_status, changed_by, reason)
      VALUES (${params.id}, 'pending', 'paid', ${`admin:${params.adminId}`}, ${params.paymentProof ?? null})
    `;

    // 계좌 마스킹 (카톡용)
    const digits = (r.bank_account_snapshot ?? '').replace(/[^0-9]/g, '');
    const last4 = digits.slice(-4);
    const masked = digits.length > 4 ? `***-***-***${last4}` : r.bank_account_snapshot;

    return {
      phone: r.phone,
      amount: r.requested_amount,
      fee: r.fee_amount,
      withholding: r.withholding_amount,
      actual: r.actual_payout,
      bankName: r.bank_name_snapshot,
      bankAccountMasked: masked,
    };
  }

  private async sendPaidAlimtalk(info: {
    phone: string | null;
    amount: number;
    fee: number;
    withholding: number;
    actual: number;
    bankName: string;
    bankAccountMasked: string;
  }): Promise<void> {
    if (!info.phone) return;
    await this.sms.sendAlimtalkByCode('payout_request_paid', info.phone, {
      amount: info.amount.toLocaleString(),
      fee: info.fee.toLocaleString(),
      withholding: info.withholding.toLocaleString(),
      actual: info.actual.toLocaleString(),
      bank: `${info.bankName} ${info.bankAccountMasked}`,
    });
  }

  /** 슈퍼어드민 권한 체크 (어드민 차단 토글용 — 별도 라우트에서 호출) */
  assertSuper(isSuper: boolean): void {
    if (!isSuper) {
      throw new ForbiddenException('슈퍼어드민만 가능합니다.');
    }
  }
}
