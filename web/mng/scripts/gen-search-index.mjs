/**
 * 전체메뉴 검색 인덱스 자동 생성.
 *   App.tsx 라우트(path→컴포넌트→파일)를 파싱하고, 각 페이지 컴포넌트 코드에서
 *   화면에 렌더되는 한글 단어를 전부 추출해 path별 검색 인덱스(JSON)로 만든다.
 *   → 화면에 보이는 단어는 사람이 손으로 aliases 에 안 넣어도 자동으로 검색된다.
 *   → 새 기능/페이지를 추가해도 다음 빌드에 자동 인덱싱(유지보수 0).
 *
 * prebuild 로 자동 실행(package.json). 산출물: src/generated/menuSearchIndex.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const OUT = path.join(ROOT, 'src', 'generated', 'menuSearchIndex.json');

const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');

// 1) import 컴포넌트 → 파일명 매핑
const importMap = {};
for (const m of appSrc.matchAll(/import\s+(\w+)\s+from\s+'\.\/pages\/([\w/]+)'/g)) {
  importMap[m[1]] = m[2];
}

// 2) 라우트: <Route path="..." element={<Comp ...
const routes = [];
for (const m of appSrc.matchAll(/path="([^"]+)"\s+element=\{<(\w+)/g)) {
  routes.push({ path: m[1], comp: m[2] });
}

// 3) 페이지 파일에서 화면 한글 단어 추출 (공백 없는 연속 한글[+영숫자] 블록, 2자 이상)
const STOP = new Set(['것이다', '입니다', '합니다', '됩니다', '없습니다', '있습니다', '하세요', '해주세요']);
function extractKoWords(file) {
  const fp = path.join(PAGES_DIR, `${file}.tsx`);
  if (!fs.existsSync(fp)) return [];
  const src = fs.readFileSync(fp, 'utf8');
  const set = new Set();
  for (const m of src.matchAll(/[가-힣][가-힣A-Za-z0-9]{1,}/g)) {
    const w = m[0];
    if (w.length >= 2 && !STOP.has(w)) set.add(w);
  }
  return [...set];
}

const index = {};
let total = 0;
for (const r of routes) {
  const file = importMap[r.comp];
  if (!file) continue;
  const words = extractKoWords(file);
  if (words.length === 0) continue;
  // 같은 path 여러 번(상세/목록) 나오면 합집합
  index[r.path] = [...new Set([...(index[r.path] ?? []), ...words])];
  total += words.length;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`[gen-search-index] ${Object.keys(index).length} routes, ${total} words → ${path.relative(ROOT, OUT)}`);
