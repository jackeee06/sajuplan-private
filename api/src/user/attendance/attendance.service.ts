import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 출석체크 서비스 (2026-05-16 Phase 1).
 *
 * 핵심 정책:
 *  - 1일 1회 자동 출석 (로그인 hook 에서 호출)
 *  - 회원/상담사 별도 정책 (setting.attendance.user.* / attendance.counselor.*)
 *  - 연속일 계산: 어제 출석 있으면 +1, 없으면 1로 리셋
 *  - 보너스: 5/10/15/20일에 추가 코인. 30일째 = 별도 쿠폰 금액 (현재는 코인으로 통합 지급 — TODO: 쿠폰 발급)
 *  - 안전장치: enabled 체크, 신규 회원 N일 제한, 일일 총 한도
 *
 * UNIQUE(member_id, attended_date) 제약으로 동시성 안전 — 중복 시도는 23505 로 자동 차단.
 *
 * 시간대: KST (Asia/Seoul) — 자정 기준 일자 변경.
 */

export type AttendanceTargetKind = 'user' | 'counselor';

export interface AttendancePolicy {
  enabled: boolean;
  day1: number;
  day5_bonus: number;
  day10_bonus: number;
  day15_bonus: number;
  day20_bonus: number;
  day30_coupon_amount: number;
  coupon_expire_days: number;
  daily_total_limit: number;
  min_signup_days: number;
  /** 같은 IP 하루 출석 가능한 최대 계정 수 (어뷰징 차단, 2026-05-16 Phase 3). 0 = 무제한 */
  ip_daily_limit: number;
}

