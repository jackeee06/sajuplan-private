import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';

/**
 * 매일 09:00 KST — 어제 24시간 운영 활동 요약 + 사장님 카톡 발송.
 * 2026-05-29 신설 (운영 시작 안전망).
 *
 * 발송 내용:
 *   - 어제 결제 N건 (completed) / 환불 N건
 *   - 어제 상담 N건 / 단기통화환불 N건
 *   - 어제 신규 회원 N
 *   - 어제 OpsAlert 발생 N (alimtalk_log 에서 ops_admin_alert_v2 카운트)
 *   - health-check 현재 0건 (정상) / 위반 카테고리 (있으면)
 *   - chat_room m2net_failed 누적 (10건 이상이면 경고)
 *   - DB 백업 어제 OK?
 *
 * OpsAlertService 재사용 (template_code = ops_admin_alert_v2).
 *   category = '일일 운영 요약'
 *   detail = 위 항목 모두
 */
@Injectable()
export class DailySummaryService {
  private readonly logger = new Logger(DailySummaryService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly opsAlert: OpsAlertService,
  ) {}

  async run(): Promise<{ sent: number; summary: string }> {
    // KST 어제 00:00 ~ 오늘 00:00
    const summary = await this.collect();
    const detail = this.format(summary);
    const result = await this.opsAlert.send('일일 운영 요약', detail);
    this.logger.log(`[daily-summary] sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`);
    return { sent: result.sent, summary: detail };
  }

  private async collect() {
    const [
      payment, refund, consultation, shortCallRefund, newMember,
      opsAlertYesterday, healthViolation, m2netFailed,
    ] = await Promise.all([
      this.sql<{ cnt: string; total: string }[]>`
        SELECT COUNT(*)::text AS cnt, COALESCE(SUM(amount), 0)::text AS total
          FROM payment
         WHERE status='completed'
           AND created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '1 day'
           AND created_at <  (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM refund_request
         WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '1 day'
           AND created_at <  (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM consultation
         WHERE reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
           AND created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '1 day'
           AND created_at <  (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM consultation
         WHERE refund_status='short_call_refund'
           AND created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '1 day'
           AND created_at <  (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM member
         WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '1 day'
           AND created_at <  (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM alimtalk_log
         WHERE template_code='ops_admin_alert_v2'
           AND sent_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '1 day'
           AND sent_at <  (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      // health-check 위반 (현재 시점)
      this.sql<{ check: string; cnt: number }[]>`
        SELECT 'C-1 음수' AS check, COUNT(*)::int AS cnt
          FROM point WHERE free_balance<0 OR paid_balance<0 OR earning_balance<0
        UNION ALL
        SELECT 'C-8 drift', COUNT(*)::int
          FROM member m JOIN point p ON p.member_id=m.id
         WHERE m.point != (p.free_balance + p.paid_balance)
        UNION ALL
        SELECT 'C-17 m2net_failed', COUNT(*)::int
          FROM chat_room WHERE settle_status='m2net_failed'
      `,
      this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM chat_room WHERE settle_status='m2net_failed'
      `,
    ]);

    return {
      payment_cnt: Number(payment[0].cnt),
      payment_total: Number(payment[0].total),
      refund_cnt: Number(refund[0].cnt),
      consultation_cnt: Number(consultation[0].cnt),
      short_call_cnt: Number(shortCallRefund[0].cnt),
      new_member_cnt: Number(newMember[0].cnt),
      ops_alert_yesterday: Number(opsAlertYesterday[0].cnt),
      health_violations: healthViolation.filter((r) => r.cnt > 0),
      m2net_failed_total: Number(m2netFailed[0].cnt),
    };
  }

  private format(s: Awaited<ReturnType<DailySummaryService['collect']>>): string {
    const lines: string[] = [];
    lines.push(`[어제 활동]`);
    lines.push(`결제 ${s.payment_cnt}건 (${s.payment_total.toLocaleString()}원)`);
    lines.push(`상담 ${s.consultation_cnt}건${s.short_call_cnt > 0 ? ` (짧은통화 ${s.short_call_cnt})` : ''}`);
    if (s.refund_cnt > 0) lines.push(`환불 신청 ${s.refund_cnt}건 ⚠️`);
    lines.push(`신규 회원 ${s.new_member_cnt}명`);
    lines.push(`OpsAlert 발송 ${s.ops_alert_yesterday}건${s.ops_alert_yesterday > 0 ? ' ⚠️' : ''}`);
    lines.push('');
    lines.push(`[현재 상태]`);
    if (s.health_violations.length === 0) {
      lines.push(`health-check ✅ 모두 정상`);
    } else {
      lines.push(`health-check ⚠️ 위반:`);
      for (const v of s.health_violations) lines.push(`  · ${v.check}: ${v.cnt}건`);
    }
    if (s.m2net_failed_total >= 10) {
      lines.push(`chat_room m2net_failed ⚠️ ${s.m2net_failed_total}건 (10건 이상 누적)`);
    }
    return lines.join('\n');
  }
}
