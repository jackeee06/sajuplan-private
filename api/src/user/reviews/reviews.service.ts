import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicRecentReview {
  id: number;
  title: string;
  content: string;
  rating: number | null;
  created_at: string;
  /** 작성자 익명 처리 표기 (예: '김*객') — 닉네임/이름에서 도출 */
  reviewer_name: string;
  counselor_id: number;
  counselor_nickname: string;
  counselor_code: string | null;
  counselor_profile_image: string | null;
  counselor_profile_image_webp: string | null;
  headline: string | null;
  hashtag1: string | null;
  hashtag2: string | null;
  unit_seconds: number | null;
  unit_cost: number | null;
  counselor_review_count: number;
  specialty: string | null;
  /** specialty/hashtag 에서 카테고리 추정 */
  category: '사주' | '타로' | '신점' | '기타';
}

/**
 * 메인 페이지 후기 탭 — sample/theme/basic/mobile/index.php 의 tab06(후기) 대응.
 * 최근 후기 N건을 상담사 정보와 함께 노출.
 */
@Injectable()
export class UserReviewsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async recent(params: {
    category?: string;
    limit?: number;
  }): Promise<PublicRecentReview[]> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 13));
    const cat = (params.category ?? '').trim();

    const categoryWhere =
      cat && cat !== '전체'
        ? this.sql`AND (
            COALESCE(pc.specialty, '') ILIKE ${'%' + cat + '%'}
            OR COALESCE(pc.hashtag1, '') ILIKE ${'%' + cat + '%'}
            OR COALESCE(pc.hashtag2, '') ILIKE ${'%' + cat + '%'}
          )`
        : this.sql``;

    type Row = {
      id: number;
      title: string;
      content: string | null;
      rating: number | null;
      created_at: Date;
      is_secret: boolean;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
      counselor_id: number;
      counselor_nickname: string;
      counselor_name: string;
      counselor_code: string | null;
      counselor_profile_image: string | null;
      counselor_profile_image_webp: string | null;
      headline: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      counselor_review_count: number | null;
      specialty: string | null;
    };

    const rows = await this.sql<Row[]>`
      SELECT r.id, r.title, r.content, r.rating, r.created_at, r.is_secret,
             rm.nickname AS reviewer_nickname, rm.mb_id AS reviewer_mb_id,
             c.id        AS counselor_id,
             c.nickname  AS counselor_nickname,
             c.name      AS counselor_name,
             c.csrid     AS counselor_code,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image_webp,
             pc.headline, pc.hashtag1, pc.hashtag2,
             pc.unit_seconds, pc.unit_cost,
             pc.review_count AS counselor_review_count,
             pc.specialty
        FROM post_review r
        LEFT JOIN member rm        ON rm.id = r.member_id
        INNER JOIN member c        ON c.id  = r.counselor_id
        LEFT JOIN post_counselor pc ON pc.member_id = c.id
       WHERE c.role = 'counselor'
         AND c.left_at IS NULL
         ${categoryWhere}
       ORDER BY r.created_at DESC
       LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      // 비밀글이면 본문 가림
      content: r.is_secret ? '' : (r.content ?? ''),
      rating: r.rating,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      reviewer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id),
      counselor_id: r.counselor_id,
      counselor_nickname: r.counselor_nickname || r.counselor_name,
      counselor_code: r.counselor_code,
      counselor_profile_image: r.counselor_profile_image ? `/uploads/member/${r.counselor_profile_image}` : null,
      counselor_profile_image_webp: r.counselor_profile_image_webp ? `/uploads/member/${r.counselor_profile_image_webp}` : null,
      headline: r.headline,
      hashtag1: r.hashtag1,
      hashtag2: r.hashtag2,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      counselor_review_count: r.counselor_review_count ?? 0,
      specialty: r.specialty,
      category: inferCategory(r.specialty, r.hashtag1, r.hashtag2),
    }));
  }

  /**
   * 특정 상담사의 후기 목록 + 총 건수.
   * 상담사 상세 페이지의 후기 탭(/counselors/:id/reviews) 에서 사용.
   */
  async byCounselor(params: {
    counselorId: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PublicCounselorReview[]; total: number }> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const offset = Math.max(0, params.offset ?? 0);

    type Row = {
      id: number;
      title: string;
      content: string | null;
      rating: number | null;
      created_at: Date;
      is_secret: boolean;
      is_best: boolean;
      best_at: Date | null;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
    };

    const [rows, totalRows] = await Promise.all([
      this.sql<Row[]>`
        SELECT r.id, r.title, r.content, r.rating, r.created_at, r.is_secret,
               r.is_best, r.best_at,
               rm.nickname AS reviewer_nickname, rm.mb_id AS reviewer_mb_id
          FROM post_review r
          LEFT JOIN member rm ON rm.id = r.member_id
         WHERE r.counselor_id = ${params.counselorId}
         ORDER BY r.is_best DESC, r.best_at DESC NULLS LAST, r.created_at DESC
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
          FROM post_review
         WHERE counselor_id = ${params.counselorId}
      `,
    ]);

    const items: PublicCounselorReview[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.is_secret ? '' : (r.content ?? ''),
      is_secret: r.is_secret,
      is_best: r.is_best,
      best_at:
        r.best_at instanceof Date
          ? r.best_at.toISOString()
          : r.best_at === null ? null : String(r.best_at),
      rating: r.rating,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      reviewer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id),
    }));

    return { items, total: Number(totalRows[0]?.count ?? 0) };
  }

  /**
   * 마이페이지 — 본인이 작성한 후기 목록.
   *  - photoOnly: extras.photo_url 가 있는 row 만 (또는 has_file=true 폴백)
   *  - 페이지네이션 + 총 건수 반환
   */
  async mine(params: {
    memberId: number;
    page?: number;
    limit?: number;
    photoOnly?: boolean;
  }): Promise<{
    items: MyReviewItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.trunc(params.limit ?? 10)));
    const offset = (page - 1) * limit;

    const photoFilter = params.photoOnly
      ? this.sql`AND (
          (r.extras ->> 'photo_url') IS NOT NULL AND (r.extras ->> 'photo_url') <> ''
          OR r.has_file = TRUE
        )`
      : this.sql``;

    type Row = {
      id: number;
      title: string;
      content: string | null;
      rating: number | null;
      created_at: Date;
      has_file: boolean;
      extras: Record<string, unknown> | null;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
      counselor_id: number;
      counselor_name: string;
      counselor_nickname: string;
      counselor_code: string | null;
      counselor_profile_image: string | null;
      counselor_profile_image_webp: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      specialty: string | null;
      total: string;
    };

    const rows = await this.sql<Row[]>`
      SELECT r.id, r.title, r.content, r.rating, r.created_at, r.has_file, r.extras,
             rm.nickname AS reviewer_nickname, rm.mb_id AS reviewer_mb_id,
             c.id        AS counselor_id,
             c.name      AS counselor_name,
             c.nickname  AS counselor_nickname,
             c.csrid     AS counselor_code,
             (SELECT mf.stored_name      FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
             (SELECT mf.stored_name_webp FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image_webp,
             pc.hashtag1, pc.hashtag2, pc.specialty,
             COUNT(*) OVER ()::text AS total
        FROM post_review r
        LEFT JOIN member rm        ON rm.id = r.member_id
        INNER JOIN member c        ON c.id  = r.counselor_id
        LEFT JOIN post_counselor pc ON pc.member_id = c.id
       WHERE r.member_id = ${params.memberId}
         ${photoFilter}
       ORDER BY r.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    const items: MyReviewItem[] = rows.map((r) => {
      const extras = parseExtras(r.extras);
      const photoUrl = pickPhotoUrl(extras);
      const photoUrlWebp = pickPhotoUrlWebp(extras);
      const consultType = typeof extras.consult_type === 'string' ? (extras.consult_type as string) : '';
      const consultDuration =
        typeof extras.consult_duration === 'string' ? (extras.consult_duration as string) : '';

      const created = r.created_at instanceof Date ? r.created_at : new Date(r.created_at);
      const consultDate = isNaN(created.getTime())
        ? ''
        : `${created.getFullYear()}.${pad(created.getMonth() + 1)}.${pad(created.getDate())}`;

      return {
        id: r.id,
        title: r.title,
        content: r.content ?? '',
        rating: r.rating,
        created_at: created.toISOString(),
        photo_url: photoUrl,
        photo_url_webp: photoUrlWebp,
        consult_type: consultType,
        consult_date: consultDate,
        consult_duration: consultDuration,
        customer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id, '고객'),
        counselor_id: r.counselor_id,
        counselor_name: r.counselor_nickname || r.counselor_name,
        counselor_code: r.counselor_code ?? '',
        counselor_badge: inferCategory(r.specialty, r.hashtag1, r.hashtag2),
        counselor_avatar: r.counselor_profile_image ? `/uploads/member/${r.counselor_profile_image}` : null,
      };
    });

    return { items, total, page, limit };
  }

  /** 본인 후기 단건 — 수정 폼 prefill 용. 본인이 아니면 403. */
  async getMine(id: number, memberId: number): Promise<MyReviewItem> {
    const rows = await this.sql<{
      id: number;
      title: string;
      content: string | null;
      rating: number | null;
      is_secret: boolean;
      has_file: boolean;
      extras: Record<string, unknown> | null;
      created_at: Date;
      member_id: number | null;
      counselor_id: number;
      counselor_name: string;
      counselor_nickname: string;
      counselor_code: string | null;
      counselor_profile_image: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      specialty: string | null;
      reviewer_nickname: string | null;
      reviewer_mb_id: string | null;
    }[]>`
      SELECT r.id, r.title, r.content, r.rating, r.is_secret, r.has_file, r.extras, r.created_at, r.member_id,
             c.id        AS counselor_id,
             c.name      AS counselor_name,
             c.nickname  AS counselor_nickname,
             c.csrid     AS counselor_code,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = c.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS counselor_profile_image,
             pc.hashtag1, pc.hashtag2, pc.specialty,
             rm.nickname AS reviewer_nickname, rm.mb_id AS reviewer_mb_id
        FROM post_review r
        INNER JOIN member c ON c.id = r.counselor_id
        LEFT JOIN post_counselor pc ON pc.member_id = c.id
        LEFT JOIN member rm ON rm.id = r.member_id
       WHERE r.id = ${id}
       LIMIT 1
    `;
    const r = rows[0];
    if (!r) throw new NotFoundException('후기를 찾을 수 없습니다.');
    if (r.member_id !== memberId) throw new ForbiddenException('본인이 작성한 후기만 조회할 수 있습니다.');

    const extras = parseExtras(r.extras);
    const photoUrl = pickPhotoUrl(extras);
    const photoUrlWebp = pickPhotoUrlWebp(extras);
    const consultType = typeof extras.consult_type === 'string' ? (extras.consult_type as string) : '';
    const consultDuration =
      typeof extras.consult_duration === 'string' ? (extras.consult_duration as string) : '';

    const created = r.created_at instanceof Date ? r.created_at : new Date(r.created_at);
    const consultDate = isNaN(created.getTime())
      ? ''
      : `${created.getFullYear()}.${pad(created.getMonth() + 1)}.${pad(created.getDate())}`;

    return {
      id: r.id,
      title: r.title,
      content: r.content ?? '',
      rating: r.rating,
      created_at: created.toISOString(),
      photo_url: photoUrl,
      photo_url_webp: photoUrlWebp,
      consult_type: consultType,
      consult_date: consultDate,
      consult_duration: consultDuration,
      customer_name: displayReviewer(r.reviewer_nickname, r.reviewer_mb_id, '고객'),
      counselor_id: r.counselor_id,
      counselor_name: r.counselor_nickname || r.counselor_name,
      counselor_code: r.counselor_code ?? '',
      counselor_badge: inferCategory(r.specialty, r.hashtag1, r.hashtag2),
      counselor_avatar: r.counselor_profile_image ? `/uploads/member/${r.counselor_profile_image}` : null,
    };
  }

  /** 본인 후기 수정 — 제목/본문/비밀글/별점/사진. 본인이 아니면 403. */
  async updateMine(
    id: number,
    memberId: number,
    input: {
      title?: string;
      content?: string;
      is_secret?: boolean;
      rating?: number;
      photo_url?: string | null;
      photo_url_webp?: string | null;
    },
  ): Promise<MyReviewItem> {
    const owner = await this.sql<{ member_id: number | null; extras: Record<string, unknown> | null }[]>`
      SELECT member_id, extras FROM post_review WHERE id = ${id} LIMIT 1
    `;
    if (owner.length === 0) throw new NotFoundException('후기를 찾을 수 없습니다.');
    if (owner[0].member_id !== memberId) throw new ForbiddenException('본인이 작성한 후기만 수정할 수 있습니다.');

    const title = input.title?.trim();
    if (title !== undefined && title.length === 0) {
      throw new BadRequestException('제목을 입력해주세요.');
    }

    const extras = (owner[0].extras ?? {}) as Record<string, unknown>;
    if (input.photo_url !== undefined) {
      if (input.photo_url) extras.photo_url = input.photo_url;
      else {
        delete extras.photo_url;
        delete extras.photo_url_webp;
      }
    }
    if (input.photo_url_webp !== undefined) {
      if (input.photo_url_webp) extras.photo_url_webp = input.photo_url_webp;
      else delete extras.photo_url_webp;
    }

    // 동적 SET — 전달된 필드만 갱신
    const updates: Record<string, unknown> = { extras };
    if (title !== undefined) updates.title = title;
    if (input.content !== undefined) updates.content = input.content;
    if (input.is_secret !== undefined) updates.is_secret = input.is_secret;
    if (input.rating !== undefined) updates.rating = input.rating;

    await this.sql`
      UPDATE post_review SET ${this.sql(updates)}, updated_at = now()
       WHERE id = ${id}
    `;

    return this.getMine(id, memberId);
  }

  /**
   * 새 후기 작성. 한 통화/채팅(consultation) 당 1건 — 중복 작성 차단.
   *
   *  - counselor_id 는 실제 상담사 회원이어야 함 (role='counselor')
   *  - consultation_id 가 오면 본인 소유 + 종료된 상담만 허용. 이미 후기가 있으면 409.
   *  - photo_url 은 별도 업로드 엔드포인트 응답 URL 을 그대로 전달.
   *  - consult_type / consult_duration 등 부가 표시 정보는 consultation 으로부터 자동 채움.
   */
  async createMine(
    memberId: number,
    input: {
      counselor_id: number;
      title: string;
      content: string;
      is_secret?: boolean;
      rating?: number | null;
      photo_url?: string | null;
      photo_url_webp?: string | null;
      consultation_id?: number | null;
    },
  ): Promise<MyReviewItem> {
    const title = (input.title ?? '').trim();
    const content = (input.content ?? '').trim();
    if (!title) throw new BadRequestException('제목을 입력해주세요.');
    if (!content) throw new BadRequestException('후기 내용을 입력해주세요.');
    if (!input.counselor_id) throw new BadRequestException('상담사 정보가 없습니다.');

    // 상담사 존재 검증
    const cs = await this.sql<{ id: number; role: string | null }[]>`
      SELECT id, role FROM member WHERE id = ${input.counselor_id} LIMIT 1
    `;
    if (cs.length === 0) throw new NotFoundException('상담사를 찾을 수 없습니다.');
    if (cs[0].role !== 'counselor') {
      throw new BadRequestException('해당 회원은 상담사가 아닙니다.');
    }

    // 본인 작성자 정보
    const me = await this.sql<{ id: number; mb_id: string | null }[]>`
      SELECT id, mb_id FROM member WHERE id = ${memberId} LIMIT 1
    `;
    if (me.length === 0) throw new NotFoundException('회원 정보를 찾을 수 없습니다.');

    const extras: Record<string, unknown> = {};
    if (input.photo_url) extras.photo_url = input.photo_url;
    if (input.photo_url_webp) extras.photo_url_webp = input.photo_url_webp;

    // consultation 검증 + 중복 후기 차단
    //  - 2026-05-15: 상담사 보호 정책으로 consultation_id **필수** + 사용시간 **5분(300초) 이상** 요건 추가.
    //    공격성/문제 손님이 5분 안에 끊고 악의적 후기 쓰는 경로를 차단한다.
    //  - consultation.counselor_id 가 있으면 그 값을 정답(source of truth)으로 사용.
    //    프론트에서 잘못된 counselor_id 를 보냈더라도(예: 상담사 변경/매핑 차이) consultation
    //    소유자가 본인 회원이라면 후기 작성을 허용한다 — "포인트 쓴 상담이면 후기 가능" 요건.
    if (!input.consultation_id) {
      throw new BadRequestException('상담 내역이 있어야 후기를 작성할 수 있습니다.');
    }
    let resolvedCounselorId = input.counselor_id;
    /** 후기 작성 포인트 지급 판정에 쓰일 사용포인트 (consultation.amt). 0이면 조건 적용 안 함. */
    let consultationAmt = 0;
    {
      const rows = await this.sql<{
        id: number;
        member_id: number | null;
        counselor_id: number | null;
        reason: string | null;
        roomid: string | null;
        ended_at: Date | null;
        started_at: Date | null;
        usetm: number | null;
        amt: number | null;
      }[]>`
        SELECT id, member_id, counselor_id, reason, roomid, ended_at, started_at, usetm, amt
          FROM consultation WHERE id = ${input.consultation_id} LIMIT 1
      `;
      const c = rows[0];
      if (!c) throw new NotFoundException('상담 내역을 찾을 수 없습니다.');
      if (c.member_id !== memberId) {
        throw new ForbiddenException('본인의 상담만 후기를 작성할 수 있습니다.');
      }
      // 5분(300초) 이상 사용 검증 — 상담사 보호 정책 (2026-05-15)
      const sec = Number(c.usetm ?? 0);
      if (sec < 300) {
        throw new BadRequestException('5분 이상 상담을 진행한 경우에만 후기 작성이 가능합니다.');
      }
      if (c.counselor_id) {
        // consultation 의 counselor_id 가 있으면 항상 그 값을 사용 (입력 불일치 무시).
        resolvedCounselorId = c.counselor_id;
      }

      // 동일 consultation 후기 중복 차단
      const dup = await this.sql<{ id: number }[]>`
        SELECT id FROM post_review
         WHERE member_id = ${memberId}
           AND (extras ->> 'consultation_id')::text = ${String(input.consultation_id)}
         LIMIT 1
      `;
      if (dup.length > 0) {
        throw new BadRequestException('이미 후기를 작성한 상담입니다.');
      }
      extras.consultation_id = input.consultation_id;
      // 표시용 부가 정보 — sample 의 wr_2/wr_3 자리 활용
      const isChat = !!(c.roomid && c.roomid.length > 0);
      extras.consult_type = isChat ? '채팅' : '전화';
      if (sec > 0) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        extras.consult_duration = `${m}분 ${s}초`;
      }
      consultationAmt = Math.max(0, Math.trunc(Number(c.amt ?? 0)));
    }

    const rating = input.rating != null
      ? Math.max(1, Math.min(5, Math.trunc(Number(input.rating))))
      : null;

    const inserted = await this.sql<{ id: number }[]>`
      INSERT INTO post_review (
        member_id, mb_id, counselor_id,
        title, content, rating,
        is_secret, has_file, extras
      ) VALUES (
        ${memberId}, ${me[0].mb_id}, ${resolvedCounselorId},
        ${title}, ${content}, ${rating},
        ${!!input.is_secret}, ${!!input.photo_url},
        ${JSON.stringify(extras)}::jsonb
      )
      RETURNING id
    `;

    // 후기 작성 포인트 지급 (best-effort — 실패해도 후기 작성은 성공으로 본다).
    //  - setting.review.payout_enabled === '1' 이어야 함
    //  - amount > 0 이어야 함
    //  - consultation_id 가 있고 consultation.amt >= payout_min_used 이어야 함
    //    (payout_min_used 가 0 이면 사용 포인트 조건 없음)
    try {
      await this.maybeCreditReviewPoint(memberId, inserted[0].id, consultationAmt);
    } catch {
      /* 지급 실패는 응답에 노출하지 않음 — 후기 자체는 정상 저장됨 */
    }

    return this.getMine(inserted[0].id, memberId);
  }

  /**
   * 후기 작성 포인트 지급 — setting 값을 읽어 조건 충족 시 회원에게 적립.
   * 외부에서 호출되지 않는 내부 헬퍼. 실패하더라도 후기 작성 흐름은 건드리지 않는다.
   */
  private async maybeCreditReviewPoint(
    memberId: number,
    reviewId: number,
    consultationAmt: number,
  ): Promise<void> {
    const settings = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting WHERE namespace = 'review'
    `;
    const map = new Map<string, string>();
    for (const r of settings) map.set(r.key, r.value ?? '');
    const enabled = map.get('payout_enabled') === '1';
    if (!enabled) return;
    const amount = Math.max(0, Math.trunc(Number(map.get('payout_amount') ?? '0')));
    if (amount <= 0) return;
    const minUsed = Math.max(0, Math.trunc(Number(map.get('payout_min_used') ?? '0')));
    // 사용포인트 조건: minUsed 가 0보다 크면 consultationAmt 가 그 이상이어야 한다.
    // (상담 내역 없이 직접 작성된 후기는 consultationAmt=0 이라 minUsed>0 일 때 자연 차단)
    if (minUsed > 0 && consultationAmt < minUsed) return;

    await this.sql.begin(async (tx) => {
      // 만료일 — member.point_term 정책 따라
      const termRows = await tx<{ value: string | null }[]>`
        SELECT value FROM setting WHERE namespace = 'member' AND key = 'point_term' LIMIT 1
      `;
      const term = Number(termRows[0]?.value ?? 0) || 0;
      let expireDate: string | null = null;
      if (term > 0) {
        const dt = new Date();
        dt.setDate(dt.getDate() + term - 1);
        expireDate = dt.toISOString().slice(0, 10);
      }

      // point row 보장 + 잠금
      let ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
        SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
      `;
      if (ptRows.length === 0) {
        await tx`
          INSERT INTO point (member_id, free_balance, paid_balance, total_earned, total_used)
          VALUES (${memberId}, 0, 0, 0, 0)
          ON CONFLICT (member_id) DO NOTHING
        `;
        ptRows = await tx<{ free_balance: number; paid_balance: number }[]>`
          SELECT free_balance, paid_balance FROM point WHERE member_id = ${memberId} FOR UPDATE
        `;
      }
      const free = Number(ptRows[0].free_balance);
      const paid = Number(ptRows[0].paid_balance);
      const balanceAfter = free + paid + amount;

      await tx`
        INSERT INTO point_history (
          member_id, content, earn_point, use_point, balance_after,
          is_paid, is_expired, expire_date, rel_action, actor_type
        ) VALUES (
          ${memberId}, ${'후기 작성 적립'}, ${amount}, 0, ${balanceAfter},
          false, false, ${expireDate}, ${`review:${reviewId}`}, 'system'
        )
      `;

      await tx`
        UPDATE point SET
          free_balance = free_balance + ${amount},
          total_earned = total_earned + ${amount},
          updated_at = now()
         WHERE member_id = ${memberId}
      `;
      await tx`UPDATE member SET point = point + ${amount}, updated_at = now() WHERE id = ${memberId}`;
    });
  }

  /** 본인 후기 물리 삭제 (hard delete). 본인이 아니면 403. */
  async deleteMine(id: number, memberId: number): Promise<void> {
    const r = await this.sql`
      DELETE FROM post_review WHERE id = ${id} AND member_id = ${memberId}
    `;
    if (r.count === 0) {
      const exists = await this.sql<{ id: number }[]>`SELECT id FROM post_review WHERE id = ${id} LIMIT 1`;
      if (exists.length === 0) throw new NotFoundException('후기를 찾을 수 없습니다.');
      throw new ForbiddenException('본인이 작성한 후기만 삭제할 수 있습니다.');
    }
  }

  /**
   * 후기 신고 등록 (2026-05-15 신설).
   *  - 후기 존재 검증
   *  - 본인이 쓴 후기는 신고 불가 (400)
   *  - 같은 사용자가 같은 후기 중복 신고 차단 (DB UNIQUE → 409)
   *  - 카테고리 화이트리스트: 'abuse'/'false'/'ad'/'privacy'/'other'
   */
  async reportReview(
    reviewId: number,
    reporterId: number,
    input: { reason_category: string; reason: string | null },
  ): Promise<void> {
    const allowedCategories = new Set(['abuse', 'false', 'ad', 'privacy', 'other']);
    const category = allowedCategories.has(input.reason_category) ? input.reason_category : 'other';

    const rows = await this.sql<{ member_id: number | null }[]>`
      SELECT member_id FROM post_review WHERE id = ${reviewId} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('후기를 찾을 수 없습니다.');
    if (rows[0].member_id === reporterId) {
      throw new BadRequestException('본인이 작성한 후기는 신고할 수 없습니다.');
    }

    try {
      await this.sql`
        INSERT INTO post_review_report (review_id, reporter_member_id, reason_category, reason)
        VALUES (${reviewId}, ${reporterId}, ${category}, ${input.reason})
      `;
    } catch (e) {
      // PostgreSQL unique_violation = '23505'
      if (e instanceof Error && 'code' in e && (e as { code?: string }).code === '23505') {
        throw new ConflictException('이미 신고하신 후기입니다.');
      }
      throw e;
    }
  }

  /**
   * 베스트 후기 토글 (2026-05-15) — 상담사 본인만 자기 받은 후기를 선정/해제.
   *
   *  - 본인이 받은 후기가 아니면 403
   *  - is_best=true 로 신규 등록 시 기존 베스트 5개 초과면 409
   *  - is_best 갱신과 best_at 도 함께 (해제 시 NULL)
   */
  async toggleBest(reviewId: number, counselorId: number, isBest: boolean): Promise<{ ok: true; is_best: boolean; best_at: Date | null }> {
    const rows = await this.sql<{ id: number; counselor_id: number | null; is_best: boolean }[]>`
      SELECT id, counselor_id, is_best FROM post_review WHERE id = ${reviewId} LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('후기를 찾을 수 없습니다.');
    const r = rows[0];
    if (r.counselor_id !== counselorId) {
      throw new ForbiddenException('본인이 받은 후기만 베스트로 선정할 수 있습니다.');
    }
    // 동일 상태 요청 — no-op
    if (r.is_best === isBest) {
      return { ok: true, is_best: isBest, best_at: null };
    }
    // 신규 등록 시 5개 제한
    if (isBest) {
      const cnt = await this.sql<{ cnt: string }[]>`
        SELECT COUNT(*)::text AS cnt FROM post_review
         WHERE counselor_id = ${counselorId} AND is_best = true
      `;
      if (Number(cnt[0]?.cnt ?? 0) >= 5) {
        throw new ConflictException('베스트 후기는 최대 5개까지만 선정할 수 있습니다. 기존 베스트를 해제한 뒤 시도해 주세요.');
      }
    }
    const bestAt = isBest ? new Date() : null;
    await this.sql`
      UPDATE post_review
         SET is_best = ${isBest},
             best_at = ${bestAt}
       WHERE id = ${reviewId}
    `;
    return { ok: true, is_best: isBest, best_at: bestAt };
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * post_review.extras 는 JSONB 컬럼이지만, 드라이버/마이그레이션 경로에 따라 가끔
 * 객체 대신 JSON 문자열로 반환되는 경우가 있다. 두 케이스 모두 안전하게 객체로 변환한다.
 *
 * 또한 photo_url 후보 키가 여러 개일 수 있어 (legacy: photo_url / image_url / img_url)
 * 첫 번째 string 값을 반환하는 헬퍼를 함께 둔다.
 */
function parseExtras(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function pickPhotoUrl(extras: Record<string, unknown>): string | null {
  for (const key of ['photo_url', 'image_url', 'img_url', 'photo']) {
    const v = extras[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return null;
}

function pickPhotoUrlWebp(extras: Record<string, unknown>): string | null {
  for (const key of ['photo_url_webp', 'image_url_webp', 'img_url_webp']) {
    const v = extras[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return null;
}

export interface PublicCounselorReview {
  id: number;
  title: string;
  /** 비밀글이면 빈 문자열 */
  content: string;
  is_secret: boolean;
  /** 베스트 후기 여부 (상담사가 선정) */
  is_best: boolean;
  /** 베스트 선정 시각 — 정렬용. 해제 시 null */
  best_at: string | null;
  rating: number | null;
  created_at: string;
  /** 마스킹된 작성자명 (예: '김*객') */
  reviewer_name: string;
}

/** 마이페이지 — 내가 작성한 후기 항목 (상담사 정보 + extras 포함) */
export interface MyReviewItem {
  id: number;
  title: string;
  content: string;
  rating: number | null;
  created_at: string;
  /** 첨부 사진 URL (extras.photo_url 또는 첫 첨부 image — 없으면 null) */
  photo_url: string | null;
  /** WebP 변환 사이블링 URL — 있으면 <picture>에서 우선 노출 */
  photo_url_webp: string | null;
  /** extras 의 상담 정보 (있으면 표시, 없으면 빈 문자열) */
  consult_type: string;        // '전화상담' | '채팅상담' | ''
  consult_date: string;        // 'YYYY.MM.DD' (post_review.created_at 기반)
  consult_duration: string;    // '00시간17분30초' (extras.duration 또는 빈 문자열)
  /** 마스킹된 본인 표기 (예: '김*객') */
  customer_name: string;
  counselor_id: number;
  counselor_name: string;
  counselor_code: string;
  counselor_badge: '타로' | '신점' | '사주' | '기타';
  counselor_avatar: string | null;
}

/** sample 의 작성자 마스킹 (예: '김민지' → '김*지'). 2자 이하면 둘째 글자만 별표. */
function maskName(name: string): string {
  const s = name.trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*' + s.slice(2);
}

/**
 * mb_id 마스킹 — 본명 노출 회피용 (2026-05-15 정책).
 * 예: 'ubuub1234' → 'ub***34', 'kim' → 'k*m', 'a' → 'a'
 * 양끝 2글자만 노출하고 가운데는 *** 로 고정 (길이 정보 숨김).
 */
function maskMbId(mbId: string): string {
  const s = mbId.trim();
  if (s.length <= 2) return s;
  if (s.length <= 4) return s[0] + '***' + s.slice(-1);
  return s.slice(0, 2) + '***' + s.slice(-2);
}

/**
 * 작성자 표기 우선순위 (2026-05-15 정책):
 *   1) 닉네임이 있으면 nickname (마스킹)
 *   2) 없으면 mb_id (마스킹)
 *   3) 둘 다 없으면 '익명' 폴백
 * 본명(name)은 절대 노출하지 않는다 — 고객 우려.
 */
function displayReviewer(nickname: string | null, mbId: string | null, fallback = '익명'): string {
  if (nickname && nickname.trim()) return maskName(nickname);
  if (mbId && mbId.trim()) return maskMbId(mbId);
  return fallback;
}

function inferCategory(
  ...vals: (string | null)[]
): '사주' | '타로' | '신점' | '기타' {
  const text = vals.filter(Boolean).join(' ');
  if (text.includes('타로')) return '타로';
  if (text.includes('신점')) return '신점';
  if (text.includes('사주')) return '사주';
  // 후기 카드에는 카테고리를 선택하는 UI가 없으므로 '기타' 라벨을 노출하면 어색하다.
  // 분류 단서가 전혀 없을 때는 기본값으로 '사주' 를 사용해 색상 뱃지가 항상 보이도록 한다.
  return '사주';
}
