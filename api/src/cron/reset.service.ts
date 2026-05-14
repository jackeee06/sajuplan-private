import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SQL, type Sql } from '../shared/db/db.module';

/**
 * 운영 데이터 일괄 초기화 서비스.
 *
 * 사용자 요청 (2026-05-12): 전체 회원 기준
 *   1) settlement_monthly  — 정산이력 전체
 *   2) point / point_history / member.point — 포인트 잔액·내역 전체 초기화
 *   3) coupon / coupon_history — 발급된 쿠폰 + 사용 이력
 *      (coupon_zone, coupon_zone_member 마스터는 보존)
 *
 * 결제 본체 (payment / payment_method / payment_outbox / consultation) 는 건드리지 않음.
 *
 * 일회성/재해석 위험 — 호출 시 confirm 토큰 필수.
 */
@Injectable()
export class ResetService {
  private readonly logger = new Logger(ResetService.name);

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async resetAll() {
    return await this.sql.begin(async (tx) => {
      const settlementDel = await tx<{ id: number }[]>`DELETE FROM settlement_monthly RETURNING id`;
      const pointHistoryDel = await tx<{ id: number }[]>`DELETE FROM point_history RETURNING id`;
      const couponHistoryDel = await tx<{ id: number }[]>`DELETE FROM coupon_history RETURNING id`;
      const couponDel = await tx<{ id: number }[]>`DELETE FROM coupon RETURNING id`;

      // 잔액 집계 테이블 리셋
      const pointReset = await tx<{ member_id: number }[]>`
        UPDATE point
           SET free_balance = 0,
               paid_balance = 0,
               total_earned = 0,
               total_used = 0,
               updated_at = now()
         WHERE free_balance <> 0
            OR paid_balance <> 0
            OR total_earned <> 0
            OR total_used <> 0
        RETURNING member_id
      `;
      const memberPointReset = await tx<{ id: number }[]>`
        UPDATE member SET point = 0 WHERE point <> 0 RETURNING id
      `;

      // consultation.calc_flag / is_settled 되돌리기 (정산 흔적 제거)
      const consReset = await tx<{ id: number }[]>`
        UPDATE consultation
           SET calc_flag = NULL,
               is_settled = false
         WHERE calc_flag = 'Y'
            OR is_settled = true
        RETURNING id
      `;

      const summary = {
        settlement_monthly_deleted: settlementDel.length,
        point_history_deleted: pointHistoryDel.length,
        coupon_history_deleted: couponHistoryDel.length,
        coupon_deleted: couponDel.length,
        point_balance_reset_members: pointReset.length,
        member_point_reset: memberPointReset.length,
        consultation_settle_flag_reset: consReset.length,
      };
      this.logger.warn(`[RESET ALL] ${JSON.stringify(summary)}`);
      return { ok: true, ...summary };
    });
  }

  /**
   * 자동충전 진단 — 특정 회원의 최근 결제/포인트 row + autopay push 로그 tail.
   *
   * 사용 케이스: 통화 중 자동충전이 일어났는데 포인트 적립이 안 된 사고 추적.
   *   - payment 에 row 가 있는가? (있다면 status / m2net_status / coin_amount 확인)
   *   - point_history 에 적립 row 가 있는가? (rel_table='payment_autopay' 매칭)
   *   - point 잔액과 member.point 가 일치하는가?
   *   - autopay-push.log 에 해당 시각 푸시 도착 흔적이 있는가?
   */
  async diagnoseAutopay(mbId: string, hours: number) {
    const memberRow = await this.sql<{
      id: number; mb_id: string; csrid: string | null; phone: string | null;
      point: number; created_at: string;
    }[]>`
      SELECT id, mb_id, csrid, phone, point, created_at::text
        FROM member WHERE mb_id = ${mbId} LIMIT 1
    `;
    if (memberRow.length === 0) return { error: 'member not found', mbId };
    const m = memberRow[0];

    const payments = await this.sql<{
      id: number; oid: string | null; pay_method: string | null;
      amount: number; coin_amount: number; status: string | null;
      m2net_status: string | null; result_message: string | null;
      tid: string | null; created_at: string; updated_at: string | null;
    }[]>`
      SELECT id, oid, pay_method, amount, coin_amount, status, m2net_status,
             result_message, tid, created_at::text, updated_at::text
        FROM payment
       WHERE member_id = ${m.id}
         AND created_at > now() - (${hours}::int * interval '1 hour')
       ORDER BY id DESC LIMIT 20
    `;

    const pointHistory = await this.sql<{
      id: number; content: string | null; earn_point: number; use_point: number;
      balance_after: number; rel_table: string | null; rel_id: string | null;
      rel_action: string | null; created_at: string;
    }[]>`
      SELECT id, content, earn_point, use_point, balance_after,
             rel_table, rel_id, rel_action, created_at::text
        FROM point_history
       WHERE member_id = ${m.id}
         AND created_at > now() - (${hours}::int * interval '1 hour')
       ORDER BY id DESC LIMIT 30
    `;

    const pointAgg = await this.sql<{
      free_balance: number; paid_balance: number; total_earned: number; total_used: number;
    }[]>`
      SELECT free_balance, paid_balance, total_earned, total_used
        FROM point WHERE member_id = ${m.id} LIMIT 1
    `;

    // autopay-push 로그 tail (해당 회원 mb_id 또는 csrid 포함된 라인만 필터)
    const logFile = path.resolve(process.cwd(), 'logs', 'autopay-push.log');
    let pushLogLines: string[] = [];
    try {
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        const needle = m.csrid ?? mbId;
        pushLogLines = lines
          .filter((l) => l.includes(needle) || l.includes(mbId))
          .slice(-30);
      }
    } catch (e) {
      this.logger.warn(`autopay-push.log 읽기 실패: ${(e as Error).message}`);
    }

    return {
      member: m,
      payments,
      point_history: pointHistory,
      point_aggregate: pointAgg[0] ?? null,
      push_log_lines: pushLogLines,
    };
  }
}
