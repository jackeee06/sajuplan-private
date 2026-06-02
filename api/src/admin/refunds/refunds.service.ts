import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 어드민 — 상담 환불 처리 (Phase 10).
 *
 * 사용 시나리오:
 *   회원이 상담 후 분쟁 제기 (예: 사기 상담사, 통화 품질 문제)
 *   → 어드민이 ConsultationDetail 에서 환불 처리
 *   → 회원에게 포인트 환원 + consultation.refunded_amount 누적
 *   → 정산 cron 이 refunded_amount 만큼 차감해 상담사 정산에서 빠짐
 *
 * 안전장치:
 *   - 트랜잭션 + advisory lock (consultation_id 기준 직렬화)
 *   - 환불 금액 ≤ consultation.amt - 이미 환불된 금액 (over-refund 방지)
 *   - point_history → point → member.point 3단계 갱신
 *   - amount_free / amount_pro 분리 — free 가 먼저 차감 시 free 우선 환원
 *   - 멱등성 제공 안 함 — 어드민이 의도적으로 부분 환불 가능
 *
 * 정산 연동:
 *   - consultation.refunded_amount 컬럼만 갱신
 *   - settlement-cron 이 (amt_free - refunded_free) + (amt_pro - refunded_pro) 으로 계산하도록 별도 PR 필요
 *   - 단, MVP 에선 refunded_amount 전체를 amt 에서 차감
 */
