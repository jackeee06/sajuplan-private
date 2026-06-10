import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../db/db.module';
import { SmsService } from '../../user/sms/sms.service';
import { PushService } from '../push/push.service';

/**
 * 실시간 등급 승급 서비스 (2026-06-07 신설).
 *
 * 정책 요약:
 *  - 상담 종료 시 당월 누적 상담시간을 재산정하여, 다음 등급 임계값을 넘으면 즉시 승급.
 *  - 복수 단계 승급 허용 (예: 파트너3 → 파트너5).
 *  - 강등은 이 서비스에서 하지 않음 — 강등은 매월 1일 grade-cron 전용.
 *  - 단가 변경 락(unit_cost_changeable_at) 즉시 해제 → 승급 후 바로 새 단가 선택 가능.
 *  - 실패해도 상담 처리에 영향 없음 (void 호출).
 *
 * 이력:
 *  - member_grade_history.changed_by = 'realtime'  ← 실시간 승급 식별자
 *  - member_grade_history.last_month_seconds = 당월 누적 초 (월 크론과 달리 "전월" 아님)
 */

const GRADE_ORDER = [
  'preliminary',
  'partner1',
  'partner2',
  'partner3',
  'partner4',
  'partner5',
] as const;

type Grade = typeof GRADE_ORDER[number];

const GRADE_LABEL: Record<Grade, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
};

function gradeRank(g: string): number {
  const idx = GRADE_ORDER.indexOf(g as Grade);
  return idx < 0 ? 0 : idx;
}

@Injectable()
export class GradeUpgradeService {
  private readonly logger = new Logger(GradeUpgradeService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
    private readonly push: PushService,
  ) {}

  /**
   * 상담 종료 후 실시간 등급 승급 체크 및 실행.
   *
   * - void 호출 전용 — 실패해도 상담 처리(m2net-push) 롤백 없음.
   * - pg_advisory_xact_lock 으로 동시 실행 직렬화.
   */
  async checkAndUpgrade(counselorId: number): Promise<void> {
    try {
      await this.sql.begin(async (tx) => {
        // 동시성 락 — grade-cron / forceGrade / 단가 변경 API 와 동일 키(7777003)
        await tx`SELECT pg_advisory_xact_lock(7777003, ${counselorId})`;

        // 현재 상태 조회 (FOR UPDATE 행 잠금)
        const memberRows = await tx<{
          id: number;
          mb_id: string | null;
          grade: string;
          nickname: string | null;
          phone: string | null;
        }[]>`
          SELECT id, mb_id, grade, nickname, phone
            FROM member
           WHERE id = ${counselorId}
             AND role = 'counselor'
             AND left_at IS NULL
           FOR UPDATE
           LIMIT 1
        `;
        if (memberRows.length === 0) return;
        const m = memberRows[0];

        // 이미 최고 등급이면 종료
        if (gradeRank(m.grade) >= 5) return;

        // 당월 범위 (KST 자정 기준)
        const { startday, endday } = this.currentMonthRange();

        // 당월 누적 상담 시간 (초) — 정상 종료된 통화만
        const sumRow = await tx<{ total_seconds: string }[]>`
          SELECT COALESCE(SUM(usetm), 0)::text AS total_seconds
            FROM consultation
           WHERE counselor_id = ${counselorId}
             AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
             AND created_at >= ${startday}
             AND created_at <  ${endday}
        `;
        const totalSeconds = Number(sumRow[0]?.total_seconds ?? 0);
        const totalHours = totalSeconds / 3600;

        // 정책 임계값 로드 (setting 테이블)
        const thresholds = await this.loadThresholds();

        // 달성 가능한 최고 등급 산출
        const targetGrade = this.computeTargetGrade(totalHours, thresholds);
        const targetRank = gradeRank(targetGrade);
        const currentRank = gradeRank(m.grade);

        // 현재보다 높지 않으면 종료
        if (targetRank <= currentRank) return;

        const gradeLabel = GRADE_LABEL[targetGrade as Grade] ?? targetGrade;
        const hoursStr = String(Math.round(totalHours * 10) / 10);

        // 승급 실행:
        //   - grade 변경
        //   - unit_cost_changeable_at = NULL (즉시 단가 변경 허용)
        await tx`
          UPDATE member
             SET grade                   = ${targetGrade},
                 unit_cost_changeable_at = NULL
           WHERE id = ${counselorId}
        `;

        // 이력 기록 — changed_by='realtime' 으로 월 크론 이력과 구분
        await tx`
          INSERT INTO member_grade_history
            (member_id, grade_before, grade_after, last_month_seconds, change_type, changed_by, reason)
          VALUES
            (${counselorId}, ${m.grade}, ${targetGrade}, ${totalSeconds},
             'promote', 'realtime',
             ${'당월 누적 ' + hoursStr + '시간 달성 → 즉시 승급'})
        `;

        this.logger.log(
          `[grade-upgrade] realtime 승급: mb_id=${m.mb_id} ` +
          `${m.grade} → ${targetGrade} (${hoursStr}시간)`,
        );

        // ── 인앱 알림 ──────────────────────────────────────────────────────
        // [2026-06-07] 메모리 큐 폴링 → 출석 토스트 방식으로 전환.
        //   member_grade_history(changed_by='realtime', notified_at IS NULL) 자체가 "미확인 승급" 진실원.
        //   클라가 상담 종료/진입 시 consumePendingUpgrade() 로 조회 → 토스트 1회 표시 → notified_at 마킹.
        //   별도 enqueue 불필요 (위 INSERT 의 notified_at NULL 이 곧 알림 대기 상태).
        const phone = m.phone;
        const nickname = m.nickname;

        // FCM 포그라운드 인앱 배너 — 앱이 켜져 있으면 즉시 배너로 표시 (App.tsx InAppNotification)
        // member_push_token 에서 해당 상담사의 활성 FCM 토큰 조회 후 발송
        setImmediate(async () => {
          try {
            const tokenRows = await this.sql<{ token: string }[]>`
              SELECT token FROM member_push_token
               WHERE member_id = ${counselorId}
                 AND token IS NOT NULL
               LIMIT 10
            `;
            if (tokenRows.length > 0) {
              await this.push.sendToTokens(
                tokenRows.map((r) => r.token),
                {
                  title: `🎉 ${gradeLabel}로 승급되었습니다!`,
                  body: `당월 ${hoursStr}시간 달성으로 즉시 승급됐어요. 단가를 변경하세요.`,
                  data: {
                    event_url: '/counselor/mypage',
                    type: 'grade_upgraded',
                    new_grade: targetGrade,
                  },
                },
              );
              this.logger.log(`[grade-upgrade] FCM 발송: counselorId=${counselorId} ${targetGrade}`);
            }
          } catch (e) {
            this.logger.warn(`[grade-upgrade] FCM 발송 실패: ${(e as Error).message}`);
          }

          // 알림톡 — 앱 밖에 있는 경우 카카오톡으로 도달
          if (phone) {
            void this.sms.sendAlimtalkByCode('counselor_grade_upgraded', phone, {
              counselor_name: nickname ?? m.mb_id ?? '상담사',
              new_grade: gradeLabel,
              hours: hoursStr,
            });
          }
        });
      });
    } catch (e) {
      this.logger.error(
        `[grade-upgrade] 실패 counselorId=${counselorId}: ${(e as Error).message}`,
      );
    }
  }

