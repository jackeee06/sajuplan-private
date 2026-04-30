/**
 * 마이그레이션 러너
 *
 * 사용:
 *   npm run db:migrate         — 미적용 마이그레이션 모두 실행
 *   npm run db:migrate -- list — 적용 이력 확인
 *
 * 동작:
 *   1. _migration 메타 테이블 보장 (없으면 생성)
 *   2. api/db/migrations/*.sql 파일 사전 정렬
 *   3. 적용 안 된 파일을 트랜잭션으로 실행, _migration에 기록
 */
import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

config({ path: join(__dirname, '..', '.env') });

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[err] DATABASE_URL 미설정. api/.env 확인');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: (n) => console.log(`  [pg notice] ${n.message}`),
});

async function ensureMigrationTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migration (
      id          BIGSERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    VARCHAR(64),
      duration_ms INT
    )
  `;
  await sql`COMMENT ON TABLE _migration IS '마이그레이션 적용 이력. 자동 생성됨'`;
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function getApplied(): Promise<Set<string>> {
  const rows = await sql<{ filename: string }[]>`SELECT filename FROM _migration`;
  return new Set(rows.map((r) => r.filename));
}

async function applyMigration(filename: string): Promise<void> {
  const path = join(MIGRATIONS_DIR, filename);
  const content = readFileSync(path, 'utf-8');

  console.log(`[i] 적용: ${filename}`);
  const startedAt = Date.now();

  // 마이그레이션 SQL 자체에 BEGIN/COMMIT이 있으므로 unsafe로 그대로 실행
  // 실패하면 던져진 에러로 transaction이 자동 롤백됨
  await sql.unsafe(content);

  const duration = Date.now() - startedAt;
  await sql`
    INSERT INTO _migration (filename, duration_ms)
    VALUES (${filename}, ${duration})
  `;
  console.log(`    완료 (${duration}ms)`);
}

async function listCommand(): Promise<void> {
  await ensureMigrationTable();
  const applied = await sql<{ filename: string; applied_at: Date; duration_ms: number | null }[]>`
    SELECT filename, applied_at, duration_ms FROM _migration ORDER BY filename
  `;
  const files = listMigrationFiles();
  const appliedSet = new Set(applied.map((a) => a.filename));

  console.log('\n적용 이력:');
  console.log('-'.repeat(80));
  for (const f of files) {
    const a = applied.find((x) => x.filename === f);
    if (a) {
      const ts = a.applied_at.toISOString().replace('T', ' ').slice(0, 19);
      console.log(`  ✓ ${f.padEnd(40)} ${ts}  (${a.duration_ms ?? '?'}ms)`);
    } else {
      console.log(`  ○ ${f.padEnd(40)} (미적용)`);
    }
  }
  // 파일은 없는데 DB에는 있는 경우 (수동 삭제 등)
  for (const a of applied) {
    if (!files.includes(a.filename)) {
      console.log(`  ! ${a.filename} (DB에만 존재 — 파일 누락)`);
    }
  }
}

async function migrateCommand(): Promise<void> {
  await ensureMigrationTable();
  const files = listMigrationFiles();
  const applied = await getApplied();

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log('[i] 적용할 마이그레이션 없음 (모두 적용됨)');
    return;
  }

  console.log(`[i] 미적용 ${pending.length}개:`);
  pending.forEach((f) => console.log(`    - ${f}`));
  console.log();

  for (const f of pending) {
    await applyMigration(f);
  }
  console.log(`\n[i] 완료. ${pending.length}개 적용됨.`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  try {
    if (cmd === 'list') {
      await listCommand();
    } else {
      await migrateCommand();
    }
  } catch (e) {
    console.error('[err] 마이그레이션 실패:', e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
