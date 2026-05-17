import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { M2netPushService } from './m2net-push.service';
import { CallbackIpAllowlistGuard } from './callback-ip-allowlist.guard';

// m2net push 도착 진단용 파일 로그. 채팅 종료 시 push 가 실제로 진입하는지,
// payload 내용은 무엇인지 (특히 reason / amt / usetm / roomid) 추적용.
// 운영 PM2 cwd 가 /data/wwwroot/api.sajumoon.kr 이므로 그 하위 logs/ 에 기록.
// (deploy.sh 가 source rsync 시 dist/ 만 빼고 동기화해서 logs/ 가 사라질 수 있으므로
//  append 시점에 항상 디렉토리 보장.)
const PUSH_LOG_DIR = path.resolve(process.cwd(), 'logs');
const PUSH_LOG_FILE = path.join(PUSH_LOG_DIR, 'm2net-push.log');

function appendPushLog(kind: string, ip: string, body: unknown): void {
  const line = `${new Date().toISOString()} [${kind}] ip=${ip} body=${JSON.stringify(body)}\n`;
  // 디렉토리가 사라졌으면 그때그때 재생성 (배포 직후 ENOENT 방지).
  try {
    fs.mkdirSync(PUSH_LOG_DIR, { recursive: true });
  } catch {
    /* swallow */
  }
  fs.appendFile(PUSH_LOG_FILE, line, (err) => {
    if (err) {
      // 파일 IO 실패가 push 처리를 막아선 안 됨.
      console.warn(`[m2net push log] append 실패: ${err.message}`);
    }
  });
}

/**
 * 엠투넷 Push 통지 콜백.
 *
 * 운영 등록 URL (CP관리자 → CP정보확인및수정):
 *   - Push통지Url        → https://api.sajumoon.kr/api/pg/m2net/call-push
 *   - 상담사상태통지Url  → https://api.sajumoon.kr/api/pg/m2net/state-push
 *
 * sample 매핑:
 *   POST /api/pg/m2net/call-push  ← sample/mtonet/mtonet_rcv.php
 *   POST /api/pg/m2net/state-push ← sample/mtonet/mtonet_state.php
 *
 * 인증:
 *   - 토큰 검증 없음. 운영에서는 PassCall.co.kr 도메인 IP 화이트리스트로 nginx 또는 미들웨어 차단 권장.
 */
// [Audit E-C1] m2net push 라우트 — IP 화이트리스트 (log 모드) + throttle 분당 120회.
@Controller('pg/m2net')
@UseGuards(CallbackIpAllowlistGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class M2netPushController {
  constructor(private readonly svc: M2netPushService) {}

  /**
   * 통화/채팅 종료 등 이벤트 push (mtonet_rcv.php).
   *  - body 가 단일 객체 또는 배열로 올 수 있어 양쪽 모두 처리.
   *  - HTTP 200 을 무조건 응답 (sample 도 동일). 처리 실패는 로그로만 추적.
   */
  @Post('call-push')
  @HttpCode(200)
  async callPush(@Req() req: Request, @Body() body: unknown) {
    const payload = body && typeof body === 'object' ? body : (req as { body?: unknown }).body;
    appendPushLog('call-push', req.ip ?? '-', payload ?? body ?? null);
    if (!payload) return { ok: true };

    if (Array.isArray(payload)) {
      let processed = 0;
      for (const item of payload) {
        if (item && typeof item === 'object') {
          await this.svc.handleCallPush(item as Record<string, unknown>);
          processed += 1;
        }
      }
      return { ok: true, processed };
    }
    if (typeof payload === 'object') {
      await this.svc.handleCallPush(payload as Record<string, unknown>);
    }
    return { ok: true };
  }

  /** 상담사 상태 일괄 push (mtonet_state.php). body 형태: { list: [{csrid, state}, ...] } */
  @Post('state-push')
  @HttpCode(200)
  async statePush(@Req() req: Request, @Body() body: unknown) {
    const payload = body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : ((req as { body?: unknown }).body as Record<string, unknown> | undefined);
    appendPushLog('state-push', req.ip ?? '-', payload ?? body ?? null);
    if (!payload) return { ok: true, updated: 0 };
    return this.svc.handleStatePush(payload);
  }

  /**
   * GET /api/pg/m2net/push-log?key=...&tail=200
   *
   * 진단용 — 브라우저에서 m2net push 도착 여부 / payload 를 확인하기 위한 임시 엔드포인트.
   * SSH 없이도 채팅 종료 시 END_CHAT push 가 들어오는지 추적 가능.
   *
   * 가드: 쿼리 key 가 .env M2NET_PUSH_LOG_KEY 와 일치해야만 노출. 미설정 시 비활성.
   * 차감 진단이 끝나면 이 엔드포인트는 제거 권장.
   */
  @Get('push-log')
  pushLog(@Query('key') key: string | undefined, @Query('tail') tail: string | undefined) {
    const expected = process.env.M2NET_PUSH_LOG_KEY;
    if (!expected) throw new ForbiddenException('disabled');
    if (!key || key !== expected) throw new ForbiddenException('forbidden');
    const tailN = Math.min(2000, Math.max(1, parseInt(tail ?? '200', 10) || 200));
    let content = '';
    try {
      content = fs.readFileSync(PUSH_LOG_FILE, 'utf8');
    } catch {
      return { ok: true, lines: [], note: 'log file empty or not yet created' };
    }
    const allLines = content.split('\n').filter((l) => l.length > 0);
    const lines = allLines.slice(-tailN);
    return { ok: true, total: allLines.length, showing: lines.length, lines };
  }
}