@Injectable()
export class AdminRefundsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 환불 생성 + 즉시 승인 + 포인트 환원 — 단일 트랜잭션.
   * pending 상태 거치지 않고 어드민이 직접 결정.
   */
  async createAndApprove(params: {
    consultationId: number;
    amount: number;
    reason: string;
    adminId: number;
    idempotentKey?: string;
  }) {
    const { consultationId, amount, reason, adminId, idempotentKey } = params;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('환불 금액은 0보다 커야 합니다.');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('사유 필수 — 분쟁 시 증거');
    }

    // [Audit B-#8] 멱등 키로 중복 처리 차단 (HTTP 재전송 / 더블 클릭 대비)
    // 클라이언트가 idempotent_key 보내면, 같은 (consultation_id, idempotent_key)
    // 조합은 1회만 처리. DB UNIQUE (uq_refund_request_idem) 가 최후 방어선.
    if (idempotentKey && idempotentKey.trim()) {
      const existing = await this.sql<{ id: number; amount: number }[]>`
        SELECT id, amount FROM refund_request
         WHERE consultation_id = ${consultationId}
           AND idempotent_key = ${idempotentKey.trim()}
         LIMIT 1
      `;
      if (existing.length > 0) {
        return {
          ok: true as const,
          refund_id: existing[0].id,
          consultation_id: consultationId,
          amount: existing[0].amount,
          amount_free: 0,
          amount_pro: 0,
          new_balance: 0,
          refund_status: 'idempotent_skip',
        };
      }
    }

    return await this.sql.begin(async (tx) => {
      // 1. consultation 잠금
      await tx`SELECT pg_advisory_xact_lock(7777004, ${consultationId})`;

      const consRows = await tx<{
        id: number;
        member_id: number | null;
        counselor_id: number | null;
        amt: number;
        amt_free: number;
        amt_pro: number;
        refunded_amount: number;
        refund_status: string | null;
      }[]>`
        SELECT id, member_id, counselor_id, amt, amt_free, amt_pro, refunded_amount, refund_status
          FROM consultation
         WHERE id = ${consultationId}
         FOR UPDATE
      `;
      if (consRows.length === 0) throw new NotFoundException('상담을 찾을 수 없습니다.');
      const cs = consRows[0];

      if (!cs.member_id) {
        throw new BadRequestException('회원 ID 없는 상담은 환불 불가 (전화 매칭 누락 건).');
      }

      // 단기통화 자동환불(2026-05-22 정책)된 건은 수동 환불 불가 — 이미 회원 잔액 복구 완료.
      // m2net 측에도 +복구되어 있어 재환불 시 이중 환불 사고 발생.
      if (cs.refund_status === 'short_call_refund') {
        throw new BadRequestException(
          '이미 단기통화 자동환불 처리된 상담입니다. 회원 잔액·m2net 잔액 모두 복구 완료 상태로, 수동 환불 불가.',
        );
      }

      // [Audit A-#7] amt 정합성 검증 — amt_free + amt_pro = amt 가 성립해야 함.
      // 깨진 데이터에서 환불 비율 계산하면 잘못된 분배 발생 가능.
      const sumParts = (cs.amt_free ?? 0) + (cs.amt_pro ?? 0);
      if (sumParts !== (cs.amt ?? 0)) {
        throw new BadRequestException(
          `상담 금액 데이터 불일치: amt_free(${cs.amt_free}) + amt_pro(${cs.amt_pro}) = ${sumParts} ≠ amt(${cs.amt}). ` +
          `consultation #${consultationId} 데이터 점검 후 환불 처리하세요.`,
        );
      }

      const remaining = (cs.amt ?? 0) - (cs.refunded_amount ?? 0);
      if (remaining <= 0) {
        throw new BadRequestException('이미 전액 환불된 상담입니다.');
      }
      if (amount > remaining) {
        throw new BadRequestException(
          `환불 가능 금액 초과: 요청 ${amount.toLocaleString()}P, 가능 ${remaining.toLocaleString()}P (총 ${cs.amt.toLocaleString()}P - 기환불 ${cs.refunded_amount.toLocaleString()}P)`,
        );
      }

      // 2. free / pro 비율 계산 — 원본 비율 그대로 환원
      const totalOriginal = (cs.amt_free ?? 0) + (cs.amt_pro ?? 0);
      let refundFree = 0;
      let refundPro = 0;
      if (totalOriginal > 0) {
        refundFree = Math.round((amount * (cs.amt_free ?? 0)) / totalOriginal);
        refundPro = amount - refundFree;
      } else {
        refundPro = amount; // 폴백 — 모든 금액을 유료로
      }

      // 3. point 잔액 조회 (없으면 0, INSERT 필요)
      const ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${cs.member_id} LIMIT 1
      `;
      let freeBalance = Number(ptRows[0]?.free_balance ?? 0);
      let paidBalance = Number(ptRows[0]?.paid_balance ?? 0);
      const newFree = freeBalance + refundFree;
      const newPaid = paidBalance + refundPro;
      const newTotal = newFree + newPaid;

      // 4. point_history INSERT (환원 = earn_point)
      const phRow = await tx<{ id: number }[]>`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          is_paid, rel_action, rel_table, rel_id,
          actor_admin_id, actor_type
        ) VALUES (
          ${cs.member_id},
          ${`상담 환불 (consultation #${consultationId}, ${reason})`},
          ${amount}, 0, ${newTotal},
          ${refundPro > 0}, 'refund', 'consultation', ${String(consultationId)},
          ${adminId}, 'admin'
        )
        RETURNING id
      `;
      const phId = Number(phRow[0]?.id ?? 0);

      // 5. point 테이블 UPSERT
      if (ptRows.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
          VALUES (${cs.member_id}, ${refundFree}, ${refundPro}, ${amount}, 0)
        `;
      } else {
        await tx`
          UPDATE point
             SET free_balance = ${newFree},
                 paid_balance = ${newPaid},
                 total_earned = total_earned + ${amount},
                 updated_at = now()
           WHERE member_id = ${cs.member_id}
        `;
      }

      // 6. member.point 갱신 (denormalized 스냅샷)
      await tx`UPDATE member SET point = ${newTotal} WHERE id = ${cs.member_id}`;

      // 7. consultation.refunded_amount + refund_status 갱신
      const newRefunded = (cs.refunded_amount ?? 0) + amount;
      const newStatus = newRefunded >= cs.amt ? 'full' : 'partial';
      await tx`
        UPDATE consultation
           SET refunded_amount = ${newRefunded},
               refund_status = ${newStatus}
         WHERE id = ${consultationId}
      `;

      // 8. refund_request INSERT — 이력 기록
      const rrRow = await tx<{ id: number }[]>`
        INSERT INTO refund_request (
          consultation_id, member_id, counselor_id,
          amount, amount_free, amount_pro,
          reason, status, requested_by,
          decided_by, decided_reason, point_history_id,
          idempotent_key, decided_at
        ) VALUES (
          ${consultationId}, ${cs.member_id}, ${cs.counselor_id},
          ${amount}, ${refundFree}, ${refundPro},
          ${reason}, 'approved', ${`admin:${adminId}`},
          ${`admin:${adminId}`}, ${reason}, ${phId},
          ${idempotentKey?.trim() || null}, NOW()
        )
        RETURNING id
      `;

      return {
        ok: true,
        refund_id: rrRow[0].id,
        consultation_id: consultationId,
        amount,
        amount_free: refundFree,
        amount_pro: refundPro,
        new_balance: newTotal,
        refund_status: newStatus,
      };
    });
  }

  /**
   * 환불 리스트 (어드민 페이지).
   */
  async list(params: {
    limit?: number;
    offset?: number;
    status?: string;
    memberMbId?: string;
  }) {
    const lim = Math.min(100, Math.max(1, params.limit ?? 30));
    const off = Math.max(0, params.offset ?? 0);
    const statusFilter = params.status
      ? this.sql`AND r.status = ${params.status}`
      : this.sql``;
    const memberFilter = params.memberMbId
      ? this.sql`AND m.mb_id = ${params.memberMbId}`
      : this.sql``;

    const rows = await this.sql<Array<{
      id: number;
      consultation_id: number;
      member_id: number;
      counselor_id: number | null;
      amount: number;
      reason: string;
      status: string;
      requested_by: string;
      decided_by: string | null;
      created_at: string;
      decided_at: string | null;
      member_mb_id: string | null;
      counselor_mb_id: string | null;
      counselor_nickname: string | null;
    }>>`
      SELECT r.id, r.consultation_id, r.member_id, r.counselor_id,
             r.amount, r.reason, r.status, r.requested_by, r.decided_by,
             r.created_at::text, r.decided_at::text,
             m.mb_id AS member_mb_id,
             c.mb_id AS counselor_mb_id,
             c.nickname AS counselor_nickname
        FROM refund_request r
        LEFT JOIN member m ON m.id = r.member_id
        LEFT JOIN member c ON c.id = r.counselor_id
       WHERE 1=1
         ${statusFilter}
         ${memberFilter}
       ORDER BY r.id DESC
       LIMIT ${lim} OFFSET ${off}
    `;
    const totalRow = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
        FROM refund_request r
        LEFT JOIN member m ON m.id = r.member_id
       WHERE 1=1
         ${statusFilter}
         ${memberFilter}
    `;
    return {
      items: rows,
      total: Number(totalRow[0].count),
      limit: lim,
      offset: off,
    };
  }
}
