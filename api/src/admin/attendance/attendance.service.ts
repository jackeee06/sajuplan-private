import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 어드민 출석 관리 서비스 (2026-05-16 Phase 2).
 *
 *  - 정책 조회/수정 (setting.attendance.<target>.<key>)
 *  - 통계: 일별 출석자 수 + 지급액 (target 별 분리)
 *  - 회원별 이력 검색
 */

export type AttendanceTargetKind = 'user' | 'counselor';

const POLICY_KEYS = [
  'enabled',
  'day1',
  'day5_bonus',
  'day10_bonus',
  'day15_bonus',
  'day20_bonus',
  'day30_coupon_amount',
  'coupon_expire_days',
  'daily_total_limit',
  'min_signup_days',
  'ip_daily_limit',
] as const;
type PolicyKey = (typeof POLICY_KEYS)[number];

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
  ip_daily_limit: number;
}

export interface DailyStat {
  date: string;
  attendees: number;
  total_paid: number;
  bonus_paid: number;
  coupon_count: number;
}

@Injectable()
export class AdminAttendanceService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

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
   * 정책 업데이트 — 부분 갱신. 받은 키만 UPSERT.
   * enabled 는 'true'/'false' 문자열로 저장. 숫자는 문자열로 변환 저장.
   */
  async updatePolicy(target: AttendanceTargetKind, input: Partial<AttendancePolicy>): Promise<AttendancePolicy> {
    const entries: [PolicyKey, string][] = [];
    for (const k of POLICY_KEYS) {
      if (input[k] === undefined) continue;
      if (k === 'enabled') {
        entries.push([k, input.enabled ? 'true' : 'false']);
      } else {
        const v = Number(input[k]);
        if (!Number.isFinite(v) || v < 0) {
          throw new BadRequestException(`${k} 값이 올바르지 않습니다.`);
        }
        entries.push([k, String(Math.trunc(v))]);
      }
    }
    if (entries.length === 0) {
      throw new BadRequestException('변경할 값이 없습니다.');
    }
    for (const [k, v] of entries) {
      await this.sql`
        INSERT INTO setting (namespace, key, value)
        VALUES ('attendance', ${`${target}.${k}`}, ${v})
        ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
    return this.getPolicy(target);
  }

  /**
   * 일별 통계 — 지정 기간(기본 최근 30일) 의 출석자 수 + 지급액.
   */
  async getStats(
    target: AttendanceTargetKind,
    from?: string,
    to?: string,
  ): Promise<{ items: DailyStat[]; total_paid: number; total_attendees: number }> {
    // 기본: 최근 30일
    const fromCond = from ? this.sql`AND a.attended_date >= ${from}::date` : this.sql`AND a.attended_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 30`;
    const toCond = to ? this.sql`AND a.attended_date <= ${to}::date` : this.sql``;
    const rows = await this.sql<{
      date: string;
      attendees: string;
      total_paid: string;
      bonus_paid: string;
      coupon_count: string;
    }[]>`
      SELECT a.attended_date::text AS date,
             COUNT(*)::text AS attendees,
             COALESCE(SUM(a.base_coin + a.bonus_coin), 0)::text AS total_paid,
             COALESCE(SUM(a.bonus_coin), 0)::text AS bonus_paid,
             COUNT(*) FILTER (WHERE a.coupon_id IS NOT NULL)::text AS coupon_count
        FROM member_attendance a
       WHERE a.target_kind = ${target}
         ${fromCond}
         ${toCond}
       GROUP BY a.attended_date
       ORDER BY a.attended_date DESC
    `;
    const items: DailyStat[] = rows.map((r) => ({
      date: r.date,
      attendees: Number(r.attendees),
      total_paid: Number(r.total_paid),
      bonus_paid: Number(r.bonus_paid),
      coupon_count: Number(r.coupon_count),
    }));
    const total_paid = items.reduce((s, i) => s + i.total_paid, 0);
    const total_attendees = items.reduce((s, i) => s + i.attendees, 0);
    return { items, total_paid, total_attendees };
  }

  /**
   * 회원별 출석 이력 검색.
   *  - q: mb_id / nickname / name 부분 일치
   *  - 또는 특정 member_id 직접 지정
   */
  async getHistoryByMember(params: {
    member_id?: number;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    if (!params.member_id && !params.q) {
      // 전체 최근 출석 이력
      const rows = await this.sql<{
        id: number;
        member_id: number;
        mb_id: string | null;
        nickname: string | null;
        name: string | null;
        target_kind: string;
        attended_date: string;
        base_coin: number;
        bonus_coin: number;
        consecutive_days: number;
        total: string;
      }[]>`
        SELECT a.id, a.member_id, m.mb_id, m.nickname, m.name,
               a.target_kind, a.attended_date::text, a.base_coin, a.bonus_coin, a.consecutive_days,
               COUNT(*) OVER ()::text AS total
          FROM member_attendance a
          JOIN member m ON m.id = a.member_id
         ORDER BY a.attended_date DESC, a.id DESC
         LIMIT ${limit} OFFSET ${offset}
      `;
      return {
        items: rows.map((r) => ({ ...r, total: undefined })),
        total: rows.length > 0 ? Number(rows[0].total) : 0,
        page,
        limit,
      };
    }

    // 검색 조건 — member_id 우선, 없으면 q
    const whereMember = params.member_id
      ? this.sql`a.member_id = ${params.member_id}`
      : this.sql`(m.mb_id ILIKE ${`%${params.q}%`} OR m.nickname ILIKE ${`%${params.q}%`} OR m.name ILIKE ${`%${params.q}%`})`;

    const rows = await this.sql<{
      id: number;
      member_id: number;
      mb_id: string | null;
      nickname: string | null;
      name: string | null;
      target_kind: string;
      attended_date: string;
      base_coin: number;
      bonus_coin: number;
      consecutive_days: number;
      total: string;
    }[]>`
      SELECT a.id, a.member_id, m.mb_id, m.nickname, m.name,
             a.target_kind, a.attended_date::text, a.base_coin, a.bonus_coin, a.consecutive_days,
             COUNT(*) OVER ()::text AS total
        FROM member_attendance a
        JOIN member m ON m.id = a.member_id
       WHERE ${whereMember}
       ORDER BY a.attended_date DESC, a.id DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    return {
      items: rows.map((r) => ({ ...r, total: undefined })),
      total: rows.length > 0 ? Number(rows[0].total) : 0,
      page,
      limit,
    };
  }
}
