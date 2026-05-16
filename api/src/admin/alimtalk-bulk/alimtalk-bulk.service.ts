import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { SmsService } from '../../user/sms/sms.service';

/**
 * 어드민 일괄 알림톡 발송 + 로그 (Phase 13).
 *
 * 대상 그룹:
 *  - all_members      — 회원 전원 (탈퇴 제외)
 *  - all_counselors   — 활동 상담사 (level=5, left_at IS NULL)
 *  - phones           — 직접 입력한 번호들 (콤마/줄바꿈 구분)
 *
 * 모든 발송 결과는 alimtalk_send_log 에 기록 — 사후 분석/재발송 근거.
 *
 * 발송 속도:
 *  - BizM 처리량 한계 고려 — 동시 발송 5건 직렬 처리 (외부 API rate limit 회피)
 *  - 전체 발송은 백그라운드 비동기 X — 동기 처리 후 결과 반환 (수십~수백명까지 OK)
 */
export type BulkTarget = 'all_members' | 'all_counselors' | 'phones';

@Injectable()
export class AlimtalkBulkService {
  private readonly logger = new Logger(AlimtalkBulkService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
  ) {}

  /**
   * 일괄 발송 — 동기 처리 후 결과 반환.
   * @returns { job_id, total, sent, failed }
   */
  async sendBulk(params: {
    templateCode: string;
    target: BulkTarget;
    phones?: string;
    vars?: Record<string, string>;
    adminId: number;
  }): Promise<{ job_id: number; total: number; sent: number; failed: number }> {
    const { templateCode, target, phones, vars, adminId } = params;
    if (!templateCode) throw new BadRequestException('templateCode 필수');

    // 1. 수신자 목록 결정
    type Recipient = { phone: string; member_id: number | null };
    let recipients: Recipient[] = [];
    if (target === 'all_members') {
      recipients = await this.sql<Recipient[]>`
        SELECT phone, id AS member_id
          FROM member
         WHERE role IN ('user', 'counselor')
           AND left_at IS NULL
           AND phone IS NOT NULL
           AND phone != ''
      `;
    } else if (target === 'all_counselors') {
      recipients = await this.sql<Recipient[]>`
        SELECT phone, id AS member_id
          FROM member
         WHERE level = 5
           AND left_at IS NULL
           AND phone IS NOT NULL
           AND phone != ''
      `;
    } else if (target === 'phones') {
      if (!phones || !phones.trim()) {
        throw new BadRequestException('phones 입력 필수 (콤마/줄바꿈 구분)');
      }
      const raw = phones
        .split(/[,\n\r;]/)
        .map((s) => s.trim().replace(/[^0-9]/g, ''))
        .filter((s) => s.length >= 10);
      recipients = raw.map((p) => ({ phone: p, member_id: null }));
    } else {
      throw new BadRequestException('잘못된 target');
    }

    if (recipients.length === 0) {
      throw new BadRequestException('수신자가 없습니다.');
    }

    // 2. job 행 INSERT (집계용)
    const jobRow = await this.sql<{ id: number }[]>`
      INSERT INTO alimtalk_send_log
        (template_code, phone, vars, status, initiated_by, bulk_job_id)
      VALUES
        (${templateCode}, '__job__', ${this.sql.json(vars ?? {})}::jsonb, 'success', ${`admin:${adminId}`}, NULL)
      RETURNING id
    `;
    const jobId = Number(jobRow[0].id);
    // bulk_job_id 자기참조로 갱신
    await this.sql`UPDATE alimtalk_send_log SET bulk_job_id = ${jobId} WHERE id = ${jobId}`;

    // 3. 직렬 발송 + 결과 로깅
    let sent = 0;
    let failed = 0;
    const initiator = `admin:${adminId}`;
    for (const r of recipients) {
      let okFlag = false;
      let failReason: string | null = null;
      let raw: string | null = null;
      try {
        const result = await this.sms.sendAlimtalkByCode(
          templateCode,
          r.phone,
          vars ?? {},
        );
        okFlag = result.ok;
        if (!okFlag) failReason = result.reason ?? 'unknown';
        raw = result.raw ?? null;
      } catch (e) {
        okFlag = false;
        failReason = e instanceof Error ? e.message : String(e);
      }
      if (okFlag) sent++;
      else failed++;

      // 발송 로그
      try {
        await this.sql`
          INSERT INTO alimtalk_send_log
            (template_code, phone, vars, status, failure_reason, bizm_response,
             initiated_by, bulk_job_id, member_id)
          VALUES
            (${templateCode}, ${r.phone}, ${this.sql.json(vars ?? {})}::jsonb,
             ${okFlag ? 'success' : 'failed'}, ${failReason},
             ${raw ? this.sql.json({ raw }) : null},
             ${initiator}, ${jobId}, ${r.member_id})
        `;
      } catch (e) {
        this.logger.error(`발송 로그 INSERT 실패: ${e instanceof Error ? e.message : e}`);
      }
    }

    return { job_id: jobId, total: recipients.length, sent, failed };
  }

