import { Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export interface SettingRow {
  namespace: string;
  key: string;
  value: string | null;
  value_type: string;
  description: string | null;
  updated_at: Date;
}

export type SettingsByNamespace = Record<string, Record<string, string>>;

@Injectable()
export class SettingsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** 모든 설정을 namespace별로 묶어 반환 */
  async getAll(): Promise<SettingsByNamespace> {
    const rows = await this.sql<SettingRow[]>`
      SELECT namespace, key, value, value_type, description, updated_at
      FROM setting
      ORDER BY namespace, key
    `;
    const grouped: SettingsByNamespace = {};
    for (const r of rows) {
      if (!grouped[r.namespace]) grouped[r.namespace] = {};
      grouped[r.namespace][r.key] = r.value ?? '';
    }
    return grouped;
  }

  /** 특정 namespace 의 설정만 반환 */
  async getNamespace(namespace: string): Promise<Record<string, string>> {
    const rows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting WHERE namespace = ${namespace}
    `;
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value ?? '';
    return out;
  }

  /**
   * 일괄 업데이트. 입력은 { namespace: { key: value, ... }, ... } 형태.
   * setting 테이블에 이미 있는 (namespace, key) 만 업데이트한다 (신규 키는 무시 — 마이그레이션으로 추가).
   */
  async update(
    payload: SettingsByNamespace,
    adminId: number,
  ): Promise<{ updated: number }> {
    const flat: { namespace: string; key: string; value: string }[] = [];
    for (const ns of Object.keys(payload)) {
      for (const k of Object.keys(payload[ns])) {
        flat.push({ namespace: ns, key: k, value: String(payload[ns][k] ?? '') });
      }
    }
    if (flat.length === 0) return { updated: 0 };

    let updated = 0;
    await this.sql.begin(async (tx) => {
      for (const { namespace, key, value } of flat) {
        // 변경 전 값 조회 (이력 INSERT 용)
        const beforeRows = await tx<{ value: string | null }[]>`
          SELECT value FROM setting WHERE namespace = ${namespace} AND key = ${key} LIMIT 1
        `;
        const before = beforeRows[0]?.value ?? null;

        const result = await tx`
          UPDATE setting
             SET value = ${value},
                 updated_by_id = ${adminId},
                 updated_at = now()
           WHERE namespace = ${namespace} AND key = ${key}
        `;
        if (result.count > 0) {
          updated += result.count;
          // 실제 변경된 경우에만 이력 INSERT (값 동일하면 SKIP)
          if (before !== value) {
            await tx`
              INSERT INTO setting_history (namespace, key, value_before, value_after, changed_by)
              VALUES (${namespace}, ${key}, ${before}, ${value}, ${`admin:${adminId}`})
            `;
          }
        }
      }
    });
    return { updated };
  }

  /**
   * 설정 변경 이력 조회 (어드민 운영 도구).
   * namespace + key 로 필터 가능. 최근 순.
   */
  async getHistory(params: {
    namespace?: string;
    key?: string;
    limit?: number;
  }): Promise<Array<{
    id: number;
    namespace: string;
    key: string;
    value_before: string | null;
    value_after: string | null;
    changed_by: string;
    created_at: string;
  }>> {
    const lim = Math.min(200, Math.max(1, params.limit ?? 50));
    const nsFilter = params.namespace ? this.sql`AND namespace = ${params.namespace}` : this.sql``;
    const keyFilter = params.key ? this.sql`AND key = ${params.key}` : this.sql``;
    return await this.sql<Array<{
      id: number; namespace: string; key: string;
      value_before: string | null; value_after: string | null;
      changed_by: string; created_at: string;
    }>>`
      SELECT id, namespace, key, value_before, value_after, changed_by, created_at::text
        FROM setting_history
       WHERE 1=1
         ${nsFilter}
         ${keyFilter}
       ORDER BY id DESC
       LIMIT ${lim}
    `;
  }
}
