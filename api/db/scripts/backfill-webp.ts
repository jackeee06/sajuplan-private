/**
 * 기존 업로드 이미지에 대해 WebP 변환본을 일괄 생성한다.
 *
 * 사용:
 *   ts-node db/scripts/backfill-webp.ts            — 모든 테이블 백필
 *   ts-node db/scripts/backfill-webp.ts banner     — 특정만 (banner/popup/member/category/product/postfile)
 *   ts-node db/scripts/backfill-webp.ts --dry      — 변환 없이 대상만 출력
 *
 * 동작:
 *   1) DB 에서 image_url IS NOT NULL AND image_url_webp IS NULL 인 row 조회
 *   2) 각 row 의 파일 경로(uploads/...) 가 디스크에 존재하는지 확인
 *   3) sharp 로 .webp 사이블링 생성
 *   4) DB 의 *_webp 컬럼 업데이트
 *
 * 누락 파일은 [skip] 로 표기, 변환 실패도 [fail] 로 표기 — 다음 row 계속.
 *
 * ※ 이 스크립트는 멱등 (idempotent). 다시 실행해도 이미 채워진 row 는 건너뜀.
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import postgres from 'postgres';
import { convertImageToWebp } from '../../src/shared/common/image-to-webp';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[err] DATABASE_URL 미설정');
  process.exit(1);
}

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const targets = new Set(args.filter((a) => !a.startsWith('--')));
const runAll = targets.size === 0;
const should = (k: string) => runAll || targets.has(k);

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

interface Stat {
  scanned: number;
  converted: number;
  skipped_missing: number;
  skipped_not_image: number;
  skipped_already: number;
  failed: number;
}
const newStat = (): Stat => ({
  scanned: 0,
  converted: 0,
  skipped_missing: 0,
  skipped_not_image: 0,
  skipped_already: 0,
  failed: 0,
});

/** image_url 같은 상대 경로(예: /uploads/banner/xxx.png)에서 디스크 절대 경로 도출 */
function urlToDiskPath(url: string): string | null {
  // 외부 URL 은 변환 대상 아님
  if (/^https?:\/\//.test(url)) return null;
  // /uploads/banner/xxx.png → ./uploads/banner/xxx.png
  if (url.startsWith('/uploads/')) {
    return join(process.cwd(), url.slice(1));
  }
  // member_file.stored_name 같은 파일명만 들어있는 경우는 호출처에서 디렉토리를 합쳐서 전달
  return null;
}

async function backfillBanner(): Promise<Stat> {
  const stat = newStat();
  const rows = await sql<{ id: number; image_url: string }[]>`
    SELECT id, image_url
      FROM shop_banner
     WHERE image_url IS NOT NULL
       AND image_url_webp IS NULL
  `;
  console.log(`\n[banner] 대상 ${rows.length} 건`);
  for (const r of rows) {
    stat.scanned++;
    const disk = urlToDiskPath(r.image_url);
    if (!disk) {
      console.log(`  [skip-external] #${r.id} ${r.image_url}`);
      stat.skipped_not_image++;
      continue;
    }
    if (!existsSync(disk)) {
      console.log(`  [skip-missing] #${r.id} ${r.image_url} (file not found)`);
      stat.skipped_missing++;
      continue;
    }
    if (isDry) {
      console.log(`  [dry] #${r.id} would convert ${r.image_url}`);
      continue;
    }
    const { webpFilename, alreadyWebp } = await convertImageToWebp(disk);
    if (!webpFilename) {
      console.log(`  [fail] #${r.id} ${r.image_url}`);
      stat.failed++;
      continue;
    }
    const webpUrl = `${dirname(r.image_url)}/${webpFilename}`;
    await sql`UPDATE shop_banner SET image_url_webp = ${webpUrl} WHERE id = ${r.id}`;
    console.log(`  [ok${alreadyWebp ? '-noop' : ''}] #${r.id} → ${webpUrl}`);
    if (alreadyWebp) stat.skipped_already++;
    else stat.converted++;
  }
  return stat;
}

async function backfillPopup(): Promise<Stat> {
  const stat = newStat();
  const rows = await sql<{ id: number; image_url: string }[]>`
    SELECT id, image_url
      FROM popup_notice
     WHERE image_url IS NOT NULL
       AND image_url_webp IS NULL
  `;
  console.log(`\n[popup] 대상 ${rows.length} 건`);
  for (const r of rows) {
    stat.scanned++;
    const disk = urlToDiskPath(r.image_url);
    if (!disk) { console.log(`  [skip-external] #${r.id} ${r.image_url}`); stat.skipped_not_image++; continue; }
    if (!existsSync(disk)) { console.log(`  [skip-missing] #${r.id} ${r.image_url}`); stat.skipped_missing++; continue; }
    if (isDry) { console.log(`  [dry] #${r.id} ${r.image_url}`); continue; }
    const { webpFilename, alreadyWebp } = await convertImageToWebp(disk);
    if (!webpFilename) { console.log(`  [fail] #${r.id} ${r.image_url}`); stat.failed++; continue; }
    const webpUrl = `${dirname(r.image_url)}/${webpFilename}`;
    await sql`UPDATE popup_notice SET image_url_webp = ${webpUrl} WHERE id = ${r.id}`;
    console.log(`  [ok${alreadyWebp ? '-noop' : ''}] #${r.id} → ${webpUrl}`);
    if (alreadyWebp) stat.skipped_already++; else stat.converted++;
  }
  return stat;
}

/** member_file.stored_name 은 파일명만 — uploads/member/ 와 합쳐서 경로 만든다.
 *  이미지 종류만 변환 대상 (file_type=1 또는 kind in profile/thumbnail/wide). */
async function backfillMemberFile(): Promise<Stat> {
  const stat = newStat();
  const rows = await sql<{
    id: number;
    stored_name: string;
    kind: string | null;
    file_type: number;
  }[]>`
    SELECT id, stored_name, kind, file_type
      FROM member_file
     WHERE stored_name IS NOT NULL
       AND stored_name_webp IS NULL
       AND (file_type = 1 OR kind IN ('profile', 'thumbnail', 'wide'))
  `;
  console.log(`\n[member_file] 대상 ${rows.length} 건`);
  const memberDir = join(UPLOADS_ROOT, 'member');
  for (const r of rows) {
    stat.scanned++;
    const ext = extname(r.stored_name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      console.log(`  [skip-not-image] #${r.id} ${r.stored_name}`);
      stat.skipped_not_image++;
      continue;
    }
    const disk = join(memberDir, r.stored_name);
    if (!existsSync(disk)) {
      console.log(`  [skip-missing] #${r.id} ${r.stored_name}`);
      stat.skipped_missing++;
      continue;
    }
    if (isDry) { console.log(`  [dry] #${r.id} ${r.stored_name}`); continue; }
    const { webpFilename, alreadyWebp } = await convertImageToWebp(disk);
    if (!webpFilename) { console.log(`  [fail] #${r.id} ${r.stored_name}`); stat.failed++; continue; }
    await sql`UPDATE member_file SET stored_name_webp = ${webpFilename} WHERE id = ${r.id}`;
    console.log(`  [ok${alreadyWebp ? '-noop' : ''}] #${r.id} → ${webpFilename}`);
    if (alreadyWebp) stat.skipped_already++; else stat.converted++;
  }
  return stat;
}

async function backfillShopCategory(): Promise<Stat> {
  const stat = newStat();
  const rows = await sql<{ id: number; image_url: string }[]>`
    SELECT id, image_url
      FROM shop_category
     WHERE image_url IS NOT NULL
       AND image_url_webp IS NULL
  `;
  console.log(`\n[shop_category] 대상 ${rows.length} 건`);
  for (const r of rows) {
    stat.scanned++;
    const disk = urlToDiskPath(r.image_url);
    if (!disk) { console.log(`  [skip-external] #${r.id} ${r.image_url}`); stat.skipped_not_image++; continue; }
    if (!existsSync(disk)) { console.log(`  [skip-missing] #${r.id} ${r.image_url}`); stat.skipped_missing++; continue; }
    if (isDry) { console.log(`  [dry] #${r.id} ${r.image_url}`); continue; }
    const { webpFilename, alreadyWebp } = await convertImageToWebp(disk);
    if (!webpFilename) { console.log(`  [fail] #${r.id} ${r.image_url}`); stat.failed++; continue; }
    const webpUrl = `${dirname(r.image_url)}/${webpFilename}`;
    await sql`UPDATE shop_category SET image_url_webp = ${webpUrl} WHERE id = ${r.id}`;
    console.log(`  [ok${alreadyWebp ? '-noop' : ''}] #${r.id} → ${webpUrl}`);
    if (alreadyWebp) stat.skipped_already++; else stat.converted++;
  }
  return stat;
}

async function backfillProduct(): Promise<Stat> {
  const stat = newStat();
  const rows = await sql<{ id: number; image_main: string }[]>`
    SELECT id, image_main
      FROM product
     WHERE image_main IS NOT NULL
       AND image_main_webp IS NULL
  `;
  console.log(`\n[product] 대상 ${rows.length} 건`);
  for (const r of rows) {
    stat.scanned++;
    const disk = urlToDiskPath(r.image_main);
    if (!disk) { console.log(`  [skip-external] #${r.id} ${r.image_main}`); stat.skipped_not_image++; continue; }
    if (!existsSync(disk)) { console.log(`  [skip-missing] #${r.id} ${r.image_main}`); stat.skipped_missing++; continue; }
    if (isDry) { console.log(`  [dry] #${r.id} ${r.image_main}`); continue; }
    const { webpFilename, alreadyWebp } = await convertImageToWebp(disk);
    if (!webpFilename) { console.log(`  [fail] #${r.id} ${r.image_main}`); stat.failed++; continue; }
    const webpUrl = `${dirname(r.image_main)}/${webpFilename}`;
    await sql`UPDATE product SET image_main_webp = ${webpUrl} WHERE id = ${r.id}`;
    console.log(`  [ok${alreadyWebp ? '-noop' : ''}] #${r.id} → ${webpUrl}`);
    if (alreadyWebp) stat.skipped_already++; else stat.converted++;
  }
  return stat;
}

async function backfillPostFile(): Promise<Stat> {
  const stat = newStat();
  const rows = await sql<{
    id: number;
    board_slug: string;
    stored_name: string;
    file_type: number;
  }[]>`
    SELECT id, board_slug, stored_name, file_type
      FROM post_file
     WHERE stored_name IS NOT NULL
       AND stored_name_webp IS NULL
       AND file_type = 1
  `;
  console.log(`\n[post_file] 대상 ${rows.length} 건`);
  for (const r of rows) {
    stat.scanned++;
    const ext = extname(r.stored_name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      console.log(`  [skip-not-image] #${r.id} ${r.stored_name}`);
      stat.skipped_not_image++;
      continue;
    }
    // post_file 은 보드별 디렉토리 — 구조는 sample 기반 추정. 실제 디스크 경로가 다르면 skip.
    // 가능한 위치: uploads/board/<slug>/<file>, uploads/<slug>/<file>, uploads/post/<slug>/<file>
    const candidates = [
      join(UPLOADS_ROOT, 'board', r.board_slug, r.stored_name),
      join(UPLOADS_ROOT, r.board_slug, r.stored_name),
      join(UPLOADS_ROOT, 'post', r.board_slug, r.stored_name),
      join(UPLOADS_ROOT, 'post', r.stored_name),
      join(UPLOADS_ROOT, r.stored_name),
    ];
    const disk = candidates.find(existsSync);
    if (!disk) {
      console.log(`  [skip-missing] #${r.id} ${r.stored_name} (board=${r.board_slug})`);
      stat.skipped_missing++;
      continue;
    }
    if (isDry) { console.log(`  [dry] #${r.id} ${disk}`); continue; }
    const { webpFilename, alreadyWebp } = await convertImageToWebp(disk);
    if (!webpFilename) { console.log(`  [fail] #${r.id} ${disk}`); stat.failed++; continue; }
    await sql`UPDATE post_file SET stored_name_webp = ${webpFilename} WHERE id = ${r.id}`;
    console.log(`  [ok${alreadyWebp ? '-noop' : ''}] #${r.id} → ${webpFilename}`);
    if (alreadyWebp) stat.skipped_already++; else stat.converted++;
  }
  return stat;
}

function summarize(name: string, s: Stat) {
  console.log(`  ${name.padEnd(15)} scanned=${s.scanned} converted=${s.converted} already=${s.skipped_already} missing=${s.skipped_missing} skipped=${s.skipped_not_image} failed=${s.failed}`);
}

async function main() {
  console.log(`▸ uploads root: ${UPLOADS_ROOT}`);
  console.log(`▸ mode: ${isDry ? 'DRY-RUN (no writes)' : 'WRITE'}`);
  console.log(`▸ targets: ${runAll ? 'all' : Array.from(targets).join(',')}`);

  const stats: Record<string, Stat> = {};
  if (should('banner'))   stats.banner   = await backfillBanner();
  if (should('popup'))    stats.popup    = await backfillPopup();
  if (should('member'))   stats.member   = await backfillMemberFile();
  if (should('category')) stats.category = await backfillShopCategory();
  if (should('product'))  stats.product  = await backfillProduct();
  if (should('postfile')) stats.postfile = await backfillPostFile();

  console.log('\n══ 요약 ══');
  for (const [name, s] of Object.entries(stats)) summarize(name, s);

  await sql.end();
  console.log('\n완료.');
}

main().catch((e) => {
  console.error('[err]', e);
  process.exit(1);
});