  /** 발송 로그 조회 (단건 행 + 일괄 작업 그룹 모두) */
  async listLogs(params: {
    limit?: number;
    offset?: number;
    status?: string;
    template?: string;
    bulkOnly?: boolean;
  }) {
    const lim = Math.min(200, Math.max(1, params.limit ?? 50));
    const off = Math.max(0, params.offset ?? 0);
    const statusFilter = params.status
      ? this.sql`AND status = ${params.status}`
      : this.sql``;
    const tplFilter = params.template
      ? this.sql`AND template_code = ${params.template}`
      : this.sql``;
    const bulkFilter = params.bulkOnly
      ? this.sql`AND bulk_job_id IS NOT NULL`
      : this.sql``;
    return await this.sql<Array<{
      id: number;
      template_code: string;
      phone: string;
      status: string;
      failure_reason: string | null;
      initiated_by: string | null;
      bulk_job_id: number | null;
      member_id: number | null;
      created_at: string;
    }>>`
      SELECT id, template_code, phone, status, failure_reason,
             initiated_by, bulk_job_id, member_id, created_at::text
        FROM alimtalk_send_log
       WHERE phone != '__job__'
         ${statusFilter}
         ${tplFilter}
         ${bulkFilter}
       ORDER BY id DESC
       LIMIT ${lim} OFFSET ${off}
    `;
  }

  /** 일괄 작업 요약 */
  async listJobs(limit = 20) {
    const lim = Math.min(100, Math.max(1, limit));
    return await this.sql<Array<{
      bulk_job_id: number;
      template_code: string;
      initiated_by: string | null;
      total: string;
      sent: string;
      failed: string;
      created_at: string;
    }>>`
      SELECT bulk_job_id,
             MIN(template_code) AS template_code,
             MIN(initiated_by) AS initiated_by,
             COUNT(*) FILTER (WHERE phone != '__job__')::text AS total,
             COUNT(*) FILTER (WHERE phone != '__job__' AND status = 'success')::text AS sent,
             COUNT(*) FILTER (WHERE phone != '__job__' AND status = 'failed')::text AS failed,
             MIN(created_at)::text AS created_at
        FROM alimtalk_send_log
       WHERE bulk_job_id IS NOT NULL
       GROUP BY bulk_job_id
       ORDER BY bulk_job_id DESC
       LIMIT ${lim}
    `;
  }

  /** 등록된 템플릿 목록 (UI 선택용) */
  async listTemplates() {
    return await this.sql<Array<{
      template_code: string;
      message: string;
      is_active: boolean;
    }>>`
      SELECT template_code, message, is_active
        FROM alimtalk_template
       WHERE is_active = true
       ORDER BY template_code
    `;
  }
}
