import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 앱(모바일) 버전 관련 setting 을 그대로 반환.
 * setting.namespace = 'app' 의 모든 (key, value) 를 그대로 평면 객체로 매핑한다.
 * 새 key 가 추가되거나 삭제되어도 코드 수정 없이 응답에 반영된다.
 */
@Injectable()
export class AppVersionService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async get(): Promise<Record<string, string>> {
    const rows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting WHERE namespace = 'app'
    `;
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value ?? '';
    return out;
  }
}
