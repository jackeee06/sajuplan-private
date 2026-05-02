import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicCounselor {
  id: number;
  mb_id: string | null;
  name: string;
  nickname: string;
  csrid: string | null;
  state: string;
  use_phone: boolean;
  use_chat: boolean;
  is_rising: boolean;
  is_recommended: boolean;
  /** post_counselor 에서 — 헤드라인/특기/단가 */
  title: string | null;
  headline: string | null;
  specialty: string | null;
  hashtag1: string | null;
  hashtag2: string | null;
  unit_seconds: number | null;
  unit_cost: number | null;
  review_count: number;
  fan_count: number;
  /** 프로필 사진 URL — member_file 에서 kind='profile' 첫 번째 */
  profile_image: string | null;
  /** 카테고리 추정 (specialty 또는 hashtag 에서 사주/타로/신점 매칭) */
  category: '사주' | '타로' | '신점' | '기타';
}

export type CounselorTab = 'all' | 'popular' | 'chat' | 'review';

/**
 * 사용자 메인 페이지 상담사 리스트.
 * sample/theme/basic/mobile/index.php 의 메인 탭 (tab02 인기 / tab04 채팅 / tab05 전체 / tab06 후기) 매핑.
 */
@Injectable()
export class UserCounselorsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async list(params: {
    tab?: CounselorTab;
    category?: string;
    limit?: number;
  }): Promise<PublicCounselor[]> {
    const tab = params.tab ?? 'all';
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));

    // 정렬 — sample 흐름:
    //  all     : is_recommended → display(최신) → review_count
    //  popular : is_rising → review_count → fan_count
    //  chat    : use_chat=true 만, 그중 state 활동 우선 → review_count
    //  review  : review_count DESC
    const orderBy = (() => {
      switch (tab) {
        case 'popular':
          return this.sql`m.is_rising DESC, pc.review_count DESC NULLS LAST, pc.fan_count DESC NULLS LAST, m.id DESC`;
        case 'chat':
          return this.sql`(CASE WHEN m.state IN ('IDLE','RDCH','RDVC','CRDY') THEN 0 ELSE 1 END), pc.review_count DESC NULLS LAST, m.id DESC`;
        case 'review':
          return this.sql`pc.review_count DESC NULLS LAST, m.id DESC`;
        default: // all
          return this.sql`m.is_recommended DESC, pc.review_count DESC NULLS LAST, m.id DESC`;
      }
    })();

    // tab 별 필터
    const tabWhere = tab === 'chat' ? this.sql`AND m.use_chat = true` : this.sql``;

    // 카테고리 필터 — specialty / hashtag1 / hashtag2 중 하나에 카테고리 키워드 포함
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
      mb_id: string | null;
      name: string;
      nickname: string;
      csrid: string | null;
      state: string;
      use_phone: boolean;
      use_chat: boolean;
      is_rising: boolean;
      is_recommended: boolean;
      title: string | null;
      headline: string | null;
      specialty: string | null;
      hashtag1: string | null;
      hashtag2: string | null;
      unit_seconds: number | null;
      unit_cost: number | null;
      review_count: number | null;
      fan_count: number | null;
      profile_stored_name: string | null;
    };

    const rows = await this.sql<Row[]>`
      SELECT m.id, m.mb_id, m.name, m.nickname, m.csrid, m.state,
             m.use_phone, m.use_chat, m.is_rising, m.is_recommended,
             pc.title, pc.headline, pc.specialty, pc.hashtag1, pc.hashtag2,
             pc.unit_seconds, pc.unit_cost, pc.review_count, pc.fan_count,
             (SELECT mf.stored_name FROM member_file mf
               WHERE mf.member_id = m.id AND mf.kind = 'profile'
               ORDER BY mf.id DESC LIMIT 1) AS profile_stored_name
        FROM member m
        LEFT JOIN post_counselor pc ON pc.member_id = m.id
       WHERE m.role = 'counselor'
         AND m.left_at IS NULL
         ${tabWhere}
         ${categoryWhere}
       ORDER BY ${orderBy}
       LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      mb_id: r.mb_id,
      name: r.name,
      nickname: r.nickname,
      csrid: r.csrid,
      state: r.state,
      use_phone: r.use_phone,
      use_chat: r.use_chat,
      is_rising: r.is_rising,
      is_recommended: r.is_recommended,
      title: r.title,
      headline: r.headline,
      specialty: r.specialty,
      hashtag1: r.hashtag1,
      hashtag2: r.hashtag2,
      unit_seconds: r.unit_seconds,
      unit_cost: r.unit_cost,
      review_count: r.review_count ?? 0,
      fan_count: r.fan_count ?? 0,
      profile_image: r.profile_stored_name,
      category: this.inferCategory(r.specialty, r.hashtag1, r.hashtag2),
    }));
  }

  private inferCategory(
    ...vals: (string | null)[]
  ): '사주' | '타로' | '신점' | '기타' {
    const text = vals.filter(Boolean).join(' ');
    if (text.includes('타로')) return '타로';
    if (text.includes('신점')) return '신점';
    if (text.includes('사주')) return '사주';
    return '기타';
  }
}
