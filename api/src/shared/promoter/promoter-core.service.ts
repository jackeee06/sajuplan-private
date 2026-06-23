import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SQL, type Sql, type TxSql } from '../db/db.module';
import { SmsService } from '../../user/sms/sms.service';

/**
 * 모집인(서포터즈) 보상 — 공용 코어 서비스.
 *
 * 책임:
 *  - 가입 귀속 생성 (createReferralForSignup)
 *  - 유료 사용 적립 (accrueInTx) — m2net-push 트랜잭션 내부에서 호출
 *  - 환불 차감 (voidBySource) — m2net-push / 환불 서비스에서 호출
 *  - 실시간 적립 알림톡 (sendAccrualAlimtalk) — 게이트(setting)로 on/off
 *  - 모집인 대시보드 집계 (getDashboard)
 *
 * ★ 회사 부담 비용 원장(promoter_reward)에만 기록. point/point_history/earning_balance 무침범.
 *   → 돈 불변식(_verify_money_integrity.py) 영향 없음.
 */
@Injectable()
export class PromoterCoreService {
  private readonly logger = new Logger(PromoterCoreService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  /** 정책 상수 (setting namespace='promoter'). 누락 시 안전 기본값. */
  async getSettings(): Promise<{
    rate: number;
    months: number;
    withholdingRate: number;
    alimtalkEnabled: boolean;
  }> {
    const rows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting WHERE namespace = 'promoter'
    `;
    const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
    const num = (k: string, d: number) => {
      const v = Number(map.get(k));
      return Number.isFinite(v) && v >= 0 ? v : d;
    };
    return {
      rate: num('reward_rate', 0.03),
      months: Math.max(1, Math.trunc(num('reward_months', 3))),
      withholdingRate: num('withholding_rate', 0.033),
      alimtalkEnabled: (map.get('alimtalk_enabled') ?? 'false') === 'true',
    };
  }

  private normalizeCode(code: string): string {
    return (code ?? '').replace(/[^0-9A-Za-z]/g, '').trim();
  }

  /**
   * 가입 시 회원↔모집인 귀속 생성 (best-effort, 실패해도 가입은 정상).
   *  - code → active promoter 조회
   *  - 자기추천 차단(전화 일치 또는 member_id 일치)
   *  - 한 회원 1모집인(member_id UNIQUE) — 이미 있으면 skip
   *  - rate/기간 가입 시점 스냅샷
   */
  async createReferralForSignup(args: {
    memberId: number;
    code: string | null | undefined;
    entryMethod: 'qr' | 'code';
    memberPhone: string | null;
  }): Promise<void> {
    const code = this.normalizeCode(args.code ?? '');
    if (!code) return;
    try {
      const pr = await this.sql<{ id: number; phone: string; member_id: number | null; reward_rate: string | null }[]>`
        SELECT id, phone, member_id, reward_rate FROM promoter
         WHERE code = ${code} AND is_active = true LIMIT 1
      `;
      if (!pr[0]) {
        this.logger.log(`[promoter referral] 코드 매칭 실패(무시) code=${code} member=${args.memberId}`);
        return;
      }
      const promoter = pr[0];
      // 자기추천 차단
      const memberPhone = (args.memberPhone ?? '').replace(/\D/g, '');
      const promoterPhone = (promoter.phone ?? '').replace(/\D/g, '');
      if ((memberPhone && memberPhone === promoterPhone) || promoter.member_id === args.memberId) {
        this.logger.log(`[promoter referral] 자기추천 차단 member=${args.memberId} promoter=${promoter.id}`);
        return;
      }
      const { rate, months } = await this.getSettings();
      const rateSnapshot = promoter.reward_rate != null ? Number(promoter.reward_rate) : rate;
      await this.sql`
        INSERT INTO promoter_referral (promoter_id, member_id, entry_method, signup_at, reward_until, rate_snapshot)
        VALUES (
          ${promoter.id}, ${args.memberId}, ${args.entryMethod}, now(),
          (CURRENT_DATE + (${months} || ' months')::interval)::date,
          ${rateSnapshot}
        )
        ON CONFLICT (member_id) DO NOTHING
      `;
      this.logger.log(`[promoter referral] 귀속 member=${args.memberId} → promoter=${promoter.id} rate=${rateSnapshot} months=${months}`);
    } catch (e) {
      this.logger.error(`[promoter referral] 실패(무시) member=${args.memberId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** 사후 추천 입력 가능 기간(가입 후 N일). 앱 신규설치 경유로 가입 시 코드 누락분 구제. */
  private static readonly POST_SIGNUP_DAYS = 7;

  /**
   * 사후 추천 입력 상태 — 마이페이지 노출 제어용.
   *  - hasReferral: 이미 귀속됨(추천인 이름 동반)
   *  - canInput: 아직 귀속 없고 가입 후 7일 이내 → 입력칸 노출
   */
  async getReferralStatus(
    memberId: number,
  ): Promise<{ hasReferral: boolean; canInput: boolean; promoterName: string | null }> {
    const ref = await this.sql<{ pname: string | null }[]>`
      SELECT p.name AS pname
        FROM promoter_referral pr
        JOIN promoter p ON p.id = pr.promoter_id
       WHERE pr.member_id = ${memberId}
       LIMIT 1
    `;
    if (ref.length) return { hasReferral: true, canInput: false, promoterName: ref[0].pname };
    const days = PromoterCoreService.POST_SIGNUP_DAYS;
    const m = await this.sql<{ within: boolean }[]>`
      SELECT (created_at > now() - (${days} || ' days')::interval) AS within
        FROM member WHERE id = ${memberId} LIMIT 1
    `;
    return { hasReferral: false, canInput: m[0]?.within ?? false, promoterName: null };
  }

  /**
   * 가입 후 추천 코드 사후 입력 (마이페이지) — 가입 시 코드를 못 넣은 회원 구제.
   *  - 가입 후 7일 이내 + 아직 미귀속 + 유효 코드 + 자기추천 아님 → 귀속 생성
   *  - 입력 시점 이후 사용분부터 자연히 적립(과거 소급 없음). 기간 가드로 어뷰징 차단.
   */
  async applyReferralPostSignup(
    memberId: number,
    code: string,
  ): Promise<{ ok: boolean; message: string }> {
    const c = this.normalizeCode(code ?? '');
    if (!c) return { ok: false, message: '추천 코드를 입력해 주세요.' };
    const st = await this.getReferralStatus(memberId);
    if (st.hasReferral) return { ok: false, message: '이미 추천이 등록되어 있어요.' };
    if (!st.canInput) {
      return { ok: false, message: '추천 코드 입력 기간(가입 후 7일)이 지났어요.' };
    }
    const m = await this.sql<{ phone: string | null }[]>`
      SELECT phone FROM member WHERE id = ${memberId} LIMIT 1
    `;
    await this.createReferralForSignup({
      memberId,
      code: c,
      entryMethod: 'code',
      memberPhone: m[0]?.phone ?? null,
    });
    const after = await this.sql<{ one: number }[]>`
      SELECT 1 AS one FROM promoter_referral WHERE member_id = ${memberId} LIMIT 1
    `;
    if (after.length) return { ok: true, message: '추천 코드가 등록되었어요!' };
    return { ok: false, message: '유효하지 않은 추천 코드예요. 다시 확인해 주세요.' };
  }

  /**
   * 유료 사용 적립 — 트랜잭션 내부에서 호출(consultation/선결제 차감과 원자성).
   *  - paidAmount: 유료 사용분(종량=amt_pro / 선결제=takePaid)
   *  - 멱등: (source_table, source_id) UNIQUE
   *  - 현금형(reward_type='cash'): promoter_reward 원장만 적립(기존). 수동 정산 대상.
   *  - 코인형(reward_type='coin'): 추가로 초대한 회원(promoter.member_id)의 free_balance 즉시 코인 적립.
   *      · balance_kind='consumer' → 상담사 수익금(earning)·정산 무침범 (회사 부담 마케팅 코인).
   *      · member.point 미러 동기화. 멱등은 promoter_reward INSERT 게이트가 보장(1회만 실행).
   *      · m2net 잔액 동기화(addMemberCoin)는 HTTP라 호출자가 커밋 후 수행(반환값 사용).
   *  - 반환: 신규 적립 시 {promoterId, rewardAmount, rewardType, beneficiaryMemberId}, 중복/대상아님이면 null
   */
  async accrueInTx(
    tx: TxSql,
    args: {
      memberId: number;
      paidAmount: number;
      sourceTable: 'consultation' | 'chat_room';
      sourceId: number;
      usageLabel: string;
    },
  ): Promise<
    | { promoterId: number; rewardAmount: number; rewardType: 'cash' | 'coin'; beneficiaryMemberId: number | null }
    | null
  > {
    const paid = Math.trunc(Number(args.paidAmount));
    if (!Number.isFinite(paid) || paid <= 0) return null;
    const ref = await tx<
      { promoter_id: number; rate_snapshot: string; reward_type: string | null; beneficiary_member_id: number | null }[]
    >`
      SELECT pr.promoter_id, pr.rate_snapshot,
             p.reward_type, p.member_id AS beneficiary_member_id
        FROM promoter_referral pr
        JOIN promoter p ON p.id = pr.promoter_id
       WHERE pr.member_id = ${args.memberId} AND pr.reward_until >= CURRENT_DATE
       LIMIT 1
    `;
    if (!ref[0]) return null;
    const rate = Number(ref[0].rate_snapshot);
    const reward = Math.floor(paid * rate);
    if (reward <= 0) return null;
    const ins = await tx<{ id: number }[]>`
      INSERT INTO promoter_reward (
        promoter_id, member_id, source_table, source_id,
        base_paid, rate, reward_amount, status, usage_label
      ) VALUES (
        ${ref[0].promoter_id}, ${args.memberId}, ${args.sourceTable}, ${args.sourceId},
        ${paid}, ${rate}, ${reward}, 'accrued', ${args.usageLabel.slice(0, 120)}
      )
      ON CONFLICT (source_table, source_id) DO NOTHING
      RETURNING id
    `;
    if (ins.length === 0) return null; // 멱등 — 이미 적립됨
    const rewardId = ins[0].id;
    const rewardType: 'cash' | 'coin' = ref[0].reward_type === 'coin' ? 'coin' : 'cash';
    const beneficiaryMemberId =
      ref[0].beneficiary_member_id != null ? Number(ref[0].beneficiary_member_id) : null;

    // ── 코인형: 초대한 회원 A(beneficiary)의 free_balance 즉시 적립 (회사 부담 마케팅 코인) ──
    //    creditPointToMember(auth.service) 와 동일 정석 패턴. balance_kind='consumer' → earning/정산 무침범.
    if (rewardType === 'coin' && beneficiaryMemberId) {
      let pt = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${beneficiaryMemberId} FOR UPDATE
      `;
      if (pt.length === 0) {
        await tx`INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
                 VALUES (${beneficiaryMemberId}, 0, 0, 0, 0) ON CONFLICT (member_id) DO NOTHING`;
        pt = await tx<{ free_balance: number; paid_balance: number }[]>`
          SELECT free_balance, paid_balance FROM point WHERE member_id = ${beneficiaryMemberId} FOR UPDATE
        `;
      }
      const balanceAfter = Number(pt[0].free_balance) + Number(pt[0].paid_balance) + reward;
      await tx`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          is_paid, rel_table, rel_id, rel_action, actor_type, balance_kind
        ) VALUES (
          ${beneficiaryMemberId}, ${`친구초대 보상 — ${args.usageLabel.slice(0, 80)}`}, ${reward}, 0, ${balanceAfter},
          false, 'promoter_reward', ${String(rewardId)},
          ${`promoter_reward@${rewardId}@invite_coin`}, 'system', 'consumer'
        )
        ON CONFLICT DO NOTHING
      `;
      await tx`UPDATE point SET free_balance = free_balance + ${reward},
                                total_earned = total_earned + ${reward},
                                updated_at = now()
                WHERE member_id = ${beneficiaryMemberId}`;
      await tx`UPDATE member SET point = (SELECT free_balance + paid_balance FROM point WHERE member_id = ${beneficiaryMemberId}),
                                 updated_at = now()
                WHERE id = ${beneficiaryMemberId}`;
    }

    return { promoterId: ref[0].promoter_id, rewardAmount: reward, rewardType, beneficiaryMemberId };
  }

  /**
   * 환불 차감 — 해당 소스의 미정산 적립을 voided 처리.
   *  - exec: this.sql(서비스 단독) 또는 tx(트랜잭션 내부) 모두 허용
   *  - 이미 정산(settlement_id NOT NULL)된 건은 건드리지 않음(다음 정산 이월 상계 대상).
   */
  async voidBySource(exec: TxSql, sourceTable: 'consultation' | 'chat_room', sourceId: number): Promise<void> {
    try {
      await exec`
        UPDATE promoter_reward
           SET status = 'voided'
         WHERE source_table = ${sourceTable} AND source_id = ${sourceId}
           AND status = 'accrued' AND settlement_id IS NULL
      `;
    } catch (e) {
      this.logger.error(`[promoter void] ${sourceTable}#${sourceId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * 실시간 적립 알림톡 (게이트). setting.alimtalk_enabled=true 일 때만 발송.
   *  - 회원 마스킹·누적 기대수익 동봉. fire-and-forget.
   *  - BizM 템플릿 'promoter_reward_accrued' 승인 전까지 enabled=false 로 비활성.
   */
  async sendAccrualAlimtalk(promoterId: number, usageLabel: string, rewardAmount: number): Promise<void> {
    try {
      const { alimtalkEnabled } = await this.getSettings();
      if (!alimtalkEnabled) return;
      const rows = await this.sql<{ name: string; phone: string; expected: string }[]>`
        SELECT p.name, p.phone,
               COALESCE((SELECT SUM(reward_amount) FROM promoter_reward r
                          WHERE r.promoter_id = p.id AND r.status='accrued' AND r.settlement_id IS NULL), 0)::text AS expected
          FROM promoter p WHERE p.id = ${promoterId} LIMIT 1
      `;
      if (!rows[0]) return;
      await this.sms.sendAlimtalkByCode(
        'promoter_reward_accrued',
        rows[0].phone,
        {
          내용: usageLabel,
          적립액: rewardAmount.toLocaleString(),
          누적기대수익: Number(rows[0].expected).toLocaleString(),
        },
        '사주플랜 적립',
      );
    } catch (e) {
      this.logger.error(`[promoter alimtalk] promoter=${promoterId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** 회원 이름 마스킹: 홍길동 → 홍** */
  static maskName(name: string | null): string {
    const arr = Array.from((name ?? '').trim());
    if (arr.length === 0) return '익명';
    return arr[0] + '*'.repeat(Math.max(1, arr.length - 1));
  }

  /** 코드 유효성(존재·활성)만 — 이름 미반환. 가입 화면 prefill 검증용. */
  async getByCode(code: string): Promise<{ exists: boolean; active: boolean }> {
    const c = this.normalizeCode(code);
    if (!c) return { exists: false, active: false };
    const rows = await this.sql<{ is_active: boolean }[]>`
      SELECT is_active FROM promoter WHERE code = ${c} LIMIT 1
    `;
    if (!rows[0]) return { exists: false, active: false };
    return { exists: true, active: !!rows[0].is_active };
  }

  /** 코드 중복 여부 */
  async codeExists(code: string): Promise<boolean> {
    const r = await this.sql`SELECT 1 FROM promoter WHERE code = ${code} LIMIT 1`;
    return r.length > 0;
  }

  /** 유니크 코드 자동생성 — 전화 뒷4자리, 충돌 시 앞에 'A' 누적 (A0572, AA0572 …) */
  async generateUniqueCode(phone: string): Promise<string> {
    const digits = (phone ?? '').replace(/\D/g, '');
    let code = digits.slice(-4) || `S${digits.slice(-3)}`;
    let guard = 0;
    while ((await this.codeExists(code)) && guard < 30) {
      code = `A${code}`;
      guard++;
    }
    return code;
  }

  /** 전화번호로 사주플랜 회원 이름 조회 (신청 폼 자동입력용). 없으면 null. */
  async findMemberNameByPhone(phone: string): Promise<string | null> {
    const d = (phone ?? '').replace(/\D/g, '');
    if (!d) return null;
    const r = await this.sql<{ name: string | null }[]>`
      SELECT name FROM member
       WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') = ${d}
       ORDER BY id LIMIT 1
    `;
    return r[0]?.name ?? null;
  }

  /** 전화번호로 모집인 조회 (상태 분기용) */
  async getPromoterByPhone(phone: string): Promise<{ id: number; status: string; is_active: boolean } | null> {
    const d = (phone ?? '').replace(/\D/g, '');
    const r = await this.sql<{ id: number; status: string; is_active: boolean }[]>`
      SELECT id, status, is_active FROM promoter WHERE phone = ${d} LIMIT 1
    `;
    return r[0] ?? null;
  }

  /**
   * 자가 신청 생성. 코드 자동생성.
   *  - 일반: status='pending', is_active=false (관리자 승인 후 활동)
   *  - 주인 초대(autoApprove): status='active', is_active=true 로 즉시 활동 + 초대한 주인 귀속 기록
   */
  async createApplication(args: {
    phone: string; name: string; bankName?: string; bankAccount?: string; accountHolder?: string;
    autoApprove?: boolean; invitedByMemberId?: number | null;
  }): Promise<{ id: number; autoApproved: boolean }> {
    const phone = (args.phone ?? '').replace(/\D/g, '');
    const name = (args.name ?? '').trim().slice(0, 100);
    if (!/^01[0-9]{8,9}$/.test(phone)) throw new BadRequestException('휴대폰번호 형식이 올바르지 않습니다.');
    if (!name) throw new BadRequestException('이름을 입력해주세요.');
    const dup = await this.sql`SELECT 1 FROM promoter WHERE phone = ${phone} LIMIT 1`;
    if (dup.length > 0) throw new BadRequestException('이미 신청했거나 등록된 번호입니다.');
    const code = await this.generateUniqueCode(phone);
    const autoApprove = !!args.autoApprove;
    const status = autoApprove ? 'active' : 'pending';
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO promoter (name, phone, code, bank_name, bank_account, account_holder,
                            is_active, status, invited_by_member_id)
      VALUES (${name}, ${phone}, ${code}, ${args.bankName ?? null}, ${args.bankAccount ?? null},
              ${args.accountHolder ?? null}, ${autoApprove}, ${status}, ${args.invitedByMemberId ?? null})
      RETURNING id
    `;
    this.logger.log(
      `[promoter apply] 신청 id=${rows[0].id} name=${name} code=${code} (${status}` +
        `${autoApprove ? `, 주인초대 by=${args.invitedByMemberId}` : ''})`,
    );
    return { id: rows[0].id, autoApproved: autoApprove };
  }

  // ── 주인 초대(자동승인) ──────────────────────────────────────────────
  // 주인(member.is_owner)이 직접 카톡으로 보낸 초대 링크로 들어온 사람은 즉시 승인되어
  // 바로 활동한다. 링크 위변조를 막기 위해 주인 id 를 HMAC 서명한 토큰을 사용한다.
  // (실제 돈 정산은 여전히 관리자 수동 통제 → 자동승인해도 돈 사고 없음)

  private ownerInviteSecret(): string {
    return this.config.get<string>('JWT_SECRET') || 'sajumoon-owner-invite';
  }

  /** 주인 초대 토큰 — `${ownerId}.${HMAC}`. */
  makeOwnerInviteToken(ownerMemberId: number): string {
    const payload = String(ownerMemberId);
    const sig = createHmac('sha256', this.ownerInviteSecret())
      .update(`promoter-owner-invite:${payload}`)
      .digest('base64url')
      .slice(0, 20);
    return `${payload}.${sig}`;
  }

  /** 초대 토큰 검증 → 주인 member.id (서명 무효이거나 주인 권한 회수 시 null). */
  async verifyOwnerInviteToken(token?: string | null): Promise<number | null> {
    if (!token || typeof token !== 'string') return null;
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expect = createHmac('sha256', this.ownerInviteSecret())
      .update(`promoter-owner-invite:${payload}`)
      .digest('base64url')
      .slice(0, 20);
    if (sig !== expect) return null;
    const ownerId = Number(payload);
    if (!Number.isInteger(ownerId) || ownerId <= 0) return null;
    // 토큰 발급 후 주인 권한이 회수됐을 수 있으니 실시간 확인
    const r = await this.sql<{ is_owner: boolean }[]>`
      SELECT is_owner FROM member WHERE id = ${ownerId} LIMIT 1
    `;
    return r[0]?.is_owner ? ownerId : null;
  }

  /** 주인 전용 — 모집인 초대 카드 데이터(닉네임·서명링크). is_owner 아니면 거부. */
  async getOwnerInvite(ownerMemberId: number): Promise<{
    ownerNickname: string;
    shareUrl: string;
  }> {
    const r = await this.sql<{ nickname: string | null; name: string | null; is_owner: boolean }[]>`
      SELECT nickname, name, is_owner FROM member WHERE id = ${ownerMemberId} LIMIT 1
    `;
    if (!r[0] || !r[0].is_owner) {
      throw new ForbiddenException('모집인 초대는 주인만 사용할 수 있습니다.');
    }
    const token = this.makeOwnerInviteToken(ownerMemberId);
    const origin = 'https://sajuplan.com';
    // 주인 초대 전용 OG 경유 페이지(pi.html) — 단순 링크로 보내면 혜택 이미지 미리보기 + 클릭 시
    // 카톡 인앱브라우저에서 모바일웹(/promoter)으로 그대로 열림(피드 카드 버튼의 앱설치 문제 회피).
    // inv 서명토큰은 pi.html → /promoter?inv= 로 넘겨 자동승인.
    return {
      ownerNickname: (r[0].nickname || r[0].name || '').trim(),
      // &v= 캐시버스터 — OG 미리보기(이미지·문구) 갱신 시 카카오가 새로 스크랩하도록 버전 증가.
      shareUrl: `${origin}/pi.html?inv=${encodeURIComponent(token)}&v=2`,
    };
  }

  /** 모집인 대시보드 집계 (본인). */
  async getDashboard(promoterId: number): Promise<{
    name: string;
    code: string;
    expected: number;     // 미정산 기대수익
    paidTotal: number;    // 정산 완료 누적
    recruitCount: number; // 모집 인원
    timeline: { maskedName: string; usedAmount: number; rewardAmount: number; status: string; createdAt: string }[];
  }> {
    const p = await this.sql<{ name: string; code: string }[]>`
      SELECT name, code FROM promoter WHERE id = ${promoterId} LIMIT 1
    `;
    const agg = await this.sql<{ expected: string; paid_total: string; recruits: string }[]>`
      SELECT
        COALESCE(SUM(reward_amount) FILTER (WHERE status='accrued' AND settlement_id IS NULL), 0)::text AS expected,
        COALESCE((SELECT SUM(paid_amount) FROM promoter_settlement WHERE promoter_id=${promoterId} AND status='paid'), 0)::text AS paid_total,
        (SELECT COUNT(*) FROM promoter_referral WHERE promoter_id=${promoterId})::text AS recruits
      FROM promoter_reward WHERE promoter_id = ${promoterId}
    `;
    const tl = await this.sql<{ name: string | null; reward_amount: number; base_paid: number; status: string; created_at: string }[]>`
      SELECT m.name, r.reward_amount, r.base_paid, r.status, r.created_at
        FROM promoter_reward r
        LEFT JOIN member m ON m.id = r.member_id
       WHERE r.promoter_id = ${promoterId}
       ORDER BY r.created_at DESC
       LIMIT 100
    `;
    return {
      name: p[0]?.name ?? '',
      code: p[0]?.code ?? '',
      expected: Number(agg[0]?.expected ?? 0),
      paidTotal: Number(agg[0]?.paid_total ?? 0),
      recruitCount: Number(agg[0]?.recruits ?? 0),
      timeline: tl.map((t) => ({
        maskedName: PromoterCoreService.maskName(t.name),
        usedAmount: Number(t.base_paid),
        rewardAmount: Number(t.reward_amount),
        status: t.status,
        createdAt: t.created_at,
      })),
    };
  }

  /** 친구초대 공유 링크 베이스 (모집인 랜딩 /s/{code}). */
  private static readonly SHARE_BASE = 'https://sajuplan.com/s/';

  /**
   * 회원 친구초대 활성화 — 코인형 모집인 보장(없으면 생성), 본인 코드 반환.
   *  - 회원(앱) 전용. 친구가 코드로 가입 후 유료 사용 시 회원에게 코인 적립(reward_type='coin').
   *  - 이미 이 회원/전화로 등록된 모집인이 있으면 그대로 재사용(현금형이면 현금형 유지 — 본인 선택 존중).
   *    → phone UNIQUE 충돌 방지 + 외부영업 겸업 회원 보호.
   */
  async ensureCoinPromoterForMember(
    memberId: number,
  ): Promise<{ code: string; promoterId: number; shareUrl: string; rewardType: 'cash' | 'coin' }> {
    const m = await this.sql<{ name: string | null; nickname: string | null; phone: string | null }[]>`
      SELECT name, nickname, phone FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (!m[0]) throw new BadRequestException('회원을 찾을 수 없습니다.');
    const phoneDigits = (m[0].phone ?? '').replace(/\D/g, '');

    const existing = await this.sql<{ id: number; code: string; reward_type: string | null }[]>`
      SELECT id, code, reward_type FROM promoter
       WHERE member_id = ${memberId}
          OR (${phoneDigits} <> '' AND phone = ${phoneDigits})
       ORDER BY (member_id = ${memberId}) DESC, id
       LIMIT 1
    `;
    if (existing[0]) {
      // member_id 연결이 비어 있던 기존 모집인(전화로만 매칭)이면 회원 연결 보강.
      await this.sql`UPDATE promoter SET member_id = ${memberId}, updated_at = now()
                      WHERE id = ${existing[0].id} AND member_id IS NULL`;
      return {
        code: existing[0].code,
        promoterId: existing[0].id,
        shareUrl: PromoterCoreService.SHARE_BASE + existing[0].code,
        rewardType: existing[0].reward_type === 'coin' ? 'coin' : 'cash',
      };
    }

    const name = (m[0].nickname || m[0].name || '회원').toString().trim().slice(0, 100);
    const code = await this.generateUniqueCode(phoneDigits || String(memberId));
    const phoneForRow = phoneDigits || `M${memberId}`; // phone NOT NULL UNIQUE — 폰 없으면 회원ID 기반 대체
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO promoter (name, phone, code, member_id, reward_type, is_active, status)
      VALUES (${name}, ${phoneForRow}, ${code}, ${memberId}, 'coin', true, 'active')
      RETURNING id
    `;
    this.logger.log(`[promoter invite] 코인형 모집인 생성 member=${memberId} code=${code}`);
    return {
      code,
      promoterId: rows[0].id,
      shareUrl: PromoterCoreService.SHARE_BASE + code,
      rewardType: 'coin',
    };
  }

  /**
   * 회원 친구초대 현황 (마이페이지). 활성화 전이면 enabled=false.
   *  - totalCoins: 받은 코인 누적(환불 void 여도 코인은 회수 안 하므로 전체 합산 = 실제 받은 코인).
   */
  async getMemberInviteDashboard(memberId: number): Promise<{
    enabled: boolean;
    code: string | null;
    shareUrl: string | null;
    rewardType: 'cash' | 'coin' | null;
    friendCount: number;
    totalCoins: number;
    timeline: { maskedName: string; usedAmount: number; rewardAmount: number; status: string; createdAt: string }[];
  }> {
    const p = await this.sql<{ id: number; code: string; reward_type: string | null }[]>`
      SELECT id, code, reward_type FROM promoter WHERE member_id = ${memberId} ORDER BY id LIMIT 1
    `;
    if (!p[0]) {
      return { enabled: false, code: null, shareUrl: null, rewardType: null, friendCount: 0, totalCoins: 0, timeline: [] };
    }
    const promoterId = p[0].id;
    const agg = await this.sql<{ friends: string; coins: string }[]>`
      SELECT
        (SELECT COUNT(*) FROM promoter_referral WHERE promoter_id = ${promoterId})::text AS friends,
        COALESCE((SELECT SUM(reward_amount) FROM promoter_reward WHERE promoter_id = ${promoterId}), 0)::text AS coins
    `;
    const tl = await this.sql<
      { name: string | null; reward_amount: number; base_paid: number; status: string; created_at: string }[]
    >`
      SELECT m.name, r.reward_amount, r.base_paid, r.status, r.created_at
        FROM promoter_reward r
        LEFT JOIN member m ON m.id = r.member_id
       WHERE r.promoter_id = ${promoterId}
       ORDER BY r.created_at DESC
       LIMIT 50
    `;
    return {
      enabled: true,
      code: p[0].code,
      shareUrl: PromoterCoreService.SHARE_BASE + p[0].code,
      rewardType: p[0].reward_type === 'coin' ? 'coin' : 'cash',
      friendCount: Number(agg[0]?.friends ?? 0),
      totalCoins: Number(agg[0]?.coins ?? 0),
      timeline: tl.map((t) => ({
        maskedName: PromoterCoreService.maskName(t.name),
        usedAmount: Number(t.base_paid),
        rewardAmount: Number(t.reward_amount),
        status: t.status,
        createdAt: t.created_at,
      })),
    };
  }

  // ── 코드 박힌 쿠폰 이미지 즉석 합성 (서버 폰트 불필요) ──
  //   베이스(디자인+한글)는 미리 만든 PNG, 코드는 미리 만든 숫자 글리프 PNG 를 합성만 한다.
  //   에셋: process.cwd()/assets/coupon/{coupon-base.png, glyph-*.png, coupon-layout.json}
  //   무저장(요청 시 메모리 합성). 베이스/글리프/레이아웃은 1회 읽어 캐시.
  private static couponDir = join(process.cwd(), 'assets', 'coupon');
  private static couponBase: Buffer | null = null;
  private static couponLayout: { centerX: number; top: number; glyphW: number; glyphH: number } | null = null;
  private static glyphCache = new Map<string, Buffer>();

  /** 코드(예 '0572','A0572')를 큰 글씨로 박은 쿠폰 PNG 버퍼. 코드 없으면 베이스만. */
  async renderCouponImage(code: string): Promise<Buffer> {
    const dir = PromoterCoreService.couponDir;
    if (!PromoterCoreService.couponBase) {
      PromoterCoreService.couponBase = readFileSync(join(dir, 'coupon-base.png'));
    }
    if (!PromoterCoreService.couponLayout) {
      PromoterCoreService.couponLayout = JSON.parse(readFileSync(join(dir, 'coupon-layout.json'), 'utf8'));
    }
    const layout = PromoterCoreService.couponLayout!;
    const base = PromoterCoreService.couponBase!;
    const chars = (code ?? '').toUpperCase().replace(/[^0-9A]/g, '').slice(0, 8).split('');
    if (chars.length === 0) return base;
    const totalW = chars.length * layout.glyphW;
    const startX = Math.round(layout.centerX - totalW / 2);
    const overlays = chars.map((ch, i) => {
      let g = PromoterCoreService.glyphCache.get(ch);
      if (!g) {
        g = readFileSync(join(dir, `glyph-${ch}.png`));
        PromoterCoreService.glyphCache.set(ch, g);
      }
      return { input: g, left: startX + i * layout.glyphW, top: layout.top };
    });
    return sharp(base).composite(overlays).png().toBuffer();
  }
}
