// RWS(라이더웨이트 1909, 퍼블릭 도메인) 78장을 위키미디어에서 받아 webp로 변환.
//   - 출처: Special:FilePath (해시경로 불필요) + ?width=700 (서버측 축소)
//   - 변환: sharp → webp q82 (장당 ~25~45KB)
//   - 저장: packages/web/public/tarot/<id>.webp
// 사용: node scripts/fetch-cards.mjs   (tarot/ 에서 실행)
import { mkdir, writeFile, access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';

const OUT = new URL('../packages/web/public/tarot/', import.meta.url);
const UA = 'SajuplanTarotBot/1.0 (https://sajuplan.com; admin@sajuplan.com)';
const WIDTH = 700;

const MAJOR_NAMES = [
  'Fool', 'Magician', 'High_Priestess', 'Empress', 'Emperor', 'Hierophant', 'Lovers',
  'Chariot', 'Strength', 'Hermit', 'Wheel_of_Fortune', 'Justice', 'Hanged_Man', 'Death',
  'Temperance', 'Devil', 'Tower', 'Star', 'Moon', 'Sun', 'Judgement', 'World',
];
const SUIT_PREFIX = { wands: 'Wands', cups: 'Cups', swords: 'Swords', pentacles: 'Pents' };

// id → 위키미디어 파일명
const map = [];
MAJOR_NAMES.forEach((name, i) => {
  const nn = String(i).padStart(2, '0');
  map.push({ id: `major-${nn}`, file: `RWS_Tarot_${nn}_${name}.jpg` });
});
for (const [suit, prefix] of Object.entries(SUIT_PREFIX)) {
  for (let n = 1; n <= 14; n++) {
    const nn = String(n).padStart(2, '0');
    map.push({ id: `${suit}-${nn}`, file: `${prefix}${nn}.jpg` });
  }
}

const exists = (p) => access(p).then(() => true).catch(() => false);

async function fetchOne({ id, file }, attempt = 1) {
  const out = new URL(`${id}.webp`, OUT);
  if (await exists(out)) return 'skip';
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (res.status === 429 || res.status === 503) {
    if (attempt > 5) throw new Error(`${id}: ${res.status} 반복`);
    await sleep(1500 * attempt);
    return fetchOne({ id, file }, attempt + 1);
  }
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status} (${file})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const webp = await sharp(buf).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  await writeFile(out, webp);
  return `${(webp.length / 1024).toFixed(0)}KB`;
}

await mkdir(OUT, { recursive: true });
let ok = 0, total = 0;
for (const item of map) {
  try {
    const r = await fetchOne(item);
    if (r !== 'skip') { total += 1; ok += 1; process.stdout.write(`✓ ${item.id} ${r}\n`); }
    else process.stdout.write(`· ${item.id} (이미 있음)\n`);
  } catch (e) {
    process.stdout.write(`✗ ${item.id}  ${e.message}\n`);
  }
  await sleep(350); // 위키미디어 예의상 속도조절
}
console.log(`\n완료: ${ok}/${map.length} 신규 다운로드`);