export interface AttendanceResult {
  /** 오늘 처음 출석이었는지 (false 면 no-op: 이미 출석/비활성/제한 등) */
  attended_now: boolean;
  /** no-op 사유 — 'already' | 'disabled' | 'too_new' | 'limit_reached' | 'no_member' | null */
  skip_reason: string | null;
  /** 연속 출석 일수 (1~30+) */
  consecutive_days: number;
  /** 오늘 지급된 기본 코인 */
  base_coin: number;
  /** 오늘 지급된 보너스 코인 (5/10/15/20일) */
  bonus_coin: number;
  /** 30일째 발급된 쿠폰 금액 (현재는 코인으로 통합) */
  coupon_amount: number;
  /** 총 적립 금액 = base_coin + bonus_coin + coupon_amount */
  total_added: number;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 정책 조회 — setting.attendance.<target>.<key>.
   * 값 누락 시 안전한 기본값 사용 (모두 0 / 비활성).
   */
  async getPolicy(target: AttendanceTargetKind): Promise<AttendancePolicy> {
    const rows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting
       WHERE namespace = 'attendance'
         AND key LIKE ${`${target}.%`}
    `;
    const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
    const num = (k: string) => Number(map.get(`${target}.${k}`) ?? 0) || 0;
    return {
      enabled: (map.get(`${target}.enabled`) ?? 'false').toLowerCase() === 'true',
      day1: num('day1'),
      day5_bonus: num('day5_bonus'),
      day10_bonus: num('day10_bonus'),
      day15_bonus: num('day15_bonus'),
      day20_bonus: num('day20_bonus'),
      day30_coupon_amount: num('day30_coupon_amount'),
      coupon_expire_days: num('coupon_expire_days'),
      daily_total_limit: num('daily_total_limit'),
      min_signup_days: num('min_signup_days'),
      ip_daily_limit: num('ip_daily_limit'),
    };
  }

  /**
   * 출석 처리 — 로그인 시점에 호출.
   * 동일 시점 동시 호출 시에도 UNIQUE 제약 + ON CONFLICT DO NOTHING 으로 안전.
   */
  async checkIn(memberId: number, target: AttendanceTargetKind, ip?: string | null): Promise<AttendanceResult> {
    const policy = await this.getPolicy(target);

    // 1) 기능 비활성화
    if (!policy.enabled) {
      return this.skipResult('disabled');
    }

    // 2) 회원 정보 + 가입 N일 체크
    const meRows = await this.sql<{ created_at: Date; left_at: Date | null }[]>`
      SELECT created_at, left_at FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const me = meRows[0];
    if (!me || me.left_at) {
      return this.skipResult('no_member');
    }
    const signupAgeDays = Math.floor(
      (Date.now() - new Date(me.created_at).getTime()) / 86_400_000,
    );
    if (signupAgeDays < policy.min_signup_days) {
      return this.skipResult('too_new');
    }

    // 3) 어제 출석 여부로 consecutive_days 계산. KST 기준.
    //    DB 측에서 (now() AT TIME ZONE 'Asia/Seoul')::date 사용.
    const prev = await this.sql<{ attended_date: string; consecutive_days: number }[]>`
      SELECT attended_date::text, consecutive_days
        FROM member_attendance
       WHERE member_id = ${memberId}
       ORDER BY attended_date DESC
       LIMIT 1
    `;
    const today = await this.sql<{ today: string }[]>`
      SELECT (now() AT TIME ZONE 'Asia/Seoul')::date::text AS today
    `;
    const todayStr = today[0].today;
    let consecutive = 1;
    if (prev.length > 0) {
      if (prev[0].attended_date === todayStr) {
        // 이미 오늘 출석
        return this.skipResult('already', prev[0].consecutive_days);
      }
      // 어제 날짜 = today - 1
      const yesterday = await this.sql<{ y: string }[]>`
        SELECT (((now() AT TIME ZONE 'Asia/Seoul')::date - 1))::text AS y
      `;
      if (prev[0].attended_date === yesterday[0].y) {
        consecutive = prev[0].consecutive_days + 1;
      }
    }

    // 4) 보너스 계산
    const baseCoin = policy.day1;
    let bonusCoin = 0;
    if (consecutive === 5) bonusCoin = policy.day5_bonus;
    else if (consecutive === 10) bonusCoin = policy.day10_bonus;
    else if (consecutive === 15) bonusCoin = policy.day15_bonus;
    else if (consecutive === 20) bonusCoin = policy.day20_bonus;
    const couponAmount = consecutive === 30 ? policy.day30_coupon_amount : 0;
    const totalAdded = baseCoin + bonusCoin + couponAmount;

    // 5) 일일 총 한도 (안전장치)
    if (policy.daily_total_limit > 0) {
      const sumRows = await this.sql<{ s: string }[]>`
        SELECT COALESCE(SUM(base_coin + bonus_coin), 0)::text AS s
          FROM member_attendance
         WHERE target_kind = ${target}
           AND attended_date = ${todayStr}::date
      `;
      const todaySum = Number(sumRows[0]?.s ?? 0);
      if (todaySum + totalAdded > policy.daily_total_limit) {
        this.logger.warn(
          `[attendance] 일일 한도 초과 — target=${target} todaySum=${todaySum} request=${totalAdded} limit=${policy.daily_total_limit}`,
        );
        return this.skipResult('limit_reached', consecutive);
      }
    }

    // 5-1) IP 1일 한도 (Phase 3 안전장치, 2026-05-16) — 같은 IP 다중 계정 어뷰징 차단.
    //      ip 가 없거나 정책 0 이면 체크 안 함.
    if (ip && policy.ip_daily_limit > 0) {
      const ipRows = await this.sql<{ cnt: string }[]>`
        SELECT COUNT(DISTINCT member_id)::text AS cnt
          FROM member_attendance
         WHERE target_kind = ${target}
           AND attended_date = ${todayStr}::date
           AND ip = ${ip}::inet
      `;
      const ipCount = Number(ipRows[0]?.cnt ?? 0);
      if (ipCount >= policy.ip_daily_limit) {
        this.logger.warn(
          `[attendance] IP 한도 초과 — ip=${ip} target=${target} count=${ipCount} limit=${policy.ip_daily_limit}`,
        );
        return this.skipResult('ip_limit', consecutive);
      }
    }

    // 6) 트랜잭션: INSERT + point UPDATE
    //    UNIQUE 위반(23505) 발생 시 다른 곳에서 먼저 처리됨 → already 로 처리.
    try {
      await this.sql.begin(async (tx) => {
        await tx`
          INSERT INTO member_attendance
            (member_id, target_kind, attended_date, base_coin, bonus_coin, consecutive_days, ip)
          VALUES
            (${memberId}, ${target}, ${todayStr}::date, ${baseCoin}, ${bonusCoin}, ${consecutive}, ${ip ?? null}::inet)
        `;
        // member.point 누적 — 쿠폰 발급 전환 전까지는 30일 보상도 코인으로 합산.
        if (totalAdded > 0) {
          await tx`
            UPDATE member SET point = COALESCE(point, 0) + ${totalAdded}, updated_at = now()
             WHERE id = ${memberId}
          `;
        }
      });
    } catch (e: unknown) {
      // 동시성 UNIQUE 위반 — 이미 다른 요청이 처리
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === '23505') {
        return this.skipResult('already', consecutive);
      }
      throw e;
    }

