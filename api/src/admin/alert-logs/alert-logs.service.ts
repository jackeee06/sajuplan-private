import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { HEALTH_CHECK_LABEL } from '../../cron/daily-summary.service';

/**
 * 알림 이력 — 발송된 모든 알림톡(alimtalk_log) 조회 + 현재 시스템 점검(health-check) 상세.
 * 사장님이 "알림 숫자 불안 → 들어가서 상세 보고 안심" 하기 위한 화면용.
 */
@Injectable()
export class AlertLogsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 테스트 계정/방 추정 (mb_id·roomid 패턴) */
  private isTest(s: string | null): boolean {
    return /e2e|dummy|test|qwerty|tkarm/i.test(s ?? '');
  }

  /** 알림 발송 이력 목록 */
  async list(params: { page?: number; limit?: number; template?: string; onlyFail?: boolean }) {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 30)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (params.template) conds.push(this.sql`template_code = ${params.template}`);
    if (params.onlyFail) conds.push(this.sql`success = false`);
    const where = conds.length === 0
      ? this.sql``
      : conds.reduce((acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``);

    const [items, totalRows] = await Promise.all([
      this.sql`
        SELECT id, template_code, phone, success, error_reason, response_message, vars, sent_at, caller
          FROM alimtalk_log ${where}
         ORDER BY sent_at DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.sql<{ cnt: string }[]>`SELECT COUNT(*)::text AS cnt FROM alimtalk_log ${where}`,
    ]);
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  /** 현재 시스템 점검(health-check) 위반 + 실제 대상 + 테스트 추정 */
  async healthDetail() {
    const [c1, c8, c17] = await Promise.all([
      this.sql<{ member_id: number; mb_id: string | null; free_balance: number; paid_balance: number; earning_balance: number }[]>`
        SELECT p.member_id, m.mb_id, p.free_balance, p.paid_balance, p.earning_balance
          FROM point p JOIN member m ON m.id = p.member_id
         WHERE p.free_balance < 0 OR p.paid_balance < 0 OR p.earning_balance < 0
         ORDER BY p.member_id
      `,
      this.sql<{ id: number; mb_id: string | null; cached: number; real_sum: number; diff: number }[]>`
        SELECT m.id, m.mb_id, m.point AS cached, (p.free_balance + p.paid_balance) AS real_sum,
               m.point - (p.free_balance + p.paid_balance) AS diff
          FROM member m JOIN point p ON p.member_id = m.id
         WHERE m.point != (p.free_balance + p.paid_balance)
         ORDER BY m.id
      `,
      this.sql<{ id: number; roomid: string; settle_retry_count: number }[]>`
        SELECT id, roomid, settle_retry_count FROM chat_room WHERE settle_status = 'm2net_failed' ORDER BY id
      `,
    ]);

    return {
      checks: [
        {
          code: 'C-1',
          label: HEALTH_CHECK_LABEL['C-1 음수'],
          severity: 'critical',
          count: c1.length,
          items: c1.map((r) => ({
            who: r.mb_id ?? `회원#${r.member_id}`,
            detail: `무료 ${r.free_balance} / 유료 ${r.paid_balance} / 수익 ${r.earning_balance}`,
            test_suspect: this.isTest(r.mb_id),
          })),
        },
        {
          code: 'C-8',
          label: HEALTH_CHECK_LABEL['C-8 drift'],
          severity: 'warning',
          count: c8.length,
          items: c8.map((r) => ({
            who: r.mb_id ?? `회원#${r.id}`,
            detail: `표시값 ${r.cached} / 실제 ${r.real_sum} (차이 ${r.diff})`,
            test_suspect: this.isTest(r.mb_id),
          })),
        },
        {
          code: 'C-17',
          label: HEALTH_CHECK_LABEL['C-17 m2net_failed'],
          severity: 'warning',
          count: c17.length,
          items: c17.map((r) => ({
            who: r.roomid,
            detail: `재시도 ${r.settle_retry_count}회`,
            test_suspect: true,
          })),
        },
      ],
    };
  }
}
