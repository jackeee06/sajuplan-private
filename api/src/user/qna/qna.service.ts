import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { PushService } from '../../shared/push/push.service';
import { SmsService } from '../sms/sms.service';

export interface CounselorQnaListItem {
  id: number;
  title: string;
  content: string;
  is_secret: boolean;
  /** 답변 등록 여부 */
  has_reply: boolean;
  status: '답변완료' | '답변대기';
  /** 마스킹된 작성자 닉네임 (예: '김*객'). 본문은 비밀글이면 가림. */
  reviewer_name: string;
  created_at: string;
  /** 요청자 본인이 작성한 글 여부 */
  is_mine: boolean;
}

export interface CounselorCustomerQnaListItem {
  id: number;
  title: string;
  content: string;
  is_secret: boolean;
  has_reply: boolean;
  status: '답변완료' | '답변대기';
  reviewer_name: string;
  created_at: string;
}

export interface CounselorCustomerQnaDetail {
  id: number;
  title: string;
  content: string;
  is_secret: boolean;
  reviewer_name: string;
  created_at: string;
  reply: {
    id: number;
    content: string;
    counselor_nickname: string;
    counselor_profile_image: string | null;
    counselor_profile_image_webp: string | null;
    created_at: string;
  } | null;
}

export interface MyQnaListItem {
  id: number;
  counselor_id: number;
  counselor_name: string;
  counselor_code: string;
  title: string;
  content: string;
  is_secret: boolean;
  has_reply: boolean;
  status: '답변완료' | '답변대기';
  reviewer_name: string;
  created_at: string;
}

export interface MyQnaDetail {
  id: number;
  counselor_id: number;
  counselor_name: string;
  counselor_code: string;
  title: string;
  content: string;
  is_secret: boolean;
  reviewer_name: string;
  created_at: string;
  reply: {
    id: number;
    content: string;
    counselor_nickname: string;
    counselor_profile_image: string | null;
    counselor_profile_image_webp: string | null;
    created_at: string;
  } | null;
}

export interface CounselorQnaDetail {
  id: number;
  counselor_id: number;
  title: string;
  content: string;
  is_secret: boolean;
  is_mine: boolean;
  has_reply: boolean;
  reviewer_name: string;
  created_at: string;
  reply: {
    id: number;
    content: string;
    counselor_nickname: string;
    counselor_profile_image: string | null;
    counselor_profile_image_webp: string | null;
    created_at: string;
  } | null;
}

