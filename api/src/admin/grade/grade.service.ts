import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 어드민 — 등급/단가 운영 도구 (Phase 8).
 *
 * 책임:
 *  - 상담사별 등급/단가/이력 조회
 *  - 어드민 강제 등급/단가 수정 (분쟁/예외 대응)
 *  - 등급 분포 통계
 *  - 최근 등급/단가 변동 리포트
 */
export type Grade =
  | 'preliminary' | 'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5';

const VALID_GRADES: Grade[] = [
  'preliminary', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5',
];

const GRADE_LABEL: Record<Grade, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
};

@Injectable()
export class AdminGradeService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 상담사 등급/단가 상세 — 회원 상세 페이지에 표시할 모든 정보.
   */
  async getCounselorGradeDetail(memberId: number) {
    const memberRows = await this.sql<{
      id: number;
      mb_id: string | null;
      nickname: string | null;
      grade: Grade;
      last_month_seconds: string;
      call_070_unit_cost: number | null;
      chat_unit_cost: number | null;
      unit_cost_changeable_at: string | null;
      grade_recalculated_at: string | null;
    }[]>`
      SELECT id, mb_id, nickname, grade, last_month_seconds,
             call_070_unit_cost, chat_unit_cost,
             unit_cost_changeable_at::text, grade_recalculated_at::text
        FROM member
       WHERE id = ${memberId}
       LIMIT 1
    `;
    if (memberRows.length === 0) throw new NotFoundException('회원 없음');
    const m = memberRows[0];

    // 정책 옵션 조회
    const optRows = await this.sql<{ value: string }[]>`
      SELECT value FROM setting
       WHERE namespace = 'grade' AND key = ${`options.${m.grade}`}
       LIMIT 1
    `;
    const options = (optRows[0]?.value ?? '')
      .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);

    return {
      member: {
        id: m.id,
        mb_id: m.mb_id,
        nickname: m.nickname,
      },
      grade: m.grade,
      grade_label: GRADE_LABEL[m.grade] ?? m.grade,
      last_month_seconds: Number(m.last_month_seconds ?? 0),
      last_month_hours: Math.round(Number(m.last_month_seconds ?? 0) / 3600 * 100) / 100,
      current_unit_cost: Number(m.call_070_unit_cost ?? m.chat_unit_cost ?? 0),
      call_070_unit_cost: Number(m.call_070_unit_cost ?? 0),
      chat_unit_cost: Number(m.chat_unit_cost ?? 0),
      unit_cost_changeable_at: m.unit_cost_changeable_at,
      grade_recalculated_at: m.grade_recalculated_at,
      available_options: options,
    };
  }

  /** 단가 변경 이력 */
  async getUnitCostHistory(memberId: number, limit = 50) {
    const lim = Math.min(200, Math.max(1, limit));
    return await this.sql<Array<{
      id: number;
      grade_at_change: string;
      unit_cost_before: number | null;
      unit_cost_after: number | null;
      changed_by: string;
      reason: string | null;
      created_at: string;
    }>>`
      SELECT id, grade_at_change, unit_cost_before, unit_cost_after,
             changed_by, reason, created_at::text
        FROM member_unit_cost_history
       WHERE member_id = ${memberId}
       ORDER BY id DESC
       LIMIT ${lim}
    `;
  }

  /** 등급 변동 이력 */
  async getGradeHistory(memberId: number, limit = 50) {
    const lim = Math.min(200, Math.max(1, limit));
    return await this.sql<Array<{
      id: number;
      grade_before: string | null;
      grade_after: string;
      last_month_seconds: string | null;
      change_type: string;
      changed_by: string;
      reason: string | null;
      created_at: string;
    }>>`
      SELECT id, grade_before, grade_after, last_month_seconds::text,
             change_type, changed_by, reason, created_at::text
        FROM member_grade_history
       WHERE member_id = ${memberId}
       ORDER BY id DESC
       LIMIT ${lim}
    `;
  }

  /**
   * 어드민 강제 등급 변경 (예외 대응).
   *
   * 정상 흐름은 매월 1일 크론. 이건 수동 개입용.
   * 변경 시 unit_cost_changeable_at 도 NULL 로 리셋해 상담사가 새 옵션 선택 가능.
   */
  async forceGrade(
    memberId: number,
    newGrade: Grade,
    adminId: number,
    reason: string,
  ) {
    if (!VALID_GRADES.includes(newGrade)) {
      throw new BadRequestException('잘못된 grade');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('reason 필수 — 분쟁 시 증거');
    }

    return await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(7777003, ${memberId})`;

      const before = await tx<{ grade: Grade }[]>`
        SELECT grade FROM member WHERE id = ${memberId} FOR UPDATE
      `;
      if (before.length === 0) throw new NotFoundException('회원 없음');
      const gradeBefore = before[0].grade;
      if (gradeBefore === newGrade) {
        return { ok: true, unchanged: true, grade: newGrade };
      }

      await tx`
        UPDATE member
           SET grade = ${newGrade},
               grade_recalculated_at = NOW(),
               unit_cost_changeable_at = NULL
         WHERE id = ${memberId}
      `;
      await tx`
        INSERT INTO member_grade_history
          (member_id, grade_before, grade_after, last_month_seconds, change_type, changed_by, reason)
        VALUES
          (${memberId}, ${gradeBefore}, ${newGrade}, NULL, 'manual', ${`admin:${adminId}`}, ${reason})
      `;
      return { ok: true, unchanged: false, grade_before: gradeBefore, grade_after: newGrade };
    });
  }

  /**
   * 어드민 강제 단가 수정.
   *
   * 정책 옵션 외 값도 허용 (예외 대응). 일반 self-service API 와 다른 점.
   * call_070 / chat 양쪽 동일값.
   */
  async forceUnitCost(
    memberId: number,
    newUnitCost: number,
    adminId: number,
    reason: string,
  ) {
    if (!Number.isFinite(newUnitCost) || newUnitCost < 0) {
      throw new BadRequestException('단가가 올바르지 않습니다.');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('reason 필수 — 분쟁 시 증거');
    }

    return await this.sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(7777003, ${memberId})`;

      const before = await tx<{
        grade: Grade;
        call_070_unit_cost: number | null;
        chat_unit_cost: number | null;
      }[]>`
        SELECT grade, call_070_unit_cost, chat_unit_cost
          FROM member WHERE id = ${memberId} FOR UPDATE
      `;
      if (before.length === 0) throw new NotFoundException('회원 없음');
      const m = before[0];
      const oldUnit = Number(m.call_070_unit_cost ?? m.chat_unit_cost ?? 0);

      await tx`
        UPDATE member
           SET call_070_unit_cost = ${newUnitCost},
               chat_unit_cost = ${newUnitCost}
         WHERE id = ${memberId}
      `;
      await tx`
        INSERT INTO member_unit_cost_history
          (member_id, grade_at_change, unit_cost_before, unit_cost_after, changed_by, reason)
        VALUES
          (${memberId}, ${m.grade}, ${oldUnit}, ${newUnitCost}, ${`admin:${adminId}`}, ${reason})
      `;
      return { ok: true, unit_cost_before: oldUnit, unit_cost_after: newUnitCost };
    });
  }

  /** 등급별 상담사 분포 (대시보드/필터용). level=5 + left_at IS NULL 기준. */
  async getDistribution() {
    const rows = await this.sql<{ grade: string; cnt: string }[]>`
      SELECT grade, COUNT(*)::text AS cnt
        FROM member
       WHERE level = 5 AND left_at IS NULL
       GROUP BY grade
       ORDER BY grade
    `;
    // 누락 등급은 0 으로 채우기
    const map = new Map(rows.map((r) => [r.grade, Number(r.cnt)]));
    return VALID_GRADES.map((g) => ({
      grade: g,
      grade_label: GRADE_LABEL[g],
      count: map.get(g) ?? 0,
    }));
  }

  /**
   * 최근 등급 변동 (대시보드 시그널).
   * cron / manual 모두 포함. 최근 50건.
   */
  async getRecentChanges(limit = 50) {
    const lim = Math.min(200, Math.max(1, limit));
    return await this.sql<Array<{
      id: number;
      member_id: number;
      mb_id: string | null;
      nickname: string | null;
      grade_before: string | null;
      grade_after: string;
      change_type: string;
      changed_by: string;
      created_at: string;
    }>>`
      SELECT h.id, h.member_id, m.mb_id, m.nickname,
             h.grade_before, h.grade_after, h.change_type, h.changed_by,
             h.created_at::text
        FROM member_grade_history h
        JOIN member m ON m.id = h.member_id
       ORDER BY h.id DESC
       LIMIT ${lim}
    `;
  }
}
