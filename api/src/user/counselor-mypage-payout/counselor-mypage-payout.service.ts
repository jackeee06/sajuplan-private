import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql, type TxSql } from '../../shared/db/db.module';
import { SmsService } from '../sms/sms.service';

/**
 * 선지급(early payout) 시스템 — 상담사 마이페이지 read-only 정보.
 *
 * 명세: memory/project_payout_system_plan.md
 *
 * Phase 1 범위:
 *   - 가용 한도 계산 (read-only)
 *   - 등급/계좌/락/제한 상태 표시
 *   - 신청 이력 조회
 *
 * 실제 신청 API (POST) 는 Phase 2 에서 추가.
 *
 * 가용 한도 산식 (이번 달 기준):
 *   priceTot = SUM(consultation.amt_free × revenue_rate)
 *            + SUM(consultation.amt_pro × revenue_rate)   -- 환불 차감 후
 *   available = floor((priceTot - already_paid - carry_over_negative) × available_ratio)
 *
 *   - revenue_rate: setting.namespace='grade' key='revenue_rate.<grade>' (0.35~0.70)
 *   - available_ratio: setting.namespace='payout' key='available_ratio' (기본 0.7)
 *   - already_paid: 이번 달 paid 상태인 선지급 actual_payout 합 (수수료/원천징수 차감 전 신청금 기준)
 *   - carry_over_negative: 이전 달에서 이월된 음수 (settlement_monthly)
 */

export type Grade =
  | 'preliminary'
  | 'partner1'
  | 'partner2'
  | 'partner3'
  | 'partner4'
  | 'partner5';

const GRADE_LABEL: Record<Grade, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
};

export interface MyPayoutInfo {
  // 가용 한도
  available_amount: number;          // 지금 신청 가능한 최대 금액 (원)
  estimated_settlement: number;       // 이번 달 누적 정산 예상금 (priceTot)
  already_paid_this_month: number;    // 이번 달 paid 된 선지급 합
  carry_over_negative: number;        // 이전 달 이월 음수 (있으면 차감)

  // 정책 스냅샷
  fee_rate: number;                   // 0.05 (5%)
  withholding_rate: number;           // 0.033 (3.3%)
  available_ratio: number;            // 0.7 (70%)
  min_amount: number;                 // 30000

  // 상태
  grade: Grade;
  grade_label: string;
  is_blocked: boolean;                // 시스템 차단 (등급/잠금/수동/비활성)
  block_reason: string | null;        // 차단 사유 (한글)
  has_pending_request: boolean;       // 처리 대기 중 신청 있음 (추가 신청 차단)
  bank_locked_until: string | null;   // 계좌 변경 후 출금 잠금 해제 시각
  bank_locked: boolean;                // 잠금 활성 여부 (now < bank_locked_until)

  // 계좌 정보
  has_bank_info: boolean;             // 계좌 등록 여부
  bank_name: string | null;
  bank_holder: string | null;
  bank_account_masked: string | null; // 마스킹: '국민 123-***-****-5678'
}

export interface PayoutRequestRow {
  id: number;
  requested_amount: number;
  fee_amount: number;
  withholding_amount: number;
  actual_payout: number;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled';
  request_memo: string | null;
  reject_reason: string | null;
  bank_name_snapshot: string;
  bank_account_masked: string;
  requested_at: string;
  paid_at: string | null;
  decided_at: string | null;
}

@Injectable()
export class UserCounselorMypagePayoutService {
  private readonly logger = new Logger(UserCounselorMypagePayoutService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
  ) {}

