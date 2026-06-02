import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { SQL_READONLY, type Sql } from '../../shared/db/db.module';

/**
 * 운영 바이블 Agent — SQL Tool (Phase 2-B).
 *
 * Claude 가 자연어 질문 처리 중 "DB 조회 필요" 판단 시 호출.
 * 안전 가드:
 *  - SELECT / WITH 만 허용 (DDL/DML 차단)
 *  - LIMIT 자동 100 적용
 *  - statement_timeout 10초 (DB 사용자 레벨)
 *  - 민감 필드 자동 마스킹 (phone 뒷자리, password, bank_account)
 *  - 행 100건 제한 후 토큰 비용 컨트롤
 */

interface SqlExecutionResult {
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
  executed_sql: string;
}

@Injectable()
export class HandbookSqlToolService {
  private readonly logger = new Logger(HandbookSqlToolService.name);

  constructor(
    @Optional() @Inject(SQL_READONLY) private readonly sqlRo: Sql | null,
  ) {}

  isEnabled(): boolean {
    return !!this.sqlRo;
  }

  /**
   * SQL 검증 — SELECT/WITH 만 허용, 위험 키워드 차단.
   */
  private validateSql(sql: string): string {
    const trimmed = sql.trim().replace(/;\s*$/, '');
    if (!trimmed) throw new Error('빈 쿼리');

    const lower = trimmed.toLowerCase();
    if (!lower.startsWith('select') && !lower.startsWith('with')) {
      throw new Error('SELECT 또는 WITH 만 허용됨 (변경 작업 차단)');
    }
    // 위험 키워드 차단 (단어 경계)
    const blocked = ['insert', 'update', 'delete', 'truncate', 'drop', 'alter', 'create', 'grant', 'revoke', 'comment'];
    for (const kw of blocked) {
      const re = new RegExp(`\\b${kw}\\b`, 'i');
      if (re.test(trimmed)) {
        throw new Error(`금지 키워드 감지: ${kw} (SELECT 만 허용)`);
      }
    }
    // 여러 쿼리 차단 (;로 분리된 추가 쿼리)
    if (trimmed.includes(';')) {
      throw new Error('여러 쿼리 차단 — 한 번에 하나만 실행');
    }
    return trimmed;
  }

  /** LIMIT 자동 100 강제 (없으면 추가). */
  private addLimit(sql: string, defaultLimit = 100): string {
    if (/\blimit\s+\d+/i.test(sql)) return sql;
    return `${sql} LIMIT ${defaultLimit}`;
  }

  /** 민감 필드 마스킹. */
  private maskSensitive(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const sensitiveFields = new Set([
      'password', 'password_hash', 'pw', 'pwd',
      'bank_account', 'account_number', 'card_no', 'card_number',
      'billing_key', 'social_uid', 'verification_code', 'auth_code',
    ]);
    const phoneFields = new Set(['phone', 'mobile', 'tel', 'telno', 'caller_phone', 'callee_phone', 'sms_phone']);

    return rows.map((row) => {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const lk = key.toLowerCase();
        if (sensitiveFields.has(lk)) {
          masked[key] = value ? '***' : null;
        } else if (phoneFields.has(lk) && typeof value === 'string' && value.length >= 8) {
          // 01012345678 → 010-****-5678
          masked[key] = value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1-****-$2');
        } else {
          masked[key] = value;
        }
      }
      return masked;
    });
  }

  /**
   * SQL 실행 (안전 가드 통과 후).
   */
  async execute(rawSql: string): Promise<SqlExecutionResult> {
    if (!this.sqlRo) {
      throw new Error('SQL Tool 비활성 (DATABASE_URL_READONLY 미설정)');
    }
    const sanitized = this.validateSql(rawSql);
    const withLimit = this.addLimit(sanitized);

    this.logger.log(`[SQL Tool] executing: ${withLimit.slice(0, 200)}${withLimit.length > 200 ? '...' : ''}`);

    let rows: Record<string, unknown>[];
    try {
      rows = await this.sqlRo.unsafe(withLimit) as unknown as Record<string, unknown>[];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[SQL Tool] execution failed: ${msg}`);
      throw new Error(`SQL 실행 실패: ${msg}`);
    }

    const truncated = rows.length === 100;
    const masked = this.maskSensitive(rows);

    return {
      rows: masked,
      row_count: masked.length,
      truncated,
      executed_sql: withLimit,
    };
  }
}
