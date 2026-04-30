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
        const result = await tx`
          UPDATE setting
             SET value = ${value},
                 updated_by_id = ${adminId},
                 updated_at = now()
           WHERE namespace = ${namespace} AND key = ${key}
        `;
        updated += result.count;
      }
    });
    return { updated };
  }
}