  /**
   * 내 가용 한도 + 등급/계좌/제한 상태 조회.
   */
  async getMine(memberId: number): Promise<MyPayoutInfo> {
    // 1. 회원 + 정책 + 계좌 정보 한 번에
    const memberRows = await this.sql<{
      role: string | null;
      grade: Grade | null;
      bank_name: string | null;
      bank_holder: string | null;
      bank_account: string | null;
      bank_locked_until: string | null;
      payout_blocked: boolean | null;
      left_at: string | null;
    }[]>`
      SELECT role, grade, bank_name, bank_holder, bank_account,
             bank_locked_until, payout_blocked, left_at
        FROM member
       WHERE id = ${memberId}
       LIMIT 1
    `;
    if (memberRows.length === 0) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }
    const m = memberRows[0];
    const grade = (m.grade ?? 'preliminary') as Grade;

    // 2. 정책 조회 (payout namespace)
    const policy = await this.loadPolicy();

    // 3. 등급별 정산률
    const rateRows = await this.sql<{ value: string }[]>`
      SELECT value FROM setting
       WHERE namespace = 'grade' AND key = ${`revenue_rate.${grade}`}
       LIMIT 1
    `;
    const revenueRate = rateRows.length > 0 ? Number(rateRows[0].value) : 0;

    // 4. 이번 달 누적 정산예상금 계산 (priceTot 산식 기반)
    const estimated = await this.calcEstimatedSettlement(memberId, revenueRate);

    // 5. 이번 달 이미 paid 된 선지급 합
    const paidRows = await this.sql<{ total: string }[]>`
      SELECT COALESCE(SUM(requested_amount), 0)::text AS total
        FROM payout_request
       WHERE counselor_id = ${memberId}
         AND status = 'paid'
         AND paid_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
    `;
    const alreadyPaid = Number(paidRows[0].total);

    // 6. 이전 달 이월 음수 (있으면 차감)
    const carryRows = await this.sql<{ carry: string }[]>`
      SELECT COALESCE(SUM(carry_over_negative), 0)::text AS carry
        FROM settlement_monthly
       WHERE member_id = ${memberId}
         AND month = to_char((NOW() AT TIME ZONE 'Asia/Seoul') - interval '1 month', 'YYYY-MM')
    `;
    const carryOver = Number(carryRows[0].carry);

    // 7. 가용 한도 = floor((정산예상 - 기지급 - 이월) × ratio)
    const baseAvailable = Math.max(0, estimated - alreadyPaid - carryOver);
    const availableAmount = Math.floor(baseAvailable * policy.available_ratio);