  /**
   * 미확인 실시간 승급 1건을 꺼내고 마킹 (출석 토스트 방식).
   *
   * - 클라가 상담 종료 직후 / 마이페이지 진입 / 로그인 시 호출.
   * - changed_by='realtime' AND notified_at IS NULL 중 가장 최근(최종 등급) 1건 반환.
   * - 같은 회원의 미확인 건은 전부 한 번에 notified_at 마킹 → 복수 단계 승급도 1회만 노출.
   * - 없으면 null. (출석 checkin 과 동일하게 "방금 일어난 일"을 1회 전달)
   */
  async consumePendingUpgrade(memberId: number): Promise<{
    grade_after: string;
    grade_label: string;
    hours: string;
    upgraded_at: string;
  } | null> {
    if (!memberId || memberId <= 0) return null;
    return await this.sql.begin(async (tx) => {
      const rows = await tx<
        { id: string; grade_after: string; last_month_seconds: string; created_at: string }[]
      >`
        SELECT id, grade_after, last_month_seconds, created_at
          FROM member_grade_history
         WHERE member_id = ${memberId}
           AND change_type = 'promote'
           AND changed_by = 'realtime'
           AND notified_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return null;
      const r = rows[0];
      // 해당 회원의 미확인 realtime 승급 전부 마킹 (복수 단계 누적분 한 번에 소비)
      await tx`
        UPDATE member_grade_history
           SET notified_at = NOW()
         WHERE member_id = ${memberId}
           AND change_type = 'promote'
           AND changed_by = 'realtime'
           AND notified_at IS NULL
      `;
      const grade = r.grade_after as Grade;
      const hours = (Number(r.last_month_seconds) / 3600).toFixed(1);
      return {
        grade_after: grade,
        grade_label: GRADE_LABEL[grade] ?? grade,
        hours,
        upgraded_at: r.created_at,
      };
    });
  }

  /**
   * 현재 등급에서 시간 기준 달성 가능한 최고 등급.
   * - 현재 등급보다 낮으면 현재 등급 반환 (강등 없음).
   */
  private computeTargetGrade(
    hours: number,
    thresholds: Record<'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5', number>,
  ): string {
    if (hours >= thresholds.partner5) return 'partner5';
    if (hours >= thresholds.partner4) return 'partner4';
    if (hours >= thresholds.partner3) return 'partner3';
    if (hours >= thresholds.partner2) return 'partner2';
    if (hours >= thresholds.partner1) return 'partner1';
    return 'preliminary';
  }

  private async loadThresholds(): Promise<
    Record<'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5', number>
  > {
    // setting 은 읽기 전용 참조 — 트랜잭션 밖에서 this.sql 로 조회해도 안전
    const rows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'grade' AND key LIKE 'thresholds.%'
    `;
    const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
    return {
      partner1: map.get('thresholds.partner1') ?? 20,
      partner2: map.get('thresholds.partner2') ?? 40,
      partner3: map.get('thresholds.partner3') ?? 70,
      partner4: map.get('thresholds.partner4') ?? 90,
      partner5: map.get('thresholds.partner5') ?? 120,
    };
  }

  // ──────────────────────────────────────────────────────────────

  /**
   * 당월 누적 상담시간 및 다음 등급까지 진행 상황.
   * 상담사 마이페이지 프로그레스 바 전용.
   */
  async getCurrentMonthProgress(counselorId: number): Promise<{
    total_seconds: number;
    total_hours: number;
    grade: string;
    grade_label: string;
    next_grade: string | null;
    next_grade_label: string | null;
    next_threshold_hours: number | null;
    progress_pct: number;
    realtime_upgrades_this_month: Array<{
      grade_before: string;
      grade_after: string;
      hours_at_upgrade: number;
      changed_at: string;
    }>;
  }> {
    const { startday, endday } = this.currentMonthRange();

    const [memberRows, sumRows, upgradeRows] = await Promise.all([
      this.sql<{ grade: string }[]>`
        SELECT grade FROM member WHERE id = ${counselorId} LIMIT 1
      `,
      this.sql<{ total_seconds: string }[]>`
        SELECT COALESCE(SUM(usetm), 0)::text AS total_seconds
          FROM consultation
         WHERE counselor_id = ${counselorId}
           AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
           AND created_at >= ${startday}
           AND created_at <  ${endday}
      `,
      this.sql<{
        grade_before: string | null;
        grade_after: string;
        last_month_seconds: string | null;
        created_at: string;
      }[]>`
        SELECT grade_before, grade_after, last_month_seconds::text, created_at::text
          FROM member_grade_history
         WHERE member_id = ${counselorId}
           AND changed_by = 'realtime'
           AND created_at >= ${startday}
           AND created_at <  ${endday}
         ORDER BY created_at ASC
      `,
    ]);

    const grade = (memberRows[0]?.grade ?? 'preliminary') as Grade;
    const totalSeconds = Number(sumRows[0]?.total_seconds ?? 0);
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;

    const thresholds = await this.loadThresholds();
    const rank = gradeRank(grade);
    const nextGrade = rank < 5 ? (GRADE_ORDER[rank + 1] as Grade) : null;
    const nextThresholdHours = nextGrade
      ? (thresholds[nextGrade as keyof typeof thresholds] ?? null)
      : null;

    const progressPct = nextThresholdHours
      ? Math.min(100, Math.round((totalHours / nextThresholdHours) * 100))
      : 100;

    return {
      total_seconds: totalSeconds,
      total_hours: totalHours,
      grade,
      grade_label: GRADE_LABEL[grade] ?? grade,
      next_grade: nextGrade,
      next_grade_label: nextGrade ? (GRADE_LABEL[nextGrade] ?? nextGrade) : null,
      next_threshold_hours: nextThresholdHours,
      progress_pct: progressPct,
      realtime_upgrades_this_month: upgradeRows.map((r) => ({
        grade_before: r.grade_before ?? 'preliminary',
        grade_after: r.grade_after,
        hours_at_upgrade: Math.round((Number(r.last_month_seconds ?? 0) / 3600) * 10) / 10,
        changed_at: r.created_at,
      })),
    };
  }

  // ──────────────────────────────────────────────────────────────

  /** 당월 시작/종료 범위 (KST 자정 → UTC ISO). */
  currentMonthRange(): { startday: string; endday: string } {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth();
    const startKst = new Date(Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000);
    const endKst = new Date(Date.UTC(y, m + 1, 1) - 9 * 60 * 60 * 1000);
    return { startday: startKst.toISOString(), endday: endKst.toISOString() };
  }
}
