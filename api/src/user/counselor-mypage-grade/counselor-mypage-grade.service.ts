import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 등급/단가 시스템 — 상담사 마이페이지 self-service.
 *
 * 명세: _NEXT_SESSION_등급단가시스템.md (F 섹션)
 *
 * 안전장치:
 *   - 트랜잭션: 단가 변경 + 락 + 이력 한 번에 (롤백 안전망)
 *   - 동시성: pg_advisory_xact_lock(7777003, memberId) — 같은 회원 동시 변경 직렬화
 *   - 락 체크: unit_cost_changeable_at 검증 — null OR <= now() 일 때만 허용
 *   - 정책 외 단가 거부 (CHECK 추가로 더블 방어)
 *   - call/chat 통합: 양 컬럼에 동일값 INSERT (legacy 코드 호환)
 *   - KST 기준: 다음 변경 가능 = 다음 달 1일 0시 KST → UTC 변환 저장
 */
export type Grade =
  | 'preliminary'
  | 'partner1'
  | 'partner2'
  | 'partner3'
  | 'partner4'
  | 'partner5';

const GRADE_LABEL: Record<Grade, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
};

export interface MyGradeInfo {
  grade: Grade;
  grade_label: string;
  last_month_seconds: number;
  current_unit_cost: number;
  available_options: number[];
  /** null = 즉시 변경 가능 */
  changeable_at: string | null;
  /** UI 표시용 한국시간 (YYYY-MM-DD) */
  next_change_date_kst: string | null;
  /** 현재 즉시 변경 가능한지 */
  can_change_now: boolean;
  /** 락 해제까지 남은 일수 (음수=가능) */
  days_until_unlock: number | null;
}

