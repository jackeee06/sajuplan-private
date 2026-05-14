import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { SQL, type Sql } from '../../shared/db/db.module';
import { Ag9Service } from '../../shared/ag9/ag9.service';
import { M2netService } from '../../shared/m2net/m2net.service';
import { SmsService } from '../sms/sms.service';
import { maskCardNumber } from '../../shared/ag9/card-crypto';
import type { PgCallbackPayload } from '../../shared/ag9/ag9.types';
import { PrepareChargeDto, type GeneralPayMethod } from './dto/prepare-charge.dto';
import { RegisterCardDto } from './dto/register-card.dto';
import { SetAutoConfigDto } from './dto/set-auto-config.dto';
import { runtimeEnv } from '../../shared/env/runtime-env';

/**
 * 사용자 측 포인트 충전 핵심 서비스.
 *
 * sample 매핑:
 *   - getPackages           ← coin_fill.php 라인 42-48
 *   - prepareCharge         ← ajax.coin_fill_update.php
 *   - autoPayCharge         ← coin_pay_ok_auto.php
 *   - registerAutoPayCard   ← coin_fill_auto_card_update.php
 *   - deleteAutoPayCard     ← coin_fill_auto_card_del.php
 *   - setAutoConfig         ← coin_fill_auto_card_member_update.php
 *   - handlePaymentCallback ← coin_pay_ok_v2.php
 *   - handleVbankCallback   ← coin_pay_bank_ok_v2.php
 *   - handleAutopayPush     ← mtonet/auto_pay_result.php
 *
 * 멱등 보장:
 *   - payment.oid UNIQUE, point_history (rel_table, rel_id, rel_action) UNIQUE.
 *   - 모든 콜백은 SELECT FOR UPDATE 후 status 분기 → idempotent return.
 *   - sample/coin_pay_bank_ok_v2.php 라인 53-63 atomic UPDATE 패턴 그대로 (m2net_status='충전처리중').
 */
