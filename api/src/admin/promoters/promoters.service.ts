import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQL, type Sql } from '../../shared/db/db.module';
import { SmsService } from '../../user/sms/sms.service';
import { PromoterCoreService } from '../../shared/promoter/promoter-core.service';
import { encryptPii, maskRrn } from '../../shared/crypto/pii-crypto';

/**
 * 관리자 — 모집인(서포터즈) 등록·관리·정산.
 *  - 주민번호는 암호화 저장(rrn_enc) + 마스킹 노출(rrn_masked). 평문은 반환하지 않음.
 *  - 정산: 미정산 적립 합산 → 원천징수(setting) 차감 → 배치 생성 → [지급완료] 마킹.
 *  - 회사 부담 별도 원장 — point/earning 무침범.
 */
@Injectable()
export class AdminPromotersService {
  private readonly logger = new Logger(AdminPromotersService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly config: ConfigService,
    private readonly promoter: PromoterCoreService,
    private readonly sms: SmsService,
  ) {}

  private get cryptoSecret(): string {
    return (
      this.config.get<string>('USER_JWT_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'sajuplan-pii-fallback-secret-please-set'
    );
  }

  private normCode(code: string): string {
    return (code ?? '').replace(/[^0-9A-Za-z]/g, '').trim();
  }
  private digits(s: string | null | undefined): string {
    return (s ?? '').replace(/\D/g, '');
  }

  // ── 전역 정책값 (보상요율·기간·원천징수율) — 폼 표시용 ──
  async globalSettings() {
    const s = await this.promoter.getSettings();
    return { reward_rate: s.rate, reward_months: s.months, withholding_rate: s.withholdingRate };
  }

  // ── 목록 (모집인별 모집인원·기대수익·정산완료 합산) ──
  async list(params: { stx?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(params.limit ?? 30)));
    const offset = (page - 1) * limit;
    const stx = (params.stx ?? '').trim();
    const conds: ReturnType<Sql>[] = [];
    if (stx) conds.push(this.sql`(p.name ILIKE ${'%' + stx + '%'} OR p.phone ILIKE ${'%' + stx + '%'} OR p.code ILIKE ${'%' + stx + '%'})`);
    if (params.status && ['pending', 'active', 'rejected'].includes(params.status)) {
      conds.push(this.sql`p.status = ${params.status}`);
    }
    const where = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    const items = await this.sql`
      SELECT p.id, p.name, p.phone, p.code, p.is_active, p.status, p.created_at,
             (p.rrn_enc IS NOT NULL) AS has_rrn,
             (SELECT COUNT(*) FROM promoter_referral r WHERE r.promoter_id = p.id)::int AS recruit_count,
             COALESCE((SELECT SUM(reward_amount) FROM promoter_reward w
                        WHERE w.promoter_id = p.id AND w.status='accrued' AND w.settlement_id IS NULL), 0)::int AS expected,
             COALESCE((SELECT SUM(paid_amount) FROM promoter_settlement s
                        WHERE s.promoter_id = p.id AND s.status='paid'), 0)::int AS paid_total
        FROM promoter p
        ${where}
       ORDER BY (p.status = 'pending') DESC, p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const cnt = await this.sql<{ c: string }[]>`SELECT COUNT(*)::text AS c FROM promoter p ${where}`;
    return { items, total: Number(cnt[0].c), page, limit };
  }

  async detail(id: number) {
    const p = await this.sql`
      SELECT id, name, phone, code, bank_name, bank_account, account_holder,
             rrn_masked, (rrn_enc IS NOT NULL) AS has_rrn,
             member_id, reward_rate, is_active, status, memo, created_at
        FROM promoter WHERE id = ${id} LIMIT 1
    `;
    if (!p[0]) throw new NotFoundException('모집인을 찾을 수 없습니다.');
    const rewards = await this.sql`
      SELECT r.id, r.source_table, r.source_id, r.base_paid, r.reward_amount, r.status, r.usage_label, r.settlement_id, r.created_at,
             m.name AS member_name
        FROM promoter_reward r LEFT JOIN member m ON m.id = r.member_id
       WHERE r.promoter_id = ${id} ORDER BY r.created_at DESC LIMIT 100
    `;
    const settlements = await this.sql`
      SELECT id, total_reward, withholding, paid_amount, status, paid_at, created_at, memo
        FROM promoter_settlement WHERE promoter_id = ${id} ORDER BY created_at DESC
    `;
    return { promoter: p[0], rewards, settlements };
  }

  async create(input: {
    name: string; phone: string; code?: string;
    bank_name?: string; bank_account?: string; account_holder?: string;
    rrn?: string; reward_rate?: number | null; memo?: string;
  }, adminId: number) {
    const name = (input.name ?? '').trim();
    const phone = this.digits(input.phone);
    if (!name) throw new BadRequestException('이름은 필수입니다.');
    if (!/^01[0-9]{8,9}$/.test(phone)) throw new BadRequestException('휴대폰번호 형식이 올바르지 않습니다.');

    // 코드 — 직접 지정 시 중복 검사, 비우면 자동(전화 뒷4자리 + 충돌 시 'A' 접두).
    let code = this.normCode(input.code ?? '');
    if (!code) {
      code = await this.promoter.generateUniqueCode(phone);
    } else {
      const dup = await this.sql`SELECT 1 FROM promoter WHERE code = ${code} LIMIT 1`;
      if (dup.length > 0) {
        throw new BadRequestException(`코드 '${code}'가 이미 사용 중입니다. 다른 코드를 지정해주세요.`);
      }
    }
    const phoneDup = await this.sql`SELECT 1 FROM promoter WHERE phone = ${phone} LIMIT 1`;
    if (phoneDup.length > 0) throw new BadRequestException('이미 등록된 전화번호입니다.');

    let rrnEnc: string | null = null;
    let rrnMasked: string | null = null;
    if (input.rrn && this.digits(input.rrn).length >= 7) {
      const rrn = this.digits(input.rrn);
      rrnEnc = encryptPii(rrn, this.cryptoSecret);
      rrnMasked = maskRrn(rrn);
    }
    // 회원 연결(전화 일치) — 있으면 자동 링크
    const m = await this.sql<{ id: number }[]>`SELECT id FROM member WHERE phone = ${phone} ORDER BY id LIMIT 1`;
    const memberId = m[0]?.id ?? null;

    const rate = input.reward_rate != null && input.reward_rate >= 0 ? input.reward_rate : null;
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO promoter (name, phone, code, bank_name, bank_account, account_holder,
                            rrn_enc, rrn_masked, member_id, reward_rate, created_by_admin_id)
      VALUES (${name}, ${phone}, ${code}, ${input.bank_name ?? null}, ${input.bank_account ?? null},
              ${input.account_holder ?? null}, ${rrnEnc}, ${rrnMasked}, ${memberId}, ${rate}, ${adminId})
      RETURNING id
    `;
    this.logger.log(`[promoter create] id=${rows[0].id} name=${name} code=${code} by admin=${adminId}`);
    return { id: rows[0].id, code };
  }

