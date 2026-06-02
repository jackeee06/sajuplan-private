import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface CounselorReviewListItem {
  id: number;
  /** 마스킹된 작성자 닉네임 (예: '김*객') */
  customer_name: string;
  is_private: boolean;
  /** 베스트 후기 여부 (상담사 본인이 선정, 2026-05-15 신설) */
  is_best: boolean;
  /** 베스트 선정 시각 — 정렬·UX 표시용. 해제 시 null */
  best_at: string | null;
  title: string;
  content: string;
  rating: number | null;
  img_url: string | null;
  consult_type: '전화상담' | '채팅상담' | '';
  /** 'YYYY.MM.DD' */
  date: string;
  /** '00시간17분20초' */
  duration: string;
  created_at: string;
  reply: { author: string; text: string } | null;
}

export interface CounselorReviewDetail {
  id: number;
  customer_name: string;
  is_private: boolean;
  title: string;
  content: string;
  rating: number | null;
  img_url: string | null;
  consult_type: '전화상담' | '채팅상담' | '';
  date: string;
  duration: string;
  created_at: string;
  reply: {
    id: number;
    author: string;
    profile_img: string | null;
    profile_img_webp: string | null;
    text: string;
    posted_at: string;
  } | null;
}

interface ReviewRow {
  id: number;
  counselor_id: number;
  title: string;
  content: string | null;
  rating: number | null;
  is_secret: boolean;
  is_best: boolean;
  best_at: Date | null;
  has_file: boolean;
  extras: Record<string, unknown> | null;
  created_at: Date;
  reviewer_nickname: string | null;
  reviewer_mb_id: string | null;
  reply_id: number | null;
  reply_content: string | null;
  reply_created_at: Date | null;
  counselor_nickname: string | null;
  counselor_name: string | null;
  counselor_profile: string | null;
  counselor_profile_webp: string | null;
}