    // 8. 처리 대기 중 신청 (추가 신청 차단)
    const pendingRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM payout_request
       WHERE counselor_id = ${memberId} AND status = 'pending'
    `;
    const hasPending = Number(pendingRows[0].cnt) > 0;

    // 9. 차단 사유 결정
    const nowMs = Date.now();
    const bankLockedMs = m.bank_locked_until
      ? new Date(m.bank_locked_until).getTime()
      : 0;
    const bankLocked = bankLockedMs > nowMs;

    let blockReason: string | null = null;
    if (!policy.enabled) blockReason = '선지급 시스템이 일시 중단되었습니다.';
    else if (m.role !== 'counselor') blockReason = '상담사만 이용할 수 있습니다.';
    else if (m.left_at) blockReason = '탈퇴한 회원입니다.';
    else if (m.payout_blocked) blockReason = '운영자가 선지급 신청을 제한했습니다. 고객센터로 문의해주세요.';
    else if (policy.block_preliminary && grade === 'preliminary')
      blockReason = '예비파트너는 선지급 신청이 제한됩니다. 파트너1 등급 이상에서 이용 가능합니다.';
    else if (bankLocked)
      blockReason = `계좌 변경 후 ${policy.bank_lock_days}일간 선지급이 제한됩니다.`;

    // 10. 계좌 정보
    // [2026-05-23 정책 변경] 본인 마이페이지에서는 평문 노출 — 사장님 결정.
    //   사유: 계좌번호 노출 사고 위험보다 잘못 등록(중간숫자 오타/다른계좌 헷갈림)
    //         으로 인한 정산 사고가 훨�씬 큼. 본인 확인 가능해야 안전.
    //         어드민(다른 사람 계좌)에서는 마스킹 유지.
    const hasBank = !!(m.bank_name && m.bank_holder && m.bank_account);
    const bankAccountMasked = hasBank
      ? m.bank_account!  // 본인 → 평문
      : null;

    return {
      available_amount: blockReason ? 0 : availableAmount,
      estimated_settlement: estimated,
      already_paid_this_month: alreadyPaid,
      carry_over_negative: carryOver,

      fee_rate: policy.fee_rate,
      withholding_rate: policy.withholding_rate,
      available_ratio: policy.available_ratio,
      min_amount: policy.min_amount,

      grade,
      grade_label: GRADE_LABEL[grade],
      is_blocked: !!blockReason,
      block_reason: blockReason,
      has_pending_request: hasPending,
      bank_locked_until: m.bank_locked_until,
      bank_locked: bankLocked,

      has_bank_info: hasBank,
      bank_name: m.bank_name,
      bank_holder: m.bank_holder,
      bank_account_masked: bankAccountMasked,
    };
  }

  /**
   * 본인 신청 이력 조회 (최신순).
   */
  async getMyHistory(memberId: number, limit = 30): Promise<PayoutRequestRow[]> {
    const lim = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const rows = await this.sql<{
      id: number;
      requested_amount: number;
      fee_amount: number;
      withholding_amount: number;
      actual_payout: number;
      status: 'pending' | 'paid' | 'rejected' | 'cancelled';
      request_memo: string | null;
      reject_reason: string | null;
      bank_name_snapshot: string;
      bank_account_snapshot: string;
      requested_at: string;
      paid_at: string | null;
      decided_at: string | null;
    }[]>`
      SELECT id, requested_amount, fee_amount, withholding_amount, actual_payout,
             status, request_memo, reject_reason,
             bank_name_snapshot, bank_account_snapshot,
             requested_at, paid_at, decided_at
        FROM payout_request
       WHERE counselor_id = ${memberId}
       ORDER BY requested_at DESC
       LIMIT ${lim}
    `;
    return rows.map((r) => ({
      id: r.id,
      requested_amount: r.requested_amount,
      fee_amount: r.fee_amount,
      withholding_amount: r.withholding_amount,
      actual_payout: r.actual_payout,
      status: r.status,
      request_memo: r.request_memo,
      reject_reason: r.reject_reason,
      bank_name_snapshot: r.bank_name_snapshot,
      bank_account_masked: this.maskAccount(r.bank_account_snapshot),
      requested_at: r.requested_at,
      paid_at: r.paid_at,
      decided_at: r.decided_at,
    }));
  }

  /**
   * 선지급 신청 — Phase 2 핵심 메서드.
   *
   * 안전장치:
   *  1. 단일 트랜잭션 (sql.begin)
   *  2. 동시성 락 — pg_advisory_xact_lock(7777004, memberId): 같은 상담사 동시 신청 직렬화
   *  3. member FOR UPDATE — 회원 행 잠금 (계좌 변경/등급 변경 동시 차단)
   *  4. pending row 재확인 (락 안에서) — 동시 신청 race 방지
   *  5. 가용 한도 재계산 (락 안에서) — 신청 직전 환불/타 신청 반영
   *  6. 모든 검증 통과 후에야 INSERT
   *  7. 이력 INSERT (payout_request_log: null → pending)
   *  8. 트랜잭션 외부에서 카톡 발송 (실패해도 신청은 유효)
   */
  async createRequest(params: {
    memberId: number;
    amount: number;
    memo?: string;
  }): Promise<{
    ok: true;
    id: number;
    requested_amount: number;
    fee_amount: number;
    withholding_amount: number;
    actual_payout: number;
  }> {
    const { memberId, amount, memo } = params;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('신청 금액이 올바르지 않습니다.');
    }

    // 상한 — 안전망 (UI 에서도 가용 한도 cap)
    const HARD_CAP = 10_000_000;
    if (amount > HARD_CAP) {
      throw new BadRequestException(`1회 신청 한도(${HARD_CAP.toLocaleString()}원)를 초과했습니다.`);
    }

    const result = await this.sql.begin(async (tx) => {
      // 1. 동시성 락
      await tx`SELECT pg_advisory_xact_lock(7777004, ${memberId})`;

      // 2. 회원 정보 + 계좌 + 락 상태 FOR UPDATE
      const memberRows = await tx<{
        id: number;
        role: string | null;
        grade: Grade | null;
        bank_name: string | null;
        bank_holder: string | null;
        bank_account: string | null;
        bank_locked_until: string | null;
        payout_blocked: boolean | null;
        phone: string | null;
        left_at: string | null;
      }[]>`
        SELECT id, role, grade, bank_name, bank_holder, bank_account,
               bank_locked_until, payout_blocked, phone, left_at
          FROM member
         WHERE id = ${memberId}
         FOR UPDATE
      `;
      if (memberRows.length === 0) throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
      const m = memberRows[0];
      const grade = (m.grade ?? 'preliminary') as Grade;

      // 3. 권한/상태 검증
      if (m.role !== 'counselor') throw new ForbiddenException('상담사만 이용할 수 있습니다.');
      if (m.left_at) throw new ForbiddenException('탈퇴한 회원입니다.');
      if (m.payout_blocked) throw new ForbiddenException('선지급 신청이 제한되어 있습니다. 고객센터로 문의해주세요.');

      // 4. 정책 로드 (락 안에서 — 정책 동시 변경 영향 차단)
      const policy = await this.loadPolicyTx(tx);
      if (!policy.enabled) throw new ForbiddenException('선지급 시스템이 일시 중단되었습니다.');
      if (policy.block_preliminary && grade === 'preliminary') {
        throw new ForbiddenException('예비파트너는 선지급 신청이 제한됩니다.');
      }

      // 5. 계좌 잠금 체크 (DB 시각 기준)
      const lockRows = await tx<{ locked: boolean }[]>`
        SELECT (${m.bank_locked_until}::timestamptz IS NOT NULL
                AND ${m.bank_locked_until}::timestamptz > NOW()) AS locked
      `;
      if (lockRows[0]?.locked) {
        throw new ForbiddenException(`계좌 변경 후 ${policy.bank_lock_days}일간 선지급이 제한됩니다.`);
      }

      // 6. 계좌 정보 필수
      if (!m.bank_name || !m.bank_holder || !m.bank_account) {
        throw new BadRequestException('계좌 정보를 먼저 등록해주세요.');
      }

      // 7. 최소 신청금
      if (amount < policy.min_amount) {
        throw new BadRequestException(`최소 신청 금액은 ${policy.min_amount.toLocaleString()}원입니다.`);
      }

      // 8. pending 신청 있으면 추가 신청 차단
      const pendingRows = await tx<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM payout_request
         WHERE counselor_id = ${memberId} AND status = 'pending'
      `;
      if (Number(pendingRows[0].cnt) > 0) {
        throw new BadRequestException('이미 처리 대기 중인 신청이 있습니다. 처리 완료 후 다시 신청해주세요.');
      }