@Injectable()
export class ChargeService {
  private readonly logger = new Logger(ChargeService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly ag9: Ag9Service,
    private readonly m2net: M2netService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  // ============================================================
  // 조회: 충전 상품 목록 (sample/coin_fill.php 라인 42-48)
  // ============================================================
  async getPackages() {
    const rows = await this.sql<
      {
        id: number;
        product_name: string | null;
        amount: number;
        coin_amount: number;
        bonus_percent: number;
        total_point: number;
        message: string | null;
        display_order: number;
      }[]
    >`
      SELECT id, product_name, amount, coin_amount, bonus_percent, total_point, message, display_order
        FROM account_setting
       WHERE is_active = TRUE
       ORDER BY display_order ASC, id ASC
    `;

    return rows.map((r) => {
      const amount = Number(r.amount) || 0;
      const coin = Number(r.coin_amount) || 0;
      // sample 정책: total_point가 운영자가 직접 채우는 값이지만, 신규 마이그레이션 직후엔 0일 수 있음.
      // 0이면 coin_amount(=실 충전 코인)로 폴백 — sample/coin_fill.php 화면도 "합계" 표시는 total_point지만
      // 라이브 DB가 비어있을 땐 coin_amount = total_point로 운영해 왔음.
      const total = Number(r.total_point) || coin;
      // bonus_percent도 0이면 (coin - amount) / amount × 100으로 자동 계산
      const bonus =
        Number(r.bonus_percent) ||
        (amount > 0 && coin > amount ? Math.round(((coin - amount) / amount) * 100) : 0);
      return {
        id: Number(r.id),
        name: r.product_name ?? `상품${r.id}`,
        // VAT 10% 가산 (sample/coin_fill.php 라인 47)
        payAmount: Math.round(amount * 1.1),
        price: amount,
        coinAmount: coin,
        bonusPercent: bonus,
        totalPoint: total,
        message: r.message,
        displayOrder: Number(r.display_order),
      };
    });
  }

  // ============================================================
  // 조회: 등록된 카드 + 자동충전 설정
  // ============================================================
  async getMethods(memberId: number) {
    const cards = await this.sql<
      {
        id: number;
        card_company: string | null;
        card_no_masked: string | null;
        expires_at: string | null;
        amount: number;
        coin_amount: number;
        is_active: boolean;
        auto_enabled: boolean;
        auto_package_id: number | null;
      }[]
    >`
      SELECT id, card_company, card_no_masked, to_char(expires_at,'YYYY-MM-DD') AS expires_at,
             amount, coin_amount, is_active, auto_enabled, auto_package_id
        FROM payment_method
       WHERE member_id = ${memberId} AND is_active = TRUE
       ORDER BY registered_at DESC
    `;

    // 활성 카드의 자동충전 설정값 사용 (회원당 활성 카드 1장 UNIQUE 제약)
    const activeCard = cards[0];

    return {
      cards: cards.map((c) => ({
        id: Number(c.id),
        brand: c.card_company ?? '카드',
        numberMasked: c.card_no_masked ?? '****',
        expiresAt: c.expires_at,
        amount: Number(c.amount ?? 0),
        coinAmount: Number(c.coin_amount ?? 0),
      })),
      // 자동충전 임계값(threshold)은 엠투넷이 관리 — 사주문 DB에 보존하지 않음 (10000P 고정).
      auto: {
        enabled: activeCard?.auto_enabled ?? false,
        threshold: null as number | null,
        packageId: activeCard?.auto_package_id ?? null,
      },
    };
  }

  // ============================================================
  // 결제 준비 — payment row pending 상태로 INSERT + form params 반환
  //   sample/coin/ajax.coin_fill_update.php 동등
  // ============================================================
  async prepareCharge(memberId: number, dto: PrepareChargeDto, isMobile: boolean) {
    const member = await this.fetchMember(memberId);
    const pkg = await this.fetchPackage(dto.packageId);

    const payAmount = Math.round(pkg.amount * 1.1); // VAT 가산
    // [임시 완화] 가상계좌 10원 테스트 진행 중. 운영 진입 시 30000 으로 복구.
    // sample/coin_fill.php 라인 70: 정상 정책은 30,000원.
    if (payAmount < 10) {
      throw new BadRequestException('최소 결제 금액은 10원입니다.');
    }

    const oid = this.generateOid(memberId, dto.payMethod);

    // payment INSERT — ON CONFLICT (oid) 보호 (oid 충돌 시 무시 후 재조회)
    await this.sql.begin(async (tx) => {
      await tx`
        INSERT INTO payment (
          member_id, mb_id, membid, mb_1,
          pay_method, oid, amount, coin_amount,
          telno, status, created_at
        ) VALUES (
          ${memberId}, ${member.mb_id}, ${member.mb_1}, ${member.mb_1},
          ${dto.payMethod}, ${oid}, ${payAmount}, ${pkg.totalPoint},
          ${member.telno}, 'pending', now()
        )
        ON CONFLICT (oid) DO NOTHING
      `;

      await tx`
        INSERT INTO payment_outbox (
          oid, cpid, membid, pay_method, amount, coin_amount,
          endpoint_url, http_method, payload, is_mobile, created_at
        ) VALUES (
          ${oid}, ${this.config.get<string>('AG9_CPID') ?? ''}, ${member.mb_1},
          ${dto.payMethod}, ${payAmount}, ${pkg.totalPoint},
          '(prepare)', 'POST', ${JSON.stringify({ packageId: dto.packageId })},
          ${isMobile}, now()
        )
        ON CONFLICT (oid) DO NOTHING
      `;
    });

    // PG로 보낼 form 파라미터 빌드
    const form = this.ag9.buildPayFormParams({
      method: dto.payMethod,
      amount: payAmount,
      coinamt: pkg.totalPoint,
      oid,
      membid: member.mb_1,
      telno: member.telno,
      membnm: member.name,
      item: '상담',
      isMobile,
    });

    return { oid, ...form };
  }

  // ============================================================
  // 사주문페이 즉시 결제 — sample/coin/coin_pay_ok_auto.php 동등
  // ============================================================
  async autoPayCharge(memberId: number, packageId: number) {
    const member = await this.fetchMember(memberId);
    const pkg = await this.fetchPackage(packageId);
    const card = await this.fetchActiveCard(memberId);

    if (!this.ag9.isEnabled()) {
      throw new BadGatewayException('PG 비활성 — 운영팀에 문의해주세요.');
    }

    const payAmount = Math.round(pkg.amount * 1.1);
    const oid = this.generateOid(memberId, 'AUTO_PAY_CARD');

    // 1) payment row 사전 INSERT (멱등 키)
    await this.sql`
      INSERT INTO payment (
        member_id, mb_id, membid, mb_1,
        pay_method, oid, amount, coin_amount,
        telno, status, created_at
      ) VALUES (
        ${memberId}, ${member.mb_id}, ${member.mb_1}, ${member.mb_1},
        'GNRC_AUTO_PAY_CARD', ${oid}, ${payAmount}, ${pkg.totalPoint},
        ${member.telno}, 'pending', now()
      )
      ON CONFLICT (oid) DO NOTHING
    `;

    // 2) AG9 즉시 결제 호출
    const res = await this.ag9.autoPayRequest(member.mb_1, payAmount, pkg.totalPoint);
    if (!res.ok) {
      await this.sql`
        UPDATE payment SET status='failed', result_message=${`autopay 실패: ${res.error ?? ''}`}, updated_at=now()
         WHERE oid = ${oid}
      `;
      throw new BadGatewayException(`자동결제 실패: ${res.error ?? '알 수 없음'}`);
    }

    // 3) 콜백이 별도로 도착하지 않을 수 있어 즉시 완료 처리 (sample/coin_pay_ok_auto.php 동작)
    await this.applyCompletion({
      oid,
      tid: res.tid ?? null,
      reqResult: '0000',
      resultMsg: 'autopay completed',
      paytype: 'GNRC_AUTO_PAY_CARD',
    });

    // billkey가 적용된 카드와 무관할 수 있으나 sample 정책 — billkey 갱신 시 amount/coinamt 동기화
    void card;

    return { oid, status: 'completed' };
  }

  // ============================================================
  // 카드(BillKey) 등록 — sample/coin/coin_fill_auto_card_update.php 동등
  // ============================================================
  async registerAutoPayCard(memberId: number, dto: RegisterCardDto) {
    try {
      return await this.registerAutoPayCardImpl(memberId, dto);
    } catch (e) {
      // 모든 예외를 PM2 로그에 출력 + Nest 가 자체 처리한 HttpException 은 그대로 throw,
      // 외부 예외(DB/encryption/etc.)는 메시지를 사용자에게 노출
      this.logger.error(
        `[registerAutoPayCard] memberId=${memberId} pkg=${dto?.packageId} ` +
          `cardLen=${dto?.cardno?.replace(/\D/g, '').length} expMM=${dto?.expMonth} expYY=${dto?.expYear} ` +
          `error=${e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e)}`,
      );
      if (e instanceof BadRequestException || e instanceof BadGatewayException || e instanceof NotFoundException) {
        throw e;
      }
      throw new BadRequestException(
        `자동결제 등록 중 오류가 발생했습니다: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async registerAutoPayCardImpl(memberId: number, dto: RegisterCardDto) {
    const member = await this.fetchMember(memberId);
    const pkg = await this.fetchPackage(dto.packageId);
    if (!this.ag9.isEnabled()) {
      throw new BadGatewayException('PG 비활성 — 운영팀에 문의해주세요.');
    }
    const pushUrl = runtimeEnv().pgAutopayPushUrl;
    const payAmount = Math.round(pkg.amount * 1.1);
    const cardnoDigits = dto.cardno.replace(/\D/g, '');

    // 1) AG9 POST gnrc_autopay_regist
    const buildRegisterInput = () => ({
      oid: this.generateOid(memberId, 'REGIST'),
      cardno: cardnoDigits,
      expMonth: dto.expMonth,
      expYear: dto.expYear,
      socno: dto.socno,
      pass: dto.pass,
      membnm: member.name,
      membid: member.mb_1,
      telno: member.telno,
      item: '상담료',
      amount: payAmount,
      coinamt: pkg.totalPoint,
      pushurl: pushUrl,
    });

    let reg = await this.ag9.autoPayRegister(buildRegisterInput());

    // req_result=27 이미자동결제등록되어있음 — AG9에 stale BillKey가 남은 orphan 케이스 자동복구.
    // Why: 과거 등록이 부분 실패(우리 DB 미반영 등)하면 사용자가 재등록 시도 시 27로 막힘.
    //      sample/coin_fill_auto_card_del.php 와 동일하게 AG9 삭제 후 재등록 시도.
    if (!reg.ok && reg.error?.includes('req_result=27')) {
      this.logger.warn(
        `[registerAutoPayCard] AG9 stale BillKey 감지 (membid=${member.mb_1}) — autoPayDelete 후 재등록`,
      );
      const del = await this.ag9.autoPayDelete(member.mb_1);
      if (!del.ok) {
        throw new BadGatewayException(
          `기존 자동결제 정리 실패: ${del.error ?? '알 수 없음'} (운영팀에 문의해주세요)`,
        );
      }
      // 우리 DB에 stale row가 남아있다면 함께 비활성화 (아래 트랜잭션에서도 비활성화하지만, 명시적으로 분리)
      await this.sql`
        UPDATE payment_method SET is_active = FALSE
         WHERE member_id = ${memberId} AND is_active = TRUE
      `;
      reg = await this.ag9.autoPayRegister(buildRegisterInput());
    }

    if (!reg.ok || !reg.billkey) {
      throw new BadGatewayException(`자동결제 등록 실패: ${reg.error ?? '알 수 없음'}`);
    }
    const billkey = reg.billkey; // narrow

    // 2) DB 저장 — 기존 활성 카드 deactivate 후 신규 INSERT (회원당 1장 UNIQUE 제약)
    const expiresAt = `20${dto.expYear}-${dto.expMonth.padStart(2, '0')}-01`;
    const masked = maskCardNumber(cardnoDigits);

    await this.sql.begin(async (tx) => {
      await tx`
        UPDATE payment_method SET is_active = FALSE
         WHERE member_id = ${memberId} AND is_active = TRUE
      `;
      await tx`
        INSERT INTO payment_method (
          member_id, mb_id, membid, item, amount, coin_amount,
          card_company, card_no_masked, expires_at, billkey, is_active, registered_at
        ) VALUES (
          ${memberId}, ${member.mb_id}, ${member.mb_1}, '상담료',
          ${payAmount}, ${pkg.totalPoint},
          NULL, ${masked}, ${expiresAt}, ${billkey}, TRUE, now()
        )
        ON CONFLICT (billkey) DO UPDATE
          SET member_id = EXCLUDED.member_id,
              card_no_masked = EXCLUDED.card_no_masked,
              expires_at = EXCLUDED.expires_at,
              amount = EXCLUDED.amount,
              coin_amount = EXCLUDED.coin_amount,
              is_active = TRUE,
              registered_at = now()
      `;
    });

    // 3) 엠투넷에 자동결제 정보 PUT (sample/coin_fill_auto_card_member_update.php 라인 28)
    await this.m2net.updateAutoPayConfig(member.mb_1, {
      membnm: member.name,
      telno: member.telno,
      autopaypin: billkey,
      autopayflag: 'Y',
      autopayamt: payAmount,
      autopaycoinamt: pkg.totalPoint,
      autopaypushurl: pushUrl,
    });

    return { billkey, masked };
  }

  // ============================================================
  // 카드 삭제 — sample/coin/coin_fill_auto_card_del.php 동등
  // ============================================================
  async deleteAutoPayCard(memberId: number) {
    const member = await this.fetchMember(memberId);
    const card = await this.fetchActiveCard(memberId);

    // 1) AG9 삭제 호출 (PG 등록 자체가 없으면 27 같은 에러 — DB 만 정리하면 됨)
    if (this.ag9.isEnabled()) {
      const res = await this.ag9.autoPayDelete(member.mb_1);
      if (!res.ok) {
        this.logger.warn(
          `[deleteAutoPayCard] AG9 응답 무시 후 DB 정리만 수행 — member_id=${memberId} ${res.error ?? ''}`,
        );
      }
    }

    // 2) DB 비활성화 (AG9 결과와 무관하게 우리쪽 카드 삭제 처리)
    await this.sql`UPDATE payment_method SET is_active = FALSE WHERE id = ${card.id}`;

    // 3) 엠투넷에 autopayflag=N PUT (실패해도 무시 — best-effort)
    try {
      await this.m2net.updateAutoPayConfig(member.mb_1, {
        membnm: member.name,
        telno: member.telno,
        autopaypin: card.billkey,
        autopayflag: 'N',
      });
    } catch (e) {
      this.logger.warn(
        `[deleteAutoPayCard] m2net updateAutoPayConfig 무시 — member_id=${memberId} ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return { ok: true };
  }

  // ============================================================
  // 자동충전 설정 — sample/coin/coin_fill_auto_card_member_update.php 동등
  // ============================================================
  async setAutoConfig(memberId: number, dto: SetAutoConfigDto) {
    const member = await this.fetchMember(memberId);
    const card = await this.fetchActiveCard(memberId);

    if (dto.enabled) {
      if (!dto.packageId) {
        throw new BadRequestException('자동충전 활성화 시 packageId 필수입니다.');
      }
      const pkg = await this.fetchPackage(dto.packageId);
      const payAmount = Math.round(pkg.amount * 1.1);
      const pushUrl = runtimeEnv().pgAutopayPushUrl;

      // 1) 엠투넷에 PUT (autopayflag=Y)
      const r = await this.m2net.updateAutoPayConfig(member.mb_1, {
        membnm: member.name,
        telno: member.telno,
        autopaypin: card.billkey,
        autopayflag: 'Y',
        autopayamt: payAmount,
        autopaycoinamt: pkg.totalPoint,
        autopaypushurl: pushUrl,
      });
      if (!r.ok) {
        throw new BadGatewayException(`엠투넷 자동결제 설정 실패: ${r.error ?? '알 수 없음'}`);
      }

      // 2) 사주문 DB 에도 영속 — 페이지 새로고침 시 토글 상태 복원용
      await this.sql`
        UPDATE payment_method
           SET amount = ${payAmount}, coin_amount = ${pkg.totalPoint},
               auto_enabled = TRUE, auto_package_id = ${dto.packageId}
         WHERE id = ${card.id}
      `;
    } else {
      // 1) 엠투넷에 PUT (autopayflag=N)
      const r = await this.m2net.updateAutoPayConfig(member.mb_1, {
        membnm: member.name,
        telno: member.telno,
        autopaypin: card.billkey,
        autopayflag: 'N',
      });
      if (!r.ok) {
        throw new BadGatewayException(`엠투넷 자동결제 해제 실패: ${r.error ?? '알 수 없음'}`);
      }

      // 2) 사주문 DB 도 OFF
      await this.sql`
        UPDATE payment_method
           SET auto_enabled = FALSE
         WHERE id = ${card.id}
      `;
    }

    return { ok: true };
  }

  // ============================================================
  // 결제 상태 조회 (frontend 폴링)
  // ============================================================
  async getStatus(memberId: number, oid: string) {
    const rows = await this.sql<
      {
        status: string;
        amount: number;
        coin_amount: number;
        result_message: string | null;
        m2net_status: string | null;
        bank_code: string | null;
        bank_name: string | null;
        vr_account: string | null;
      }[]
    >`
      SELECT status, amount, coin_amount, result_message, m2net_status,
             bank_code, bank_name, vr_account
        FROM payment
       WHERE oid = ${oid} AND member_id = ${memberId}
       LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('해당 결제건이 없습니다.');
    }
    const r = rows[0];
    return {
      status: r.status,
      amount: Number(r.amount),
      coinAmount: Number(r.coin_amount),
      resultMessage: r.result_message,
      m2netStatus: r.m2net_status,
      vbank:
        r.bank_code || r.vr_account
          ? { bankCode: r.bank_code, bankName: r.bank_name, account: r.vr_account }
          : null,
    };
  }

  // ============================================================
  // 결제 내역 목록 (마이페이지 결제내역)
  //   - VBANK 발급 후 입금 전: status='pending' + vr_account 채워진 상태 → '입금대기'
  //   - VBANK 입금 완료      : status='completed' + deposit_time 채워짐 → '결제완료(가상계좌)'
  //   - 카드/간편결제 완료    : status='completed' → '결제완료'
  // ============================================================
  async getPayments(memberId: number) {
    type Row = {
      id: number;
      oid: string;
      pay_method: string | null;
      status: string;
      amount: number;
      coin_amount: number;
      bank_code: string | null;
      bank_name: string | null;
      vr_account: string | null;
      deposit_time: string | null;
      result_message: string | null;
      created_at: Date;
      cancelled_at: Date | null;
    };
    const rows = await this.sql<Row[]>`
      SELECT id, oid, pay_method, status, amount, coin_amount,
             bank_code, bank_name, vr_account, deposit_time,
             result_message, created_at, cancelled_at
        FROM payment
       WHERE member_id = ${memberId}
       ORDER BY created_at DESC
       LIMIT 100
    `;

    return rows.map((r) => {
      const pm = String(r.pay_method ?? '');
      const isVbank = /VRBANK|VBANK/i.test(pm);
      const isAuto = /AUTO_PAY/i.test(pm);
      const isCard = /CARD|PACA|DIR_CARD/i.test(pm) && !isAuto;
      const isKakao = /KAKAO|PAKM/i.test(pm);
      const isNaver = /NAVER|PANP/i.test(pm);
      const isPayco = /PAYCO|PACP/i.test(pm);
      const isApple = /APPLE/i.test(pm);
      const isToss = /TOSS/i.test(pm);

      const methodLabel = isAuto
        ? '자동충전'
        : isVbank
        ? '가상계좌'
        : isKakao
        ? '카카오페이'
        : isNaver
        ? '네이버페이'
        : isPayco
        ? '페이코'
        : isApple
        ? '애플페이'
        : isToss
        ? '토스페이'
        : isCard
        ? '카드결제'
        : pm || '결제';

      // 사용자 노출 status — sample 의 od_status 매핑과 의미상 동등하게 단순화
      let displayStatus: 'completed' | 'awaiting_deposit' | 'pending' | 'cancelled' | 'failed';
      if (r.status === 'cancelled') displayStatus = 'cancelled';
      else if (r.status === 'failed') displayStatus = 'failed';
      else if (r.status === 'completed') displayStatus = 'completed';
      else if (isVbank && r.vr_account) displayStatus = 'awaiting_deposit';
      else displayStatus = 'pending';

      return {
        id: r.id,
        oid: r.oid,
        method: methodLabel,
        amount: Number(r.amount),
        coinAmount: Number(r.coin_amount),
        status: displayStatus,
        statusLabel:
          displayStatus === 'completed'
            ? '결제완료'
            : displayStatus === 'awaiting_deposit'
            ? '입금대기'
            : displayStatus === 'cancelled'
            ? '취소완료'
            : displayStatus === 'failed'
            ? '결제실패'
            : '진행중',
        vbank:
          isVbank && (r.vr_account || r.bank_code)
            ? {
                bankCode: r.bank_code,
                bankName: r.bank_name,
                account: r.vr_account,
                depositTime: r.deposit_time,
              }
            : null,
        paidAt: r.created_at.toISOString(),
        cancelledAt: r.cancelled_at ? r.cancelled_at.toISOString() : null,
      };
    });
  }

  // ============================================================
  // PG 콜백 (returnurl) — sample/coin/coin_pay_ok_v2.php 동등
  //   카드/간편결제 결과 push.
  //   ★ 멱등: payment.oid + status='completed' 분기 + ON CONFLICT
  // ============================================================
  async handlePaymentCallback(payload: PgCallbackPayload) {
    const oid = String(payload.oid ?? '').trim();
    if (!oid) throw new BadRequestException('oid 누락');

    // 가상계좌(VRBANK)는 returnurl/formurl 경로 모두 handleVbankCallback 으로 위임.
    // Why: VBANK는 발급(deposit_tm 빈값) → 입금완료(deposit_tm 채워짐) 2단계인데
    //      applyCompletion 은 reqResult='0000' 만 보고 즉시 충전 처리해버려
    //      "발급만 되고 입금 전" 시점에 포인트가 잘못 적립되는 버그가 있었다.
    //      paytype 이 비어 오는 경우(formurl POST가 paytype 누락)에 대비해
    //      DB payment.pay_method 도 같이 검사한다.
    const paytype = String(payload.paytype ?? '');
    let isVbank = /VRBANK|VBANK/i.test(paytype);
    if (!isVbank) {
      const rows = await this.sql<{ pay_method: string | null }[]>`
        SELECT pay_method FROM payment WHERE oid = ${oid} LIMIT 1
      `;
      const pm = String(rows[0]?.pay_method ?? '');
      if (/VRBANK|VBANK/i.test(pm)) isVbank = true;
    }
    if (isVbank) {
      return this.handleVbankCallback(payload);
    }

    await this.applyCompletion({
      oid,
      tid: payload.tid ? String(payload.tid) : null,
      reqResult: String(payload.req_result ?? ''),
      resultMsg: String(payload.resultmsg ?? ''),
      paytype,
    });

    return { ok: true };
  }

  // ============================================================
  // 가상계좌 webhook (returnurl) — sample/coin/coin_pay_bank_ok_v2.php 1:1 매핑.
  //
  // PG가 returnurl로 push하는 케이스:
  //   1) 가상계좌 발급 시점        — paytype=VRBANK_PAY, deposit_tm 빈값, vrno/bankcd 채워짐
  //   2) 가상계좌 입금 완료/부분    — deposit_tm/deposit_nm 채워짐
  //   3) 결제 취소(msg=CANCEL_PAY) — 결제 취소 콜백
  // ============================================================
  async handleVbankCallback(payload: PgCallbackPayload) {
    const oid = String(payload.oid ?? '').trim();
    const tid = String(payload.tid ?? '').trim();
    if (!oid) throw new BadRequestException('oid 누락');
    const reqResult = String(payload.req_result ?? '').trim();
    if (reqResult !== '0000') return { ok: true, ignored: true }; // sample 라인 38

    const msg = String((payload as { msg?: string }).msg ?? '').trim();
    const paytype = String(payload.paytype ?? '');
    // payload key fallback:
    //   - returnurl (sample/coin_pay_ok_v2.php) 는 'bank' 키 사용
    //   - vbank-callback (coin_pay_bank_ok_v2.php) 는 'bankcd' 키 사용
    //   둘 다 같은 핸들러로 들어오므로 양쪽 fallback.
    const p = payload as Record<string, unknown>;
    const bankcd = String(p.bankcd ?? p.bank ?? '');
    const banknm = String(p.banknm ?? '');
    const vrno = String(p.vrno ?? '');
    const depositNm = String(p.deposit_nm ?? '');
    const depositTm = String(p.deposit_tm ?? '');
    const amount = Number(payload.amount) || 0;
    const rawJson = JSON.stringify(payload);
    // VBANK 여부는 paytype + vrno 둘 중 하나라도 있으면 true (PG가 paytype 누락하는 케이스 대비)
    const isVrbank = /VRBANK/i.test(paytype) || !!vrno;

    // 1) 결제 취소 분기 (sample 라인 44-48) — 충전 처리 없음
    if (msg === 'CANCEL_PAY') {
      await this.sql`
        UPDATE payment
           SET result_message = '결제취소', status = 'cancelled',
               cancelled_at = now(), m2net_status = ${rawJson},
               updated_at = now()
         WHERE oid = ${oid}
      `;
      return { ok: true, cancelled: true };
    }

    // 2) 기존 결제건 조회 — oid 만으로 매칭 (prepareCharge 시 tid=NULL 이므로 tid 매칭은 부적절).
    //    oid 는 prepareCharge 가 INSERT 시 UNIQUE 키로 사용됨.
    const rows = await this.sql<{ id: number; member_id: number; mb_1: string | null; mb_id: string | null; mb_hp: string | null; mb_name: string | null; status: string; amount: number; coin_amount: number; m2net_status: string | null }[]>`
      SELECT p.id, p.member_id, p.mb_1, p.mb_id, p.status, p.amount, p.coin_amount, p.m2net_status,
             m.phone AS mb_hp, m.name AS mb_name
        FROM payment p LEFT JOIN member m ON m.id = p.member_id
       WHERE p.oid = ${oid}
       LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      // PG가 보낸 oid가 우리 DB에 없으면 무시 (위변조 방지 / prepare 누락 케이스)
      this.logger.warn(`vbank-callback: payment row 없음 oid=${oid} tid=${tid}`);
      return { ok: true, unknown: true };
    }

    // 3) 중복 충전 방지 (sample 라인 54-63)
    //    - 가상계좌: m2net_status='코인충전성공'이면 이미 완료
    //    - 일반결제: status='completed'이면 이미 완료
    if (isVrbank && row.m2net_status === '코인충전성공') {
      return { ok: true, idempotent: true };
    }
    if (!isVrbank && row.status === 'completed') {
      return { ok: true, idempotent: true };
    }

    // 4) 발급/입금 단계 구분 — depositTm 비어있으면 발급 단계
    const isIssuanceOnly = isVrbank && !depositTm;
    const resultMsg = isIssuanceOnly
      ? '가상계좌 발급완료'
      : amount === row.amount
        ? '입금완료'
        : amount < row.amount
          ? '부분입금'
          : '입금완료';

    // 5) payment UPDATE — 발급 정보 + 입금 정보 모두 저장 (id 기준 — 가장 안정적인 매칭)
    await this.sql`
      UPDATE payment
         SET bank_code = ${bankcd || null},
             bank_name = ${banknm || null},
             vr_account = ${vrno || null},
             deposit_name = ${depositNm || null},
             deposit_time = ${depositTm || null},
             tid = ${tid || null},
             coin_amount = ${row.coin_amount},
             result_message = ${resultMsg},
             updated_at = now()
       WHERE id = ${row.id}
    `;

    // 6) 가상계좌 발급 시점(deposit_tm 빈값)이면 충전 처리 스킵 (sample 라인 96-97).
    //    발급 직후 사용자에게 입금계좌 안내 알림톡(order_bankinfo2) 발송 — sample
    //    coin_pay_ok_v2.php 라인 451-466 의 at_type='입금계좌 안내' 분기 동등.
    if (isVrbank && !depositTm) {
      if (row.mb_hp) {
        const accountInfo = `${banknm} ${vrno}`.trim();
        void this.sms
          .sendAlimtalkByCode(
            'order_bankinfo2',
            row.mb_hp,
            {
              이름: row.mb_name ?? '',
              상품명: '코인결제',
              입금액: amount.toLocaleString(),
              입금계좌: accountInfo,
            },
            '사주문 입금계좌 안내',
          )
          .then((r) => {
            if (!r.ok) this.logger.warn(`입금계좌 안내 알림톡 거부 reason=${r.reason} raw=${r.raw ?? ''}`);
          })
          .catch((e) =>
            this.logger.warn(`입금계좌 안내 알림톡 발송 예외: ${(e as Error).message}`),
          );
      }
      return { ok: true, issued: true };
    }

    // 7) 원자적 lock으로 동시 콜백 차단 (sample 라인 102-105) — id 기준
    const lockRes = await this.sql<{ id: number }[]>`
      UPDATE payment SET m2net_status = '충전처리중', updated_at = now()
       WHERE id = ${row.id}
         AND (m2net_status IS NULL
           OR m2net_status NOT IN ('코인충전성공','코인충전실패','충전처리중'))
       RETURNING id
    `;
    if (lockRes.length === 0) return { ok: true, idempotent: true };

    // 8) 충전 처리 — status=completed + point 적립 (sample 라인 110)
    await this.sql.begin(async (tx) => {
      await tx`
        UPDATE payment
           SET status = 'completed', req_result = '0000',
               updated_at = now()
         WHERE id = ${row.id} AND status <> 'completed'
      `;
      if (row.member_id) {
        await this.creditPointInTx(
          tx,
          row.member_id,
          Number(row.coin_amount),
          `코인충전 :${oid}`,
          'payment',
          String(row.id),
        );
      }
    });

    // 9) 엠투넷 동기화 (sample 라인 113-123)
    if (row.mb_1) {
      const sync = await this.m2net.addMemberCoin(row.mb_1, Number(row.coin_amount));
      await this.sql`
        UPDATE payment SET m2net_status = ${sync.ok ? '코인충전성공' : '코인충전실패'}, updated_at = now()
         WHERE id = ${row.id}
      `;
    } else {
      await this.sql`
        UPDATE payment SET m2net_status = '코인충전실패', updated_at = now() WHERE id = ${row.id}
      `;
    }

    // 10) 입금완료 시점 알림톡은 발송 안 함 — BizM 콘솔에 입금완료용 별도 템플릿이
    //     아직 등록되지 않았고, 가상계좌 발급 시 보낸 order_bankinfo2 안내로 갈음.
    //     운영 정책 상 "두 번째 알림톡은 보내지 않는다" 결정에 따른 의도적 비발송.

    return { ok: true, depositMsg: resultMsg };
  }

  // ============================================================
  // 자동충전 push — sample/mtonet/auto_pay_result.php 동등
  //   엠투넷이 자동결제 처리 후 결과를 push.
  // ============================================================
  async handleAutopayPush(payload: PgCallbackPayload) {
    const oid = String(payload.oid ?? '').trim();
    const reqResult = String(payload.req_result ?? '');
    if (!oid || reqResult !== '0000') {
      // 실패 push는 무시 (sample 동등)
      return { ok: true, ignored: true };
    }

    // 1) 동일 oid 가 이미 있으면 멱등 종료
    const exists = await this.sql<{ id: number }[]>`SELECT id FROM payment WHERE oid = ${oid} LIMIT 1`;
    if (exists.length > 0) {
      return { ok: true, idempotent: true };
    }

    const membid = String(payload.membid ?? '').trim();
    if (!membid) throw new BadRequestException('membid 누락');

    // member 조회 — m2net membid는 신규 schema에서 csrid 컬럼에 저장됨 (auth.service.ts:499)
    const memberRows = await this.sql<{ id: number; mb_id: string | null; mb_hp: string | null; mb_name: string | null }[]>`
      SELECT id, mb_id, phone AS mb_hp, name AS mb_name FROM member WHERE csrid = ${membid} LIMIT 1
    `;
    if (memberRows.length === 0) throw new NotFoundException('회원 없음');
    const member = memberRows[0];

    const amount = Number(payload.amount) || 0;
    const coinamt = Number(payload.coinamt) || 0;

    // 2) 중복 적립 방지 — `autoPayCharge` 가 이미 자체 oid(`AUTO_PAY_CARD_*`) 로 row INSERT
    //    한 케이스. m2net push 는 사후 통지일 뿐.
    //
    //    Race: autoPayCharge 가 INSERT(status='pending') → m2net.autoPayRequest() 응답 대기 중에
    //    m2net push 가 먼저 도착하는 케이스가 있다. 이때 status='completed' 만 보면 pending row
    //    를 못 잡아 신규 INSERT/적립 → 중복 발생. 따라서 status 와 무관하게 최근 자동결제 row
    //    가 있으면 dedup.
    const matched = await this.sql<{ id: number; m2net_status: string | null; status: string }[]>`
      SELECT id, m2net_status, status FROM payment
       WHERE member_id = ${member.id}
         AND amount = ${amount}
         AND coin_amount = ${coinamt}
         AND pay_method LIKE '%AUTO_PAY%'
         AND created_at > now() - interval '10 minutes'
       ORDER BY id DESC
       LIMIT 1
    `;
    if (matched.length > 0) {
      const matchedRow = matched[0];
      // m2net 측 oid/tid 만 메타로 추가 기록. 적립은 절대 다시 안 함.
      // 매칭 row 가 pending 이면 status 도 completed 로 끌어올려 — autoPayCharge 의 ag9 응답이
      // 늦게 도착해도 이미 m2net 가 결제 처리한 사실을 반영. applyCompletion 은 이미 completed 면
      // 'idempotent' 로 빠져나가므로 중복 적립 안 됨.
      await this.sql`
        UPDATE payment
           SET m2net_status = COALESCE(NULLIF(m2net_status, ''), '') || ${`|m2net_push:oid=${oid}`},
               result_message = COALESCE(NULLIF(result_message, ''), '') || ${`|push:${String(payload.resultmsg ?? '')}`},
               status = CASE WHEN status = 'pending' THEN 'completed' ELSE status END,
               updated_at = now()
         WHERE id = ${matchedRow.id}
      `;
      // pending → completed 로 승격된 경우, applyCompletion 이 적립 안 했으니 여기서 적립.
      if (matchedRow.status === 'pending') {
        await this.sql.begin(async (tx) => {
          await this.creditPointInTx(
            tx,
            member.id,
            coinamt,
            `등록카드 코인충전 :${oid}`,
            'payment_autopay',
            String(matchedRow.id),
            String(payload.reason ?? ''),
          );
        });
        this.logger.log(
          `[handleAutopayPush] pending row 승격 — member=${member.id} payment.id=${matchedRow.id} 적립 1회`,
        );
      } else {
        this.logger.log(
          `[handleAutopayPush] 중복 푸시 감지 — member=${member.id} amount=${amount} 기존 payment.id=${matchedRow.id} 매칭, 적립 스킵`,
        );
      }
      return { ok: true, dedup: true };
    }

    // 3) 매칭되는 기존 row 없음 — m2net 가 단독으로 자동결제 처리한 케이스. 신규 INSERT + 적립.
    await this.sql.begin(async (tx) => {
      const inserted = await tx<{ id: number }[]>`
        INSERT INTO payment (
          member_id, mb_id, membid, mb_1,
          pay_method, oid, tid, amount, coin_amount,
          req_result, result_message, telno,
          bank_code, bank_name, vr_account, deposit_name, deposit_time,
          status, m2net_status, created_at
        ) VALUES (
          ${member.id}, ${member.mb_id}, ${membid}, ${membid},
          ${String(payload.paytype ?? 'GNRC_AUTO_PAY_CARD')}, ${oid},
          ${String(payload.tid ?? '')}, ${amount}, ${coinamt},
          ${reqResult}, ${String(payload.resultmsg ?? '')}, ${String(payload.telno ?? '')},
          ${String(payload.bankcd ?? '')}, ${String(payload.banknm ?? '')},
          ${String(payload.vrno ?? '')}, ${String(payload.deposit_nm ?? '')}, ${String(payload.deposit_tm ?? '')},
          'completed', '등록카드 자동코인충전성공', now()
        )
        ON CONFLICT (oid) DO NOTHING
        RETURNING id
      `;
      if (inserted.length === 0) return; // 이미 존재 → 멱등 종료

      await this.creditPointInTx(
        tx,
        member.id,
        coinamt,
        `등록카드 코인충전 :${oid}`,
        'payment_autopay',
        String(inserted[0].id),
        String(payload.reason ?? ''),
      );
    });

    return { ok: true };
  }

  // ============================================================
  // 내부 헬퍼
  // ============================================================

  /**
   * payment 완료 처리 (멱등 보장).
   *  - SELECT FOR UPDATE → status='completed'면 idempotent return
   *  - status 갱신 + point 적립 + 엠투넷 동기화
   *  - PG가 사용자 취소 (req_result != 0000) 시 resultMsg에 '취소' 포함 → status='cancelled' 분기
   */
  private async applyCompletion(args: {
    oid: string;
    tid: string | null;
    reqResult: string;
    resultMsg: string;
    paytype: string;
  }) {
    const { oid, tid, reqResult, resultMsg, paytype } = args;
    const ok = reqResult === '0000';
    // 사용자가 PG 결제창에서 취소 누른 경우는 PG가 보통 resultMsg에 '취소' 또는 '사용자' 같은 키워드 포함
    const isUserCancel =
      !ok &&
      (typeof resultMsg === 'string' &&
        (/취소|사용자|cancel|user/i.test(resultMsg) || resultMsg.includes('cancel')));
    const failStatus = isUserCancel ? 'cancelled' : 'failed';

    type PaymentRow = {
      id: number;
      member_id: number | null;
      mb_1: string | null;
      coin_amount: number;
      status: string;
    };
    const result = await this.sql.begin<{ done: boolean; pmt?: PaymentRow }>(async (tx) => {
      const rows = await tx<PaymentRow[]>`
        SELECT id, member_id, mb_1, coin_amount, status
          FROM payment
         WHERE oid = ${oid}
         FOR UPDATE
      `;
      if (rows.length === 0) {
        // sample 정책: 결제 row가 없을 때 INSERT 보강은 일반적으로 prepare가 선행되므로 발생 안 함.
        // 발생하면 로그만 남기고 무시 (콜백 위변조 또는 prepare 누락).
        this.logger.warn(`payment row 없음 — oid=${oid}`);
        return { done: true };
      }
      const pmt = rows[0];
      if (pmt.status === 'completed') {
        return { done: true }; // idempotent
      }
      if (!ok) {
        if (failStatus === 'cancelled') {
          await tx`
            UPDATE payment
               SET status = 'cancelled', tid = ${tid}, req_result = ${reqResult},
                   result_message = ${resultMsg}, cancelled_at = now(), updated_at = now()
             WHERE id = ${pmt.id}
          `;
        } else {
          await tx`
            UPDATE payment
               SET status = 'failed', tid = ${tid}, req_result = ${reqResult},
                   result_message = ${resultMsg}, updated_at = now()
             WHERE id = ${pmt.id}
          `;
        }
        return { done: true };
      }
      await tx`
        UPDATE payment
           SET status = 'completed', tid = ${tid}, req_result = '0000',
               pay_method = ${paytype || pmt.id ? paytype : ''},
               result_message = ${resultMsg}, updated_at = now()
         WHERE id = ${pmt.id} AND status <> 'completed'
      `;
      if (pmt.member_id) {
        await this.creditPointInTx(
          tx,
          pmt.member_id,
          Number(pmt.coin_amount),
          `포인트 충전 (${oid})`,
          'payment',
          String(pmt.id),
        );
      }
      return { done: false, pmt };
    });

    if (result.done || !result.pmt) return;

    // 트랜잭션 커밋 후 엠투넷 동기화 (sample/coin_pay_ok_v2.php 라인 137-143)
    if (result.pmt.mb_1) {
      const sync = await this.m2net.addMemberCoin(result.pmt.mb_1, Number(result.pmt.coin_amount));
      await this.sql`
        UPDATE payment SET m2net_status = ${sync.ok ? '코인충전성공' : '코인충전실패'}, updated_at = now()
         WHERE id = ${result.pmt.id}
      `;
    }

    // 카드/간편결제 완료 알림톡은 발송하지 않음 — 운영 정책상 가상계좌 발급(order_bankinfo2) 외 알림톡 미발송.
  }

  /**
   * 트랜잭션 내 포인트 적립 (유료 충전).
   *  - point row 잠금 + free/paid balance UPDATE
   *  - point_history INSERT (rel_table, rel_id, rel_action UNIQUE — 이중 적립 차단)
   *  - member.point 동기화
   */
  // postgres.js의 TransactionSql 타입은 Sql과 다른 별도 타입 — generic으로 받음
  private async creditPointInTx(
    tx: any,
    memberId: number,
    coin: number,
    content: string,
    relTable: 'payment' | 'payment_autopay',
    relId: string,
    relAction = 'coin_credit',
  ) {
    if (coin <= 0) return;

    // point row 보장
    let ptRows = await tx<{ paid_balance: number; free_balance: number }[]>`
      SELECT paid_balance, free_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
    `;
    if (ptRows.length === 0) {
      await tx`
        INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
        VALUES (${memberId}, 0, 0, 0, 0)
        ON CONFLICT (member_id) DO NOTHING
      `;
      ptRows = await tx<{ paid_balance: number; free_balance: number }[]>`
        SELECT paid_balance, free_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
      `;
    }
    const newPaid = Number(ptRows[0].paid_balance) + coin;
    const newBalance = newPaid + Number(ptRows[0].free_balance);

    // point_history INSERT — 부분 UNIQUE 인덱스(WHERE rel_table IN ...) 충돌 시 무시 (이중 적립 차단).
    // PostgreSQL 부분 인덱스는 ON CONFLICT의 inference 절에 동일한 WHERE를 명시해야 매칭됨.
    const inserted = await tx<{ id: number }[]>`
      INSERT INTO point_history (
        member_id, content, earn_point, use_point, balance_after,
        is_paid, rel_action, rel_table, rel_id, actor_type
      ) VALUES (
        ${memberId}, ${content}, ${coin}, 0, ${newBalance},
        TRUE, ${relAction}, ${relTable}, ${relId}, 'payment'
      )
      ON CONFLICT (rel_table, rel_id, rel_action)
        WHERE rel_table IN ('payment', 'payment_autopay')
        DO NOTHING
      RETURNING id
    `;
    if (inserted.length === 0) {
      // 이미 적립됨 — point/member 잔액은 건드리지 않음
      this.logger.log(`멱등: 이미 적립된 결제건 (${relTable}/${relId}/${relAction})`);
      return;
    }

    await tx`
      UPDATE point
         SET paid_balance = paid_balance + ${coin},
             total_earned = total_earned + ${coin},
             updated_at = now()
       WHERE member_id = ${memberId}
    `;
    await tx`UPDATE member SET point = ${newBalance} WHERE id = ${memberId}`;
  }

  private generateOid(memberId: number, prefix: string): string {
    const ts = Date.now();
    const rand = crypto.randomBytes(3).toString('hex');
    const safe = prefix.replace(/[^A-Z0-9_]/gi, '').slice(0, 16) || 'pay';
    return `${safe}_${memberId}_${ts}_${rand}`.toLowerCase();
  }

  private async fetchMember(memberId: number) {
    // 신규 schema 매핑 (마이그레이션 0008로 sample/g5_member에서 rename됨):
    //   mb_1   → csrid  (일반회원도 m2net 등록 후 받은 membid를 csrid에 저장 — auth.service.ts:499)
    //   mb_name → name
    //   mb_hp   → phone
    //   mb_email → email
    const rows = await this.sql<
      { id: number; mb_id: string | null; csrid: string | null; name: string | null; phone: string | null; email: string | null }[]
    >`
      SELECT id, mb_id, csrid, name, phone, email
        FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('회원 정보를 찾을 수 없습니다.');
    const m = rows[0];
    if (!m.csrid) {
      throw new BadRequestException('엠투넷 회원 ID가 없습니다. 관리자에게 문의해주세요.');
    }
    return {
      id: m.id,
      mb_id: m.mb_id ?? '',
      mb_1: m.csrid,        // m2net membid (호출용 인터페이스는 mb_1 명칭 유지)
      name: m.name ?? '',
      telno: (m.phone ?? '').replace(/-/g, ''),
      email: m.email ?? '',
    };
  }

  private async fetchPackage(packageId: number) {
    const rows = await this.sql<
      { id: number; product_name: string | null; amount: number; bonus_percent: number; total_point: number; coin_amount: number }[]
    >`
      SELECT id, product_name, amount, bonus_percent, total_point, coin_amount
        FROM account_setting WHERE id = ${packageId} AND is_active = TRUE LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('충전 상품을 찾을 수 없습니다.');
    const r = rows[0];
    return {
      id: r.id,
      name: r.product_name ?? '',
      amount: Number(r.amount),
      bonusPercent: Number(r.bonus_percent),
      // total_point 가 0이면 coin_amount 폴백
      totalPoint: Number(r.total_point) || Number(r.coin_amount) || 0,
    };
  }

  private async fetchActiveCard(memberId: number) {
    const rows = await this.sql<{ id: number; billkey: string }[]>`
      SELECT id, billkey FROM payment_method
       WHERE member_id = ${memberId} AND is_active = TRUE LIMIT 1
    `;
    if (rows.length === 0) {
      throw new BadRequestException('등록된 사주문페이 카드가 없습니다.');
    }
    return rows[0];
  }
}

// 외부 모듈에서 GeneralPayMethod 재export 편의
export type { GeneralPayMethod };