  async update(id: number, input: {
    name?: string; code?: string; bank_name?: string; bank_account?: string;
    account_holder?: string; rrn?: string; reward_rate?: number | null; is_active?: boolean; memo?: string;
  }) {
    const cur = await this.sql<{ id: number }[]>`SELECT id FROM promoter WHERE id = ${id} LIMIT 1`;
    if (!cur[0]) throw new NotFoundException('모집인을 찾을 수 없습니다.');

    if (input.code != null) {
      const code = this.normCode(input.code);
      if (!code) throw new BadRequestException('코드가 비어있습니다.');
      const dup = await this.sql`SELECT 1 FROM promoter WHERE code = ${code} AND id <> ${id} LIMIT 1`;
      if (dup.length > 0) throw new BadRequestException(`코드 '${code}'가 이미 사용 중입니다.`);
      await this.sql`UPDATE promoter SET code = ${code}, updated_at = now() WHERE id = ${id}`;
    }
    if (input.name != null) await this.sql`UPDATE promoter SET name = ${input.name.trim()}, updated_at = now() WHERE id = ${id}`;
    if (input.bank_name !== undefined) await this.sql`UPDATE promoter SET bank_name = ${input.bank_name || null}, updated_at = now() WHERE id = ${id}`;
    if (input.bank_account !== undefined) await this.sql`UPDATE promoter SET bank_account = ${input.bank_account || null}, updated_at = now() WHERE id = ${id}`;
    if (input.account_holder !== undefined) await this.sql`UPDATE promoter SET account_holder = ${input.account_holder || null}, updated_at = now() WHERE id = ${id}`;
    if (input.reward_rate !== undefined) {
      const rate = input.reward_rate != null && input.reward_rate >= 0 ? input.reward_rate : null;
      await this.sql`UPDATE promoter SET reward_rate = ${rate}, updated_at = now() WHERE id = ${id}`;
    }
    if (input.is_active !== undefined) await this.sql`UPDATE promoter SET is_active = ${!!input.is_active}, updated_at = now() WHERE id = ${id}`;
    if (input.memo !== undefined) await this.sql`UPDATE promoter SET memo = ${input.memo || null}, updated_at = now() WHERE id = ${id}`;
    if (input.rrn && this.digits(input.rrn).length >= 7) {
      const rrn = this.digits(input.rrn);
      await this.sql`UPDATE promoter SET rrn_enc = ${encryptPii(rrn, this.cryptoSecret)}, rrn_masked = ${maskRrn(rrn)}, updated_at = now() WHERE id = ${id}`;
    }
    return { ok: true };
  }

