import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../shared/db/db.module';
import { M2netService } from '../shared/m2net/m2net.service';
import { OpsAlertService } from '../shared/ops-alert/ops-alert.service';
import { M2netPushService } from '../pg-callbacks/m2net-push.service';

/**
 * Audit C-#9, C-#10 — 외부 의존성(M2NET) 실패 후 재시도 cron.
 *
 * 두 흐름:
 *   1) chat-settle: chat_room.settle_status='m2net_failed' 행을 재정산 시도
 *   2) payment-m2net: payment.m2net_status='코인충전실패' 행을 m2net 동기화 재시도
 *
 * 정책:
 *   - 매 시간(또는 분) 실행 — crontab 에서 호출
 *   - 최대 retry_count 5회까지 시도 후 영구 실패 처리 + OpsAlert
 *   - 마지막 retry 후 10분 이내는 backoff (즉시 재시도 방지)
 */
@Injectable()
export class RetryCronService {
  private readonly logger = new Logger(RetryCronService.name);

  /** 최대 자동 재시도 횟수. 이 이상은 수동 개입 필요. */
  private readonly MAX_RETRY = 5;
  /** 같은 row 재시도 사이 최소 대기 (분) */
  private readonly RETRY_COOLDOWN_MIN = 10;

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly m2net: M2netService,
    private readonly opsAlert: OpsAlertService,
    private readonly m2netPush: M2netPushService,
  ) {}

  /**
   * #9 chat-settle 재시도. settle_status='m2net_failed' + cooldown 지난 row 들 처리.
   */
  async retryChatSettles(limit = 20): Promise<{
    processed: number;
    success: number;
    failed: number;
    exhausted: number;
  }> {
    // [2026-05-30] use_seconds=0 row 는 시작점부터 제외 + 즉시 skipped 마킹.
    //   상담사 입장 전 종료/자동취소 → m2net 등록 X → 정산 시도 자체가 무의미.
    //   chat_room.id=38,48 사고 (m2net_failed 5회 → 영구 실패 OpsAlert) 의 근본 fix.
    await this.sql`
      UPDATE chat_room
         SET settle_status = 'skipped',
             settle_failure_reason = 'no_use_seconds (상담사 입장 전 종료 또는 자동 취소)'
       WHERE settle_status IN ('m2net_failed', 'permanently_failed')
         AND use_seconds <= 0
    `;

    const rows = await this.sql<{ id: number; settle_retry_count: number; use_seconds: number }[]>`
      SELECT id, settle_retry_count, use_seconds
        FROM chat_room
       WHERE settle_status = 'm2net_failed'
         AND use_seconds > 0
         AND settle_retry_count < ${this.MAX_RETRY}
         AND (settle_last_retry_at IS NULL
              OR settle_last_retry_at < NOW() - (${this.RETRY_COOLDOWN_MIN} || ' minutes')::interval)
       ORDER BY settle_last_retry_at NULLS FIRST
       LIMIT ${Math.min(100, Math.max(1, limit))}
    `;
    let success = 0;
    let failed = 0;
    let exhausted = 0;
    for (const r of rows) {
      try {
        const res = await this.m2netPush.settleChatRoomLocal(r.id);
        if (res.settled) {
          success++;
        } else if (res.marked_for_retry) {
          failed++;
          // settle_retry_count 가 MAX_RETRY 에 도달했는지 확인 후 영구 실패 처리
          const after = await this.sql<{ settle_retry_count: number }[]>`
            SELECT settle_retry_count FROM chat_room WHERE id = ${r.id} LIMIT 1
          `;
          const cnt = Number(after[0]?.settle_retry_count ?? 0);
          if (cnt >= this.MAX_RETRY) {
            exhausted++;
            await this.sql`UPDATE chat_room SET settle_status = 'permanently_failed' WHERE id = ${r.id}`;
            // [2026-05-30] 운영자가 즉시 판단 가능하도록 컨텍스트(use_seconds/시간/실패사유) 같이 전송
            const ctx = await this.sql<{
              use_seconds: number;
              started_at: Date | null;
              ended_at: Date | null;
              reason: string | null;
            }[]>`
              SELECT use_seconds, started_at, ended_at,
                     LEFT(COALESCE(settle_failure_reason, '-'), 100) AS reason
                FROM chat_room WHERE id = ${r.id} LIMIT 1
            `;
            const x = ctx[0];
            const startedStr = x?.started_at ? new Date(x.started_at).toISOString().slice(0, 19).replace('T', ' ') : '-';
            const endedStr = x?.ended_at ? new Date(x.ended_at).toISOString().slice(0, 19).replace('T', ' ') : '-';
            void this.opsAlert.send(
              '채팅 정산 영구 실패',
              `chat_room.id=${r.id} retry=${cnt}\nuse_seconds=${x?.use_seconds ?? '?'}\n시작=${startedStr}\n종료=${endedStr}\n사유: ${x?.reason ?? '-'}\n\n수동 개입 필요 (use_seconds=0 이면 정상 — skipped 마킹).`,
            );
          }
        } else {
          // 차감액 0 등 정상 케이스 — completed 마킹은 settleChatRoomLocal 안에서 처리됨
          success++;
        }
      } catch (e) {
        failed++;
        this.logger.error(
          `[retryChatSettles] 예외 chatRoomId=${r.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    this.logger.log(
      `[retryChatSettles] processed=${rows.length} success=${success} failed=${failed} exhausted=${exhausted}`,
    );
    return { processed: rows.length, success, failed, exhausted };
  }

  /**
   * #10 payment.m2net_status='코인충전실패' 재시도.
   */
  async retryPaymentM2netSync(limit = 20): Promise<{
    processed: number;
    success: number;
    failed: number;
    exhausted: number;
  }> {
    const rows = await this.sql<{
      id: number;
      mb_1: string | null;
      coin_amount: number;
      m2net_retry_count: number;
      oid: string | null;
    }[]>`
      SELECT id, mb_1, coin_amount, m2net_retry_count, oid
        FROM payment
       WHERE m2net_status = '코인충전실패'
         AND m2net_retry_count < ${this.MAX_RETRY}
         AND mb_1 IS NOT NULL
         AND (m2net_last_retry_at IS NULL
              OR m2net_last_retry_at < NOW() - (${this.RETRY_COOLDOWN_MIN} || ' minutes')::interval)
       ORDER BY m2net_last_retry_at NULLS FIRST
       LIMIT ${Math.min(100, Math.max(1, limit))}
    `;
    let success = 0;
    let failed = 0;
    let exhausted = 0;
    for (const r of rows) {
      if (!r.mb_1) continue;
      try {
        const sync = await this.m2net.addMemberCoin(r.mb_1, Number(r.coin_amount));
        if (sync.ok) {
          await this.sql`
            UPDATE payment SET
              m2net_status = '코인충전성공',
              updated_at = now()
             WHERE id = ${r.id}
          `;
          success++;
        } else {
          await this.sql`
            UPDATE payment SET
              m2net_retry_count = m2net_retry_count + 1,
              m2net_last_retry_at = NOW(),
              updated_at = now()
             WHERE id = ${r.id}
          `;
          const newCnt = (r.m2net_retry_count ?? 0) + 1;
          if (newCnt >= this.MAX_RETRY) {
            exhausted++;
            void this.opsAlert.send(
              'M2NET 결제 적립 영구 실패',
              `payment.id=${r.id} oid=${r.oid} coin=${r.coin_amount} retry_count=${newCnt} — 수동 개입 필요`,
            );
          } else {
            failed++;
          }
        }
      } catch (e) {
        failed++;
        this.logger.error(
          `[retryPaymentM2netSync] 예외 paymentId=${r.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    this.logger.log(
      `[retryPaymentM2netSync] processed=${rows.length} success=${success} failed=${failed} exhausted=${exhausted}`,
    );
    return { processed: rows.length, success, failed, exhausted };
  }
}
