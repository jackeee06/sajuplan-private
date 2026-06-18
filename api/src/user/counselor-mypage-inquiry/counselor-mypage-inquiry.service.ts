import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { OpsAlertService } from '../../shared/ops-alert/ops-alert.service';

export const INQUIRY_CATEGORIES = ['이용안내', '상담', '정산', '서비스상품'] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export interface InquiryListItem {
  id: number;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'answered';
  photo_count: number;
  created_at: string;
  replied_at: string | null;
}

export interface InquiryDetail {
  id: number;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'answered';
  photos: string[];
  reply_content: string | null;
  reply_admin_name: string | null;
  replied_at: string | null;
  created_at: string;
}

/**
 * 상담사 → 운영자(사주플랜) 1:1 고객센터 문의.
 * 상담사 마이페이지 "문의하기"(분류: 이용안내/상담/정산/서비스상품)의 백엔드.
 *
 * - 본인이 작성한 문의만 본인이 조회 (member_id 자동 필터)
 * - 작성/목록/상세. 운영자는 admin 쪽에서 답변.
 * - 사진은 /uploads/counselor-inquiry/{member_id}/ 에 저장하고 URL 배열로 photos(jsonb)에 보관.
 */
@Injectable()
export class CounselorMypageInquiryService {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly opsAlert: OpsAlertService,
  ) {}

  /** 내 문의 목록 (최신순, 분류/검색 필터 + 페이지네이션) */
  async list(params: {
    memberId: number;
    category?: string | null;
    keyword?: string | null;
    limit: number;
    offset: number;
  }): Promise<{ items: InquiryListItem[]; total: number }> {
    const { memberId, limit, offset } = params;
    const category =
      params.category && (INQUIRY_CATEGORIES as readonly string[]).includes(params.category)
        ? params.category
        : null;
    const keyword = params.keyword?.trim() ? `%${params.keyword.trim()}%` : null;

    const rows = await this.sql<
      {
        id: number;
        category: string;
        title: string;
        content: string;
        status: 'pending' | 'answered';
        photo_count: number;
        created_at: Date;
        replied_at: Date | null;
        total: number;
      }[]
    >`
      SELECT id, category, title, content, status,
             COALESCE(jsonb_array_length(photos), 0) AS photo_count,
             created_at, replied_at,
             COUNT(*) OVER() AS total
        FROM counselor_inquiry
       WHERE member_id = ${memberId}
         AND is_hidden = false
         ${category ? this.sql`AND category = ${category}` : this.sql``}
         ${keyword ? this.sql`AND (title ILIKE ${keyword} OR content ILIKE ${keyword})` : this.sql``}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    return {
      items: rows.map((r) => ({
        id: Number(r.id),
        category: r.category,
        title: r.title,
        content: r.content,
        status: r.status,
        photo_count: Number(r.photo_count),
        created_at: r.created_at.toISOString(),
        replied_at: r.replied_at?.toISOString() ?? null,
      })),
      total,
    };
  }

  /** 내 문의 단건 (본인 소유만) */
  async getOne(memberId: number, id: number): Promise<InquiryDetail> {
    const rows = await this.sql<
      {
        id: number;
        member_id: number;
        category: string;
        title: string;
        content: string;
        status: 'pending' | 'answered';
        photos: unknown;
        reply_content: string | null;
        reply_admin_name: string | null;
        replied_at: Date | null;
        created_at: Date;
      }[]
    >`
      SELECT id, member_id, category, title, content, status, photos,
             reply_content, reply_admin_name, replied_at, created_at
        FROM counselor_inquiry
       WHERE id = ${id} AND is_hidden = false
       LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    const r = rows[0];
    if (Number(r.member_id) !== memberId) {
      throw new ForbiddenException('본인 문의만 조회할 수 있습니다.');
    }
    return {
      id: Number(r.id),
      category: r.category,
      title: r.title,
      content: r.content,
      status: r.status,
      photos: normalizePhotos(r.photos),
      reply_content: r.reply_content,
      reply_admin_name: r.reply_admin_name,
      replied_at: r.replied_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
    };
  }

  /** 내 문의 삭제 (본인 소유만) — 소프트 삭제(is_hidden=true).
   *  상담사 화면에선 즉시 사라지고(목록/상세 모두 is_hidden=false 필터), 운영자 화면에서도 숨겨진다.
   *  DB row 는 보존(감사/분쟁 추적). 답변 완료 여부와 무관하게 본인 문의는 삭제 가능. */
  async remove(memberId: number, id: number): Promise<{ ok: true }> {
    const rows = await this.sql<{ member_id: number }[]>`
      SELECT member_id FROM counselor_inquiry WHERE id = ${id} AND is_hidden = false LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('문의를 찾을 수 없습니다.');
    if (Number(rows[0].member_id) !== memberId) {
      throw new ForbiddenException('본인 문의만 삭제할 수 있습니다.');
    }
    await this.sql`
      UPDATE counselor_inquiry SET is_hidden = true, updated_at = now() WHERE id = ${id}
    `;
    return { ok: true };
  }

  /** 문의 작성 */
  async create(params: {
    memberId: number;
    mbId: string | null;
    category: string;
    title: string;
    content: string;
    photos: string[];
    ip?: string | null;
  }): Promise<{ id: number }> {
    const { memberId, mbId, title, content, ip } = params;
    if (!(INQUIRY_CATEGORIES as readonly string[]).includes(params.category)) {
      throw new BadRequestException('분류를 선택해주세요.');
    }
    const photos = (params.photos ?? []).filter((p) => typeof p === 'string' && p).slice(0, 5);

    const rows = await this.sql<{ id: number }[]>`
      INSERT INTO counselor_inquiry (member_id, mb_id, category, title, content, photos, ip, created_at, updated_at)
      VALUES (
        ${memberId}, ${mbId}, ${params.category}, ${title}, ${content},
        ${this.sql.json(photos)}::jsonb, ${ip ?? null}, now(), now()
      )
      RETURNING id
    `;
    const newId = Number(rows[0].id);

    // [2026-06-17] 새 문의 접수 시 관리자에게 카톡(관리자 문의톡). 실패해도 문의 등록엔 영향 없음(fire-and-forget).
    void (async () => {
      try {
        const m = await this.sql<{ nickname: string | null; name: string | null }[]>`
          SELECT nickname, name FROM member WHERE id = ${memberId} LIMIT 1
        `;
        const who = (m[0]?.nickname || m[0]?.name || mbId || '상담사').toString().trim();
        await this.opsAlert.send(
          '상담사 고객센터 문의 접수',
          `상담사 "${who}" 님이 새 문의를 남겼습니다.\n분류: ${params.category}\n제목: ${title}\n\n관리자 > 상담사 고객센터 문의에서 확인/답변하세요.`,
        );
      } catch {
        /* 알림 실패는 무시 — 문의 자체는 정상 저장됨 */
      }
    })();

    return { id: newId };
  }
}

function normalizePhotos(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((p): p is string => typeof p === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}