  // ── 자가 신청 승인/반려 ──
  async approve(id: number, adminId: number) {
    const rows = await this.sql<{ id: number; status: string; phone: string; name: string }[]>`
      SELECT id, status, phone, name FROM promoter WHERE id = ${id} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('모집인을 찾을 수 없습니다.');
    if (rows[0].status === 'active') throw new BadRequestException('이미 승인된 모집인입니다.');
    await this.sql`UPDATE promoter SET status='active', is_active=true, updated_at=now() WHERE id = ${id}`;
    // 승인 통보 알림톡 (best-effort — BizM 'promoter_approved' 미등록 시 자동 무발송)
    void this.sms
      .sendAlimtalkByCode('promoter_approved', rows[0].phone, { 이름: rows[0].name }, '사주플랜 서포터즈 승인')
      .catch(() => {});
    this.logger.log(`[promoter approve] id=${id} name=${rows[0].name} by admin=${adminId}`);
    return { ok: true };
  }

  async reject(id: number, reason?: string) {
    const rows = await this.sql<{ id: number }[]>`SELECT id FROM promoter WHERE id = ${id} LIMIT 1`;
    if (!rows[0]) throw new NotFoundException('모집인을 찾을 수 없습니다.');
    const memo = (reason ?? '').trim();
    if (memo) {
      await this.sql`UPDATE promoter SET status='rejected', is_active=false, memo=${memo}, updated_at=now() WHERE id = ${id}`;
    } else {
      await this.sql`UPDATE promoter SET status='rejected', is_active=false, updated_at=now() WHERE id = ${id}`;
    }
    return { ok: true };
  }

  // ── 정산 배치 생성 (미정산 적립 합산) ──
  async createSettlement(promoterId: number) {
    const p = await this.sql<{ id: number }[]>`SELECT id FROM promoter WHERE id = ${promoterId} LIMIT 1`;
    if (!p[0]) throw new NotFoundException('모집인을 찾을 수 없습니다.');
    const { withholdingRate } = await this.promoter.getSettings();

    return await this.sql.begin(async (tx) => {
      const rewards = await tx<{ id: number; reward_amount: number }[]>`
        SELECT id, reward_amount FROM promoter_reward
         WHERE promoter_id = ${promoterId} AND status='accrued' AND settlement_id IS NULL
         FOR UPDATE
      `;
      if (rewards.length === 0) throw new BadRequestException('정산할 미정산 적립이 없습니다.');
      const total = rewards.reduce((s, r) => s + Number(r.reward_amount), 0);
      const withholding = Math.floor(total * withholdingRate);
      const paid = total - withholding;
      const ins = await tx<{ id: number }[]>`
        INSERT INTO promoter_settlement (promoter_id, total_reward, withholding, paid_amount, status)
        VALUES (${promoterId}, ${total}, ${withholding}, ${paid}, 'calculated')
        RETURNING id
      `;
      const sid = ins[0].id;
      await tx`UPDATE promoter_reward SET settlement_id = ${sid} WHERE id = ANY(${rewards.map((r) => r.id)})`;
      return { id: sid, total_reward: total, withholding, paid_amount: paid, reward_count: rewards.length };
    });
  }

  // ── 지급완료 마킹 (주민번호 필수 게이트) ──
  async markPaid(settlementId: number, adminId: number, memo?: string) {
    const rows = await this.sql<{
      id: number; promoter_id: number; status: string; paid_amount: number;
      has_rrn: boolean; phone: string; name: string;
    }[]>`
      SELECT s.id, s.promoter_id, s.status, s.paid_amount,
             (p.rrn_enc IS NOT NULL) AS has_rrn, p.phone, p.name
        FROM promoter_settlement s JOIN promoter p ON p.id = s.promoter_id
       WHERE s.id = ${settlementId} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('정산 건을 찾을 수 없습니다.');
    const s = rows[0];
    if (s.status === 'paid') throw new BadRequestException('이미 지급완료된 정산입니다.');
    if (s.status === 'voided') throw new BadRequestException('무효화된 정산입니다.');
    if (!s.has_rrn) {
      throw new BadRequestException('모집인 주민번호가 등록되지 않아 정산(지급)할 수 없습니다. 먼저 주민번호를 등록해주세요.');
    }
    await this.sql`
      UPDATE promoter_settlement
         SET status='paid', paid_at=now(), paid_by_admin_id=${adminId}, memo=${memo ?? null}
       WHERE id = ${settlementId}
    `;
    // 지급 통보 알림톡 (best-effort) — 템플릿 미등록이면 자동 skip
    void this.sms.sendAlimtalkByCode(
      'promoter_settlement_paid',
      s.phone,
      { 이름: s.name, 지급액: Number(s.paid_amount).toLocaleString() },
      '사주플랜 정산 지급',
    ).catch(() => {});
    this.logger.log(`[promoter settlement paid] sid=${settlementId} promoter=${s.promoter_id} amount=${s.paid_amount} by admin=${adminId}`);
    return { ok: true };
  }

  async voidSettlement(settlementId: number, reason: string) {
    if (!reason || reason.trim().length < 5) throw new BadRequestException('무효 사유는 5자 이상 입력해주세요.');
    return await this.sql.begin(async (tx) => {
      const s = await tx<{ status: string }[]>`SELECT status FROM promoter_settlement WHERE id = ${settlementId} FOR UPDATE`;
      if (!s[0]) throw new NotFoundException('정산 건을 찾을 수 없습니다.');
      if (s[0].status === 'paid') throw new BadRequestException('이미 지급완료된 정산은 무효화할 수 없습니다.');
      // 묶였던 적립을 미정산 상태로 되돌림
      await tx`UPDATE promoter_reward SET settlement_id = NULL WHERE settlement_id = ${settlementId}`;
      await tx`UPDATE promoter_settlement SET status='voided', memo=${reason.trim()} WHERE id = ${settlementId}`;
      return { ok: true };
    });
  }
}
