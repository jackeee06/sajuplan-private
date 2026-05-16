import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../db/db.module';
import { SmsService } from '../../user/sms/sms.service';

/**
 * 운영자 알림 서비스 (Phase 7).
 *
 * 운영 중 발생하는 사고/실패를 카카오 알림톡으로 운영자(어드민) 휴대폰에 발송.
 *
 * 사용처:
 *  - 크론 실패 (등급 재산정 / 정산)
 *  - M2NET 콜백 처리 실패 (회원 차감 실패 등)
 *  - 자동충전 사고
 *  - 기타 운영자 즉시 인지 필요 사고
 *
 * 정책 setting (namespace='ops'):
 *  - admin_alert.enabled        — 'true'/'false'. false 면 logger 만 남기고 발송 skip
 *  - admin_alert.recipients     — 콤마 구분 휴대폰 번호 (010xxxxxxxx)
 *  - admin_alert.template_code  — BizM 등록 템플릿 코드 (기본 'ops_admin_alert')
 *  - admin_alert.cooldown_sec   — 같은 category 중복 발송 차단 (기본 300초)
 *
 * 발송 실패해도 호출자에게 예외 전파 X — 알림 실패가 본 작업을 막으면 안 됨.
 */
@Injectable()
export class OpsAlertService {
  private readonly logger = new Logger(OpsAlertService.name);

  /** 카테고리별 마지막 발송 시각 — 쿨다운으로 알림 폭주 방지 */
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
  ) {}

  /**
   * 운영자 알림 발송.
   * @returns { sent, failed, skipped } — 호출자가 로그 남길 수 있게 결과 반환
   */
  async send(
    category: string,
    detail: string,
  ): Promise<{ sent: number; failed: number; skipped: boolean; reason?: string }> {
    try {
      const policy = await this.loadPolicy();

      if (!policy.enabled) {
        this.logger.log(`[OpsAlert SKIP — disabled] ${category}: ${detail.slice(0, 200)}`);
        return { sent: 0, failed: 0, skipped: true, reason: 'disabled' };
      }
      if (policy.recipients.length === 0) {
        this.logger.warn(`[OpsAlert SKIP — no recipients] ${category}: ${detail.slice(0, 200)}`);
        return { sent: 0, failed: 0, skipped: true, reason: 'no_recipients' };
      }

      // 쿨다운 체크 — 같은 카테고리 알림이 너무 자주 오면 발송 차단
      const now = Date.now();
      const last = this.lastSentAt.get(category) ?? 0;
      if (now - last < policy.cooldownMs) {
        this.logger.warn(`[OpsAlert SKIP — cooldown] ${category} (last ${Math.round((now - last) / 1000)}s ago)`);
        return { sent: 0, failed: 0, skipped: true, reason: 'cooldown' };
      }
      this.lastSentAt.set(category, now);

      const at = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const truncatedDetail = detail.slice(0, 800); // 알림톡 본문 안전 길이

      let sent = 0;
      let failed = 0;
      for (const phone of policy.recipients) {
        try {
          const r = await this.sms.sendAlimtalkByCode(
            policy.templateCode,
            phone,
            { category, at, detail: truncatedDetail },
            `[사주문 운영] ${category}`,
          );
          if (r.ok) {
            sent++;
          } else {
            failed++;
            this.logger.warn(`[OpsAlert] 발송 실패 phone=${phone} reason=${r.reason ?? '?'}`);
          }
        } catch (e) {
          failed++;
          this.logger.error(`[OpsAlert] 발송 예외 phone=${phone}: ${e instanceof Error ? e.message : e}`);
        }
      }
      this.logger.log(`[OpsAlert] ${category} → sent=${sent} failed=${failed}`);
      return { sent, failed, skipped: false };
    } catch (e) {
      // OpsAlert 자체 예외는 본 작업을 막지 않도록 흡수
      this.logger.error(`[OpsAlert] 자체 예외 발생: ${e instanceof Error ? e.message : e}`);
      return { sent: 0, failed: 0, skipped: true, reason: 'exception' };
    }
  }

  private async loadPolicy() {
    const rows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting WHERE namespace = 'ops'
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      enabled: (map.get('admin_alert.enabled') ?? 'false') === 'true',
      recipients: (map.get('admin_alert.recipients') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      templateCode: map.get('admin_alert.template_code') ?? 'ops_admin_alert',
      cooldownMs: Number(map.get('admin_alert.cooldown_sec') ?? '300') * 1000,
    };
  }
}
