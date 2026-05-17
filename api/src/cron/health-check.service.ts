import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';

/**
 * Phase G — DB 일관성 health-check 서비스.
 *
 * Phase C 감사에서 정의된 18개 불변식을 정기 실행 (매시간/매일).
 * 위반 발견 시 OpsAlert 발송.
 *
 * 진실의 원천:
 *   - point.free_balance/paid_balance: 차감 시 FOR UPDATE 잠금 (정확)
 *   - member.point: denormalized snapshot (drift 가능)
 *   - consultation.amt/amt_free/amt_pro: INSERT 시 한 번 결정 후 불변
 *   - settlement_monthly: 정산 cron 결과 (한 번 INSERT 후 변경 X)
 */
@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly opsAlert: OpsAlertService,
  ) {}

  /**
   * 전체 invariant 검사. 위반 발견 시 OpsAlert + 결과 반환.
   * 운영 매시간/매일 cron 으로 호출.
   */
  async runAll(): Promise<{
    checks: Array<{ id: string; name: string; severity: 'critical' | 'warning' | 'info'; violations: number; detail?: string }>;
    total_violations: number;
    alerted: boolean;
  }> {
    const checks: Array<{ id: string; name: string; severity: 'critical' | 'warning' | 'info'; violations: number; detail?: string }> = [];

    // C-1 음수 포인트 잔액
    const c1 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM point WHERE free_balance < 0 OR paid_balance < 0
    `;
    checks.push({ id: 'C-1', name: '음수 포인트 잔액', severity: 'critical', violations: Number(c1[0].cnt) });

    // C-2 member.point 음수
    const c2 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM member WHERE point < 0
    `;
    checks.push({ id: 'C-2', name: 'member.point 음수', severity: 'critical', violations: Number(c2[0].cnt) });

    // C-3 consultation amt 정합성
    const c3 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM consultation
       WHERE amt > 0 AND (amt_free + amt_pro) != amt
         AND reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
    `;
    checks.push({ id: 'C-3', name: 'consultation amt 불일치', severity: 'critical', violations: Number(c3[0].cnt) });

    // C-4 과다 환불
    const c4 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM consultation WHERE refunded_amount > amt
    `;
    checks.push({ id: 'C-4', name: '환불금액 > 결제금액', severity: 'critical', violations: Number(c4[0].cnt) });

    // C-5 refund_request 합 > amt
    const c5 = await this.sql<{ cnt: string }[]>`
      WITH rr_sum AS (
        SELECT consultation_id, SUM(amount)::int AS total
          FROM refund_request WHERE status='approved' GROUP BY consultation_id
      )
      SELECT COUNT(*)::text AS cnt
        FROM consultation c JOIN rr_sum r ON r.consultation_id = c.id
       WHERE r.total > c.amt
    `;
    checks.push({ id: 'C-5', name: 'refund 합 > 결제금액', severity: 'critical', violations: Number(c5[0].cnt) });

    // C-6 refund 분배 불일치
    const c6 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM refund_request WHERE (amount_free + amount_pro) != amount
    `;
    checks.push({ id: 'C-6', name: 'refund free/pro 합 불일치', severity: 'warning', violations: Number(c6[0].cnt) });

    // C-7 orphan refund
    const c7 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM refund_request r LEFT JOIN consultation c ON c.id = r.consultation_id
       WHERE c.id IS NULL
    `;
    checks.push({ id: 'C-7', name: 'orphan refund_request', severity: 'warning', violations: Number(c7[0].cnt) });

    // C-8 member.point drift
    const c8 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM member m JOIN point p ON p.member_id = m.id
       WHERE m.point != (p.free_balance + p.paid_balance)
    `;
    checks.push({ id: 'C-8', name: 'member.point drift', severity: 'warning', violations: Number(c8[0].cnt) });

    // C-9 settlement 중복
    const c9 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM (
        SELECT member_id, month FROM settlement_monthly
         WHERE member_id IS NOT NULL
         GROUP BY member_id, month HAVING COUNT(*) > 1
      ) t
    `;
    checks.push({ id: 'C-9', name: 'settlement 중복', severity: 'critical', violations: Number(c9[0].cnt) });

    // C-10 비현실적 usetm
    const c10 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM consultation WHERE usetm < 0 OR usetm > 86400
    `;
    checks.push({ id: 'C-10', name: 'usetm 비현실적', severity: 'warning', violations: Number(c10[0].cnt) });

    // C-11 settlement_monthly 음수 정산액 (환불 많아 음수 가능, 알림용)
    const c11 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM settlement_monthly WHERE price < 0
    `;
    checks.push({ id: 'C-11', name: 'settlement 음수 정산액', severity: 'warning', violations: Number(c11[0].cnt) });

    // C-12 등급 임계값 역전
    const c12 = await this.sql<{ p1: number | null; p2: number | null; p3: number | null; p4: number | null; p5: number | null }[]>`
      SELECT
        (SELECT NULLIF(value,'')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner1') AS p1,
        (SELECT NULLIF(value,'')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner2') AS p2,
        (SELECT NULLIF(value,'')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner3') AS p3,
        (SELECT NULLIF(value,'')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner4') AS p4,
        (SELECT NULLIF(value,'')::int FROM setting WHERE namespace='grade' AND key='thresholds.partner5') AS p5
    `;
    const t = c12[0];
    const reversed = t && t.p1 !== null && t.p2 !== null && t.p3 !== null && t.p4 !== null && t.p5 !== null
      ? (t.p1 >= t.p2 || t.p2 >= t.p3 || t.p3 >= t.p4 || t.p4 >= t.p5)
      : false;
    checks.push({
      id: 'C-12',
      name: '등급 임계값 역전',
      severity: 'critical',
      violations: reversed ? 1 : 0,
      detail: reversed ? `${t.p1}/${t.p2}/${t.p3}/${t.p4}/${t.p5}` : undefined,
    });

    // C-13 정산률 범위 외
    const c13 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM setting
       WHERE namespace='grade' AND key LIKE 'revenue_rate.%'
         AND (NULLIF(value,'')::numeric < 0 OR NULLIF(value,'')::numeric > 1)
    `;
    checks.push({ id: 'C-13', name: '정산률 범위 외(0~1)', severity: 'critical', violations: Number(c13[0].cnt) });

    // C-14 point.free_balance > total_earned (사기성 데이터 — 받은 적 없는 free 가 있음)
    const c14 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM point WHERE free_balance > total_earned
    `;
    checks.push({ id: 'C-14', name: 'point.free_balance > total_earned', severity: 'warning', violations: Number(c14[0].cnt) });

    // C-15 refund_status 일관성
    const c15 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM consultation
       WHERE refund_status = 'full' AND refunded_amount < amt
    `;
    checks.push({ id: 'C-15', name: "refund_status='full' 불일치", severity: 'warning', violations: Number(c15[0].cnt) });

    // C-16 결제 retry 누적
    const c16 = await this.sql<{ cnt: string; max_r: string | null }[]>`
      SELECT COUNT(*)::text AS cnt, MAX(m2net_retry_count)::text AS max_r
        FROM payment WHERE m2net_status = '코인충전실패'
    `;
    const c16_v = Number(c16[0].cnt);
    checks.push({
      id: 'C-16',
      name: 'M2NET 결제 적립 retry 대기',
      severity: c16_v > 10 ? 'critical' : c16_v > 0 ? 'warning' : 'info',
      violations: c16_v,
      detail: c16[0].max_r ? `max_retries=${c16[0].max_r}` : undefined,
    });

    // C-17 채팅 정산 retry 누적
    const c17 = await this.sql<{ cnt: string; max_r: string | null }[]>`
      SELECT COUNT(*)::text AS cnt, MAX(settle_retry_count)::text AS max_r
        FROM chat_room WHERE settle_status = 'm2net_failed'
    `;
    const c17_v = Number(c17[0].cnt);
    checks.push({
      id: 'C-17',
      name: '채팅 정산 retry 대기',
      severity: c17_v > 10 ? 'critical' : c17_v > 0 ? 'warning' : 'info',
      violations: c17_v,
      detail: c17[0].max_r ? `max_retries=${c17[0].max_r}` : undefined,
    });

    // C-18 role/level 이중 진실원천 어긋남 — 정산 cron 이 level=5 기준이라 어긋나면 정산 누락
    //   매핑: admin=10, counselor=5, user=2 (메모리: project_role_level_cleanup.md)
    const c18 = await this.sql<{ cnt: string; sample: string | null }[]>`
      SELECT COUNT(*)::text AS cnt,
             STRING_AGG(DISTINCT role || ':' || level::text, ', ') AS sample
        FROM member
       WHERE (role = 'admin'     AND level <> 10)
          OR (role = 'counselor' AND level <> 5)
          OR (role = 'user'      AND level <> 2)
    `;
    checks.push({
      id: 'C-18',
      name: 'role/level 매핑 어긋남',
      severity: 'critical',
      violations: Number(c18[0].cnt),
      detail: c18[0].sample ?? undefined,
    });

    // 종합
    const critical = checks.filter((c) => c.severity === 'critical' && c.violations > 0);
    const warning = checks.filter((c) => c.severity === 'warning' && c.violations > 0);
    const totalViolations = critical.reduce((s, c) => s + c.violations, 0) + warning.reduce((s, c) => s + c.violations, 0);

    let alerted = false;
    if (critical.length > 0) {
      const detail = critical
        .map((c) => `[${c.id}] ${c.name}: ${c.violations}건${c.detail ? ` (${c.detail})` : ''}`)
        .join('\n');
      const r = await this.opsAlert.send(
        'DB 일관성 위반 감지 (Critical)',
        `다음 invariant 가 위반됨:\n${detail}\n\n로그 + DB 점검 필요`,
      );
      alerted = !r.skipped;
    } else if (warning.length > 0) {
      this.logger.warn(
        `[health-check] Warning ${warning.length}건: ${warning.map((c) => `${c.id}=${c.violations}`).join(', ')}`,
      );
    }

    this.logger.log(
      `[health-check] 완료 — critical=${critical.length} warning=${warning.length} alerted=${alerted}`,
    );

    return {
      checks,
      total_violations: totalViolations,
      alerted,
    };
  }
}