@Injectable()
export class UserCounselorQnaService {
  private readonly logger = new Logger(UserCounselorQnaService.name);

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly sms: SmsService,
    private readonly push: PushService,
  ) {}

  /** 특정 상담사의 문의 목록 + 총 건수 */
  async listByCounselor(params: {
    counselorId: number;
    limit?: number;
    offset?: number;
    /** 비밀글 본문을 볼 수 있는 사용자 — 작성자 본인 또는 해당 상담사 본인. 그 외엔 본문 가림. */
    requesterId?: number;
  }): Promise<{ items: CounselorQnaListItem[]; total: number }> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);

    type Row = {
      id: number;
      title: string;
      content: string;
      is_secret: boolean;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
      member_id: number | null;
      created_at: Date;
      reply_id: number | null;
    };

    const [rows, totalRows] = await Promise.all([
      this.sql<Row[]>`
        SELECT q.id, q.title, q.content, q.is_secret, q.member_id, q.created_at,
               m.nickname AS reviewer_nickname, m.mb_id AS reviewer_mb_id,
               r.id AS reply_id
          FROM counselor_qna q
          LEFT JOIN member m ON m.id = q.member_id
          LEFT JOIN counselor_qna_reply r ON r.qna_id = q.id
         WHERE q.counselor_id = ${params.counselorId}
           AND q.is_hidden = FALSE
         ORDER BY q.created_at DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
          FROM counselor_qna
         WHERE counselor_id = ${params.counselorId}
           AND is_hidden = FALSE
      `,
    ]);

    const items: CounselorQnaListItem[] = rows.map((r) => {
      const isOwner =
        params.requesterId != null && Number(r.member_id) === Number(params.requesterId);
      const isCounselor =
        params.requesterId != null && Number(params.requesterId) === Number(params.counselorId);
      const canSeeContent = isOwner || isCounselor; // 정책: 문의는 제3자에게 항상 비밀
      const has_reply = r.reply_id != null;
      return {
        id: r.id,
        title: r.title,
        content: canSeeContent ? r.content : '',
        is_secret: r.is_secret,
        has_reply,
        status: has_reply ? '답변완료' : '답변대기',
        reviewer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id),
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        is_mine: isOwner,
      };
    });

    return { items, total: Number(totalRows[0]?.count ?? 0) };
  }

  /** 단건 조회 — 비밀글이면 본인/상담사/관리자만 본문 노출 */
  async getOne(params: {
    counselorId: number;
    qnaId: number;
    requesterId?: number;
  }): Promise<CounselorQnaDetail> {
    type QnaRow = {
      id: number;
      counselor_id: number;
      member_id: number | null;
      title: string;
      content: string;
      is_secret: boolean;
      is_hidden: boolean;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
      created_at: Date;
    };

    const rows = await this.sql<QnaRow[]>`
      SELECT q.id, q.counselor_id, q.member_id, q.title, q.content, q.is_secret, q.is_hidden, q.created_at,
             m.nickname AS reviewer_nickname, m.mb_id AS reviewer_mb_id
        FROM counselor_qna q
        LEFT JOIN member m ON m.id = q.member_id
       WHERE q.id = ${params.qnaId}
         AND q.counselor_id = ${params.counselorId}
       LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    const q = rows[0];

    const isOwner =
      params.requesterId != null && Number(q.member_id) === Number(params.requesterId);
    const isCounselor =
      params.requesterId != null && Number(params.requesterId) === Number(q.counselor_id);

    // 숨김 처리된 글: 작성자 본인 + 해당 상담사만 접근 가능
    if (q.is_hidden && !isOwner && !isCounselor) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    const canSeeContent = isOwner || isCounselor; // 정책: 문의는 제3자에게 항상 비밀

    type ReplyRow = {
      id: number;
      content: string;
      created_at: Date;
      counselor_nickname: string;
      counselor_name: string;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
    };

    const replyRows = await this.sql<ReplyRow[]>`
      SELECT r.id, r.content, r.created_at,
             c.nickname AS counselor_nickname, c.name AS counselor_name,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp
        FROM counselor_qna_reply r
        INNER JOIN member c ON c.id = r.counselor_id
       WHERE r.qna_id = ${params.qnaId}
       LIMIT 1
    `;
    const reply = replyRows[0]
      ? {
          id: replyRows[0].id,
          content: replyRows[0].content,
          counselor_nickname:
            replyRows[0].counselor_nickname || replyRows[0].counselor_name,
          counselor_profile_image: replyRows[0].profile_stored_name
            ? `/uploads/member/${replyRows[0].profile_stored_name}`
            : null,
          counselor_profile_image_webp: replyRows[0].profile_stored_name_webp
            ? `/uploads/member/${replyRows[0].profile_stored_name_webp}`
            : null,
          created_at:
            replyRows[0].created_at instanceof Date
              ? replyRows[0].created_at.toISOString()
              : String(replyRows[0].created_at),
        }
      : null;

    return {
      id: q.id,
      counselor_id: q.counselor_id,
      title: q.title,
      content: canSeeContent ? q.content : '',
      is_secret: q.is_secret,
      is_mine: isOwner,
      has_reply: reply !== null,
      reviewer_name: displayReviewer(q.reviewer_nickname, q.reviewer_mb_id),
      created_at:
        q.created_at instanceof Date
          ? q.created_at.toISOString()
          : String(q.created_at),
      reply,
    };
  }

  /**
   * 내가 쓴 상담문의 목록 — 마이페이지 "나의 상담문의" 용.
   * 상담사 정보(이름·코드)와 답변 유무를 함께 반환.
   */
  async listByMember(params: {
    memberId: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: MyQnaListItem[]; total: number }> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);

    type Row = {
      id: number;
      counselor_id: number;
      counselor_name: string | null;
      counselor_nickname: string | null;
      counselor_code: string | null;
      title: string;
      content: string;
      is_secret: boolean;
      created_at: Date;
      reply_id: number | null;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
    };

    const [rows, totalRows] = await Promise.all([
      this.sql<Row[]>`
        SELECT q.id, q.counselor_id, q.title, q.content, q.is_secret, q.created_at,
               c.name AS counselor_name, c.nickname AS counselor_nickname,
               c.dtmfno AS counselor_code,
               r.id AS reply_id,
               m.nickname AS reviewer_nickname, m.mb_id AS reviewer_mb_id
          FROM counselor_qna q
          LEFT JOIN member c ON c.id = q.counselor_id
          LEFT JOIN member m ON m.id = q.member_id
          LEFT JOIN counselor_qna_reply r ON r.qna_id = q.id
         WHERE q.member_id = ${params.memberId}
         ORDER BY q.created_at DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
          FROM counselor_qna
         WHERE member_id = ${params.memberId}
      `,
    ]);

    const items: MyQnaListItem[] = rows.map((r) => {
      const has_reply = r.reply_id != null;
      return {
        id: r.id,
        counselor_id: r.counselor_id,
        counselor_name: r.counselor_nickname || r.counselor_name || '상담사',
        counselor_code: r.counselor_code || '',
        title: r.title,
        content: r.content,
        is_secret: r.is_secret,
        has_reply,
        status: has_reply ? '답변완료' : '답변대기',
        reviewer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id),
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
      };
    });

    return { items, total: Number(totalRows[0]?.count ?? 0) };
  }

  /** 내가 쓴 상담문의 단건 — 본인 소유가 아니면 ForbiddenException */
  async getOneByMember(params: {
    memberId: number;
    qnaId: number;
  }): Promise<MyQnaDetail> {
    type QnaRow = {
      id: number;
      counselor_id: number;
      member_id: number | null;
      counselor_name: string | null;
      counselor_nickname: string | null;
      counselor_code: string | null;
      title: string;
      content: string;
      is_secret: boolean;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
      created_at: Date;
    };

    const rows = await this.sql<QnaRow[]>`
      SELECT q.id, q.counselor_id, q.member_id, q.title, q.content, q.is_secret, q.created_at,
             c.name AS counselor_name, c.nickname AS counselor_nickname,
             c.dtmfno AS counselor_code,
             m.nickname AS reviewer_nickname, m.mb_id AS reviewer_mb_id
        FROM counselor_qna q
        LEFT JOIN member c ON c.id = q.counselor_id
        LEFT JOIN member m ON m.id = q.member_id
       WHERE q.id = ${params.qnaId}
       LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    const q = rows[0];
    if (Number(q.member_id) !== Number(params.memberId)) {
      throw new ForbiddenException('본인 문의만 조회할 수 있습니다.');
    }

    type ReplyRow = {
      id: number;
      content: string;
      created_at: Date;
      counselor_nickname: string;
      counselor_name: string;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
    };

    const replyRows = await this.sql<ReplyRow[]>`
      SELECT r.id, r.content, r.created_at,
             c.nickname AS counselor_nickname, c.name AS counselor_name,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp
        FROM counselor_qna_reply r
        INNER JOIN member c ON c.id = r.counselor_id
       WHERE r.qna_id = ${params.qnaId}
       LIMIT 1
    `;
    const reply = replyRows[0]
      ? {
          id: replyRows[0].id,
          content: replyRows[0].content,
          counselor_nickname:
            replyRows[0].counselor_nickname || replyRows[0].counselor_name,
          counselor_profile_image: replyRows[0].profile_stored_name
            ? `/uploads/member/${replyRows[0].profile_stored_name}`
            : null,
          counselor_profile_image_webp: replyRows[0].profile_stored_name_webp
            ? `/uploads/member/${replyRows[0].profile_stored_name_webp}`
            : null,
          created_at:
            replyRows[0].created_at instanceof Date
              ? replyRows[0].created_at.toISOString()
              : String(replyRows[0].created_at),
        }
      : null;

    return {
      id: q.id,
      counselor_id: q.counselor_id,
      counselor_name: q.counselor_nickname || q.counselor_name || '상담사',
      counselor_code: q.counselor_code || '',
      title: q.title,
      content: q.content,
      is_secret: q.is_secret,
      reviewer_name: displayReviewer(q.reviewer_nickname, q.reviewer_mb_id),
      created_at:
        q.created_at instanceof Date
          ? q.created_at.toISOString()
          : String(q.created_at),
      reply,
    };
  }

  /**
   * 상담사 마이페이지 — 내게 들어온 1:1 문의 목록.
   * 회원 마스킹/비밀글 본문 제한 없이 답변 작성 본인이므로 전체 본문 노출.
   */
  async listForCounselor(params: {
    counselorId: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CounselorCustomerQnaListItem[]; total: number }> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);

    type Row = {
      id: number;
      title: string;
      content: string;
      is_secret: boolean;
      created_at: Date;
      reply_id: number | null;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
    };

    const [rows, totalRows] = await Promise.all([
      this.sql<Row[]>`
        SELECT q.id, q.title, q.content, q.is_secret, q.created_at,
               r.id AS reply_id,
               m.nickname AS reviewer_nickname, m.mb_id AS reviewer_mb_id
          FROM counselor_qna q
          LEFT JOIN member m ON m.id = q.member_id
          LEFT JOIN counselor_qna_reply r ON r.qna_id = q.id
         WHERE q.counselor_id = ${params.counselorId}
         ORDER BY q.created_at DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
          FROM counselor_qna
         WHERE counselor_id = ${params.counselorId}
      `,
    ]);

    const items: CounselorCustomerQnaListItem[] = rows.map((r) => {
      const has_reply = r.reply_id != null;
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        is_secret: r.is_secret,
        has_reply,
        status: has_reply ? '답변완료' : '답변대기',
        reviewer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id),
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
      };
    });

    return { items, total: Number(totalRows[0]?.count ?? 0) };
  }

  /** 상담사 — 자기 앞으로 들어온 문의 단건 조회 (소유 검증) */
  async getOneForCounselor(params: {
    counselorId: number;
    qnaId: number;
  }): Promise<CounselorCustomerQnaDetail> {
    type QnaRow = {
      id: number;
      counselor_id: number;
      title: string;
      content: string;
      is_secret: boolean;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
      created_at: Date;
    };

    const rows = await this.sql<QnaRow[]>`
      SELECT q.id, q.counselor_id, q.title, q.content, q.is_secret, q.created_at,
             m.nickname AS reviewer_nickname, m.mb_id AS reviewer_mb_id
        FROM counselor_qna q
        LEFT JOIN member m ON m.id = q.member_id
       WHERE q.id = ${params.qnaId}
       LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    const q = rows[0];
    if (Number(q.counselor_id) !== Number(params.counselorId)) {
      throw new ForbiddenException('본인 앞 문의만 조회할 수 있습니다.');
    }

    type ReplyRow = {
      id: number;
      content: string;
      created_at: Date;
      counselor_nickname: string;
      counselor_name: string;
      profile_stored_name: string | null;
      profile_stored_name_webp: string | null;
    };

    const replyRows = await this.sql<ReplyRow[]>`
      SELECT r.id, r.content, r.created_at,
             c.nickname AS counselor_nickname, c.name AS counselor_name,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name_webp
        FROM counselor_qna_reply r
        INNER JOIN member c ON c.id = r.counselor_id
       WHERE r.qna_id = ${params.qnaId}
       LIMIT 1
    `;
    const reply = replyRows[0]
      ? {
          id: replyRows[0].id,
          content: replyRows[0].content,
          counselor_nickname:
            replyRows[0].counselor_nickname || replyRows[0].counselor_name,
          counselor_profile_image: replyRows[0].profile_stored_name
            ? `/uploads/member/${replyRows[0].profile_stored_name}`
            : null,
          counselor_profile_image_webp: replyRows[0].profile_stored_name_webp
            ? `/uploads/member/${replyRows[0].profile_stored_name_webp}`
            : null,
          created_at:
            replyRows[0].created_at instanceof Date
              ? replyRows[0].created_at.toISOString()
              : String(replyRows[0].created_at),
        }
      : null;

    return {
      id: q.id,
      title: q.title,
      content: q.content,
      is_secret: q.is_secret,
      reviewer_name: displayReviewer(q.reviewer_nickname, q.reviewer_mb_id),
      created_at:
        q.created_at instanceof Date
          ? q.created_at.toISOString()
          : String(q.created_at),
      reply,
    };
  }

  /** 상담사 답변 작성 — 1문의당 1답변, 중복 시 ConflictException */
  async createReply(params: {
    counselorId: number;
    qnaId: number;
    content: string;
  }): Promise<{ id: number }> {
    const content = params.content.trim();
    if (!content) throw new BadRequestException('답변 내용을 입력해주세요.');

    // 소유 검증
    const qrows = await this.sql<{ counselor_id: number }[]>`
      SELECT counselor_id FROM counselor_qna WHERE id = ${params.qnaId} LIMIT 1
    `;
    if (qrows.length === 0) {
      throw new NotFoundException('문의를 찾을 수 없습니다.');
    }
    if (Number(qrows[0].counselor_id) !== Number(params.counselorId)) {
      throw new ForbiddenException('본인 앞 문의에만 답변할 수 있습니다.');
    }

    // 중복 답변 방지
    const dup = await this.sql<{ id: number }[]>`
      SELECT id FROM counselor_qna_reply WHERE qna_id = ${params.qnaId} LIMIT 1
    `;
    if (dup.length > 0) {
      throw new ConflictException('이미 답변이 등록되어 있습니다.');
    }

    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO counselor_qna_reply (qna_id, counselor_id, content)
      VALUES (${params.qnaId}, ${params.counselorId}, ${content})
      RETURNING id
    `;

    // 알림톡: 고객에게 답변 등록 안내 (BizM qa_answer2)
    void this.notifyQaAnswer(params.qnaId, params.counselorId);

    return { id: rows[0].id };
  }

  /** 답변 수정 — 본인이 작성한 답변만. */
  async updateReply(params: {
    counselorId: number;
    qnaId: number;
    content: string;
  }): Promise<{ id: number }> {
    const content = params.content.trim();
    if (!content) throw new BadRequestException('답변 내용을 입력해주세요.');

    const rows = await this.sql<{ id: number; counselor_id: number }[]>`
      SELECT id, counselor_id FROM counselor_qna_reply WHERE qna_id = ${params.qnaId} LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('답변을 찾을 수 없습니다.');
    }
    if (Number(rows[0].counselor_id) !== params.counselorId) {
      throw new ForbiddenException('본인이 작성한 답변만 수정할 수 있습니다.');
    }
    await this.sql`
      UPDATE counselor_qna_reply
         SET content = ${content}
       WHERE id = ${rows[0].id}
    `;
    return { id: rows[0].id };
  }

  /** 답변 삭제 — 본인이 작성한 답변만. */
  async deleteReply(params: {
    counselorId: number;
    qnaId: number;
  }): Promise<{ ok: true }> {
    const rows = await this.sql<{ id: number; counselor_id: number }[]>`
      SELECT id, counselor_id FROM counselor_qna_reply WHERE qna_id = ${params.qnaId} LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('답변을 찾을 수 없습니다.');
    }
    if (Number(rows[0].counselor_id) !== Number(params.counselorId)) {
      throw new ForbiddenException('본인이 작성한 답변만 삭제할 수 있습니다.');
    }
    await this.sql`DELETE FROM counselor_qna_reply WHERE id = ${rows[0].id}`;
    return { ok: true };
  }

  /** 문의 작성 — 회원 인증 필요 */
  async create(params: {
    counselorId: number;
    memberId: number;
    title: string;
    content: string;
    isSecret: boolean;
  }): Promise<{ id: number }> {
    // 대상이 정말 상담사인지 확인 (잘못된 ID 로 작성 방지)
    const cnt = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
        FROM member
       WHERE id = ${params.counselorId}
         AND role = 'counselor'
         AND left_at IS NULL
    `;
    if (Number(cnt[0]?.count ?? 0) === 0) {
      throw new NotFoundException('상담사를 찾을 수 없습니다.');
    }

    // 본인 페이지에 본인이 문의 작성 금지
    if (params.memberId === params.counselorId) {
      throw new ForbiddenException('본인 페이지에는 문의할 수 없습니다.');
    }

    // 하루 5개 제한 — 같은 상담사에게 고객당 1일 최대 5개
    const todayCount = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
        FROM counselor_qna
       WHERE member_id = ${params.memberId}
         AND counselor_id = ${params.counselorId}
         AND created_at >= CURRENT_DATE::timestamptz
         AND created_at <  (CURRENT_DATE + 1)::timestamptz
    `;
    if (Number(todayCount[0]?.count ?? 0) >= 5) {
      throw new BadRequestException('같은 상담사에게 하루 최대 5개까지 문의할 수 있습니다.');
    }

    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO counselor_qna (counselor_id, member_id, title, content, is_secret)
      VALUES (${params.counselorId}, ${params.memberId}, ${params.title}, ${params.content}, ${params.isSecret})
      RETURNING id
    `;

    // 알림톡: 상담사에게 신규 문의 도착 안내 (BizM qa_ask_v2)
    void this.notifyQaAsk(params.counselorId, params.memberId, rows[0].id);

    return { id: rows[0].id };
  }

  /** 문의 수정 — 본인 소유 + 답변 없을 때만. 제목·내용만 수정 가능. */
  async updateQna(params: {
    memberId: number;
    qnaId: number;
    title: string;
    content: string;
  }): Promise<{ id: number }> {
    const title = params.title.trim();
    const content = params.content.trim();
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content) throw new BadRequestException('문의 내용을 입력해주세요.');
    if (title.length > 255) throw new BadRequestException('제목이 너무 깁니다. (최대 255자)');

    const rows = await this.sql<{ id: number; member_id: number | null }[]>`
      SELECT q.id, q.member_id
        FROM counselor_qna q
       WHERE q.id = ${params.qnaId}
       LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    if (Number(rows[0].member_id) !== Number(params.memberId)) throw new ForbiddenException('본인이 작성한 문의만 수정할 수 있습니다.');

    const reply = await this.sql<{ id: number }[]>`
      SELECT id FROM counselor_qna_reply WHERE qna_id = ${params.qnaId} LIMIT 1
    `;
    if (reply.length > 0) throw new ForbiddenException('답변이 달린 문의는 수정할 수 없습니다.');

    await this.sql`
      UPDATE counselor_qna SET title = ${title}, content = ${content}
       WHERE id = ${params.qnaId}
    `;
    return { id: params.qnaId };
  }

  /** 문의 삭제 — 본인 소유 + 답변 없을 때만. */
  async deleteQna(params: {
    memberId: number;
    qnaId: number;
  }): Promise<{ ok: true }> {
    const rows = await this.sql<{ id: number; member_id: number | null }[]>`
      SELECT id, member_id FROM counselor_qna WHERE id = ${params.qnaId} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    if (Number(rows[0].member_id) !== Number(params.memberId)) throw new ForbiddenException('본인이 작성한 문의만 삭제할 수 있습니다.');

    const reply = await this.sql<{ id: number }[]>`
      SELECT id FROM counselor_qna_reply WHERE qna_id = ${params.qnaId} LIMIT 1
    `;
    if (reply.length > 0) throw new ForbiddenException('답변이 달린 문의는 삭제할 수 없습니다.');

    await this.sql`DELETE FROM counselor_qna WHERE id = ${params.qnaId}`;
    return { ok: true };
  }

  async reportQna(params: {
    qnaId: number;
    reporterId: number;
    reason: string;
  }): Promise<{ ok: true }> {
    const rows = await this.sql<{ id: number; member_id: number }[]>`
      SELECT id, member_id FROM counselor_qna WHERE id = ${params.qnaId} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');

    try {
      await this.sql`
        INSERT INTO post_report (board_slug, post_id, reporter_id, reporter_mb_id, target_member_id, target_mb_id, mode, reason, status, created_at)
        VALUES ('counselor_qna', ${params.qnaId}, ${params.reporterId}, '',
                ${rows[0].member_id}, '', 'report', ${params.reason}, 0, NOW())
      `;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('unique') || msg.includes('duplicate')) throw new ConflictException('이미 신고한 문의입니다.');
      throw e;
    }

    // 신고 횟수 집계 — 3회 이상이면 자동 숨김
    const countRows = await this.sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM post_report
       WHERE board_slug = 'counselor_qna' AND post_id = ${params.qnaId}
    `;
    const reportCount = Number(countRows[0].cnt);
    if (reportCount >= 3) {
      await this.sql`UPDATE counselor_qna SET is_hidden = TRUE WHERE id = ${params.qnaId} AND is_hidden = FALSE`;
    }

    // 작성자에게 FCM 푸시 (fire-and-forget)
    void this.sendReportPush(rows[0].member_id, params.qnaId).catch((e) =>
      this.logger.warn(`[reportQna] 푸시 실패: ${e instanceof Error ? e.message : String(e)}`),
    );

    return { ok: true };
  }

  private async sendReportPush(authorId: number, qnaId: number): Promise<void> {
    const tokenRows = await this.sql<{ token: string }[]>`
      SELECT token FROM member_push_token
       WHERE member_id = ${authorId} AND is_active = TRUE
    `;
    const tokens = tokenRows.map((t) => t.token).filter(Boolean);
    if (tokens.length === 0) return;
    await this.push.sendToTokens(tokens, {
      title: '내 문의가 신고됐습니다',
      body: '게시된 문의에 신고가 접수되었습니다. 내용을 확인해주세요.',
      data: { type: 'qna_reported', qna_id: String(qnaId), link: '/mypage/my-qnas' },
    });
  }

  /**
   * 문의 등록 알림톡 (BizM qa_ask2) — 상담사 핸드폰 발송.
   *
   *   ※ 사주플랜 상담 문의 도착 안내 ※
   *   #{상담사명} 선생님, 새로운 상담 문의가 접수...
   *   → 버튼: 문의 내용 확인하기
   *
   * 변수: 상담사명. 고객명은 마스킹 정책상 본문에 안 들어가도 됨.
   * sample 의 wz_alimtalk_bizm 와 동일하게 fire-and-forget. 실패해도 본문 작성은 성공.
   */
  private async notifyQaAsk(counselorId: number, memberId: number, qnaId: number): Promise<void> {
    try {
      const rows = await this.sql<{
        counselor_phone: string | null;
        counselor_name: string | null;
        counselor_nickname: string | null;
        member_name: string | null;
        member_nickname: string | null;
      }[]>`
        SELECT
          c.phone     AS counselor_phone,
          c.name      AS counselor_name,
          c.nickname  AS counselor_nickname,
          m.name      AS member_name,
          m.nickname  AS member_nickname
        FROM member c
        LEFT JOIN member m ON m.id = ${memberId}
        WHERE c.id = ${counselorId}
        LIMIT 1
      `;
      const r = rows[0];
      if (!r?.counselor_phone) {
        this.logger.warn(`qa_ask2 스킵: 상담사 ${counselorId} 전화번호 없음`);
        return;
      }
      const counselorName = r.counselor_nickname || r.counselor_name || '';
      const customerName = r.member_nickname || r.member_name || '';
      const res = await this.sms.sendAlimtalkByCode(
        'qa_ask_v2',
        r.counselor_phone,
        { 상담사명: counselorName, 고객명: customerName, url: `/counselor/mypage/customer-qnas/${qnaId}` },
        '사주플랜 상담 문의 도착 안내',
      );
      if (!res.ok) {
        this.logger.warn(`qa_ask2 거부 counselor=${counselorId} reason=${res.reason} raw=${res.raw ?? ''}`);
      }
    } catch (e) {
      this.logger.warn(`qa_ask2 발송 예외 counselor=${counselorId}: ${(e as Error).message}`);
    }
  }

  /**
   * 답변 완료 알림톡 (BizM qa_answer2) — 문의 작성한 고객 핸드폰 발송.
   *
   *   ※ 사주플랜 문의글 답변 안내 ※
   *   #{고객명}님, #{상담사명} 선생님의 답변이 등록...
   *   → 버튼: 답변 내용 확인 하기
   */
  private async notifyQaAnswer(qnaId: number, counselorId: number): Promise<void> {
    try {
      const rows = await this.sql<{
        member_phone: string | null;
        member_name: string | null;
        member_nickname: string | null;
        counselor_name: string | null;
        counselor_nickname: string | null;
      }[]>`
        SELECT
          m.phone     AS member_phone,
          m.name      AS member_name,
          m.nickname  AS member_nickname,
          c.name      AS counselor_name,
          c.nickname  AS counselor_nickname
        FROM counselor_qna q
        LEFT JOIN member m ON m.id = q.member_id
        LEFT JOIN member c ON c.id = ${counselorId}
        WHERE q.id = ${qnaId}
        LIMIT 1
      `;
      const r = rows[0];
      if (!r?.member_phone) {
        this.logger.warn(`qa_answer2 스킵: 문의 ${qnaId} 고객 전화번호 없음`);
        return;
      }
      const customerName = r.member_nickname || r.member_name || '';
      const counselorName = r.counselor_nickname || r.counselor_name || '';
      const res = await this.sms.sendAlimtalkByCode(
        'qa_answer_v2',
        r.member_phone,
        { 고객명: customerName, 상담사명: counselorName },
        '사주플랜 문의글 답변 안내',
      );
      if (!res.ok) {
        this.logger.warn(`qa_answer2 거부 qna=${qnaId} reason=${res.reason} raw=${res.raw ?? ''}`);
      }
    } catch (e) {
      this.logger.warn(`qa_answer2 발송 예외 qna=${qnaId}: ${(e as Error).message}`);
    }
  }
}

/** sample 의 작성자 마스킹 (예: '김민지' → '김*지'). 2자 이하면 둘째 글자만 별표. */
function maskName(name: string): string {
  const s = name.trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*' + s.slice(2);
}

/** mb_id 마스킹 — 본명 노출 회피용 (2026-05-15). 예: 'ubuub1234' → 'ub***34' */
function maskMbId(mbId: string): string {
  const s = mbId.trim();
  if (s.length <= 2) return s;
  if (s.length <= 4) return s[0] + '***' + s.slice(-1);
  return s.slice(0, 2) + '***' + s.slice(-2);
}

/** 작성자 표기 우선순위: nickname → mb_id(마스킹) → '익명'. 본명 노출 안 함 (2026-05-15). */
function displayReviewer(nickname: string | null, mbId: string | null, fallback = '익명'): string {
  if (nickname && nickname.trim()) return maskName(nickname);
  if (mbId && mbId.trim()) return maskMbId(mbId);
  return fallback;
}
