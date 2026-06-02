import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 관리자 개인 메모장 (admin_memo) — admin 1명당 1 row.
 *
 * - 본인 메모만 본인이 봄 (admin_id 자동 필터)
 * - 자동 저장 (프론트가 디바운스 후 PUT)
 * - content 는 HTML (Toast UI Editor 출력)
 * - 이미지는 /uploads/admin-memo/{admin_id}/ 로 별도 폴더 분리 (다른 admin 이미지 노출 X)
 */
@Injectable()
export class AdminMemoService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async get(adminId: number): Promise<{ content: string; updated_at: string | null }> {
    const rows = await this.sql<{ content: string; updated_at: Date }[]>`
      SELECT content, updated_at FROM admin_memo WHERE admin_id = ${adminId} LIMIT 1
    `;
    if (rows.length === 0) return { content: '', updated_at: null };
    return {
      content: rows[0].content ?? '',
      updated_at: rows[0].updated_at?.toISOString() ?? null,
    };
  }

  async save(adminId: number, content: string): Promise<{ updated_at: string }> {
    // 길이 안전 한도 — TEXT 컬럼이라 사실상 무제한이지만 1MB 정도로 cap (이미지는 URL 만 들어가니 충분)
    const safeContent = (content ?? '').slice(0, 1_000_000);
    const rows = await this.sql<{ updated_at: Date }[]>`
      INSERT INTO admin_memo (admin_id, content, updated_at)
      VALUES (${adminId}, ${safeContent}, now())
      ON CONFLICT (admin_id) DO UPDATE
        SET content = EXCLUDED.content, updated_at = now()
      RETURNING updated_at
    `;
    return { updated_at: rows[0].updated_at.toISOString() };
  }
}