@Injectable()
export class UserCounselorMypageGradeService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 내 등급/단가 조회.
   */
  async getMine(memberId: number): Promise<MyGradeInfo> {
    const rows = await this.sql<{
      grade: Grade;
      last_month_seconds: string;
      call_070_unit_cost: number | null;
      chat_unit_cost: number | null;
      unit_cost_changeable_at: string | null;
    }[]>`
      SELECT grade, last_month_seconds, call_070_unit_cost, chat_unit_cost, unit_cost_changeable_at
        FROM member
       WHERE id = ${memberId}
       LIMIT 1
    `;
    if (rows.length === 0) {
      throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
    }
    const m = rows[0];
    const grade = (m.grade ?? 'preliminary') as Grade;
    const options = await this.getOptionsForGrade(grade);

    // 통합 단가 정책: call_070 우선, 없으면 chat 사용
    const currentUnitCost = Number(m.call_070_unit_cost ?? m.chat_unit_cost ?? 0);

    const changeableAt = m.unit_cost_changeable_at;
    const nowMs = Date.now();
    const changeableMs = changeableAt ? new Date(changeableAt).getTime() : 0;
    const canChangeNow = !changeableAt || changeableMs <= nowMs;
    const daysUntilUnlock = changeableAt
      ? Math.ceil((changeableMs - nowMs) / (24 * 60 * 60 * 1000))
      : null;

    return {
      grade,
      grade_label: GRADE_LABEL[grade],
      last_month_seconds: Number(m.last_month_seconds ?? 0),
      current_unit_cost: currentUnitCost,
      available_options: options,
      changeable_at: changeableAt,
      next_change_date_kst: changeableAt ? this.toKstDate(changeableAt) : null,
      can_change_now: canChangeNow,
      days_until_unlock: daysUntilUnlock,
    };
  }

  /**
   * 단가 변경.
   *
   * 모든 검증 + 변경 + 이력을 단일 트랜잭션 + advisory lock 으로 보호.
   */
  async changeUnitCost(params: {
    memberId: number;
    newUnitCost: number;
    reason?: string;
  }): Promise<{ ok: true; new_unit_cost: number; next_changeable_at: string }> {
    const { memberId, newUnitCost, reason } = params;
    if (!Number.isFinite(newUnitCost) || newUnitCost <= 0) {
      throw new BadRequestException('단가가 올바르지 않습니다.');
    }

    return await this.sql.begin(async (tx) => {
      // 1. 동시성 락 — 같은 회원 동시 변경 직렬화
      await tx`SELECT pg_advisory_xact_lock(7777003, ${memberId})`;

      // 2. 현재 상태 조회 (행 잠금)
      const memberRows = await tx<{
        id: number;
        role: string | null;
        grade: Grade;
        call_070_unit_cost: number | null;
        chat_unit_cost: number | null;
        unit_cost_changeable_at: string | null;
      }[]>`
        SELECT id, role, grade, call_070_unit_cost, chat_unit_cost, unit_cost_changeable_at
          FROM member
         WHERE id = ${memberId}
         FOR UPDATE
      `;
      if (memberRows.length === 0) {
        throw new BadRequestException('회원 정보를 찾을 수 없습니다.');
      }
      const m = memberRows[0];

      // 3. 상담사 권한 검증
      if (m.role !== 'counselor') {
        throw new ForbiddenException('상담사만 단가를 변경할 수 있습니다.');
      }

      // 4. 락 체크 (DB 시각 기준 — 클라이언트 시계 신뢰 X)
      const lockRows = await tx<{ locked: boolean }[]>`
        SELECT (${m.unit_cost_changeable_at}::timestamptz IS NOT NULL
                AND ${m.unit_cost_changeable_at}::timestamptz > NOW()) AS locked
      `;
      if (lockRows[0]?.locked) {
        throw new BadRequestException(
          '단가 변경 가능 일자가 아닙니다. 매월 1일 또는 신규 가입 직후에만 변경할 수 있습니다.',
        );
      }

      // 5. 정책 외 단가 거부 (tx 안에서 setting 조회)
      const optionRows = await tx<{ value: string }[]>`
        SELECT value FROM setting
         WHERE namespace = 'grade' AND key = ${`options.${m.grade}`}
         LIMIT 1
      `;
      const options = this.parseOptions(optionRows[0]?.value);
      if (!options.includes(newUnitCost)) {
        throw new BadRequestException(
          `현재 등급(${GRADE_LABEL[m.grade]})에서 선택 가능한 단가가 아닙니다. (가능: ${options.join(', ')}원)`,
        );
      }

      const oldUnitCost = Number(m.call_070_unit_cost ?? m.chat_unit_cost ?? 0);

      // 6. 다음 변경 가능 시각 = 다음 달 1일 0시 KST
      //    KST = UTC+9. SQL 에서 timezone-safe 하게 계산.
      const nextChangeableRows = await tx<{ next_at: string }[]>`
        SELECT (date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul')
                + interval '1 month') AT TIME ZONE 'Asia/Seoul' AS next_at
      `;
      const nextChangeableAt = nextChangeableRows[0].next_at;

      // 7. UPDATE — call/chat 양쪽 동일값
      await tx`
        UPDATE member
           SET call_070_unit_cost = ${newUnitCost},
               chat_unit_cost = ${newUnitCost},
               unit_cost_changeable_at = ${nextChangeableAt}
         WHERE id = ${memberId}
      `;

      // 8. 이력 INSERT
      await tx`
        INSERT INTO member_unit_cost_history
          (member_id, grade_at_change, unit_cost_before, unit_cost_after, changed_by, reason)
        VALUES
          (${memberId}, ${m.grade}, ${oldUnitCost}, ${newUnitCost}, 'self', ${reason ?? null})
      `;

      return {
        ok: true as const,
        new_unit_cost: newUnitCost,
        next_changeable_at: nextChangeableAt,
      };
    });
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────

  private async getOptionsForGrade(grade: Grade): Promise<number[]> {
    const rows = await this.sql<{ value: string }[]>`
      SELECT value FROM setting
       WHERE namespace = 'grade' AND key = ${`options.${grade}`}
       LIMIT 1
    `;
    return this.parseOptions(rows[0]?.value);
  }

  private parseOptions(raw: string | undefined): number[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  /** ISO timestamp → KST 'YYYY-MM-DD' 변환 */
  private toKstDate(iso: string): string {
    const d = new Date(iso);
    // KST = UTC+9
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }
}
