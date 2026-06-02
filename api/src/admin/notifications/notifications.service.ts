import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { PushService } from '../../shared/push/push.service';
import { SmsService } from '../../user/sms/sms.service';

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
    private readonly sms: SmsService,
  ) {}

  // ─── 알림톡 테스트 발송 ─────────────────────
  /**
   * 운영 알림톡을 임의 폰으로 테스트 발송. notification_log 적재 안 함.
   * Body: { template_code, phone, vars? }
   */
  async sendAlimtalkTest(body: { template_code: string; phone: string; vars?: Record<string, string | number> }) {
    if (!body.template_code) throw new BadRequestException('template_code 누락');
    if (!body.phone) throw new BadRequestException('phone 누락');
    return this.sms.sendAlimtalkByCode(
      body.template_code,
      body.phone,
      body.vars ?? {},
      `[테스트] ${body.template_code}`,
    );
  }

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

  /** 푸시 발송 이력 전체 삭제 — 관리자 화면의 '내역 비우기' 버튼용. */
  async clearPushHistory(): Promise<{ ok: true; deleted: number }> {
    const r = await this.sql`DELETE FROM notification_log`;
    return { ok: true, deleted: r.count };
  }

  // ─── 푸시 발송 ────────────────────────────
  /**
   * target:
   *  - 'all'       전체 공지        → FCM topic `chl_all`, category=`전체공지`
   *  - 'user'      일반회원         → FCM topic `chl_2`,   category=`일반회원`
   *  - 'counselor' 상담사            → FCM topic `chl_5`,   category=`상담사`
   *  - 숫자 문자열 → 단일 member_id (개별), 토큰 직접발송, category=`개별`
   *
   * 브로드캐스트는 notification_log 에 단일 row(member_id=NULL, mb_id='all') 로
   * 기록되며, 사용자측 조회에서 role + category 매칭으로 노출된다 (sample 충실 이식).
   * 개별 발송은 회원당 1 row(member_id 지정) 로 기록한다.
   */
  /**
   * 단일 토큰 또는 토픽으로 직접 발송 — 테스트용.
   * notification_log 에 기록하지 않아 운영 이력에 영향 없음.
   */
  async sendPushTest(input: {
    token?: string;
    topic?: string;
    title: string;
    content?: string;
    link_url?: string;
  }): Promise<{ ok: boolean; mode: 'token' | 'topic'; result: unknown; error?: string }> {
    const title = (input.title ?? '').trim();
    if (!title) throw new BadRequestException('title 은 필수입니다.');
    if (!this.push.isEnabled()) {
      return { ok: false, mode: input.token ? 'token' : 'topic', result: null, error: 'FCM 미설정' };
    }
    const payload = {
      title,
      body: input.content,
      data: input.link_url ? { event_url: input.link_url } : undefined,
    };
    if (input.token && input.token.trim()) {
      const r = await this.push.sendToTokens([input.token.trim()], payload);
      return { ok: r.ok, mode: 'token', result: r };
    }
    if (input.topic && input.topic.trim()) {
      const r = await this.push.sendToTopic(input.topic.trim(), payload);
      return { ok: r.ok, mode: 'topic', result: r };
    }
    throw new BadRequestException('token 또는 topic 중 하나는 필수입니다.');
  }

  async sendPush(input: { target: string; title: string; content?: string; link_url?: string }): Promise<{ ok: boolean; recipients: number; pushed: { success: number; failure: number; error?: string } }> {
    const { target, title } = input;
    const content = input.content ?? '';
    const linkUrl = input.link_url ?? null;
    if (!title || !title.trim()) throw new BadRequestException('제목은 필수입니다.');
    if (!target) throw new BadRequestException('발송 대상을 선택하세요.');

    const isBroadcast = target === 'all' || target === 'user' || target === 'counselor';

    let category: string;
    let topic: string | null = null;
    let recipientCount = 0;
    let pushed = { success: 0, failure: 0 } as { success: number; failure: number; error?: string };

    if (isBroadcast) {
      // 카테고리/토픽 매핑 (sample/adm/push_update.php 와 동일)
      if (target === 'all') { category = '전체공지'; topic = 'chl_all'; }
      else if (target === 'user') { category = '일반회원'; topic = 'chl_2'; }
      else { category = '상담사'; topic = 'chl_5'; }

      // 대상 카운트 (참고용, 실제 발송은 토픽 구독자 기준)
      const cnt = target === 'all'
        ? await this.sql<{ cnt: string }[]>`SELECT count(*)::text AS cnt FROM member WHERE role IN ('user','counselor') AND left_at IS NULL`
        : await this.sql<{ cnt: string }[]>`SELECT count(*)::text AS cnt FROM member WHERE role = ${target} AND left_at IS NULL`;
      recipientCount = Number(cnt[0]?.cnt ?? '0');

      // 단일 row 기록 (브로드캐스트)
      await this.sql`
        INSERT INTO notification_log (member_id, mb_id, title, content, link_url, category, code)
        VALUES (NULL, 'all', ${title}, ${content}, ${linkUrl}, ${category}, 'alim_notice')
      `;

      // FCM 토픽 발송
      if (this.push.isEnabled() && topic) {
        const r = await this.push.sendToTopic(topic, {
          title,
          body: content,
          data: linkUrl ? { event_url: linkUrl } : undefined,
        });
        pushed = r.ok
          ? { success: 1, failure: 0 }
          : { success: 0, failure: 1, error: r.error };
      } else {
        pushed = { success: 0, failure: 0, error: 'FCM 미설정 — notification_log만 기록됨' };
      }
    } else if (/^\d+$/.test(target)) {
      // 개별 발송
      const id = Number(target);
      const recipients = await this.sql<{ id: number; mb_id: string | null }[]>`
        SELECT id, mb_id FROM member WHERE id = ${id}
      `;
      if (recipients.length === 0) throw new NotFoundException('회원을 찾을 수 없습니다.');
      recipientCount = recipients.length;
      category = '개별';

      const r = recipients[0];
      await this.sql`
        INSERT INTO notification_log (member_id, mb_id, title, content, link_url, category, code)
        VALUES (${r.id}, ${r.mb_id ?? ''}, ${title}, ${content}, ${linkUrl}, ${category}, 'alim_notice')
      `;

      if (this.push.isEnabled()) {
        const tokens = await this.sql<{ token: string }[]>`
          SELECT token FROM member_push_token
           WHERE is_active = true AND token <> '' AND member_id = ${r.id}
        `;
        const tokenList = tokens.map((t) => t.token);
        if (tokenList.length > 0) {
          const sr = await this.push.sendToTokens(tokenList, {
            title,
            body: content,
            data: linkUrl ? { event_url: linkUrl } : undefined,
          });
          pushed = { success: sr.success, failure: sr.failure, error: sr.error };
        }
      } else {
        pushed = { success: 0, failure: 0, error: 'FCM 미설정 — notification_log만 기록됨' };
      }
    } else {
      throw new BadRequestException(`알 수 없는 발송 대상: ${target}`);
    }

    return { ok: true, recipients: recipientCount, pushed };
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
