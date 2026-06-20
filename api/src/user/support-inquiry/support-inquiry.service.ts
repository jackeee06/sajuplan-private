import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { OpsAlertService } from '../../shared/ops-alert/ops-alert.service';

/**
 * 회원 → 운영자(고객센터) 1:1 문의.
 *
 * 저장소: 기존 post_qa 테이블 재사용 (slug 'qa' — 관리자 "고객센터 문의(회원)" 메뉴가 이미 목록·답변 지원).
 *   - 회원이 앱 "이용안내 > 1:1 문의" 로 작성 → post_qa INSERT
 *   - 관리자가 답변하면 post_qa.extras.admin_reply 에 박제 + 회원에게 FCM 푸시
 *   - 답변 달리기 전까지만 회원이 수정·삭제 가능
 *
 * post_qa 스키마 확인(2026-06-19): title 만 NOT NULL(무default), 나머지는 default/nullable → INSERT 안전.
 */

export const SUPPORT_CATEGORIES = ['이용안내', '결제/충전', '상담', '기타'] as const;

export interface SupportInquiryListItem {
  id: number;
  category: string | null;
  title: string;
  content: string;
  is_secret: boolean;
  has_reply: boolean;
  status: '답변완료' | '답변대기';
  created_at: string;
}

export interface SupportInquiryDetail extends SupportInquiryListItem {
  reply: {
    content: string;
    replied_at: string | null;
    replied_by: string | null;
  } | null;
}

interface AdminReply {
  content?: string;
  replied_at?: string;
  replied_by?: string;
}

@Injectable()
export class UserSupportInquiryService {
  private readonly logger = new Logger(UserSupportInquiryService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly opsAlert: OpsAlertService,
  ) {}

  /** 문의 작성 */
  async create(params: {
    memberId: number;
    category: string;
    title: string;
    content: string;
    isSecret: boolean;
  }): Promise<{ id: number }> {
    const title = params.title.trim();
    const content = params.content.trim();
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content) throw new BadRequestException('문의 내용을 입력해주세요.');
    if (title.length > 255) throw new BadRequestException('제목이 너무 깁니다. (최대 255자)');

    const category = (SUPPORT_CATEGORIES as readonly string[]).includes(params.category)
      ? params.category
      : '기타';

    // 하루 10건 제한 — 스팸 방어
    const today = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
        FROM post_qa
       WHERE member_id = ${params.memberId}
         AND created_at >= CURRENT_DATE::timestamptz
         AND created_at <  (CURRENT_DATE + 1)::timestamptz
    `;
    if (Number(today[0]?.count ?? 0) >= 10) {
      throw new BadRequestException('하루 문의 가능 횟수를 초과했습니다. (최대 10건)');
    }

    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO post_qa (member_id, mb_id, title, content, category, is_secret)
      VALUES (
        ${params.memberId},
        (SELECT mb_id FROM member WHERE id = ${params.memberId}),
        ${title},
        ${content},
        ${category},
        ${params.isSecret}
      )
      RETURNING id
    `;

    // 운영자 알림(관리자 문의톡) — 새 문의 즉시 인지. fire-and-forget, 실패해도 작성은 성공.
    void this.notifyOpsNewInquiry(params.memberId, category, title).catch((e) =>
      this.logger.warn(`[support-inquiry] 운영자 알림 실패: ${e instanceof Error ? e.message : String(e)}`),
    );

