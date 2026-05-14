import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encryptCardField } from './card-crypto';
import { runtimeEnv } from '../env/runtime-env';
import {
  AutoPayRegisterInput,
  AutoPayRegisterResult,
  AutoPayRequestResult,
  BuildPayFormInput,
  BuildPayFormOutput,
  CancelPayResult,
} from './ag9.types';

/**
 * AG9 (passcall.co.kr:32837) PG 클라이언트.
 *
 * sample 함수 매핑:
 *   - send_mjson_auto_pay("cptl/autopay/gnrc_autopay_regist", PATCH)  → autoPayRegister
 *   - send_mjson_auto_pay("cptl/autopay/gnrc_autopay_request", POST)  → autoPayRequest
 *   - send_mjson_auto_pay("cptl/autopay/gnrc_autopay_delete",  POST)  → autoPayDelete
 *   - send_mjson_cancle  ("cptl/cancelpay/gnrc_cancel_pay",     POST) → cancelPay
 *   - send_mjson_cancle  ("cptl/cancelpay/gnrc_cancel_pay_part",POST) → cancelPayPartial
 *   - coin_fill.php JS on_pay url 분기                                → buildPayFormParams
 *
 * 응답 코드:
 *   - 일반결제 콜백 req_result === '0000' = 성공 (PDF 4장)
 *   - 자동결제/취소 req_result === '00'   = 성공 (PDF 7,8장)
 */
@Injectable()
export class Ag9Service {
  private readonly logger = new Logger(Ag9Service.name);
  private readonly enabled: boolean;
  private readonly host: string;
  private readonly authToken: string;
  private readonly cpid: string;
  private readonly cardCryptKey: string;
  private readonly returnUrl: string;
  private readonly formUrl: string;

