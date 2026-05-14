import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ChargeService } from './charge.service';
import type { PgCallbackPayload } from '../../shared/ag9/ag9.types';
import { runtimeEnv } from '../../shared/env/runtime-env';

// 자동결제 push 도착 진단용 파일 로그.
// /api/pg/m2net/call-push 와 동일 패턴 (pg-callbacks/m2net-push.controller.ts:12-29).
// 운영 PM2 cwd 하위 logs/autopay-push.log 에 append. 적립 누락 사고 추적용.
const AUTOPAY_LOG_DIR = path.resolve(process.cwd(), 'logs');
const AUTOPAY_LOG_FILE = path.join(AUTOPAY_LOG_DIR, 'autopay-push.log');

function appendAutopayLog(kind: string, ip: string, body: unknown): void {
  const line = `${new Date().toISOString()} [${kind}] ip=${ip} body=${JSON.stringify(body)}\n`;
  try {
    fs.mkdirSync(AUTOPAY_LOG_DIR, { recursive: true });
  } catch {
    /* swallow */
  }
  fs.appendFile(AUTOPAY_LOG_FILE, line, (err) => {
    if (err) console.warn(`[autopay push log] append 실패: ${err.message}`);
  });
}

/**
 * PG / 엠투넷 콜백 수신 — 인증 없음. 운영 시 IP 화이트리스트 검증 필요.
 *
 * 엔드포인트:
 *   POST /api/pg/charge/callback        ← AG9 일반결제 returnurl (sample/coin_pay_ok_v2.php)
 *   POST /api/pg/charge/vbank-callback  ← AG9 가상계좌 입금 통지 (sample/coin_pay_bank_ok_v2.php)
 *   POST /api/pg/charge/autopay-push    ← 엠투넷 자동결제 push (sample/mtonet/auto_pay_result.php)
 *
 * 멱등 보장:
 *   - payment.oid UNIQUE + point_history.(rel_table, rel_id, rel_action) UNIQUE
 *   - 같은 oid 콜백이 두 번 와도 두 번째는 idempotent return
 *
 * 보안:
 *   - 운영팀에서 받은 passcall.co.kr 도메인 IP를 setting 테이블에 등록 후
 *     본 컨트롤러 진입 시 미들웨어 또는 가드로 검증 (별도 PR에서 보강 예정).
 */
@Controller('pg/charge')
export class PgCallbackController {
  constructor(
    private readonly svc: ChargeService,
    private readonly config: ConfigService,
  ) {}

  /** AG9 카드/간편결제 결과 push (returnurl) */
  @Post('callback')
  @HttpCode(200)
  async callback(@Req() req: Request, @Body() body: PgCallbackPayload) {
    // PG는 form-urlencoded 또는 JSON 둘 다 보낼 수 있음
    const payload = (body && Object.keys(body).length ? body : (req as any).body) as PgCallbackPayload;
    appendAutopayLog('callback', req.ip ?? '-', payload);
    return this.svc.handlePaymentCallback(payload);
  }

  /** AG9 가상계좌 입금 완료 통지 */
  @Post('vbank-callback')
  @HttpCode(200)
  async vbankCallback(@Req() req: Request, @Body() body: PgCallbackPayload) {
    const payload = (body && Object.keys(body).length ? body : (req as any).body) as PgCallbackPayload;
    appendAutopayLog('vbank-callback', req.ip ?? '-', payload);
    return this.svc.handleVbankCallback(payload);
  }

  /** 엠투넷 자동결제 결과 push (autopaypushurl) */
  @Post('autopay-push')
  @HttpCode(200)
  async autopayPush(@Req() req: Request, @Body() body: PgCallbackPayload) {
    const payload = (body && Object.keys(body).length ? body : (req as any).body) as PgCallbackPayload;
    appendAutopayLog('autopay-push', req.ip ?? '-', payload);
    try {
      const r = await this.svc.handleAutopayPush(payload);
      appendAutopayLog('autopay-push-result', req.ip ?? '-', r);
      return r;
    } catch (e) {
      appendAutopayLog('autopay-push-error', req.ip ?? '-', { message: (e as Error).message });
      throw e;
    }
  }

