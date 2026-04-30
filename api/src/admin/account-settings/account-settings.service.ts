import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

/**
 * sample/adm/coin_pay_form.php (메뉴 350460 "충전금액 설정") 정확 매핑.
 *   원본: account_config (product_id 1~5)
 *   신규: account_setting
 *     - amount: 결제금액(VAT 별도)
 *     - coin_amount: 총 지급 포인트 (보너스 포함)
 *     - extras.bonus / extras.message: 보너스 적립 / 노출 문구
 */

export interface AccountSettingRow {
  id: number;
  no: number | null;
  product_name: string | null;
  amount: number | null;
  coin_amount: number | null;
  is_active: boolean;
  display_order: number;
  extras: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AccountSettingInput {
  product_name?: string;
  amount: number;
  coin_amount: number;
  bonus?: number;
  message?: string;
  is_active?: boolean;
  display_order?: number;
}

@Injectable()
export class AccountSettingsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async list() {
    const items = await this.sql<AccountSettingRow[]>`
      SELECT * FROM account_setting ORDER BY display_order ASC, id ASC
    `;
    return { items, total: items.length };
  }

  async upsert(items: AccountSettingInput[]) {
    if (!Array.isArray(items)) throw new BadRequestException('items 배열을 전달하세요.');
    const toInt = (v: unknown): number => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    };
    return await this.sql.begin(async (tx) => {
      // 단순 정책: 전체 삭제 후 재삽입 (5개 정도 소량이라 안전)
      await tx`DELETE FROM account_setting`;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const amount = toInt(it.amount);
        const coin = toInt(it.coin_amount);
        const bonus = toInt(it.bonus);
        const extras: Record<string, unknown> = {};
        // 0도 유효한 값 — 입력값이 명시적으로 들어왔으면 그대로 보존
        if (it.bonus !== undefined && it.bonus !== null && (it.bonus as unknown) !== '') {
          extras.bonus = bonus;
        }
        if (it.message) extras.message = it.message;
        await tx`
          INSERT INTO account_setting (no, product_name, amount, coin_amount, is_active, display_order, extras)
          VALUES (${i + 1}, ${it.product_name ?? null}, ${amount}, ${coin}, ${it.is_active ?? true}, ${it.display_order ?? i}, ${this.sql.json(extras as never)})
        `;
      }
      return { ok: true, count: items.length };
    });
  }
}
