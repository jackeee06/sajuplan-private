import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 상담사 추천 수당 (프로모션) 정책 — 어드민 수동 운영.
 *
 * 정책 (2026-05-17 사장님 결정):
 *   - 추천자(A) 가 피추천자(B) 를 추천 → B 가입 후 6개월 한정
 *   - 1~3개월: B 의 settlement_monthly.price × 2% → A 포인트
 *   - 4~6개월: B 의 settlement_monthly.price × 1% → A 포인트
 *   - 6개월 이후 자동 만료 (status='expired')
 *   - 등록/지급: 어드민에서 수동 (정책 변경 유연성)
 *
 * 매월 운영 흐름:
 *   1. (매월 1일) settlement cron 실행 → settlement_monthly 채워짐
 *   2. (1~5일) 운영자가 /mng/referrals 진입 → 이번 달 지급 대상 확인
 *   3. 각 row 의 "이번 달 지급" 버튼 → payCurrentMonth 호출
 *   4. point_history INSERT (추천자 포인트 자동 증가) + counselor_referral_payment 이력
 */
@Injectable()
export class AdminReferralsService {
  private readonly logger = new Logger(AdminReferralsService.name);

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 6개월 후 만료 시점 계산 */
  private addMonths(d: Date, months: number): Date {
    const result = new Date(d);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /** 가입일 기준 N개월차 (1부터 시작 — 1개월 차이면 1, 4개월차면 4) */
  private monthsSince(registeredAt: Date, refMonthStart: Date): number {
    const y = refMonthStart.getFullYear() - registeredAt.getFullYear();
    const m = refMonthStart.getMonth() - registeredAt.getMonth();
    return y * 12 + m + 1; // refMonthStart 시점에 등록월 포함 1개월 차
  }

  /** N개월차에 따른 비율 (1~3: 2%, 4~6: 1%, 그 외: 0) */
  private rateFor(monthIndex: number): number {
    if (monthIndex >= 1 && monthIndex <= 3) return 2.0;
    if (monthIndex >= 4 && monthIndex <= 6) return 1.0;
    return 0;
  }

  /**
   * 추천 관계 리스트 — 어드민 화면용. 각 행은 이번 달 (또는 지정 month) 예상 지급액까지 계산.
   * @param month YYYY-MM (예: '2026-05'). 생략 시 현재 월 — 1 (전월). 매출은 전월 매출이 정산되므로.
   */
  async list(params: { month?: string; status?: string }): Promise<Array<{
    id: number;
    referrer_id: number;
    referrer_mb_id: string | null;
    referrer_nickname: string | null;
    referee_id: number;
    referee_mb_id: string | null;
    referee_nickname: string | null;
    registered_at: string;
    expires_at: string;
    status: string;
    months_since: number;
    rate_pct: number;
    referee_sales: number;
    expected_payment: number;
    paid_this_month: boolean;
    paid_amount: number | null;
    memo: string | null;
  }>> {
    const targetMonth = this.resolveMonth(params.month);
    const monthStart = `${targetMonth}-01`;
    const status = params.status && ['active', 'expired', 'disabled'].includes(params.status)
      ? params.status
      : null;

    const rows = await this.sql<Array<{
      id: number;
      referrer_id: number;
      referrer_mb_id: string | null;
      referrer_nickname: string | null;
      referee_id: number;
      referee_mb_id: string | null;
      referee_nickname: string | null;
      registered_at: Date;
      expires_at: Date;
      status: string;
      referee_sales: string | null;
      paid_id: number | null;
      paid_amount: string | null;
    }>>`
      SELECT
        r.id, r.referrer_id, r.referee_id,
        r.registered_at, r.expires_at, r.status, r.memo,
        rer.mb_id  AS referrer_mb_id,
        rer.nickname AS referrer_nickname,
        ree.mb_id  AS referee_mb_id,
        ree.nickname AS referee_nickname,
        (SELECT price FROM settlement_monthly
          WHERE member_id = r.referee_id AND month = ${monthStart}
          LIMIT 1) AS referee_sales,
        p.id AS paid_id, p.paid_amount
      FROM counselor_referral r
      LEFT JOIN member rer ON rer.id = r.referrer_id
      LEFT JOIN member ree ON ree.id = r.referee_id
      LEFT JOIN counselor_referral_payment p
             ON p.referral_id = r.id AND p.pay_month = ${monthStart}
      ${status ? this.sql`WHERE r.status = ${status}` : this.sql``}
      ORDER BY r.created_at DESC
    `;

    const monthDate = new Date(`${monthStart}T00:00:00Z`);
    return rows.map((row) => {
      const monthsSince = this.monthsSince(new Date(row.registered_at), monthDate);
      const rate = this.rateFor(monthsSince);
      const sales = Number(row.referee_sales ?? 0);
      const expected = Math.floor((sales * rate) / 100);
      return {
        id: Number(row.id),
        referrer_id: Number(row.referrer_id),
        referrer_mb_id: row.referrer_mb_id,
        referrer_nickname: row.referrer_nickname,
        referee_id: Number(row.referee_id),
        referee_mb_id: row.referee_mb_id,
        referee_nickname: row.referee_nickname,
        registered_at: new Date(row.registered_at).toISOString(),
        expires_at: new Date(row.expires_at).toISOString(),
        status: row.status,
        months_since: monthsSince,
        rate_pct: rate,
        referee_sales: sales,
        expected_payment: expected,
        paid_this_month: !!row.paid_id,
        paid_amount: row.paid_amount != null ? Number(row.paid_amount) : null,
        memo: (row as unknown as { memo: string | null }).memo,
      };
    });
  }

  /** YYYY-MM 정규화. 생략 시 전월 (정산 cron 이 매월 1일 04:00 에 전월 정산). */
  private resolveMonth(input?: string): string {
    if (input && /^\d{4}-\d{2}$/.test(input)) return input;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0~11, getMonth()-1 → 전월. 1월이면 12월.
    const prevY = m === 0 ? y - 1 : y;
    const prevM = m === 0 ? 12 : m;
    return `${prevY}-${String(prevM).padStart(2, '0')}`;
  }

  /** 추천 관계 신규 등록 (운영자 수동). registered_at = B 가입일, expires_at = +6개월. */
  async create(input: {
    referrer_id: number;
    referee_id: number;
    memo?: string | null;
    admin_id: number;
  }): Promise<{ id: number }> {
    if (input.referrer_id === input.referee_id) {
      throw new BadRequestException('자기 자신을 추천자로 등록할 수 없습니다.');
    }
    // 둘 다 상담사인지 검증
    const members = await this.sql<{ id: number; role: string; created_at: Date }[]>`
      SELECT id, role, created_at FROM member
       WHERE id IN (${input.referrer_id}, ${input.referee_id})
    `;
    const referrer = members.find((m) => Number(m.id) === input.referrer_id);
    const referee = members.find((m) => Number(m.id) === input.referee_id);
    if (!referrer || referrer.role !== 'counselor') {
      throw new BadRequestException('추천자(A)가 상담사가 아닙니다.');
    }
    if (!referee || referee.role !== 'counselor') {
      throw new BadRequestException('피추천자(B)가 상담사가 아닙니다.');
    }
    // 피추천자 중복 등록 차단
    const existing = await this.sql<{ id: number }[]>`
      SELECT id FROM counselor_referral WHERE referee_id = ${input.referee_id} LIMIT 1
    `;
    if (existing.length > 0) {
      throw new ConflictException('이미 추천 등록된 피추천자입니다.');
    }

    const registeredAt = new Date(referee.created_at);
    const expiresAt = this.addMonths(registeredAt, 6);

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO counselor_referral
        (referrer_id, referee_id, registered_at, expires_at, status, memo, created_by_id)
      VALUES
        (${input.referrer_id}, ${input.referee_id}, ${registeredAt}, ${expiresAt},
         'active', ${input.memo ?? null}, ${input.admin_id})
      RETURNING id
    `;
    this.logger.log(`[referral.create] id=${inserted[0].id} A=${input.referrer_id} B=${input.referee_id}`);
    return { id: Number(inserted[0].id) };
  }

  /** 이번 달 지급 처리 — 추천자 포인트 적립 + 이력 INSERT */
  async payCurrentMonth(params: { id: number; month?: string; admin_id: number }): Promise<{
    paid_amount: number;
    rate_pct: number;
    referee_sales: number;
    point_history_id: number;
  }> {
    const targetMonth = this.resolveMonth(params.month);
    const monthStart = `${targetMonth}-01`;

    return await this.sql.begin(async (tx) => {
      // 1) referral 조회 + 잠금
      const refs = await tx<{
        id: number;
        referrer_id: number;
        referee_id: number;
        registered_at: Date;
        expires_at: Date;
        status: string;
      }[]>`
        SELECT id, referrer_id, referee_id, registered_at, expires_at, status
          FROM counselor_referral WHERE id = ${params.id}
          FOR UPDATE
      `;
      if (refs.length === 0) throw new NotFoundException('추천 관계가 없습니다.');
      const r = refs[0];
      if (r.status !== 'active') {
        throw new BadRequestException(`status=${r.status} — 지급 불가`);
      }

      // 2) 같은 month 이미 지급됐는지 확인 (UNIQUE)
      const already = await tx<{ id: number }[]>`
        SELECT id FROM counselor_referral_payment
         WHERE referral_id = ${params.id} AND pay_month = ${monthStart} LIMIT 1
      `;
      if (already.length > 0) {
        throw new ConflictException('이 달의 지급은 이미 처리되었습니다.');
      }

      // 3) 만료 여부 확인
      const monthDate = new Date(`${monthStart}T00:00:00Z`);
      if (monthDate >= new Date(r.expires_at)) {
        // status 자동 만료 처리
        await tx`UPDATE counselor_referral SET status = 'expired', updated_at = now() WHERE id = ${params.id}`;
        throw new BadRequestException('이미 만료된 추천 관계입니다 (가입 후 6개월 경과).');
      }

      // 4) 개월차 + 비율 + B 매출
      const monthsSince = this.monthsSince(new Date(r.registered_at), monthDate);
      const rate = this.rateFor(monthsSince);
      if (rate === 0) {
        throw new BadRequestException(`지급 대상 개월(${monthsSince})이 아닙니다.`);
      }
      const salesRows = await tx<{ price: string | null }[]>`
        SELECT price FROM settlement_monthly
         WHERE member_id = ${r.referee_id} AND month = ${monthStart}
         LIMIT 1
      `;
      const sales = Number(salesRows[0]?.price ?? 0);
      if (sales <= 0) {
        throw new BadRequestException('피추천자의 해당 월 매출 0 — 지급 안 함.');
      }
      const paid = Math.floor((sales * rate) / 100);
      if (paid <= 0) {
        throw new BadRequestException('계산된 지급액 0 — 지급 안 함.');
      }

      // 5) 추천자 point 적립 — paid_balance (정산 대상은 아니지만 추천 수당이라 paid 처리)
      const ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${r.referrer_id} FOR UPDATE
      `;
      let curFree = 0, curPaid = 0;
      if (ptRows.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
          VALUES (${r.referrer_id}, 0, ${paid}, ${paid}, 0)
        `;
        curPaid = paid;
      } else {
        curFree = Number(ptRows[0].free_balance);
        curPaid = Number(ptRows[0].paid_balance) + paid;
        await tx`
          UPDATE point
             SET paid_balance = paid_balance + ${paid},
                 total_earned = total_earned + ${paid},
                 updated_at = now()
           WHERE member_id = ${r.referrer_id}
        `;
      }
      await tx`UPDATE member SET point = point + ${paid}, updated_at = now() WHERE id = ${r.referrer_id}`;

      // 6) point_history INSERT
      const phRows = await tx<{ id: number }[]>`
        INSERT INTO point_history
          (member_id, content, earn_point, use_point, balance_after,
           rel_table, rel_id, rel_action,
           is_paid, is_expired, expire_date, actor_type)
        VALUES
          (${r.referrer_id},
           ${`[추천수당] ${targetMonth} (피추천자 매출 ${sales.toLocaleString()}원의 ${rate}%)`},
           ${paid}, 0, ${curFree + curPaid},
           'counselor_referral', ${String(params.id)}, ${`${params.id}@추천수당@${targetMonth}`},
           true, false, NULL, 'admin')
        RETURNING id
      `;

      // 7) counselor_referral_payment 이력
      await tx`
        INSERT INTO counselor_referral_payment
          (referral_id, pay_month, rate_pct, referee_sales, paid_amount, paid_by_id, point_history_id)
        VALUES
          (${params.id}, ${monthStart}, ${rate}, ${sales}, ${paid}, ${params.admin_id}, ${phRows[0].id})
      `;

      // 8) 6개월 마지막달이면 status='expired' 로 마킹 (다음 달 더 못 받게)
      if (monthsSince >= 6) {
        await tx`UPDATE counselor_referral SET status = 'expired', updated_at = now() WHERE id = ${params.id}`;
      }

      return {
        paid_amount: paid,
        rate_pct: rate,
        referee_sales: sales,
        point_history_id: Number(phRows[0].id),
      };
    });
  }

  /** 추천 관계 비활성 (허위 가입 등). status='disabled'. */
  async disable(id: number, memo?: string): Promise<void> {
    const r = await this.sql`
      UPDATE counselor_referral
         SET status = 'disabled',
             memo = ${memo ?? null},
             updated_at = now()
       WHERE id = ${id}
    `;
    if (r.count === 0) throw new NotFoundException('추천 관계가 없습니다.');
  }

  /** 추천자/피추천자 후보 검색 (autocomplete) — 활성 상담사만. */
  async searchCounselors(q: string): Promise<Array<{
    id: number;
    mb_id: string | null;
    nickname: string | null;
    name: string;
    created_at: string;
  }>> {
    const term = (q || '').trim();
    if (term.length < 1) return [];
    const like = `%${term}%`;
    const rows = await this.sql<{
      id: number; mb_id: string | null; nickname: string | null; name: string; created_at: Date;
    }[]>`
      SELECT id, mb_id, nickname, name, created_at
        FROM member
       WHERE role = 'counselor' AND left_at IS NULL
         AND (mb_id ILIKE ${like} OR nickname ILIKE ${like} OR name ILIKE ${like})
       ORDER BY id DESC
       LIMIT 20
    `;
    return rows.map((r) => ({
      id: Number(r.id),
      mb_id: r.mb_id,
      nickname: r.nickname,
      name: r.name,
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  // ─── 추천인 정책 (슈퍼 전용) ────────────────────────────────────────────────

  /** 현재 추천 정책값 조회 */
  async getPolicy(): Promise<{ rate: number; months: number }> {
    const rows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'promotion' AND key IN ('referral_rate','referral_months')
    `;
    const rate   = parseFloat(rows.find(r => r.key === 'referral_rate')?.value   ?? '0.01');
    const months = parseInt(rows.find(r => r.key === 'referral_months')?.value   ?? '3', 10);
    return { rate, months };
  }

  /** 추천 정책 업데이트 (저장 즉시 신규 추천부터 적용, 기존 스냅샷 유지) */
  async updatePolicy(params: {
    rate?: number;
    months?: number;
    admin_id: number;
  }): Promise<{ rate: number; months: number }> {
    if (params.rate !== undefined) {
      if (params.rate < 0 || params.rate > 1) {
        throw new BadRequestException('요율은 0 이상 1 이하 소수여야 합니다 (예: 0.01 = 1%)');
      }
      await this.sql`
        INSERT INTO setting (namespace, key, value, updated_by_id, updated_at)
        VALUES ('promotion','referral_rate',${String(params.rate)},${params.admin_id},NOW())
        ON CONFLICT (namespace, key) DO UPDATE
          SET value = EXCLUDED.value, updated_by_id = EXCLUDED.updated_by_id, updated_at = NOW()
      `;
    }
    if (params.months !== undefined) {
      if (params.months < 1 || params.months > 24) {
        throw new BadRequestException('기간은 1~24 개월이어야 합니다.');
      }
      await this.sql`
        INSERT INTO setting (namespace, key, value, updated_by_id, updated_at)
        VALUES ('promotion','referral_months',${String(params.months)},${params.admin_id},NOW())
        ON CONFLICT (namespace, key) DO UPDATE
          SET value = EXCLUDED.value, updated_by_id = EXCLUDED.updated_by_id, updated_at = NOW()
      `;
    }
    return this.getPolicy();
  }

  // ─── 상담사 마이페이지 — 추천 현황 (사용자 API에서 호출) ──────────────────

  /** 상담사 본인 추천 현황 — referral_code + 추천한 상담사 목록 + 누적 수당 */
  async getMyCounselorReferral(memberId: number): Promise<{
    referral_code: string | null;
    referrals: {
      id: number;
      referee_mb_id: string | null;
      referee_nickname: string | null;
      registered_at: string;
      expires_at: string;
      months_snapshot: number;
      rate_snapshot: number;
      status: string;
      total_paid: number;
    }[];
    total_paid_all: number;
  }> {
    const codeRows = await this.sql<{ referral_code: string | null }[]>`
      SELECT referral_code FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const referral_code = codeRows[0]?.referral_code ?? null;

    const refs = await this.sql<{
      id: number;
      referee_mb_id: string | null;
      referee_nickname: string | null;
      registered_at: Date;
      expires_at: Date;
      months_snapshot: number;
      rate_snapshot: string;
      status: string;
      total_paid: string | null;
    }[]>`
      SELECT
        r.id,
        ree.mb_id       AS referee_mb_id,
        ree.nickname    AS referee_nickname,
        r.registered_at, r.expires_at,
        r.months_snapshot, r.rate_snapshot, r.status,
        (SELECT COALESCE(SUM(p.paid_amount),0)
           FROM counselor_referral_payment p
          WHERE p.referral_id = r.id) AS total_paid
      FROM counselor_referral r
      LEFT JOIN member ree ON ree.id = r.referee_id
      WHERE r.referrer_id = ${memberId}
      ORDER BY r.created_at DESC
    `;

    const referrals = refs.map(r => ({
      id: Number(r.id),
      referee_mb_id: r.referee_mb_id,
      referee_nickname: r.referee_nickname,
      registered_at: new Date(r.registered_at).toISOString(),
      expires_at: new Date(r.expires_at).toISOString(),
      months_snapshot: Number(r.months_snapshot),
      rate_snapshot: parseFloat(r.rate_snapshot),
      status: r.status,
      total_paid: Number(r.total_paid ?? 0),
    }));

    const total_paid_all = referrals.reduce((s, r) => s + r.total_paid, 0);
    return { referral_code, referrals, total_paid_all };
  }
}