      // 9. 일 1회 제한 (오늘 paid + rejected + cancelled 포함 X — pending 만 카운트하면 8 단계와 중복)
      //    같은 날 paid/cancelled/rejected 됐어도 새 신청 허용하면 매번 새 신청 가능 → 일 1회 막을 수 없음.
      //    "신청한 row 가 오늘 N건 이상이면" 으로 해석 → 모든 status 포함 카운트.
      if (policy.max_per_day_per_counselor > 0) {
        const todayRows = await tx<{ cnt: string }[]>`
          SELECT COUNT(*)::text AS cnt FROM payout_request
           WHERE counselor_id = ${memberId}
             AND requested_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
        `;
        if (Number(todayRows[0].cnt) >= policy.max_per_day_per_counselor) {
          throw new BadRequestException(`선지급 신청은 하루 ${policy.max_per_day_per_counselor}회 가능합니다. 내일 다시 시도해주세요.`);
        }
      }

      // 10. 가용 한도 재계산 (락 안에서, 정확)
      const rateRowsT = await tx<{ value: string }[]>`
        SELECT value FROM setting
         WHERE namespace='grade' AND key=${`revenue_rate.${grade}`} LIMIT 1
      `;
      const revenueRate = rateRowsT.length > 0 ? Number(rateRowsT[0].value) : 0;
      const estimated = await this.calcEstimatedSettlementTx(tx, memberId, revenueRate);

