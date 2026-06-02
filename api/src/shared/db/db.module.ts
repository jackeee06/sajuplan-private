import { Global, Module, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';

/**
 * postgres.js 클라이언트 DI 토큰
 *
 * 사용:
 *   @Inject(SQL) private readonly sql: Sql
 *   const rows = await this.sql`SELECT id FROM member WHERE mb_id = ${mbId}`
 */
export const SQL = Symbol('postgres.sql');
export type Sql = ReturnType<typeof postgres>;
// 트랜잭션 내 sql 핸들 (sql.begin 콜백의 첫 인자). InTx 패턴 helper 에서 사용.
export type TxSql = postgres.TransactionSql<Record<string, never>>;

/**
 * 읽기 전용 SQL 클라이언트 (Phase 2-B Agent / handbook RAG).
 * handbook_readonly user — SELECT 만 가능, statement_timeout 10초 강제.
 *
 * 사용:
 *   @Inject(SQL_READONLY) private readonly sqlRo: Sql
 */
export const SQL_READONLY = Symbol('postgres.sql.readonly');

/**
 * SQL 클라이언트 종료 매니저 (App 종료 시 connection pool drain)
 */
class SqlShutdown implements OnApplicationShutdown {
  constructor(private readonly client: Sql) {}
  async onApplicationShutdown(): Promise<void> {
    Logger.log('postgres.js 연결 종료', 'DbModule');
    await this.client.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: SQL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Sql => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) {
          throw new Error('DATABASE_URL 미설정. api/.env 확인');
        }
        const client = postgres(url, {
          max: 10,
          idle_timeout: 30,
          // SSL은 인프라 설정에 맞춰 조정. 현재 테스트 서버는 동일 LAN
          // ssl: { rejectUnauthorized: false },
          onnotice: () => {},
        });
        Logger.log(`postgres.js 연결됨 (max=10)`, 'DbModule');
        return client;
      },
    },
    {
      provide: SqlShutdown,
      inject: [SQL],
      useFactory: (client: Sql) => new SqlShutdown(client),
    },
    {
      provide: SQL_READONLY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Sql | null => {
        const url = config.get<string>('DATABASE_URL_READONLY');
        if (!url) {
          Logger.warn('DATABASE_URL_READONLY 미설정. handbook Agent SQL Tool 비활성.', 'DbModule');
          return null;
        }
        const client = postgres(url, {
          max: 3,
          idle_timeout: 30,
          onnotice: () => {},
        });
        Logger.log(`postgres.js readonly 연결됨 (max=3)`, 'DbModule');
        return client;
      },
    },
  ],
  exports: [SQL, SQL_READONLY],
})
export class DbModule {}
