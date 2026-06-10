import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';

/**
 * 매월 1일 등급 재산정 cron.
 *
 * 명세: _NEXT_SESSION_등급단가시스템.md F.2
 *
 * 흐름 (전월 기준):
 *   1) setting 정책 로드 (thresholds.* + demote_step_max)
 *   2) 상담사 (level=5, left_at IS NULL) 전원 순회
 *   3) consultation.usetm 합산 (직전 1개월, reason IN ('DISCONNECT','END_CHAT','END_CHAT_LOCAL'))
 *   4) 시간 기준 새 등급 산정
 *   5) 강등은 한 단계씩만 (demote_step_max=1)
 *   6) UPDATE member + INSERT member_grade_history (변동 시) + unit_cost_changeable_at=NULL
 *      → 등급 변동 직후 단가 1회 선택 가능 (월 1일 락 해제)
 *
 * 멱등성:
 *   - grade_recalculated_at >= 당월 1일 0시(KST) 면 skip (같은 달 두 번 안 돌게)
 *   - testOnly=true 면 DB 변경 0
 *
 * 동시성: pg_advisory_xact_lock(7777003, memberId) — 단가 변경 API 와 같은 키 (직렬화)
 */
@Injectable()
export class GradeCronService {
  private readonly logger = new Logger(GradeCronService.name);

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 등급 재산정.
   * @param month   YYYY-MM. 직전 1개월 산정 대상. 생략 시 전월(KST).
   * @param testOnly true 면 dry-run (DB 변경 0).
   * @param mbId    특정 상담사만 (테스트용).
   */
  async recalculate(month?: string, testOnly = false, mbId?: string) {
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : this.prevMonthKst();
    const range = this.monthRange(targetMonth);
    const thisMonthStart = this.thisMonthStartKst();

    // 정책 로드
    const policy = await this.loadPolicy();
    this.logger.log(`[grade-cron] month=${targetMonth} range=${range.startday}~${range.endday} test=${testOnly}`);

    // [role/level 정리] level=5 → role='counselor' 통일 (이중 진실원천 제거)
    const counselors = mbId
      ? await this.sql<{ id: number; mb_id: string | null; grade: string; call_070_unit_cost: number | null; chat_unit_cost: number | null; grade_recalculated_at: string | null }[]>`
          SELECT id, mb_id, grade, call_070_unit_cost, chat_unit_cost, grade_recalculated_at FROM member
           WHERE role = 'counselor' AND left_at IS NULL AND mb_id = ${mbId}
           LIMIT 1
        `
      : await this.sql<{ id: number; mb_id: string | null; grade: string; call_070_unit_cost: number | null; chat_unit_cost: number | null; grade_recalculated_at: string | null }[]>`
          SELECT id, mb_id, grade, call_070_unit_cost, chat_unit_cost, grade_recalculated_at FROM member
           WHERE role = 'counselor' AND left_at IS NULL
           ORDER BY id
        `;

    const results: Array<{
      memberId: number;
      mb_id: string | null;
      hours: number;
      seconds: number;
      grade_before: string;
      grade_after: string;
      change_type: 'promote' | 'demote' | 'unchanged' | 'skipped';
      unit_cost_before: number | null;
      unit_cost_after: number | null;
    }> = [];

    for (const c of counselors) {
      const res = await this.processCounselor({
        member: c,
        range,
        policy,
        thisMonthStart,
        testOnly,
      });
      results.push(res);
    }

    const summary = {
      month: targetMonth,
      test: testOnly,
      total: results.length,
      promoted: results.filter((r) => r.change_type === 'promote').length,
      demoted: results.filter((r) => r.change_type === 'demote').length,
      unchanged: results.filter((r) => r.change_type === 'unchanged').length,
      skipped: results.filter((r) => r.change_type === 'skipped').length,
    };

    this.logger.log(`[grade-cron] done: ${JSON.stringify(summary)}`);

    return { summary, items: results };
  }

  // ────────────────────────────────────────

