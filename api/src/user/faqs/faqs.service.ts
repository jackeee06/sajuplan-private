import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface PublicFaqCategory {
  id: number;
  title: string;
  display_order: number;
  /** 활성 FAQ 항목 수 — 빈 카테고리 숨김 처리에 사용 */
  faq_count: number;
}

export interface PublicFaqItem {
  id: number;
  category_id: number;
  category_title: string;
  question: string;
  answer: string;
  display_order: number;
}

/**
 * 사용자용 FAQ 공개 조회 — 인증 불필요.
 * is_active = false 건과 카테고리는 모두 제외.
 */
@Injectable()
export class UserFaqsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 활성 카테고리 목록 — display_order 오름차순. */
  async listCategories(): Promise<PublicFaqCategory[]> {
    const rows = await this.sql<PublicFaqCategory[]>`
      SELECT
        c.id,
        c.title,
        c.display_order,
        (
          SELECT COUNT(*)::int
            FROM faq f
           WHERE f.category_id = c.id
             AND f.is_active = TRUE
        ) AS faq_count
      FROM faq_category c
      WHERE c.is_active = TRUE
      ORDER BY c.display_order ASC, c.id ASC
    `;
    return rows;
  }

  /**
   * 활성 FAQ 항목 목록.
   * @param categoryId 지정 시 해당 카테고리만, 미지정 시 전체.
   */
  async listFaqs(categoryId?: number): Promise<PublicFaqItem[]> {
    if (categoryId && Number.isFinite(categoryId)) {
      return this.sql<PublicFaqItem[]>`
        SELECT
          f.id,
          f.category_id,
          c.title AS category_title,
          f.question,
          COALESCE(f.answer, '') AS answer,
          f.display_order
        FROM faq f
        JOIN faq_category c ON c.id = f.category_id
        WHERE f.is_active = TRUE
          AND c.is_active = TRUE
          AND f.category_id = ${categoryId}
        ORDER BY f.display_order ASC, f.id ASC
      `;
    }
    return this.sql<PublicFaqItem[]>`
      SELECT
        f.id,
        f.category_id,
        c.title AS category_title,
        f.question,
        COALESCE(f.answer, '') AS answer,
        f.display_order
      FROM faq f
      JOIN faq_category c ON c.id = f.category_id
      WHERE f.is_active = TRUE
        AND c.is_active = TRUE
      ORDER BY c.display_order ASC, c.id ASC, f.display_order ASC, f.id ASC
    `;
  }
}
