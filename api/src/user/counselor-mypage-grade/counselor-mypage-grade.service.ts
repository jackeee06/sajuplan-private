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

/** 실시간 상담수수료 표 — 등급 1행 (단가 옵션별 시간당 상담료 포함) */
export interface FeeScheduleRow {
  grade: Grade;
  grade_label: string;
  /** 승급 임계값(당월 누적 시간). 예비파트너는 0 */
  threshold_hours: number;
  /** 정산률 0~1 (예: 0.40) */
  revenue_rate: number;
  /** 해당 등급에서 선택 가능한 30초당 고객이용료 옵션 + 시간당 상담료(상담사 수익) */
  options: Array<{
    /** 30초당 고객이용료(원) */
    customer_fee: number;
    /** 시간당 상담료 = 고객이용료 × 120(30초/시간) × 정산률, 반올림 */
    hourly_earning: number;
  }>;
}

/** 등급별 기본 임계값(시간) — setting 누락 시 폴백 */
const DEFAULT_THRESHOLDS: Record<Exclude<Grade, 'preliminary'>, number> = {
  partner1: 20,
  partner2: 40,
  partner3: 70,
  partner4: 90,
  partner5: 120,
};

/** 등급별 기본 정산률 — setting 누락 시 폴백 (handbook counselor/02-grade-pricing 기준) */
const DEFAULT_REVENUE_RATE: Record<Grade, number> = {
  preliminary: 0.4,
  partner1: 0.52,
  partner2: 0.56,
  partner3: 0.6,
  partner4: 0.63,
  partner5: 0.7,
};

/** 등급별 기본 단가 옵션 — setting 누락 시 폴백 */
const DEFAULT_OPTIONS: Record<Grade, number[]> = {
  preliminary: [800, 1000],
  partner1: [800, 1000],
  partner2: [1000, 1200],
  partner3: [1000, 1200, 1300, 1400],
  partner4: [1000, 1200, 1300, 1400, 1500],
  partner5: [1200, 1300, 1400, 1500, 1800, 2000],
};

const GRADE_ORDER: Grade[] = [
  'preliminary',
  'partner1',
  'partner2',
  'partner3',
  'partner4',
  'partner5',
];

/** 1시간 = 30초 단위 120개 */
const UNITS_PER_HOUR = 120;

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

  /**
   * 실시간 상담수수료 표 — 전 등급 정책을 한 번에 조회.
   *
   * setting(namespace='grade')의 thresholds.*, options.<grade>, revenue_rate.<grade>
   * 를 모두 읽어 등급별 표를 구성한다. 누락 시 핸드북 기준 폴백값 사용.
   *
   * 시간당 상담료(상담사 수익) = 고객이용료(30초당) × 120 × 정산률.
   * 로그인한 사용자라면 누구나 조회 가능 (공개 정보).
   */
  async getFeeSchedule(): Promise<FeeScheduleRow[]> {
    const rows = await this.sql<{ key: string; value: string }[]>`
      SELECT key, value FROM setting WHERE namespace = 'grade'
    `;
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return GRADE_ORDER.map((grade) => {
      // 임계값 (예비파트너는 0)
      const threshold =
        grade === 'preliminary'
          ? 0
          : Number(
              map.get(`thresholds.${grade}`) ??
                DEFAULT_THRESHOLDS[grade as Exclude<Grade, 'preliminary'>],
            );

      // 정산률 — 0~1 범위 검증, 벗어나면 폴백
      const rawRate = Number(map.get(`revenue_rate.${grade}`));
      const revenueRate =
        Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 1
          ? rawRate
          : DEFAULT_REVENUE_RATE[grade];

      // 단가 옵션 — 없으면 폴백
      const parsed = this.parseOptions(map.get(`options.${grade}`));
      const options = parsed.length > 0 ? parsed : DEFAULT_OPTIONS[grade];

      return {
        grade,
        grade_label: GRADE_LABEL[grade],
        threshold_hours: Number.isFinite(threshold) ? threshold : 0,
        revenue_rate: revenueRate,
        options: options.map((customerFee) => ({
          customer_fee: customerFee,
          hourly_earning: Math.round(customerFee * UNITS_PER_HOUR * revenueRate),
        })),
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