      const paidRows = await tx<{ total: string }[]>`
        SELECT COALESCE(SUM(requested_amount), 0)::text AS total
          FROM payout_request
         WHERE counselor_id = ${memberId}
           AND status = 'paid'
           AND paid_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
      `;
      const alreadyPaid = Number(paidRows[0].total);

      const carryRows = await tx<{ carry: string }[]>`
        SELECT COALESCE(SUM(carry_over_negative), 0)::text AS carry
          FROM settlement_monthly
         WHERE member_id = ${memberId}
           AND month = to_char((NOW() AT TIME ZONE 'Asia/Seoul') - interval '1 month', 'YYYY-MM')
      `;
      const carryOver = Number(carryRows[0].carry);

      const baseAvailable = Math.max(0, estimated - alreadyPaid - carryOver);
      const available = Math.floor(baseAvailable * policy.available_ratio);

      if (amount > available) {
        throw new BadRequestException(
          `신청 금액이 가용 한도(${available.toLocaleString()}원)를 초과합니다.`,
        );
      }

      // 11. 금액 분해
      const fee = Math.floor(amount * policy.fee_rate);
      const withholding = Math.floor(amount * policy.withholding_rate);
      const actual = amount - fee - withholding;
      if (actual <= 0) {
        throw new BadRequestException('수수료/원천징수 차감 후 실지급액이 0원 이하입니다.');
      }

      // 12. INSERT
      const inserted = await tx<{ id: number }[]>`
        INSERT INTO payout_request
          (counselor_id, requested_amount, fee_amount, withholding_amount, actual_payout,
           fee_rate_snapshot, available_at_request, grade_at_request,
           bank_name_snapshot, bank_holder_snapshot, bank_account_snapshot,
           status, request_memo)
        VALUES
          (${memberId}, ${amount}, ${fee}, ${withholding}, ${actual},
           ${policy.fee_rate}, ${available}, ${grade},
           ${m.bank_name}, ${m.bank_holder}, ${m.bank_account},
           'pending', ${memo ?? null})
        RETURNING id
      `;
      const requestId = inserted[0].id;

      // 13. 이력 (null → pending)
      await tx`
        INSERT INTO payout_request_log (request_id, from_status, to_status, changed_by, reason)
        VALUES (${requestId}, NULL, 'pending', 'self', ${memo ?? null})
      `;

