import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';

/**
 * [Audit E-C1] PG/M2NET 콜백 발신 IP 화이트리스트 가드.
 *
 * 분석 결과 (2026-05-17): 5일치 nginx access log 12,000+ 콜백 모두 `211.175.205.88` 단일 IP.
 *   - M2NET state-push / call-push (Go-http-client UA)
 *   - AG9 charge/callback / autopay-push (Go-http-client + curl UA)
 *   - 단 charge/complete 는 사용자 브라우저 redirect 이므로 별도 (이 가드 적용 X)
 *
 * 동작 모드 (env CALLBACK_IP_MODE 로 제어):
 *   - 'log'    (기본) — 화이트리스트 외 IP 도 통과시키되 OpsAlert + Logger.warn. 운영 안전.
 *   - 'reject' — 화이트리스트 외 IP 차단 (401). 1주 모니터링 후 전환 권장.
 *
 * 화이트리스트 (env CALLBACK_ALLOW_IPS, 쉼표 구분):
 *   기본값 '211.175.205.88'. 추가 IP 발견 시 .env 의 CALLBACK_ALLOW_IPS 에 등록.
 *
 * 적용 위치:
 *   @UseGuards(CallbackIpAllowlistGuard) 를 각 콜백 컨트롤러에.
 *   (charge/complete 는 사용자 브라우저라 적용 X)
 */
@Injectable()
export class CallbackIpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(CallbackIpAllowlistGuard.name);
  // 이미 알림 보낸 IP — 5분간 중복 알림 차단
  private readonly recentAlerts = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly opsAlert: OpsAlertService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(req);
    const allowed = this.allowList();
    const mode = String(this.config.get('CALLBACK_IP_MODE') ?? 'log').toLowerCase();

    if (allowed.has(ip)) return true;

    // IPv6-mapped IPv4 (::ffff:1.2.3.4) 도 변환해서 비교
    const stripped = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    if (allowed.has(stripped)) return true;

    // 화이트리스트 외 IP 도착 — 알림 + (mode 에 따라) 차단
    this.alertOnce(ip, req);

    if (mode === 'reject') {
      throw new UnauthorizedException(`callback IP not allowed: ${ip}`);
    }
    // 'log' 모드 — 통과
    return true;
  }

  private extractIp(req: Request): string {
    // 우선순위:
    //   1) X-Real-IP (nginx 가 명시적으로 set — 가장 신뢰할 만)
    //   2) X-Forwarded-For 의 첫 번째 IP (proxy chain 의 client)
    //   3) req.ip (trust proxy 가 잘 동작 시)
    //   4) socket.remoteAddress (마지막 fallback)
    const xRealIp = (req.headers['x-real-ip'] as string | undefined)?.trim();
    if (xRealIp) return xRealIp;
    const xff = (req.headers['x-forwarded-for'] as string | undefined)?.trim();
    if (xff) return xff.split(',')[0].trim();
    return req.ip ?? req.socket?.remoteAddress ?? '?';
  }

  private allowList(): Set<string> {
    const raw = String(this.config.get('CALLBACK_ALLOW_IPS') ?? '211.175.205.88');
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }

  private alertOnce(ip: string, req: Request): void {
    const key = `${ip}|${req.path}`;
    const last = this.recentAlerts.get(key) ?? 0;
    const now = Date.now();
    if (now - last < 5 * 60 * 1000) return; // 5분 cooldown
    this.recentAlerts.set(key, now);
    // 메모리 leak 방지: cooldown 윈도우 (5분) 지난 항목 정리.
    //   장시간 운영 시 attacker IP 가 많아져도 자동 청소 → key 수 제한적.
    if (this.recentAlerts.size > 100) {
      const cutoff = now - 5 * 60 * 1000;
      for (const [k, ts] of this.recentAlerts) {
        if (ts < cutoff) this.recentAlerts.delete(k);
      }
    }
    this.logger.warn(`[CallbackIpAllowlist] 비-화이트리스트 IP 도착 ip=${ip} path=${req.path} ua=${req.headers['user-agent']}`);
    void this.opsAlert.send(
      '⚠️ 콜백 비-화이트리스트 IP 도착',
      `path=${req.path}\nip=${ip}\nUA=${req.headers['user-agent'] ?? '-'}\n\nlog 모드라 통과시킴. M2NET/AG9 IP 변경 가능성 또는 위조 시도. 확인 후 .env CALLBACK_ALLOW_IPS 업데이트 또는 차단 검토.`,
    );
  }
}
