import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/faqmasterlist.php (FAQ 카테고리, 메뉴 700700) +
 * sample/adm/faqlist.php (FAQ 항목, fm_id=N) 정확 매핑.
 *
 *   faq_master (sample) → faq_category (신규)
 *     fm_id      → category.fm_id (레거시) / category.id (신규 PK)
 *     fm_subject → category.title
 *     fm_head_html → category.head_html
 *     fm_tail_html → category.tail_html
 *     fm_order   → category.display_order
 *
 *   faq (sample → 신규)
 *     fa_id      → faq.fa_id (레거시) / faq.id (신규 PK)
 *     fm_id      → faq.category_id
 *     fa_subject → faq.question
 *     fa_content → faq.answer
 *     fa_order   → faq.display_order
 */

export interface FaqCategoryRow {
  id: number;
  fm_id: number | null;
  title: string;
  head_html: string | null;
  tail_html: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  faq_count: number;
}

export interface FaqRow {
  id: number;
  fa_id: number | null;
  category_id: number | null;
  category_title: string | null;
  question: string;
  answer: string | null;
  display_order: number;
  view_count: number;
  is_active: boolean;
  created_at: string;
}

@Injectable()
export class FaqsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  // ─── FAQ 카테고리 ─────────────────────────
  async listCategories() {
    const items = await this.sql<FaqCategoryRow[]>`
      SELECT
        c.id, c.fm_id, c.title, c.head_html, c.tail_html, c.display_order, c.is_active, c.created_at,
        (SELECT count(*) FROM faq f WHERE f.category_id = c.id)::int AS faq_count
      FROM faq_category c
      ORDER BY c.display_order ASC, c.id ASC
    `;
    return { items, total: items.length };
  }

  async getCategory(id: number): Promise<FaqCategoryRow> {
    const rows = await this.sql<FaqCategoryRow[]>`
      SELECT
        c.id, c.fm_id, c.title, c.head_html, c.tail_html, c.display_order, c.is_active, c.created_at,
        (SELECT count(*) FROM faq f WHERE f.category_id = c.id)::int AS faq_count
      FROM faq_category c
      WHERE c.id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    return rows[0];
  }

  async createCategory(input: { title: string; head_html?: string; tail_html?: string; display_order?: number; is_active?: boolean }) {
    if (!input.title?.trim()) throw new BadRequestException('제목은 필수입니다.');
    const rows = await this.sql<FaqCategoryRow[]>`
      INSERT INTO faq_category (title, head_html, tail_html, display_order, is_active)
      VALUES (${input.title.trim()}, ${input.head_html ?? null}, ${input.tail_html ?? null}, ${input.display_order ?? 0}, ${input.is_active ?? true})
      RETURNING *, 0::int AS faq_count
    `;
    return rows[0];
  }

  async updateCategory(id: number, input: Partial<{ title: string; head_html: string; tail_html: string; display_order: number; is_active: boolean }>) {
    const cur = await this.getCategory(id);
    const rows = await this.sql<FaqCategoryRow[]>`
      UPDATE faq_category SET
        title = ${input.title?.trim() ?? cur.title},
        head_html = ${input.head_html ?? cur.head_html},
        tail_html = ${input.tail_html ?? cur.tail_html},
        display_order = ${input.display_order ?? cur.display_order},
        is_active = ${input.is_active ?? cur.is_active}
      WHERE id = ${id}
      RETURNING *, (SELECT count(*) FROM faq f WHERE f.category_id = id)::int AS faq_count
    `;
    return rows[0];
  }

  async removeCategory(id: number) {
    const result = await this.sql`DELETE FROM faq_category WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    return { ok: true };
  }

  // ─── FAQ 항목 ─────────────────────────
  async listFaqs(categoryId?: number) {
    let items: FaqRow[];
    if (categoryId) {
      items = await this.sql<FaqRow[]>`
        SELECT f.id, f.fa_id, f.category_id, f.question, f.answer, f.display_order, f.view_count, f.is_active, f.created_at,
               c.title AS category_title
        FROM faq f
        LEFT JOIN faq_category c ON c.id = f.category_id
        WHERE f.category_id = ${categoryId}
        ORDER BY f.display_order ASC, f.id ASC
      `;
    } else {
      items = await this.sql<FaqRow[]>`
        SELECT f.id, f.fa_id, f.category_id, f.question, f.answer, f.display_order, f.view_count, f.is_active, f.created_at,
               c.title AS category_title
        FROM faq f
        LEFT JOIN faq_category c ON c.id = f.category_id
        ORDER BY c.display_order ASC NULLS LAST, f.display_order ASC, f.id ASC
      `;
    }
    return { items, total: items.length };
  }

  async getFaq(id: number): Promise<FaqRow> {
    const rows = await this.sql<FaqRow[]>`
      SELECT f.id, f.fa_id, f.category_id, f.question, f.answer, f.display_order, f.view_count, f.is_active, f.created_at,
             c.title AS category_title
      FROM faq f
      LEFT JOIN faq_category c ON c.id = f.category_id
      WHERE f.id = ${id}
      LIMIT 1
    `;
    if (rows.length === 0) throw new NotFoundException('FAQ 항목을 찾을 수 없습니다.');
    return rows[0];
  }

  async createFaq(input: { category_id: number; question: string; answer?: string; display_order?: number; is_active?: boolean }) {
    if (!input.category_id) throw new BadRequestException('카테고리는 필수입니다.');
    if (!input.question?.trim()) throw new BadRequestException('질문은 필수입니다.');
    const rows = await this.sql<FaqRow[]>`
      INSERT INTO faq (category_id, question, answer, display_order, is_active)
      VALUES (${input.category_id}, ${input.question.trim()}, ${input.answer ?? ''}, ${input.display_order ?? 0}, ${input.is_active ?? true})
      RETURNING id, fa_id, category_id, question, answer, display_order, view_count, is_active, created_at,
                (SELECT title FROM faq_category WHERE id = category_id) AS category_title
    `;
    return rows[0];
  }

  async updateFaq(id: number, input: Partial<{ category_id: number; question: string; answer: string; display_order: number; is_active: boolean }>) {
    const cur = await this.getFaq(id);
    const rows = await this.sql<FaqRow[]>`
      UPDATE faq SET
        category_id = ${input.category_id ?? cur.category_id},
        question = ${input.question?.trim() ?? cur.question},
        answer = ${input.answer ?? cur.answer},
        display_order = ${input.display_order ?? cur.display_order},
        is_active = ${input.is_active ?? cur.is_active}
      WHERE id = ${id}
      RETURNING id, fa_id, category_id, question, answer, display_order, view_count, is_active, created_at,
                (SELECT title FROM faq_category WHERE id = category_id) AS category_title
    `;
    return rows[0];
  }

  async removeFaq(id: number) {
    const result = await this.sql`DELETE FROM faq WHERE id = ${id}`;
    if (result.count === 0) throw new NotFoundException('FAQ 항목을 찾을 수 없습니다.');
    return { ok: true };
  }
}
