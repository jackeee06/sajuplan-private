import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';
import { AlertsService } from '../shared/alerts/alerts.service';

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
    private readonly alerts: AlertsService,
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

    // C-1 음수 포인트 잔액 (소비포인트 free/paid + 수익포인트 earning 모두 검증)
    const c1 = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt
        FROM point
       WHERE free_balance < 0 OR paid_balance < 0 OR earning_balance < 0
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

    // ── 선지급(early payout) 시스템 invariants (Phase 1, 2026-05-21) ──
    // 명세: memory/project_payout_system_plan.md
    //   payout_request 테이블이 없으면 (마이그레이션 전) 모두 0 으로 처리.

    const tblExists = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_request'
      ) AS exists
    `;

    if (!tblExists[0]?.exists) {
      // 스키마 미적용 환경 — invariant 등록만 하고 0 처리
      checks.push({ id: 'C-19', name: '선지급 누적 paid > 정산예상 (사기/버그)', severity: 'critical', violations: 0, detail: '(payout_request 테이블 없음)' });
      checks.push({ id: 'C-20', name: 'paid 됐는데 정산 차감 누락', severity: 'critical', violations: 0, detail: '(payout_request 테이블 없음)' });
      checks.push({ id: 'C-21', name: '30일+ pending 상태 신청', severity: 'warning', violations: 0, detail: '(payout_request 테이블 없음)' });
    } else {
      // C-19 누적 paid > 누적 정산예상 × 1.5 (시스템 버그·사기·환불 폭주 가능성)
      //   완전 일치 비교는 무의미 (환불 변수). 1.5배 초과만 Critical.
      //   threshold 는 setting 에서 읽음 (기본 1.5)
      const thresholdRow = await this.sql<{ value: string }[]>`
        SELECT value FROM setting
         WHERE namespace='payout' AND key='anomaly_paid_ratio_threshold'
         LIMIT 1
      `;
      const threshold = thresholdRow.length > 0 ? Number(thresholdRow[0].value) || 1.5 : 1.5;
      const c19 = await this.sql<{ cnt: string; sample: string | null }[]>`
        WITH paid_sum AS (
          SELECT counselor_id, SUM(requested_amount)::bigint AS paid_total
            FROM payout_request
           WHERE status = 'paid'
             AND paid_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
           GROUP BY counselor_id
        ),
        estimated AS (
          SELECT c.counselor_id,
                 SUM(GREATEST(c.amt_free - COALESCE(rr.refunded_free, 0), 0)
                   + GREATEST(c.amt_pro  - COALESCE(rr.refunded_pro,  0), 0))::bigint AS amt_total
            FROM consultation c
            LEFT JOIN (
              SELECT consultation_id,
                     COALESCE(SUM(amount_free),0)::bigint AS refunded_free,
                     COALESCE(SUM(amount_pro), 0)::bigint AS refunded_pro
                FROM refund_request WHERE status='approved'
               GROUP BY consultation_id
            ) rr ON rr.consultation_id = c.id
           WHERE c.reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL')
             AND c.created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
             AND c.refund_status IS DISTINCT FROM 'full'
           GROUP BY c.counselor_id
        )
        SELECT COUNT(*)::text AS cnt,
               STRING_AGG('mb_id=' || m.mb_id || ' paid=' || p.paid_total || ' est=' || COALESCE(e.amt_total, 0), ', ') AS sample
          FROM paid_sum p
          LEFT JOIN estimated e ON e.counselor_id = p.counselor_id
          LEFT JOIN member m ON m.id = p.counselor_id
         WHERE p.paid_total::numeric > COALESCE(e.amt_total, 0)::numeric * ${threshold}::numeric
      `;
      checks.push({
        id: 'C-19',
        name: `선지급 누적 paid > 정산예상 × ${threshold}`,
        severity: 'critical',
        violations: Number(c19[0].cnt),
        detail: c19[0].sample ?? undefined,
      });

      // C-20 paid 됐는데 settlement_month 가 null + 1개월 이상 경과 (정산 cron 미차감)
      //   paid_at + 1개월 < 현재 면 정산 cron 이 차감했어야 함. 누락된 row 추적.
      const c20 = await this.sql<{ cnt: string; sample: string | null }[]>`
        SELECT COUNT(*)::text AS cnt,
               STRING_AGG('id=' || id::text || ' paid_at=' || paid_at::text, ', ') AS sample
          FROM payout_request
         WHERE status = 'paid'
           AND settled_at IS NULL
           AND paid_at < (date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul'
      `;
      checks.push({
        id: 'C-20',
        name: 'paid 됐는데 정산 차감 누락',
        severity: 'critical',
        violations: Number(c20[0].cnt),
        detail: c20[0].sample ?? undefined,
      });

      // C-21 30일+ pending 상태 신청 (운영자가 까먹은 신청)
      //   기본 30일. setting 으로 조정 가능.
      const pendingDaysRow = await this.sql<{ value: string }[]>`
        SELECT value FROM setting
         WHERE namespace='payout' AND key='anomaly_pending_days'
         LIMIT 1
      `;
      const pendingDays = pendingDaysRow.length > 0 ? Number(pendingDaysRow[0].value) || 30 : 30;
      const c21 = await this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt
          FROM payout_request
         WHERE status = 'pending'
           AND requested_at < NOW() - (${pendingDays}::int || ' days')::interval
      `;
      checks.push({
        id: 'C-21',
        name: `${pendingDays}일+ pending 상태 선지급 신청`,
        severity: 'warning',
        violations: Number(c21[0].cnt),
      });
    }

    // C-22 (2026-05-22) csrid 없는 counselor 검출
    //   role=counselor 인데 m2net csrid 가 NULL 이면 통화/채팅 라우팅 불가.
    //   원인: counselor-apply 승인 시 linkCounselorToM2net 실패 (외부 API 장애 등) 또는
    //         어드민이 폼 저장 시 register_m2net=false 옵션 사용. 어느 쪽이든 운영자 인지 필요.
    //   left_at IS NOT NULL (탈퇴) 은 제외.
    //   더미 데이터(mb_id LIKE 'dummy_%') 는 시연/테스트용이라 검증 제외.
    const c22 = await this.sql<{ cnt: string; sample: string | null }[]>`
      SELECT COUNT(*)::text AS cnt,
             STRING_AGG('id=' || id || ' mb_id=' || mb_id, ', ') AS sample
        FROM member
       WHERE role = 'counselor'
         AND csrid IS NULL
         AND left_at IS NULL
         AND mb_id NOT LIKE 'dummy\\_%' ESCAPE '\\'
    `;
    checks.push({
      id: 'C-22',
      name: 'csrid 없는 counselor (m2net 등록 누락)',
      severity: 'warning',
      violations: Number(c22[0].cnt),
      detail: c22[0].sample ?? undefined,
    });

    // 종합
    const critical = checks.filter((c) => c.severity === 'critical' && c.violations > 0);
    const warning = checks.filter((c) => c.severity === 'warning' && c.violations > 0);
    const totalViolations = critical.reduce((s, c) => s + c.violations, 0) + warning.reduce((s, c) => s + c.violations, 0);

    // 알림 항목별 한국어 행동 지침 매핑
    const ACTION_GUIDE: Record<string, string> = {
      'C-1': '관리자 > 코인내역 > 음수 잔액 회원 확인 후 수동 보정',
      'C-2': '관리자 > 회원 > member.point 음수 회원 확인',
      'C-3': '관리자 > 상담내역 > 해당 상담 코인 차감 누락 여부 확인',
      'C-4': '관리자 > 환불 > 환불액이 상담료 초과한 건 즉시 확인',
      'C-5': '관리자 > 환불 > 환불 합산이 상담료 초과한 건 확인',
      'C-6': '관리자 > 환불 > free+pro 합계 불일치 건 확인',
      'C-7': '관리자 > 환불 > 삭제된 상담의 환불 건 확인',
      'C-8': '(경미) 잔액 스냅샷 오차 — 자동 복구됨, 주기적 확인만 필요',
      'C-9': '관리자 > 정산 > 같은 달 중복 정산 즉시 확인',
      'C-12': '관리자 > 등급 설정 > 등급 임계값 순서 확인·수정',
      'C-13': '관리자 > 등급 설정 > 정산률이 0~100% 범위인지 확인',
      'C-16': '관리자 > 결제 > M2NET 적립 실패 건 수동 재처리',
      'C-17': '관리자 > 상담 > 채팅 정산 실패 건 수동 재처리',
      'C-18': '관리자 > 회원 > role·level 불일치 회원 확인·수정',
      'C-19': '관리자 > 선지급 > 이달 선지급 합계가 예상 수익 초과 — 즉시 확인',
      'C-20': '관리자 > 선지급 > 지급 완료인데 정산 미차감 건 확인',
      'C-21': '관리자 > 선지급 > 30일 이상 방치된 신청 건 처리',
      'C-22': '관리자 > 상담사 > m2net 미등록 상담사 재등록 필요',
    };

    let alerted = false;
    if (critical.length > 0) {
      const detail = critical
        .map((c) => {
          const guide = ACTION_GUIDE[c.id] ?? '관리자 > 운영 현황 확인';
          const detailSuffix = c.detail ? ` (${c.detail})` : '';
          return `• ${c.name}: ${c.violations}건${detailSuffix}\n  → ${guide}`;
        })
        .join('\n');
      // 카테고리에 fingerprint 포함 — "동일 증상" 만 6시간 dedup. 다른 항목 발생 시 즉시 알림.
      const fingerprint = critical.map((c) => `${c.id}=${c.violations}`).join(',');
      const r = await this.opsAlert.send(
        `데이터 이상 감지 (${fingerprint})`,
        `자동 점검에서 이상이 발견됐습니다:\n\n${detail}\n\n사주플랜 관리자(sajuplan.com/mng)에서 확인하세요.`,
        { cooldownSec: 21600 }, // 6시간 — 같은 fingerprint 반복 알림만 차단
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

    // [엄격검증 4차 fix 2026-05-27 Q-1] alerts in-memory 큐 TTL 청소 — 매시간 호출.
    //   비활성 사용자(polling 안 함) 의 만료 alerts 누적 방지.
    try {
      const cleaned = this.alerts.sweepExpired();
      if (cleaned > 0) this.logger.log(`[health-check] alerts.sweepExpired 청소 ${cleaned}건`);
    } catch (e) {
      this.logger.warn(`[health-check] alerts.sweepExpired 실패: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      checks,
      total_violations: totalViolations,
      alerted,
    };
  }
}
