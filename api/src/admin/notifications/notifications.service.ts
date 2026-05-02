import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { PushService } from '../../shared/push/push.service';

/**
 * 알림 (푸시/알림톡/메일) 통합 service.
 *  - 푸시: member_push_token + notification_log
 *  - 알림톡: alimtalk_template + alimtalk_event_binding
 */

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly push: PushService,
  ) {}

  // ─── 푸시 토큰 ────────────────────────────
  async pushTokens(filter: { q?: string; platform?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 30)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(t.mb_id ILIKE ${q} OR m.mb_id ILIKE ${q} OR m.name ILIKE ${q})`);
    }
    if (filter.platform) conds.push(this.sql`t.platform = ${filter.platform}`);
    const whereClause = conds.length === 0 ? this.sql`` : conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``,
    );

    const items = await this.sql`
      SELECT t.id, t.member_id, t.mb_id, t.platform, t.token, t.device_phone,
             t.is_active, t.created_at, t.updated_at,
             m.mb_id, m.name AS member_name
      FROM member_push_token t
      LEFT JOIN member m ON m.id = t.member_id
      ${whereClause}
      ORDER BY t.updated_at DESC NULLS LAST, t.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM member_push_token t LEFT JOIN member m ON m.id = t.member_id ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  // ─── 푸시 발송 이력 (notification_log) ────────────────────
  async pushHistory(filter: { q?: string; category?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.trunc(filter.page ?? 1));
    const limit = Math.min(200, Math.max(1, Math.trunc(filter.limit ?? 30)));
    const offset = (page - 1) * limit;

    const conds: ReturnType<Sql>[] = [];
    if (filter.q) {
      const q = `%${filter.q}%`;
      conds.push(this.sql`(n.title ILIKE ${q} OR n.content ILIKE ${q} OR m.mb_id ILIKE ${q})`);
    }
    if (filter.category) conds.push(this.sql`n.category = ${filter.category}`);
    const whereClause = conds.length === 0 ? this.sql`` : conds.reduce(
      (acc, c, i) => (i === 0 ? this.sql`WHERE ${c}` : this.sql`${acc} AND ${c}`), this.sql``,
    );

    const items = await this.sql`
      SELECT n.id, n.member_id, n.mb_id, n.title, n.content, n.link_url, n.category, n.code, n.created_at,
             m.mb_id, m.name AS member_name
      FROM notification_log n
      LEFT JOIN member m ON m.id = n.member_id
      ${whereClause}
      ORDER BY n.created_at DESC NULLS LAST, n.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalRows = await this.sql<{ cnt: string }[]>`
      SELECT count(*)::text AS cnt FROM notification_log n LEFT JOIN member m ON m.id = n.member_id ${whereClause}
    `;
    return { items, total: Number(totalRows[0].cnt), page, limit };
  }

  // ─── 푸시 발송 ────────────────────────────
  /**
   * target:
   *  - 'all'       전체 활동 회원
   *  - 'user'      role=user
   *  - 'counselor' role=counselor
   *  - 숫자 문자열 → 단일 member_id
   *
   * NOTE: 실제 FCM/APNS 호출은 별도 worker에서 처리 (TODO).
   *       여기선 notification_log에만 기록하여 발송 큐 역할.
   */
  async sendPush(input: { target: string; title: string; content?: string; link_url?: string }): Promise<{ ok: boolean; recipients: number; pushed: { success: number; failure: number; error?: string } }> {
    const { target, title } = input;
    const content = input.content ?? '';
    const linkUrl = input.link_url ?? null;
    if (!title || !title.trim()) throw new BadRequestException('제목은 필수입니다.');
    if (!target) throw new BadRequestException('발송 대상을 선택하세요.');

    // 대상 추출
    let recipients: { id: number; mb_id: string | null }[] = [];
    if (target === 'all') {
      recipients = await this.sql<{ id: number; mb_id: string | null }[]>`
        SELECT m.id, m.mb_id FROM member m
         WHERE m.role IN ('user','counselor') AND m.left_at IS NULL
      `;
    } else if (target === 'user' || target === 'counselor') {
      recipients = await this.sql<{ id: number; mb_id: string | null }[]>`
        SELECT m.id, m.mb_id FROM member m
         WHERE m.role = ${target} AND m.left_at IS NULL
      `;
    } else if (/^\d+$/.test(target)) {
      const id = Number(target);
      recipients = await this.sql<{ id: number; mb_id: string | null }[]>`
        SELECT id, mb_id FROM member WHERE id = ${id}
      `;
      if (recipients.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');
    } else {
      throw new BadRequestException(`알 수 없는 발송 대상: ${target}`);
    }

    if (recipients.length === 0) return { ok: true, recipients: 0, pushed: { success: 0, failure: 0 } };

    // notification_log에 일괄 INSERT (배치)
    const category = target === 'all' ? '전체공지' : target === 'user' ? '일반회원' : target === 'counselor' ? '상담사' : '개별';
    await this.sql`
      INSERT INTO notification_log (member_id, mb_id, title, content, link_url, category)
      SELECT v.member_id::bigint, v.mb_id, ${title}, ${content}, ${linkUrl}, ${category}
        FROM unnest(
          ${this.sql.array(recipients.map((r) => r.id))}::bigint[],
          ${this.sql.array(recipients.map((r) => r.mb_id ?? ''))}::text[]
        ) AS v(member_id, mb_id)
    `;

    // FCM 실제 발송 — 활성 토큰 조회해서 다중 발송
    let pushed = { success: 0, failure: 0 } as { success: number; failure: number; error?: string };
    if (this.push.isEnabled()) {
      const memberIds = recipients.map((r) => r.id);
      const tokens = await this.sql<{ token: string }[]>`
        SELECT token FROM member_push_token
         WHERE is_active = true AND token <> '' AND member_id = ANY(${this.sql.array(memberIds)}::bigint[])
      `;
      const tokenList = tokens.map((t) => t.token);
      if (tokenList.length > 0) {
        const r = await this.push.sendToTokens(tokenList, {
          title,
          body: content,
          data: linkUrl ? { url: linkUrl } : undefined,
        });
        pushed = { success: r.success, failure: r.failure, error: r.error };
      }
    } else {
      pushed = { success: 0, failure: 0, error: 'FCM 미설정 — notification_log만 기록됨' };
    }

    return { ok: true, recipients: recipients.length, pushed };
  }

  // ─── 알림톡 템플릿 ─────────────────────────
  async alimtalkTemplates() {
    const items = await this.sql`
      SELECT id, template_code, subject, message, primary_btn_name, primary_btn_url,
             buttons, is_active, created_at, updated_at
      FROM alimtalk_template
      ORDER BY id DESC
    `;
    return { items, total: items.length };
  }

  async getAlimtalkTemplate(id: number) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM alimtalk_template WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    return rows[0];
  }

  async createAlimtalkTemplate(input: { template_code: string; subject?: string; message: string; primary_btn_name?: string; primary_btn_url?: string; is_active?: boolean }) {
    if (!input.template_code?.trim()) throw new BadRequestException('템플릿 코드는 필수입니다.');
    if (!input.message?.trim()) throw new BadRequestException('메시지는 필수입니다.');
    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO alimtalk_template (template_code, subject, message, primary_btn_name, primary_btn_url, is_active)
      VALUES (${input.template_code.trim()}, ${input.subject ?? null}, ${input.message},
              ${input.primary_btn_name ?? null}, ${input.primary_btn_url ?? null}, ${input.is_active ?? true})
      RETURNING id
    `;
    return this.getAlimtalkTemplate(rows[0].id);
  }

  async updateAlimtalkTemplate(id: number, input: Partial<{ template_code: string; subject: string; message: string; primary_btn_name: string; primary_btn_url: string; is_active: boolean }>) {
    const cur = await this.getAlimtalkTemplate(id) as Record<string, unknown>;
    await this.sql`
      UPDATE alimtalk_template SET
        template_code = ${input.template_code ?? (cur.template_code as string)},
        subject = ${input.subject !== undefined ? input.subject : (cur.subject as string | null)},
        message = ${input.message ?? (cur.message as string)},
        primary_btn_name = ${input.primary_btn_name !== undefined ? input.primary_btn_name : (cur.primary_btn_name as string | null)},
        primary_btn_url = ${input.primary_btn_url !== undefined ? input.primary_btn_url : (cur.primary_btn_url as string | null)},
        is_active = ${input.is_active ?? (cur.is_active as boolean)},
        updated_at = now()
      WHERE id = ${id}
    `;
    return this.getAlimtalkTemplate(id);
  }

  async removeAlimtalkTemplate(id: number) {
    const r = await this.sql`DELETE FROM alimtalk_template WHERE id = ${id}`;
    if (r.count === 0) throw new NotFoundException('템플릿을 찾을 수 없습니다.');
    return { ok: true };
  }
}