  /**
   * AG9 formurl 수신 — 결제 완료/취소 시 PG가 사용자 브라우저 form으로 POST.
   * sample/coin/coin_pay_ok_v2.php 와 동일 위치의 신규 진입점.
   *
   * 동작:
   *   1) PG 응답을 handlePaymentCallback 호출 (returnurl 누락 시 보강) — 멱등
   *   2) 사용자 SPA `/charge/complete?oid=...&status=...` 로 302 redirect
   *
   * formurl이 nginx 정적 SPA(/charge/complete)로 가면 nginx 405 Not Allowed 발생.
   * 그래서 formurl을 본 백엔드 라우트로 받고, 처리 후 GET 으로 SPA에 redirect.
   */
  @Post('complete')
  async completePost(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    return this.handleFormUrl(req, res, body);
  }

  /** PG가 일부 케이스에서 GET 으로 query string 만 redirect 할 수도 있어 동일 핸들러 노출 */
  @Get('complete')
  async completeGet(@Req() req: Request, @Res() res: Response, @Query() query: any) {
    return this.handleFormUrl(req, res, query);
  }

  private async handleFormUrl(req: Request, res: Response, payload: any) {
    const merged = {
      ...(payload ?? {}),
      ...((req as any).body ?? {}),
      ...((req.query as any) ?? {}),
    };
    const oid = String(merged.oid ?? merged.Oid ?? '').trim();
    const reqResult = String(merged.req_result ?? merged.ReqResult ?? '').trim();
    const resultMsg = String(merged.resultmsg ?? merged.ResultMsg ?? merged.message ?? '').trim();

    // 멱등 — 이미 callback(returnurl)이 처리했어도 안전.
    // VBANK 필드(vrno/bank/banknm/deposit_*) 도 함께 전달 — 이전에 누락되어 가상계좌 정보가 DB에 저장되지 않았던 버그.
    if (oid) {
      try {
        await this.svc.handlePaymentCallback({
          ...merged,
          oid,
          tid: String(merged.tid ?? ''),
          cpid: String(merged.cpid ?? ''),
          membid: String(merged.membid ?? ''),
          amount: merged.amount ?? 0,
          coinamt: merged.coinamt ?? 0,
          paytype: String(merged.paytype ?? ''),
          req_result: reqResult || '0000',
          resultmsg: resultMsg,
          // VBANK 필드 — sample 의 returnurl 은 'bank' 키, vbank-callback 은 'bankcd' 키 사용. 둘 다 보존.
          vrno: String(merged.vrno ?? ''),
          bank: String(merged.bank ?? ''),
          bankcd: String(merged.bankcd ?? merged.bank ?? ''),
          banknm: String(merged.banknm ?? ''),
          deposit_nm: String(merged.deposit_nm ?? ''),
          deposit_tm: String(merged.deposit_tm ?? ''),
        } as PgCallbackPayload);
      } catch {
        // SPA 측에서 status 폴링하면 보임 — 여기선 무시
      }
    }

    // SPA 결제 완료 화면으로 redirect — SAJUMOON_ENV(test|prod) 단일 분기.
    // pgFormUrl 은 PG가 form_post 로 호출한 백엔드 자기 자신. SPA 결과 화면 URL은 별도.
    const spaUrl = runtimeEnv().pgCompleteSpaUrl;
    const params = new URLSearchParams();
    if (oid) params.set('oid', oid);
    if (reqResult) params.set('req_result', reqResult);
    if (resultMsg) params.set('msg', resultMsg.slice(0, 200));
    return res.redirect(302, `${spaUrl}?${params.toString()}`);
  }
}