      return {
        ok: true as const,
        id: requestId,
        requested_amount: amount,
        fee_amount: fee,
        withholding_amount: withholding,
        actual_payout: actual,
        phone: m.phone,
      };
    });

    // 14. 트랜잭션 외부에서 카톡 알림 (실패해도 신청은 유효)
    if (result.phone) {
      this.sms.sendAlimtalkByCode('payout_request_received', result.phone, {
        amount: result.requested_amount.toLocaleString(),
      }).catch((e) => this.logger.warn(`payout_request_received 알림톡 실패: ${(e as Error).message}`));
    }

    // phone 은 응답에 노출 X
    const { phone: _ph, ...out } = result;
    void _ph;
    return out;
  }

  /**
   * 신청 취소 — 상담사 본인이 pending 상태일 때만.
   */
  async cancelRequest(memberId: number, requestId: number): Promise<{ ok: true }> {
    return await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(7777004, ${memberId})`;

      const rows = await tx<{ id: number; counselor_id: number; status: string }[]>`
        SELECT id, counselor_id, status
          FROM payout_request
         WHERE id = ${requestId}
         FOR UPDATE
      `;
      if (rows.length === 0) throw new NotFoundException('신청을 찾을 수 없습니다.');
      const r = rows[0];
      if (r.counselor_id !== memberId) throw new ForbiddenException('본인의 신청만 취소할 수 있습니다.');
      if (r.status !== 'pending') {
        throw new BadRequestException(`'${r.status}' 상태의 신청은 취소할 수 없습니다.`);
      }

      await tx`
        UPDATE payout_request
           SET status = 'cancelled',
               updated_at = now()
         WHERE id = ${requestId}
      `;
      await tx`
        INSERT INTO payout_request_log (request_id, from_status, to_status, changed_by)
        VALUES (${requestId}, 'pending', 'cancelled', 'self')
      `;
      return { ok: true as const };
    });
  }

  /**
   * 계좌 정보 등록/변경.
   *
   * 안전장치:
   *  - 모든 필드 필수 (이름/계좌번호/예금주)
   *  - 단일 트랜잭션 + 이력 INSERT
   *  - 변경 시 bank_locked_until = now() + N일 (선지급 잠금)
   *  - 변경 후 카톡 알림 (본인 인지용)
   *  - pending 신청 있으면 거부 (처리 중에 계좌 바꾸면 분쟁)
   */
  async updateBank(params: {
    memberId: number;
    bank_name: string;
    bank_holder: string;
    bank_account: string;
    actorIp?: string;
  }): Promise<{ ok: true; bank_locked_until: string | null }> {
    const { memberId, actorIp } = params;
    const bankName = (params.bank_name ?? '').trim();
    const bankHolder = (params.bank_holder ?? '').trim();
    // 계좌번호는 숫자/하이픈만
    const bankAccount = (params.bank_account ?? '').replace(/[^0-9-]/g, '');
    if (!bankName || !bankHolder || !bankAccount) {
      throw new BadRequestException('은행명/예금주/계좌번호를 모두 입력해주세요.');
    }
    if (bankName.length > 30 || bankHolder.length > 30 || bankAccount.length > 40) {
      throw new BadRequestException('입력값이 너무 깁니다.');
    }
    // [2026-05-23] 프론트와 동일한 검증 — API 직접 호출 우회 차단
    //   예금주: 한글 2~20자 (외국인 영문은 어드민에서 운영자가 직접 등록)
    //   계좌번호: 숫자 10~14자리 (시중은행 일반)
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ ]{2,20}$/.test(bankHolder)) {
      throw new BadRequestException('예금주명은 한글 2~20자만 입력 가능합니다.');
    }
    const accountDigits = bankAccount.replace(/-/g, '');
    if (accountDigits.length < 10 || accountDigits.length > 14) {
      throw new BadRequestException('계좌번호는 10~14자리여야 합니다.');
    }

    const result = await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(7777004, ${memberId})`;

      const rows = await tx<{
        id: number;
        role: string | null;
        bank_name: string | null;
        bank_holder: string | null;
        bank_account: string | null;
        phone: string | null;
      }[]>`
        SELECT id, role, bank_name, bank_holder, bank_account, phone
          FROM member
         WHERE id = ${memberId}
         FOR UPDATE
      `;
      if (rows.length === 0) throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
      const m = rows[0];
      if (m.role !== 'counselor') throw new ForbiddenException('상담사만 이용할 수 있습니다.');

      // pending 신청 있으면 거부 (처리 중에 계좌 바꾸면 분쟁)
      const pendingRows = await tx<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM payout_request
         WHERE counselor_id = ${memberId} AND status = 'pending'
      `;
      if (Number(pendingRows[0].cnt) > 0) {
        throw new BadRequestException('처리 대기 중인 신청이 있어 계좌를 변경할 수 없습니다. 처리 완료 후 변경해주세요.');
      }

      // 변경 여부 확인 (동일값 재저장은 잠금 갱신 X)
      const sameAsBefore =
        m.bank_name === bankName &&
        m.bank_holder === bankHolder &&
        m.bank_account === bankAccount;

      if (sameAsBefore) {
        return { ok: true as const, bank_locked_until: null, phone: m.phone, changed: false };
      }

      // 정책 — 잠금 일수
      const policy = await this.loadPolicyTx(tx);
      const lockUntilRows = await tx<{ until: string }[]>`
        SELECT (NOW() + (${policy.bank_lock_days}::int || ' days')::interval) AS until
      `;
      const lockUntil = lockUntilRows[0].until;

      // UPDATE
      await tx`
        UPDATE member
           SET bank_name = ${bankName},
               bank_holder = ${bankHolder},
               bank_account = ${bankAccount},
               bank_locked_until = ${lockUntil}
         WHERE id = ${memberId}
      `;

      // 이력
      await tx`
        INSERT INTO counselor_bank_history
          (counselor_id,
           bank_name_before, bank_holder_before, bank_account_before,
           bank_name_after, bank_holder_after, bank_account_after,
           changed_by, changed_ip)
        VALUES
          (${memberId},
           ${m.bank_name}, ${m.bank_holder}, ${m.bank_account},
           ${bankName}, ${bankHolder}, ${bankAccount},
           'self', ${actorIp ?? null})
      `;

      return { ok: true as const, bank_locked_until: lockUntil, phone: m.phone, changed: true };
    });

    // 변경된 경우만 카톡 발송 (본인 인지용 — 향후 추가 가능)
    // 별도 템플릿 없으므로 일단 로그만. 추후 'payout_bank_changed' 템플릿 추가.
    if (result.changed) {
      this.logger.log(`[payout-bank-changed] memberId=${params.memberId} locked_until=${result.bank_locked_until}`);
    }

    return { ok: result.ok, bank_locked_until: result.bank_locked_until };
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────

  /**
   * 이번 달 누적 정산 예상금 계산 (priceTot 기준).
   * settlement-cron 의 산식과 동일 로직. 단 read-only.
   *
   * 산식:
   *   priceTot = floor(amt_free * rate) + floor(amt_pro * rate)
   *   (환불 차감 후, refund_status='full' 제외, point_history 매칭 안 함 — 실시간이라)
   */
  // tx 안에서 호출 가능한 변형 (createRequest 의 락 안에서 가용 재계산용)
  private async calcEstimatedSettlementTx(tx: TxSql, memberId: number, revenueRate: number): Promise<number> {
    if (revenueRate <= 0) return 0;
    const mb4Row = await tx<{ mb4: number }[]>`
      SELECT COALESCE(call_070_unit_cost, 0)::int AS mb4 FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const mb4 = mb4Row[0]?.mb4 ?? 0;
    const row = await tx<{ amt_free: string; amt_pro: string }[]>`
      SELECT
        COALESCE(SUM(GREATEST(c.amt_free - COALESCE(rr.refunded_free, 0), 0)), 0)::text AS amt_free,
        COALESCE(SUM(GREATEST(c.amt_pro  - COALESCE(rr.refunded_pro,  0), 0)), 0)::text AS amt_pro
        FROM consultation c
        LEFT JOIN (
          SELECT consultation_id,
                 COALESCE(SUM(amount_free), 0)::bigint AS refunded_free,
                 COALESCE(SUM(amount_pro),  0)::bigint AS refunded_pro
            FROM refund_request WHERE status = 'approved' GROUP BY consultation_id
        ) rr ON rr.consultation_id = c.id
       WHERE c.counselor_id = ${memberId}
         AND c.reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
         AND c.created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
         AND c.created_at <  (date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') + interval '1 month') AT TIME ZONE 'Asia/Seoul'
         AND NOT (c.reason = 'DISCONNECT' AND c.usetm < 30 AND c.amt <= ${mb4})
         AND c.refund_status IS DISTINCT FROM 'full'
    `;
    const amtFree = Number(row[0].amt_free);
    const amtPro = Number(row[0].amt_pro);
    const ratePct = revenueRate * 100;
    return Math.floor((amtFree * ratePct) / 100) + Math.floor((amtPro * ratePct) / 100);
  }

  private async loadPolicyTx(tx: TxSql): Promise<{
    enabled: boolean;
    fee_rate: number;
    withholding_rate: number;
    available_ratio: number;
    min_amount: number;
    block_preliminary: boolean;
    bank_lock_days: number;
    max_per_day_per_counselor: number;
  }> {
    const rows = await tx<{ key: string; value: string }[]>`
      SELECT key, value FROM setting WHERE namespace = 'payout'
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string, def: number) => {
      const v = Number(map.get(k));
      return Number.isFinite(v) ? v : def;
    };
    const bool = (k: string, def: boolean) => {
      const v = map.get(k);
      if (v === undefined) return def;
      return v === 'true' || v === '1';
    };
    return {
      enabled: bool('enabled', true),
      fee_rate: num('fee_rate', 0.05),
      withholding_rate: num('withholding_rate', 0.033),
      available_ratio: num('available_ratio', 0.7),
      min_amount: num('min_amount', 30000),
      block_preliminary: bool('block_preliminary', true),
      bank_lock_days: num('bank_lock_days', 3),
      max_per_day_per_counselor: num('max_per_day_per_counselor', 1),
    };
  }

  private async calcEstimatedSettlement(memberId: number, revenueRate: number): Promise<number> {
    if (revenueRate <= 0) return 0;

    // mb4 = 회원 단가 (DISCONNECT && usetm<30 && amt<=mb4 환불 제외 조건)
    const mb4Row = await this.sql<{ mb4: number }[]>`
      SELECT COALESCE(call_070_unit_cost, 0)::int AS mb4 FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const mb4 = mb4Row[0]?.mb4 ?? 0;

    const row = await this.sql<{ amt_free: string; amt_pro: string }[]>`
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
         AND c.created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
         AND c.created_at <  (date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') + interval '1 month') AT TIME ZONE 'Asia/Seoul'
         AND NOT (c.reason = 'DISCONNECT' AND c.usetm < 30 AND c.amt <= ${mb4})
         AND c.refund_status IS DISTINCT FROM 'full'
    `;
    const amtFree = Number(row[0].amt_free);
    const amtPro = Number(row[0].amt_pro);
    const ratePct = revenueRate * 100;
    const priceFree = Math.floor((amtFree * ratePct) / 100);
    const pricePaid = Math.floor((amtPro * ratePct) / 100);
    return priceFree + pricePaid;
  }

  private async loadPolicy(): Promise<{
    enabled: boolean;
    fee_rate: number;
    withholding_rate: number;
    available_ratio: number;
    min_amount: number;
    block_preliminary: boolean;
    bank_lock_days: number;
  }> {
    const rows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting WHERE namespace = 'payout'
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string, def: number) => {
      const v = Number(map.get(k));
      return Number.isFinite(v) ? v : def;
    };
    const bool = (k: string, def: boolean) => {
      const v = map.get(k);
      if (v === undefined) return def;
      return v === 'true' || v === '1';
    };
    return {
      enabled: bool('enabled', true),
      fee_rate: num('fee_rate', 0.05),
      withholding_rate: num('withholding_rate', 0.033),
      available_ratio: num('available_ratio', 0.7),
      min_amount: num('min_amount', 30000),
      block_preliminary: bool('block_preliminary', true),
      bank_lock_days: num('bank_lock_days', 3),
    };
  }

  /** 계좌번호 마스킹: '123-456-789012' → '123-***-***9012' (뒤 4자리만) */
  private maskAccount(account: string): string {
    const digits = account.replace(/[^0-9]/g, '');
    if (digits.length <= 4) return account;
    const last4 = digits.slice(-4);
    return `***-***-***${last4}`;
  }
}
