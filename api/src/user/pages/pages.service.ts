import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicPage {
  slug: string;
  title: string;
  /** HTML 또는 일반 텍스트 (use_html=true 면 HTML, 아니면 \n 포함 평문) */
  content: string;
  use_html: boolean;
  updated_at: string;
}

/**
 * 정적 페이지 (이용약관/개인정보취급방침/회사소개 등) 공개 조회.
 * 어드민 [contents] 메뉴에서 등록·수정한 page 테이블 row 를 슬러그로 노출.
 */
@Injectable()
export class UserPagesService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async getBySlug(slug: string): Promise<PublicPage> {
    const trimmed = (slug || '').trim();
    if (!trimmed) throw new NotFoundException('페이지를 찾을 수 없습니다.');

    type Row = {
      slug: string;
      title: string;
      content: string | null;
      mobile_content: string | null;
      use_html: boolean;
      is_active: boolean;
      updated_at: Date;
    };
    const rows = await this.sql<Row[]>`
      SELECT slug, title, content, mobile_content, use_html, is_active, updated_at
        FROM page
       WHERE slug = ${trimmed}
       LIMIT 1
    `;
    const r = rows[0];
    if (!r || !r.is_active) {
      throw new NotFoundException('페이지를 찾을 수 없습니다.');
    }
    // 모바일 본문이 비어있으면 데스크톱 본문 사용 (sample 호환)
    const body = (r.mobile_content && r.mobile_content.trim() !== '')
      ? r.mobile_content
      : (r.content ?? '');
    return {
      slug: r.slug,
      title: r.title,
      content: body,
      use_html: r.use_html,
      updated_at: r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
    };
  }
}