@Injectable()
export class UserCounselorReviewsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * 상담사 마이페이지 후기 목록.
   *  - 본인이 받은 후기만 (post_review.counselor_id = me)
   *  - unanswered: 답변이 없는 후기만
   *  - photo: extras.photo_url 또는 has_file=true 인 후기만
   */
  async listMine(params: {
    counselorId: number;
    page?: number;
    limit?: number;
    unansweredOnly?: boolean;
    photoOnly?: boolean;
  }): Promise<{
    items: CounselorReviewListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 10)));
    const offset = (page - 1) * limit;

    const unansweredFilter = params.unansweredOnly
      ? this.sql`AND rep.id IS NULL`
      : this.sql``;
    const photoFilter = params.photoOnly
      ? this.sql`AND (
          (r.extras ->> 'photo_url') IS NOT NULL AND (r.extras ->> 'photo_url') <> ''
          OR r.has_file = TRUE
        )`
      : this.sql``;

    type Row = ReviewRow & { total: string };
    const rows = await this.sql<Row[]>`
      SELECT r.id, r.counselor_id, r.title, r.content, r.rating,
             r.is_secret, r.is_best, r.best_at, r.has_file, r.extras, r.created_at,
             rm.nickname AS reviewer_nickname, rm.mb_id AS reviewer_mb_id,
             rep.id              AS reply_id,
             rep.content         AS reply_content,
             rep.created_at      AS reply_created_at,
             c.nickname          AS counselor_nickname,
             c.name              AS counselor_name,
             NULL::text          AS counselor_profile,
             NULL::text          AS counselor_profile_webp,
             COUNT(*) OVER ()::text AS total
        FROM post_review r
        LEFT JOIN member rm        ON rm.id = r.member_id
        INNER JOIN member c        ON c.id  = r.counselor_id
        LEFT JOIN post_review_reply rep ON rep.review_id = r.id
       WHERE r.counselor_id = ${params.counselorId}
         ${unansweredFilter}
         ${photoFilter}
       ORDER BY r.is_best DESC, r.best_at DESC NULLS LAST, r.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    const items: CounselorReviewListItem[] = rows.map((r) => {
      const meta = extractMeta(r.extras, r.created_at);
      return {
        id: r.id,
        customer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id, '고객'),
        is_private: r.is_secret,
        is_best: r.is_best,
        best_at:
          r.best_at instanceof Date
            ? r.best_at.toISOString()
            : r.best_at === null ? null : String(r.best_at),
        title: r.title,
        content: r.is_secret ? '' : (r.content ?? ''),
        rating: r.rating,
        img_url: meta.photoUrl,
        consult_type: meta.consultType,
        date: meta.date,
        duration: meta.duration,
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        reply: r.reply_id
          ? {
              author: r.counselor_nickname || r.counselor_name || '상담사',
              text: r.reply_content ?? '',
            }
          : null,
      };
    });

    return { items, total, page, limit };
  }

  /** 단건 — 상담사 본인이 받은 후기만 조회 가능. 답변 풀세트 포함. */
  async getMine(
    counselorId: number,
    reviewId: number,
  ): Promise<CounselorReviewDetail> {
    const rows = await this.sql<ReviewRow[]>`
      SELECT r.id, r.counselor_id, r.title, r.content, r.rating,
             r.is_secret, r.has_file, r.extras, r.created_at,
             rm.nickname AS reviewer_nickname, rm.mb_id AS reviewer_mb_id,
             rep.id              AS reply_id,
             rep.content         AS reply_content,
             rep.created_at      AS reply_created_at,
             c.nickname          AS counselor_nickname,
             c.name              AS counselor_name,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_webp
        FROM post_review r
        LEFT JOIN member rm ON rm.id = r.member_id
        INNER JOIN member c ON c.id = r.counselor_id
        LEFT JOIN post_review_reply rep ON rep.review_id = r.id
       WHERE r.id = ${reviewId}
       LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('후기를 찾을 수 없습니다.');
    if (Number(r.counselor_id) !== counselorId) {
      throw new ForbiddenException('본인이 받은 후기만 조회할 수 있습니다.');
    }

    const meta = extractMeta(r.extras, r.created_at);
    return {
      id: r.id,
      customer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id, '고객'),
      is_private: r.is_secret,
      title: r.title,
      content: r.is_secret ? '' : (r.content ?? ''),
      rating: r.rating,
      img_url: meta.photoUrl,
      consult_type: meta.consultType,
      date: meta.date,
      duration: meta.duration,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      reply: r.reply_id
        ? {
            id: r.reply_id,
            author: r.counselor_nickname || r.counselor_name || '상담사',
            profile_img: r.counselor_profile
              ? `/uploads/member/${r.counselor_profile}`
              : null,
            profile_img_webp: r.counselor_profile_webp
              ? `/uploads/member/${r.counselor_profile_webp}`
              : null,
            text: r.reply_content ?? '',
            posted_at: r.reply_created_at
              ? r.reply_created_at instanceof Date
                ? r.reply_created_at.toISOString()
                : String(r.reply_created_at)
              : '',
          }
        : null,
    };
  }

  /** 답변 작성 — 후기 1건당 1답변. 이미 있으면 BadRequest. */
  async createReply(
    counselorId: number,
    reviewId: number,
    content: string,
  ): Promise<CounselorReviewDetail> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('답변 내용을 입력해주세요.');
    }

    const target = await this.sql<{ counselor_id: number }[]>`
      SELECT counselor_id FROM post_review WHERE id = ${reviewId} LIMIT 1
    `;
    if (target.length === 0) {
      throw new NotFoundException('후기를 찾을 수 없습니다.');
    }
    if (Number(target[0].counselor_id) !== counselorId) {
      throw new ForbiddenException('본인이 받은 후기만 답변할 수 있습니다.');
    }

    const existing = await this.sql<{ id: number }[]>`
      SELECT id FROM post_review_reply WHERE review_id = ${reviewId} LIMIT 1
    `;
    if (existing.length > 0) {
      throw new BadRequestException('이미 답변이 등록된 후기입니다.');
    }

    await this.sql`
      INSERT INTO post_review_reply (review_id, counselor_id, content)
      VALUES (${reviewId}, ${counselorId}, ${trimmed})
    `;

    return this.getMine(counselorId, reviewId);
  }

  /** 답변 수정 — 본인 답변만. */
  async updateReply(
    counselorId: number,
    reviewId: number,
    content: string,
  ): Promise<CounselorReviewDetail> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('답변 내용을 입력해주세요.');
    }

    const rows = await this.sql<{ id: number; counselor_id: number }[]>`
      SELECT id, counselor_id FROM post_review_reply
       WHERE review_id = ${reviewId} LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('답변이 존재하지 않습니다.');
    }
    if (Number(rows[0].counselor_id) !== counselorId) {
      throw new ForbiddenException('본인이 작성한 답변만 수정할 수 있습니다.');
    }

    await this.sql`
      UPDATE post_review_reply
         SET content = ${trimmed}, updated_at = now()
       WHERE id = ${rows[0].id}
    `;
    return this.getMine(counselorId, reviewId);
  }

  /** 답변 삭제 — 본인 답변만. */
  async deleteReply(counselorId: number, reviewId: number): Promise<void> {
    const rows = await this.sql<{ id: number; counselor_id: number }[]>`
      SELECT id, counselor_id FROM post_review_reply
       WHERE review_id = ${reviewId} LIMIT 1
    `;
    if (rows.length === 0) {
      throw new NotFoundException('답변이 존재하지 않습니다.');
    }
    if (Number(rows[0].counselor_id) !== counselorId) {
      throw new ForbiddenException('본인이 작성한 답변만 삭제할 수 있습니다.');
    }
    await this.sql`DELETE FROM post_review_reply WHERE id = ${rows[0].id}`;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
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

/** 작성자 표기 우선순위: nickname → mb_id(마스킹) → fallback. 본명은 노출 안 함 (2026-05-15). */
function displayReviewer(nickname: string | null, mbId: string | null, fallback = '익명'): string {
  if (nickname && nickname.trim()) return maskName(nickname);
  if (mbId && mbId.trim()) return maskMbId(mbId);
  return fallback;
}

/**
 * extras JSONB 에서 후기 카드 표시용 메타(상담타입/기간/사진) 추출.
 *  - consult_type: '전화상담' | '채팅상담' | '' (extras.consult_type)
 *  - duration: '00시간17분20초' (extras.consult_duration 또는 extras.duration)
 *  - photo_url: extras.photo_url (있으면 그대로, 절대/상대 어느쪽이든)
 */
function extractMeta(
  extras: Record<string, unknown> | null,
  createdAt: Date,
): { consultType: '전화상담' | '채팅상담' | ''; duration: string; date: string; photoUrl: string | null } {
  const e = (extras ?? {}) as Record<string, unknown>;
  const consultRaw =
    typeof e.consult_type === 'string' ? e.consult_type.trim() : '';
  const consultType: '전화상담' | '채팅상담' | '' =
    consultRaw === '전화상담' || consultRaw === '채팅상담' ? consultRaw : '';
  const duration =
    typeof e.consult_duration === 'string'
      ? e.consult_duration
      : typeof e.duration === 'string'
        ? e.duration
        : '';

  const photoUrl =
    typeof e.photo_url === 'string' && e.photo_url.trim().length > 0
      ? e.photo_url
      : null;

  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const date = isNaN(created.getTime())
    ? ''
    : `${created.getFullYear()}.${pad(created.getMonth() + 1)}.${pad(created.getDate())}`;

  return { consultType, duration, date, photoUrl };
}
