import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/point_list.php (메뉴 350430, "포인트 관리") 정확 매핑.
 *
 *   sample 컬럼:                       신규 매핑:
 *   ──────────────────────────────────────────────────────
 *   po_content (내용)                  point_history.content
 *   mb_level (구분)                    member.level (JOIN)
 *   mb_id (아이디)                     member.mb_id (JOIN)
 *   mb_nick (닉네임)                   member.nickname (JOIN)
 *   po_point (포인트)                  earn_point - use_point
 *   po_datetime (일시)                 created_at
 *   po_expired/po_expire_date (만료)   is_expired / expire_date
 *   po_mb_point (포인트합)             balance_after
 *   po_rel_table / po_rel_id           rel_table / rel_id
 *
 *   검색 (sfl):
 *     mb_id      : member.mb_id 정확 매칭
 *     po_content : content LIKE %stx%
 *
 *   기간: po_datetime → created_at
 *
 *   상단 요약:
 *     - 전체목록 / 전체 N건
 *     - mb_id 검색 시: "회원ID님 포인트 합계 N점" (member.point)
 *     - 검색 안 하면: "전체 합계 SUM(earn-use)점"
 *
 *   하단 폼: 개별회원 포인트 증감 (회원ID + 내용 + 포인트 + 유효기간)
 *           POST /admin/points/adjust-by-mb-id
 */

export interface AdjustInput {
  delta: number;
  reason: string;
  isPaid?: boolean;
  /**
   * 어떤 잔액 컬럼을 조정할지:
   *  - 'free'    : 소비포인트 무료분 (free_balance)
   *  - 'paid'    : 소비포인트 결제분 (paid_balance)   ← isPaid=true 와 동등
   *  - 'earning' : 수익포인트 (earning_balance)  ← 상담사 적립 조정 (분쟁/보너스/사고 처리)
   * 미지정 시 isPaid 플래그로 free/paid 결정.
   */
  kind?: 'free' | 'paid' | 'earning';
  expireDate?: string | null;
}

export interface AdjustByMbIdInput {
  mbId: string;
  reason: string;
  point: number;
  expireDays?: number;
  isPaid?: boolean;
  kind?: 'free' | 'paid' | 'earning';
}

export interface ActorInfo {
  adminId: number;
  ip: string | null;
}

export interface PointHistoryRow {
  id: number;
  member_id: number | null;
  mb_id: string | null;
  member_name: string | null;
  member_nickname: string | null;
  member_level: number | null;
  member_role: string | null;
  member_point: number | null;
  content: string | null;
  earn_point: number;
  use_point: number;
  balance_after: number;
  is_paid: boolean;
  is_expired: boolean;
  expire_date: string | null;
  rel_table: string | null;
  rel_id: string | null;
  rel_action: string | null;
  actor_admin_id: number | null;
  actor_admin_mb_id: string | null;
  actor_ip: string | null;
  actor_type: string;
  created_at: string;
}

export type PointSfl = 'mb_id' | 'po_content';