    return { id: rows[0].id };
  }

  /** 새 고객센터 문의 → 운영자(관리자 문의톡)에게 알림 */
  private async notifyOpsNewInquiry(memberId: number, category: string, title: string): Promise<void> {
    const rows = await this.sql<{ name: string | null; nickname: string | null; mb_id: string | null }[]>`
      SELECT name, nickname, mb_id FROM member WHERE id = ${memberId} LIMIT 1
    `;
    const m = rows[0];
    const who = m?.name || m?.nickname || m?.mb_id || `#${memberId}`;
    const detail = `새 고객센터 1:1 문의가 접수되었습니다.\n분류: ${category}\n제목: ${title}\n회원: ${who}\n→ 관리자 > 상담·문의 관리 > 고객센터 문의(회원) 에서 답변해주세요.`;
    // 카테고리 'cs_inquiry' — 30초 쿨다운(동일 회원 연타 방지, 정상 문의는 거의 그대로 통과)
    await this.opsAlert.send('고객센터 문의', detail, { cooldownSec: 30 });
  }

  /** 내 문의 목록 */
  async listByMember(params: {
    memberId: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SupportInquiryListItem[]; total: number }> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);

    type Row = {
      id: number;
      category: string | null;
      title: string;
      content: string | null;
      is_secret: boolean;
      created_at: Date;
      has_reply: boolean;
    };

    const [rows, totalRows] = await Promise.all([
      this.sql<Row[]>`
        SELECT id, category, title, content, is_secret, created_at,
               (extras -> 'admin_reply') IS NOT NULL AS has_reply
          FROM post_qa
         WHERE member_id = ${params.memberId}
         ORDER BY created_at DESC, id DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM post_qa WHERE member_id = ${params.memberId}
      `,
    ]);

    const items: SupportInquiryListItem[] = rows.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      content: r.content ?? '',
      is_secret: r.is_secret,
      has_reply: r.has_reply,
      status: r.has_reply ? '답변완료' : '답변대기',
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));

    return { items, total: Number(totalRows[0]?.count ?? 0) };
  }

  /** 내 문의 단건 — 본인 소유만 */
  async getOneByMember(params: {
    memberId: number;
    id: number;
  }): Promise<SupportInquiryDetail> {
    type Row = {
      id: number;
      member_id: number | null;
      category: string | null;
      title: string;
      content: string | null;
      is_secret: boolean;
      created_at: Date;
      admin_reply: AdminReply | null;
    };

    const rows = await this.sql<Row[]>`
      SELECT id, member_id, category, title, content, is_secret, created_at,
             extras -> 'admin_reply' AS admin_reply
        FROM post_qa
       WHERE id = ${params.id}
       LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    const q = rows[0];
    if (Number(q.member_id) !== Number(params.memberId)) {
      throw new ForbiddenException('본인 문의만 조회할 수 있습니다.');
    }

    const ar = q.admin_reply;
    const reply = ar && ar.content
      ? {
          content: ar.content,
          replied_at: ar.replied_at ?? null,
          replied_by: ar.replied_by ?? null,
        }
      : null;

    return {
      id: q.id,
      category: q.category,
      title: q.title,
      content: q.content ?? '',
      is_secret: q.is_secret,
      has_reply: reply !== null,
      status: reply !== null ? '답변완료' : '답변대기',
      created_at: q.created_at instanceof Date ? q.created_at.toISOString() : String(q.created_at),
      reply,
    };
  }

  /** 문의 수정 — 본인 소유 + 답변 없을 때만 */
  async update(params: {
    memberId: number;
    id: number;
    title: string;
    content: string;
  }): Promise<{ id: number }> {
    const title = params.title.trim();
    const content = params.content.trim();
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content) throw new BadRequestException('문의 내용을 입력해주세요.');
    if (title.length > 255) throw new BadRequestException('제목이 너무 깁니다. (최대 255자)');

    const rows = await this.sql<{ member_id: number | null; has_reply: boolean }[]>`
      SELECT member_id, (extras -> 'admin_reply') IS NOT NULL AS has_reply
        FROM post_qa WHERE id = ${params.id} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    if (Number(rows[0].member_id) !== Number(params.memberId)) {
      throw new ForbiddenException('본인이 작성한 문의만 수정할 수 있습니다.');
    }
    if (rows[0].has_reply) throw new ForbiddenException('답변이 달린 문의는 수정할 수 없습니다.');

    await this.sql`
      UPDATE post_qa SET title = ${title}, content = ${content}, updated_at = now()
       WHERE id = ${params.id}
    `;
    return { id: params.id };
  }

  /** 문의 삭제 — 본인 소유 + 답변 없을 때만 */
  async remove(params: { memberId: number; id: number }): Promise<{ ok: true }> {
    const rows = await this.sql<{ member_id: number | null; has_reply: boolean }[]>`
      SELECT member_id, (extras -> 'admin_reply') IS NOT NULL AS has_reply
        FROM post_qa WHERE id = ${params.id} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    if (Number(rows[0].member_id) !== Number(params.memberId)) {
      throw new ForbiddenException('본인이 작성한 문의만 삭제할 수 있습니다.');
    }
    if (rows[0].has_reply) throw new ForbiddenException('답변이 달린 문의는 삭제할 수 없습니다.');

    await this.sql`DELETE FROM post_qa WHERE id = ${params.id}`;
    return { ok: true };
  }
}
