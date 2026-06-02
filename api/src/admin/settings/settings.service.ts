import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * 슈퍼어드민(member.is_super=true) 만 수정 가능한 setting 키 화이트리스트.
 *
 * 일반 어드민은 읽기만 가능 (UI 에서 disabled 표시).
 * 사장님 (gisu) 정책: 슈퍼만의 기능은 "전화번호 on/off" + "선지급 수수료율" 두 가지.
 *   - 전화번호 on/off 는 member.use_phone 컬럼이라 setting 아님 (별도 API 가드)
 *   - 선지급 수수료율 (fee_rate / withholding_rate) 만 여기 화이트리스트.
 */
// 2026-05-22 확장 (사장님 정책):
//   매출 직결 정책은 슈퍼만 수정. 일반관리자는 등급/단가는 읽기 가능, 임계값은 노출 X.
//   - 단가 옵션 / 정산률 / 락·재산정 / 강등 → 일반 read-only (UI fieldset disabled), 슈퍼 수정
//   - 임계값 (영업비밀) → 일반에게 노출 자체 X
const SUPER_ONLY_SETTING_KEYS: ReadonlySet<string> = new Set([
  // 선지급 (기존)
  'payout.fee_rate',
  'payout.withholding_rate',
  // 등급 단가 옵션 (6등급)
  'grade.options.preliminary',
  'grade.options.partner1',
  'grade.options.partner2',
  'grade.options.partner3',
  'grade.options.partner4',
  'grade.options.partner5',
  // 정산률 (6등급)
  'grade.revenue_rate.preliminary',
  'grade.revenue_rate.partner1',
  'grade.revenue_rate.partner2',
  'grade.revenue_rate.partner3',
  'grade.revenue_rate.partner4',
  'grade.revenue_rate.partner5',
  // 임계값 — 영업비밀. UI 에서도 일반관리자에겐 숨김
  'grade.thresholds.partner1',
  'grade.thresholds.partner2',
  'grade.thresholds.partner3',
  'grade.thresholds.partner4',
  'grade.thresholds.partner5',
  // 락 / 재산정 / 강등 정책
  'grade.lock_until_first_day',
  'grade.recalc_day_of_month',
  'grade.recalc_hour_kst',
  'grade.demote_step_max',
  // 신규 가입 기본 단가 (2026-05-22 추가) — 매출 직결
  'grade.default_new_unit_cost',
]);

export function isSuperOnlySetting(namespace: string, key: string): boolean {
  return SUPER_ONLY_SETTING_KEYS.has(`${namespace}.${key}`);
}

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
   *
   * @param isSuper 슈퍼어드민 여부. false 일 때 SUPER_ONLY_SETTING_KEYS 변경 시 ForbiddenException.
   *                실제로 값이 바뀔 때만 거부 (동일값 재전송은 허용 — 폼 일괄저장 시 무의미한 거부 방지).
   */
  async update(
    payload: SettingsByNamespace,
    adminId: number,
    isSuper: boolean = false,
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
        // 변경 전 값 조회 (이력 INSERT 용 + 슈퍼 권한 체크용)
        const beforeRows = await tx<{ value: string | null }[]>`
          SELECT value FROM setting WHERE namespace = ${namespace} AND key = ${key} LIMIT 1
        `;
        const before = beforeRows[0]?.value ?? null;

        // 슈퍼어드민 전용 키 권한 체크 — 값이 실제로 바뀔 때만 거부
        if (!isSuper && isSuperOnlySetting(namespace, key) && before !== value) {
          throw new ForbiddenException(
            `'${namespace}.${key}' 는 슈퍼어드민만 변경할 수 있습니다.`,
          );
        }

        // UPSERT — 신규 key (예: admin_alert.recipient_labels) 도 자동 INSERT.
        //   기존: UPDATE 만 → row 없으면 0건 → 저장 안 됨 (이름 저장 안 되던 사고)
        const result = await tx`
          INSERT INTO setting (namespace, key, value, updated_by_id, updated_at)
          VALUES (${namespace}, ${key}, ${value}, ${adminId}, now())
          ON CONFLICT (namespace, key) DO UPDATE
             SET value = EXCLUDED.value,
                 updated_by_id = EXCLUDED.updated_by_id,
                 updated_at = EXCLUDED.updated_at
        `;
        if (result.count > 0) {
          updated += result.count;
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