export interface HistoryFilter {
  sfl?: PointSfl;
  stx?: string;
  fr_date?: string;
  to_date?: string;
  member_id?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class PointsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** sample/lib/common.lib.php:1025 — cf_point_term을 setting 테이블에서 조회 (default 365일) */
  private async getPointTerm(): Promise<number> {
    const rows = await this.sql<{ value: string }[]>`
      SELECT value FROM setting WHERE namespace = 'member' AND key = 'point_term' LIMIT 1
    `;
    if (rows.length > 0) {
      const n = Number(rows[0].value);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return 365;
  }

  /**
   * 회원 포인트 가감 (트랜잭션 + 잔액 검증 + 감사로그).
   * - 음수 잔액 금지: 차감 시 isPaid 사이드 잔액 부족하면 400
   * - 모든 변동에 actor_admin_id/actor_ip/actor_type='admin' 기록
   * - point_history insert + point 집계 갱신 + member.point 동기화
   *
   * 만료일 (sample/lib/common.lib.php:1025-1037 동등):
   *   적립(delta>0):
   *     - 사용자 입력 expireDate 우선
   *     - 없고 cf_point_term > 0: today + (term - 1) days
   *     - 없고 cf_point_term = 0: 무한 (NULL)
   *   차감(delta<0):
   *     - is_expired = TRUE (소멸 처리)
   *     - expire_date = today (사용 시점)
   */
  async adjust(memberId: number, input: AdjustInput, actor: ActorInfo) {
    const delta = Math.trunc(Number(input.delta));
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('변동값(delta)은 0이 아닌 정수여야 합니다.');
    }
    const reason = (input.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('사유(reason)는 필수입니다.');
    }
    if (reason.length > 500) {
      throw new BadRequestException('사유는 500자 이하로 입력해주세요.');
    }
    const kind: 'free' | 'paid' | 'earning' = input.kind ?? (input.isPaid ? 'paid' : 'free');
    const isPaid = kind === 'paid';

    // 만료일 계산 (sample insert_point 동등)
    let expireDate: string | null = input.expireDate || null;
    let isExpired = false;
    if (delta > 0) {
      // 적립
      if (!expireDate) {
        const term = await this.getPointTerm();
        if (term > 0) {
          const dt = new Date();
          dt.setDate(dt.getDate() + term - 1);
          expireDate = dt.toISOString().slice(0, 10);
        }
      }
    } else {
      // 차감 — sample: po_expired=1, po_expire_date=today
      isExpired = true;
      expireDate = new Date().toISOString().slice(0, 10);
    }

    return await this.sql.begin(async (tx) => {
      const memberRows = await tx<{ id: number }[]>`
        SELECT id FROM member WHERE id = ${memberId} LIMIT 1
      `;
      if (memberRows.length === 0) {
        throw new NotFoundException('해당 회원을 찾을 수 없습니다.');
      }

      let ptRows = await tx<{ free_balance: number; paid_balance: number; earning_balance: number }[]>`
        SELECT free_balance, paid_balance, earning_balance
          FROM point
         WHERE member_id = ${memberId}
         FOR UPDATE
      `;
      if (ptRows.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, earning_balance, total_earned, total_used)
          VALUES (${memberId}, 0, 0, 0, 0, 0)
          ON CONFLICT (member_id) DO NOTHING
        `;
        ptRows = await tx<{ free_balance: number; paid_balance: number; earning_balance: number }[]>`
          SELECT free_balance, paid_balance, earning_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
        `;
      }
      const free = Number(ptRows[0].free_balance);
      const paid = Number(ptRows[0].paid_balance);
      const earning = Number(ptRows[0].earning_balance);

      // 차감 시 해당 잔액 부족 검증
      const targetSide = kind === 'paid' ? paid : kind === 'earning' ? earning : free;
      const kindLabel = kind === 'paid' ? '소비(결제분)' : kind === 'earning' ? '수익' : '소비(무료분)';
      if (delta < 0 && targetSide + delta < 0) {
        throw new BadRequestException(
          `${kindLabel} 포인트 잔액이 부족합니다. 현재 ${targetSide.toLocaleString()}P, 차감 요청 ${Math.abs(delta).toLocaleString()}P.`,
        );
      }

      // point_history.balance_after 의 의미:
      //   - free/paid 조정 : 회원 표면 잔액 (free + paid) + delta
      //   - earning 조정   : 수익포인트 잔액 (earning) + delta
      const balanceAfter = kind === 'earning' ? earning + delta : free + paid + delta;
      const earnPoint = delta > 0 ? delta : 0;
      const usePoint = delta < 0 ? -delta : 0;
      // rel_table 마커: 수익포인트 조정은 '@earning_adjust' 로 분리 (감사/분석 시 식별)
      const relTable = kind === 'earning' ? '@earning_adjust' : null;

      await tx`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          is_paid, is_expired, expire_date, rel_table, rel_action,
          actor_admin_id, actor_ip, actor_type
        ) VALUES (
          ${memberId}, ${reason}, ${earnPoint}, ${usePoint}, ${balanceAfter},
          ${isPaid}, ${isExpired}, ${expireDate}, ${relTable}, 'admin_adjust',
          ${actor.adminId}, ${actor.ip}, 'admin'
        )
      `;

      if (kind === 'earning') {
        // 수익포인트 — member.point 는 갱신하지 않음 (회원 표면 잔액 무관)
        if (delta > 0) {
          await tx`UPDATE point SET earning_balance = earning_balance + ${delta}, total_earned = total_earned + ${delta}, updated_at = now() WHERE member_id = ${memberId}`;
        } else {
          await tx`UPDATE point SET earning_balance = earning_balance + ${delta}, total_used = total_used + ${-delta}, updated_at = now() WHERE member_id = ${memberId}`;
        }
        return {
          balanceAfter,
          freeBalance: free,
          paidBalance: paid,
          earningBalance: earning + delta,
        };
      }

      if (kind === 'paid') {
        if (delta > 0) {
          await tx`UPDATE point SET paid_balance = paid_balance + ${delta}, total_earned = total_earned + ${delta}, updated_at = now() WHERE member_id = ${memberId}`;
        } else {
          await tx`UPDATE point SET paid_balance = paid_balance + ${delta}, total_used = total_used + ${-delta}, updated_at = now() WHERE member_id = ${memberId}`;
        }
      } else {
        if (delta > 0) {
          await tx`UPDATE point SET free_balance = free_balance + ${delta}, total_earned = total_earned + ${delta}, updated_at = now() WHERE member_id = ${memberId}`;
        } else {
          await tx`UPDATE point SET free_balance = free_balance + ${delta}, total_used = total_used + ${-delta}, updated_at = now() WHERE member_id = ${memberId}`;
        }
      }

      await tx`UPDATE member SET point = ${balanceAfter} WHERE id = ${memberId}`;

      return {
        balanceAfter,
        freeBalance: kind === 'paid' ? free : free + delta,
        paidBalance: kind === 'paid' ? paid + delta : paid,
        earningBalance: earning,
      };
    });
  }

  /** sample 페이지 하단 폼 — 회원아이디(mb_id) 직접 입력으로 조정 */
  async adjustByMbId(input: AdjustByMbIdInput, actor: ActorInfo) {
    const mbId = (input.mbId ?? '').trim();
    if (!mbId) throw new BadRequestException('회원아이디를 입력해주세요.');
    const point = Math.trunc(Number(input.point));
    if (!Number.isFinite(point) || point === 0) {
      throw new BadRequestException('포인트는 0이 아닌 정수여야 합니다.');
    }
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('포인트 내용은 필수입니다.');

    const rows = await this.sql<{ id: number }[]>`
      SELECT id FROM member WHERE mb_id = ${mbId} LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException(`회원아이디 '${mbId}'를 찾을 수 없습니다.`);
    }

    let expireDate: string | null = null;
    if (input.expireDays && input.expireDays > 0) {
      const dt = new Date();
      dt.setDate(dt.getDate() + Math.trunc(input.expireDays));
      expireDate = dt.toISOString().slice(0, 10);
    }

    return await this.adjust(
      rows[0].id,
      { delta: point, reason, isPaid: input.isPaid, kind: input.kind, expireDate },
      actor,
    );
  }