  constructor(private readonly config: ConfigService) {
    this.host = (config.get<string>('AG9_HOST') ?? 'https://passcall.co.kr:32837').replace(/\/$/, '');
    this.authToken = config.get<string>('AG9_AUTH_TOKEN') ?? '';
    this.cpid = config.get<string>('AG9_CPID') ?? '';
    this.cardCryptKey = config.get<string>('CARD_CRYPT_KEY') ?? '';
    const env = runtimeEnv();
    this.returnUrl = env.pgReturnUrl;
    this.formUrl = env.pgFormUrl;
    this.enabled = Boolean(this.host && this.authToken && this.cpid);
    this.logger.log(
      `[Ag9Service] enabled=${this.enabled} host=${this.host} cpid=${this.cpid}`,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ============================================================
  // 일반결제 (form submit) — sample/coin/coin_fill.php JS on_pay
  // ============================================================
  buildPayFormParams(input: BuildPayFormInput): BuildPayFormOutput {
    let url: string;
    if (input.method === 'VBANK') {
      url = `${this.host}/cptl/gnrc-vrbank/pay`;
    } else {
      // 카드/간편결제: PC vs 모바일 엔드포인트 분기
      url = input.isMobile
        ? `${this.host}/cptl/gnrc-mob/pay`
        : `${this.host}/cptl/gnrc-pc/pay`;

      // 간편결제는 spaytype 쿼리 추가 (PDF 5장)
      const spaytype = (
        {
          PAYCO: 'payco_direct',
          KAKAO: 'kakaopay_direct',
          NAVER: 'naverpay_direct',
          APPLE: 'applepay_direct',
          TOSS: 'tosspay_direct',
          SSPAY: 'sspay_direct',
        } as const
      )[input.method as 'PAYCO' | 'KAKAO' | 'NAVER' | 'APPLE' | 'TOSS' | 'SSPAY'];
      if (spaytype) url = `${url}?spaytype=${spaytype}`;
    }

    return {
      url,
      params: {
        cpid: this.cpid,
        membid: input.membid,
        oid: input.oid,
        amount: String(input.amount),
        coinamt: String(input.coinamt),
        item: input.item,
        membnm: input.membnm,
        telno: input.telno,
        paymethod: input.method,
        // PDF 3장: returnurl(API push) + formurl(완료 화면)
        returnurl: this.returnUrl,
        formurl: this.formUrl,
      },
    };
  }

  // ============================================================
  // 자동결제 등록 — PATCH gnrc_autopay_regist (PDF 7장)
  // ============================================================
  async autoPayRegister(input: AutoPayRegisterInput): Promise<AutoPayRegisterResult> {
    if (!this.enabled) return { ok: false, error: 'AG9 비활성 (env 미설정)' };
    if (!this.cardCryptKey) return { ok: false, error: 'CARD_CRYPT_KEY 미설정' };

    // 진단 로깅 — 운영 로그에서 실제 어떤 입력으로 호출되는지 + PG 응답 그대로 확인
    this.logger.log(
      `[autoPayRegister.input] oid=${input.oid} cardLen=${input.cardno?.length} expMM=${input.expMonth} expYY=${input.expYear} ` +
      `socnoLen=${input.socno?.length} passLen=${input.pass?.length} membid=${input.membid} telno=${input.telno} ` +
      `amount=${input.amount} coinamt=${input.coinamt} cryptKeyLen=${this.cardCryptKey.length}`,
    );

    // 1) 카드 정보 AES-128-CBC 암호화 (sample/coin_fill_auto_card_update.php 라인 60-82)
    const enc = (v: string) => encryptCardField(v, this.cardCryptKey);
    const body = {
      oid: input.oid,
      cardno: enc(input.cardno),
      exp_month: enc(input.expMonth),
      exp_year: enc(input.expYear),
      socno: enc(input.socno),
      pass: enc(input.pass),
      item: input.item,
      usernm: enc(input.membnm),
      amount: input.amount,
      coinamt: input.coinamt,
      membid: enc(input.membid),
      telno: enc(input.telno),
      pushurl: input.pushurl,
    };

    this.logger.log(
      `[autoPayRegister.body] cardno=${body.cardno.slice(0, 12)}... ` +
      `exp_m=${body.exp_month.slice(0, 12)}... membid=${body.membid.slice(0, 12)}... ` +
      `usernm=${body.usernm.slice(0, 12)}...`,
    );

    // 2) PDF 7장: PATCH 메서드. 단 sample 라이브는 POST로 호출 (coin_fill_auto_card_update.php 라인 89).
    //    매뉴얼은 PATCH라 명시했지만 sample이 POST로 운영 중 → POST 사용 (sample 정책).
    try {
      const res = await this.callJson('POST', `${this.host}/cptl/autopay/gnrc_autopay_regist`, body);
      this.logger.log(`[autoPayRegister.response] ${JSON.stringify(res)}`);
      const ok = res?.req_result === '00';
      if (!ok) {
        return { ok: false, raw: res, error: `req_result=${res?.req_result} ${res?.resultmessage ?? ''}` };
      }
      return { ok: true, billkey: String(res.BillKey ?? res.billkey ?? ''), raw: res };
    } catch (e) {
      this.logger.error(`autoPayRegister 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // ============================================================
  // 자동결제 즉시 호출 — POST gnrc_autopay_request
  // ============================================================
  async autoPayRequest(membid: string, amount: number, coinamt: number): Promise<AutoPayRequestResult> {
    if (!this.enabled) return { ok: false, error: 'AG9 비활성' };
    try {
      const res = await this.callJson('POST', `${this.host}/cptl/autopay/gnrc_autopay_request`, {
        membid,
        amount: String(amount),
        coinamt: String(coinamt),
      });
      const ok = res?.req_result === '00';
      return { ok, tid: res?.tid as string | undefined, raw: res, error: ok ? undefined : `req_result=${res?.req_result}` };
    } catch (e) {
      this.logger.error(`autoPayRequest 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // ============================================================
  // 자동결제 등록 삭제 — POST gnrc_autopay_delete
  // ============================================================
  async autoPayDelete(membid: string): Promise<{ ok: boolean; raw?: unknown; error?: string }> {
    if (!this.enabled) return { ok: false, error: 'AG9 비활성' };
    try {
      const res = await this.callJson('POST', `${this.host}/cptl/autopay/gnrc_autopay_delete`, {
        membid,
      });
      const ok = res?.req_result === '00';
      return { ok, raw: res, error: ok ? undefined : `req_result=${res?.req_result}` };
    } catch (e) {
      this.logger.error(`autoPayDelete 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // ============================================================
  // 결제 취소 (전액) — POST gnrc_cancel_pay (PDF 8장)
  // ============================================================
  async cancelPay(oid: string): Promise<CancelPayResult> {
    if (!this.enabled) return { ok: false, error: 'AG9 비활성' };
    try {
      const res = await this.callJson('POST', `${this.host}/cptl/cancelpay/gnrc_cancel_pay`, { oid });
      const ok = res?.req_result === '00';
      return {
        ok,
        reqResult: res?.req_result as string | undefined,
        resultMessage: res?.resultmessage as string | undefined,
        raw: res,
        error: ok ? undefined : `req_result=${res?.req_result}`,
      };
    } catch (e) {
      this.logger.error(`cancelPay 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // ============================================================
  // 결제 부분 취소 — POST gnrc_cancel_pay_part (PDF 8장)
  // ============================================================
  async cancelPayPartial(oid: string, recamt: number, reccoinamt: number): Promise<CancelPayResult> {
    if (!this.enabled) return { ok: false, error: 'AG9 비활성' };
    try {
      const res = await this.callJson('POST', `${this.host}/cptl/cancelpay/gnrc_cancel_pay_part`, {
        oid,
        recamt,
        reccoinamt,
      });
      const ok = res?.req_result === '00';
      return {
        ok,
        reqResult: res?.req_result as string | undefined,
        resultMessage: res?.resultmessage as string | undefined,
        raw: res,
        error: ok ? undefined : `req_result=${res?.req_result}`,
      };
    } catch (e) {
      this.logger.error(`cancelPayPartial 호출 실패: ${e instanceof Error ? e.message : String(e)}`);
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // ============================================================
  // 내부 HTTP 호출
  // ============================================================
  private async callJson(method: 'POST' | 'PATCH', url: string, body: unknown): Promise<Record<string, unknown> | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authToken,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        this.logger.warn(`AG9 응답이 JSON 아님: ${text.slice(0, 200)}`);
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
