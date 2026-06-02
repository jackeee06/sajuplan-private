import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 상담사 개인 메모장 — admin_memo 테이블 공유 (admin_id 컬럼은 member.id 의미).
 *
 * - 본인 메모만 본인이 봄 (memberId 자동 필터)
 * - 자동 저장 (프론트가 디바운스 후 PUT)
 * - content 는 HTML (Toast UI Editor 출력)
 * - 이미지는 /uploads/counselor-memo/{member_id}/ 로 별도 폴더 분리
 */
@Injectable()
export class CounselorMypageMemoService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async get(memberId: number): Promise<{ content: string; updated_at: string | null }> {
    const rows = await this.sql<{ content: string; updated_at: Date }[]>`
      SELECT content, updated_at FROM admin_memo WHERE admin_id = ${memberId} LIMIT 1
    `;
    if (rows.length === 0) return { content: '', updated_at: null };
    return {
      content: rows[0].content ?? '',
      updated_at: rows[0].updated_at?.toISOString() ?? null,
    };
  }

  async save(memberId: number, content: string): Promise<{ updated_at: string }> {
    const safeContent = (content ?? '').slice(0, 1_000_000);
    const rows = await this.sql<{ updated_at: Date }[]>`
      INSERT INTO admin_memo (admin_id, content, updated_at)
      VALUES (${memberId}, ${safeContent}, now())
      ON CONFLICT (admin_id) DO UPDATE
        SET content = EXCLUDED.content, updated_at = now()
      RETURNING updated_at
    `;
    return { updated_at: rows[0].updated_at.toISOString() };
  }
}