  private async processCounselor(params: {
    member: { id: number; mb_id: string | null; grade: string; call_070_unit_cost: number | null; chat_unit_cost: number | null; grade_recalculated_at: string | null };
    range: { startday: string; endday: string };
    policy: ReturnType<typeof this.emptyPolicy>;
    thisMonthStart: string;
    testOnly: boolean;
  }) {
    const { member, range, policy, thisMonthStart, testOnly } = params;

    // 멱등성: 이번 달에 이미 재산정 했으면 skip
    if (
      !testOnly &&
      member.grade_recalculated_at &&
      new Date(member.grade_recalculated_at).getTime() >= new Date(thisMonthStart).getTime()
    ) {
      return {
        memberId: member.id,
        mb_id: member.mb_id,
        hours: 0,
        seconds: 0,
        grade_before: member.grade,
        grade_after: member.grade,
        change_type: 'skipped' as const,
        unit_cost_before: null,
        unit_cost_after: null,
      };
    }

    // 직전 1개월 합산 (정상 종료된 통화만)
    const sumRow = await this.sql<{ total_seconds: string }[]>`
      SELECT COALESCE(SUM(usetm), 0)::text AS total_seconds
        FROM consultation
       WHERE counselor_id = ${member.id}
         AND reason IN ('DISCONNECT', 'END_CHAT', 'END_CHAT_LOCAL')
         AND created_at >= ${range.startday}
         AND created_at <  ${range.endday}
    `;
    const seconds = Number(sumRow[0]?.total_seconds ?? 0);
    const hours = seconds / 3600;

    // 새 등급 계산
    const rawNewGrade = this.computeGradeFromHours(hours, policy.thresholds);
    const finalGrade = this.applyDemoteLimit(member.grade, rawNewGrade, policy.demoteStepMax);

    const changeType: 'promote' | 'demote' | 'unchanged' =
      finalGrade === member.grade
        ? 'unchanged'
        : this.gradeRank(finalGrade) > this.gradeRank(member.grade)
          ? 'promote'
          : 'demote';

    // 강등 시 단가 자동 조정 — 새 등급 허용 범위를 초과하면 새 등급의 최상위 단가로 자동 조정
    // (사장님 정책 2026-06-08: "묻지말고 자동으로 새 등급 최상위 단가로")
    // call_070_unit_cost / chat_unit_cost 는 항상 동일하게 유지하므로 대표값은 call_070 기준
    const currentUnitCost = Number(member.call_070_unit_cost ?? member.chat_unit_cost ?? 0);
    let adjustedUnitCost: number | null = null;
    if (changeType === 'demote' && currentUnitCost > 0) {
      const newGradeOptions = await this.loadGradeOptions(finalGrade);
      if (newGradeOptions.length > 0 && !newGradeOptions.includes(currentUnitCost)) {
        adjustedUnitCost = Math.max(...newGradeOptions);
        this.logger.log(
          `[grade-cron] 단가 자동 조정: memberId=${member.id} mb_id=${member.mb_id} ` +
          `${currentUnitCost}원 → ${adjustedUnitCost}원 (강등 ${member.grade}→${finalGrade})`,
        );
      }
    }

    if (testOnly) {
      return {
        memberId: member.id,
        mb_id: member.mb_id,
        hours: Math.round(hours * 100) / 100,
        seconds,
        grade_before: member.grade,
        grade_after: finalGrade,
        change_type: changeType,
        unit_cost_before: currentUnitCost || null,
        unit_cost_after: adjustedUnitCost,
      };
    }

    // 실제 반영 — 트랜잭션 + advisory lock
    await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(7777003, ${member.id})`;

      if (changeType === 'unchanged') {
        // 등급 동일: last_month_seconds 만 갱신 + 재산정 시각 마킹
        await tx`
          UPDATE member
             SET last_month_seconds = ${seconds},
                 grade_recalculated_at = NOW(),
                 unit_cost_changeable_at = NULL
           WHERE id = ${member.id}
        `;
      } else {
        // 등급 변동: 전체 갱신 + 이력 INSERT
        if (adjustedUnitCost !== null) {
          await tx`
            UPDATE member
               SET grade = ${finalGrade},
                   last_month_seconds = ${seconds},
                   grade_recalculated_at = NOW(),
                   unit_cost_changeable_at = NULL,
                   call_070_unit_cost = ${adjustedUnitCost},
                   chat_unit_cost = ${adjustedUnitCost}
             WHERE id = ${member.id}
          `;
        } else {
          await tx`
            UPDATE member
               SET grade = ${finalGrade},
                   last_month_seconds = ${seconds},
                   grade_recalculated_at = NOW(),
                   unit_cost_changeable_at = NULL
             WHERE id = ${member.id}
          `;
        }
        const reason = adjustedUnitCost !== null
          ? `monthly recalc (단가 자동조정 ${currentUnitCost}→${adjustedUnitCost}원)`
          : 'monthly recalc';
        await tx`
          INSERT INTO member_grade_history
            (member_id, grade_before, grade_after, last_month_seconds, change_type, changed_by, reason)
          VALUES
            (${member.id}, ${member.grade}, ${finalGrade}, ${seconds}, ${changeType}, 'cron', ${reason})
        `;
      }
    });

    return {
      memberId: member.id,
      mb_id: member.mb_id,
      hours: Math.round(hours * 100) / 100,
      seconds,
      grade_before: member.grade,
      grade_after: finalGrade,
      change_type: changeType,
      // 단가 자동 조정 결과 (testOnly=true 시에도 예상값 포함 — 검증용)
      unit_cost_before: currentUnitCost || null,
      unit_cost_after: adjustedUnitCost,  // null이면 조정 없음
    };
  }

  // ────── 등급 계산 헬퍼 ──────

  /**
   * 시간(시) 기준 등급 산정. 임계값 미만은 'preliminary'.
   * thresholds: { partner1: 20, partner2: 40, ... }
   */
  private computeGradeFromHours(
    hours: number,
    thresholds: { [k in 'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5']: number },
  ): string {
    if (hours >= thresholds.partner5) return 'partner5';
    if (hours >= thresholds.partner4) return 'partner4';
    if (hours >= thresholds.partner3) return 'partner3';
    if (hours >= thresholds.partner2) return 'partner2';
    if (hours >= thresholds.partner1) return 'partner1';
    return 'preliminary';
  }

  /**
   * 강등은 한 번에 최대 N 단계만 (demote_step_max).
   * 승급은 제약 없음 (한 달에 여러 단계 가능).
   */
  private applyDemoteLimit(current: string, computed: string, stepMax: number): string {
    const curRank = this.gradeRank(current);
    const compRank = this.gradeRank(computed);
    if (compRank >= curRank) return computed; // 승급/유지
    // 강등: max stepMax 단계만 떨어짐
    const targetRank = Math.max(compRank, curRank - stepMax);
    return this.rankToGrade(targetRank);
  }

  private gradeRank(g: string): number {
    switch (g) {
      case 'preliminary': return 0;
      case 'partner1': return 1;
      case 'partner2': return 2;
      case 'partner3': return 3;
      case 'partner4': return 4;
      case 'partner5': return 5;
      default: return 0;
    }
  }

  private rankToGrade(rank: number): string {
    return ['preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5'][
      Math.max(0, Math.min(5, rank))
    ];
  }

  // ────── 등급별 단가 옵션 로드 ──────

  /** setting 테이블에서 해당 등급의 허용 단가 목록을 조회. 오름차순 정렬. */
  private async loadGradeOptions(grade: string): Promise<number[]> {
    const rows = await this.sql<{ value: string }[]>`
      SELECT value FROM setting
       WHERE namespace = 'grade' AND key = ${'options.' + grade}
       LIMIT 1
    `;
    const raw = rows[0]?.value ?? '';
    return raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
  }

  // ────── 정책 로드 ──────

  private async loadPolicy() {
    const rows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting WHERE namespace = 'grade'
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      thresholds: {
        partner1: Number(map.get('thresholds.partner1') ?? 20),
        partner2: Number(map.get('thresholds.partner2') ?? 40),
        partner3: Number(map.get('thresholds.partner3') ?? 70),
        partner4: Number(map.get('thresholds.partner4') ?? 90),
        partner5: Number(map.get('thresholds.partner5') ?? 120),
      },
      demoteStepMax: Number(map.get('demote_step_max') ?? 1),
    };
  }

  private emptyPolicy() {
    return {
      thresholds: { partner1: 20, partner2: 40, partner3: 70, partner4: 90, partner5: 120 },
      demoteStepMax: 1,
    };
  }

  // ────── 시간 유틸 (KST) ──────

  /** 전월 YYYY-MM (KST 기준). */
  private prevMonthKst(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth();
    const prev = new Date(Date.UTC(y, m - 1, 1));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** 해당 월의 KST 자정 범위 → UTC ISO. */
  private monthRange(month: string) {
    const [y, m] = month.split('-').map((x) => Number(x));
    const startKst = new Date(Date.UTC(y, m - 1, 1) - 9 * 60 * 60 * 1000);
    const endKst = new Date(Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000);
    return {
      startday: startKst.toISOString(),
      endday: endKst.toISOString(),
    };
  }

  /** 당월 1일 0시(KST) 의 UTC ISO. 멱등성 검사용. */
  private thisMonthStartKst(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000);
    return start.toISOString();
  }
}