    this.logger.log(
      `[attendance] OK member_id=${memberId} target=${target} day=${consecutive} ` +
        `base=${baseCoin} bonus=${bonusCoin} coupon=${couponAmount} total=${totalAdded}`,
    );

    return {
      attended_now: true,
      skip_reason: null,
      consecutive_days: consecutive,
      base_coin: baseCoin,
      bonus_coin: bonusCoin,
      coupon_amount: couponAmount,
      total_added: totalAdded,
    };
  }

  /**
   * 오늘 출석 상태 조회 — 마이페이지 위젯/모달 표시용.
   */
  async getToday(memberId: number): Promise<{
    attended_today: boolean;
    consecutive_days: number;
    today_total_added: number;
    last_attended_date: string | null;
  }> {
    const today = await this.sql<{ today: string }[]>`
      SELECT (now() AT TIME ZONE 'Asia/Seoul')::date::text AS today
    `;
    const todayStr = today[0].today;
    const rows = await this.sql<{
      attended_date: string;
      base_coin: number;
      bonus_coin: number;
      consecutive_days: number;
    }[]>`
      SELECT attended_date::text, base_coin, bonus_coin, consecutive_days
        FROM member_attendance
       WHERE member_id = ${memberId}
       ORDER BY attended_date DESC
       LIMIT 1
    `;
    const last = rows[0];
    if (!last) {
      return { attended_today: false, consecutive_days: 0, today_total_added: 0, last_attended_date: null };
    }
    return {
      attended_today: last.attended_date === todayStr,
      consecutive_days: last.attended_date === todayStr ? last.consecutive_days : 0,
      today_total_added: last.attended_date === todayStr ? last.base_coin + last.bonus_coin : 0,
      last_attended_date: last.attended_date,
    };
  }

  /** 마이페이지 — 최근 출석 이력 (이번 달 또는 N일). */
  async getHistory(memberId: number, limit = 30): Promise<{ items: { attended_date: string; base_coin: number; bonus_coin: number; consecutive_days: number }[] }> {
    const items = await this.sql<{
      attended_date: string;
      base_coin: number;
      bonus_coin: number;
      consecutive_days: number;
    }[]>`
      SELECT attended_date::text, base_coin, bonus_coin, consecutive_days
        FROM member_attendance
       WHERE member_id = ${memberId}
       ORDER BY attended_date DESC
       LIMIT ${Math.min(100, Math.max(1, limit))}
    `;
    return { items };
  }

  private skipResult(reason: string, consecutive = 0): AttendanceResult {
    return {
      attended_now: false,
      skip_reason: reason,
      consecutive_days: consecutive,
      base_coin: 0,
      bonus_coin: 0,
      coupon_amount: 0,
      total_added: 0,
    };
  }
}
