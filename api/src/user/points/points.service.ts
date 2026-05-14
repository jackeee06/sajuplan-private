import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 사용자 페이지의 포인트 내역.
 *
 * 사용처:
 *   - GET /api/user/points/balance  : 보유 포인트 (member.point + 무료/유료 분리)
 *   - GET /api/user/points/history  : 본인 적립/사용 내역 페이지네이션
 *
 * 정책:
 *   - 본인 내역만 조회 (UserAuthGuard 로 검증된 req.user.sub).
 *   - 만료 처리(is_expired=true)는 차감으로 표시하되 별도 표기 가능 — UI 에서 처리.
 *   - rel_action: 'admin_adjust', 'consult_charge', 'signup_bonus' 등 표시 라벨 매핑은 frontend.
 */

export interface PointBalance {
  /** 총 보유 포인트 (free + paid). member.point 와 동일 (단일 진실원: point 테이블). */
  total: number;
  /** 무료(이벤트/쿠폰) 포인트 잔액 */
  free: number;
  /** 유료(충전) 포인트 잔액 */
  paid: number;
  /** 누적 적립 (참고용) */
  total_earned: number;
  /** 누적 사용 (참고용) */
  total_used: number;
}

export interface PointHistoryItem {
  id: number;
  /** 'in' (적립) | 'out' (사용/차감) */
  direction: 'in' | 'out';
  /** 변동 금액 (절대값, 양수) */
  amount: number;
  /** 변동 직후 잔액 — 거래 시점 스냅샷 */
  balance_after: number;
  /** 표시 텍스트 (point_history.content) */
  title: string;
  /** ISO 8601 시각 */
  occurred_at: string;
  /** 만료된 적립 여부 — 적립 row 가 만료되었으면 true (UI 회색 처리 등) */
  is_expired: boolean;
  /** 만료일 (적립인 경우) — 'YYYY-MM-DD' */
  expire_date: string | null;
  /** 유료 포인트 변동 여부 */
  is_paid: boolean;
  /** 변동 종류 — 표시 카테고리 매핑용 (consult_charge, signup_bonus 등) */
  rel_action: string | null;
  /** 연관 레코드 (예: 'consultation', 'coupon') — 추후 상세 이동 시 사용 가능 */
  rel_table: string | null;
  rel_id: string | null;
}

@Injectable()
export class UserPointsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 보유 포인트 잔액. point row 가 없으면 0 으로 채워서 반환. */
  async getBalance(memberId: number): Promise<PointBalance> {
    const rows = await this.sql<
      {
        free_balance: number;
        paid_balance: number;
        total_earned: string;
        total_used: string;
      }[]
    >`
      SELECT free_balance, paid_balance, total_earned::text, total_used::text
        FROM point
       WHERE member_id = ${memberId}
       LIMIT 1
    `;
    if (rows.length === 0) {
      return { total: 0, free: 0, paid: 0, total_earned: 0, total_used: 0 };
    }
    const r = rows[0];
    const free = Number(r.free_balance) || 0;
    const paid = Number(r.paid_balance) || 0;
    return {
      total: free + paid,
      free,
      paid,
      total_earned: Number(r.total_earned) || 0,
      total_used: Number(r.total_used) || 0,
    };
  }

  /**
   * 본인 포인트 내역 — created_at DESC, 페이지네이션.
   * limit max 100, default 30.
   */
  async getHistory(
    memberId: number,
    page = 1,
    limit = 30,
  ): Promise<{
    items: PointHistoryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const safePage = Math.max(1, Math.trunc(page));
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    const offset = (safePage - 1) * safeLimit;

    type Row = {
      id: number;
      content: string | null;
      earn_point: number;
      use_point: number;
      balance_after: number;
      is_expired: boolean;
      expire_date: string | null;
      is_paid: boolean;
      rel_action: string | null;
      rel_table: string | null;
      rel_id: string | null;
      created_at: Date;
    };

    const rows = await this.sql<Row[]>`
      SELECT id, content, earn_point, use_point, balance_after,
             is_expired, expire_date, is_paid, rel_action, rel_table, rel_id, created_at
        FROM point_history
       WHERE member_id = ${memberId}
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM point_history WHERE member_id = ${memberId}
    `;

    const items: PointHistoryItem[] = rows.map((r) => {
      const earn = Number(r.earn_point) || 0;
      const use = Number(r.use_point) || 0;
      const direction: 'in' | 'out' = earn > 0 ? 'in' : 'out';
      const amount = direction === 'in' ? earn : use;
      return {
        id: Number(r.id),
        direction,
        amount,
        balance_after: Number(r.balance_after) || 0,
        title: r.content?.trim() || (direction === 'in' ? '포인트 적립' : '포인트 사용'),
        occurred_at: r.created_at.toISOString(),
        is_expired: !!r.is_expired,
        expire_date: r.expire_date ? String(r.expire_date) : null,
        is_paid: !!r.is_paid,
        rel_action: r.rel_action,
        rel_table: r.rel_table,
        rel_id: r.rel_id ? String(r.rel_id) : null,
      };
    });

    return {
      items,
      total: Number(totalRows[0]?.cnt ?? 0),
      page: safePage,
      limit: safeLimit,
    };
  }
}