  /** sample point_list.php 그대로 — 검색/필터/요약 */
  async findHistory(filter: HistoryFilter) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(filter.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.member_id) {
      conds.push(this.sql`ph.member_id = ${filter.member_id}`);
    }
    if (filter.stx) {
      const q = `%${filter.stx}%`;
      switch (filter.sfl) {
        case 'mb_id':
          // 부분 매칭으로 통일 (sample은 정확 매칭이지만 신규는 검색 편의를 위해 LIKE)
          conds.push(this.sql`(m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q})`);
          break;
        case 'po_content':
          conds.push(this.sql`ph.content ILIKE ${q}`);
          break;
        default:
          conds.push(this.sql`(m.mb_id ILIKE ${q} OR m.name ILIKE ${q} OR m.nickname ILIKE ${q} OR ph.content ILIKE ${q})`);
      }
    }
    if (filter.fr_date) {
      conds.push(this.sql`ph.created_at >= ${filter.fr_date + ' 00:00:00'}::timestamptz`);
    }
    if (filter.to_date) {
      conds.push(this.sql`ph.created_at <= ${filter.to_date + ' 23:59:59'}::timestamptz`);
    }

    const whereClause = conds.length === 0
      ? this.sql``
      : conds.reduce(
          (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`),
          this.sql``,
        );

    const items = await this.sql<PointHistoryRow[]>`
      SELECT
        ph.id, ph.member_id, ph.content,
        ph.earn_point, ph.use_point, ph.balance_after,
        ph.is_paid, ph.is_expired, ph.expire_date,
        ph.rel_table, ph.rel_id, ph.rel_action,
        ph.actor_admin_id, ph.actor_ip, ph.actor_type,
        ph.created_at,
        m.mb_id, m.name AS member_name, m.nickname AS member_nickname,
        m.level AS member_level, m.role AS member_role, m.point AS member_point,
        a.mb_id AS actor_admin_mb_id
      FROM point_history ph
      LEFT JOIN member m ON m.id = ph.member_id
      LEFT JOIN member a ON a.id = ph.actor_admin_id
      ${whereClause}
      ORDER BY ph.created_at DESC, ph.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt
      FROM point_history ph
      LEFT JOIN member m ON m.id = ph.member_id
      ${whereClause}
    `;

    // 합계: sample은 SUM(po_point) (전체 검색 결과 기준).
    // 신규 point_history는 earn_point - use_point.
    const sumRows = await this.sql<{ sum_point: string }[]>`
      SELECT COALESCE(SUM(ph.earn_point - ph.use_point), 0)::text AS sum_point
      FROM point_history ph
      LEFT JOIN member m ON m.id = ph.member_id
      ${whereClause}
    `;

    // mb_id 검색 시 해당 회원 정보 + 잔액
    let searched_member: { mb_id: string; nickname: string; point: number } | null = null;
    if (filter.sfl === 'mb_id' && filter.stx) {
      const mrows = await this.sql<{ mb_id: string; nickname: string; point: number }[]>`
        SELECT mb_id, nickname, point FROM member WHERE mb_id = ${filter.stx} LIMIT 1
      `;
      if (mrows.length > 0) searched_member = mrows[0];
    }

    return {
      items,
      total: Number(totalRows[0].cnt),
      page,
      limit,
      summary: {
        sum_point: Number(sumRows[0].sum_point),
        searched_member,
      },
    };
  }

  async getMemberHistory(memberId: number, page = 1, limit = 20) {
    return this.findHistory({ member_id: memberId, page, limit });
  }
}
