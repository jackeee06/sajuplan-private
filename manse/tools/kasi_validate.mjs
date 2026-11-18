/**
 * 만세력 정확도 자동 대조 — 한국천문연구원(KASI) 공개 API 기준
 * ────────────────────────────────────────────────────────────────
 * "만세력이 틀렸다" 신고를 원천 차단하기 위한 진짜-버그 탐지 게이트.
 * 대한민국 공식 기준(KASI)과 대조해, 배포 전 자동으로 어긋남을 잡는다.
 *
 * 검증 두 축 (둘 다 computeManse 공개 API만 사용 — 엔진 내부 의존 없음):
 *  1) 월주 경계(절기)  : KASI 24절기 시각을 받아, 그 순간 ±tol분에서 월지(月支)가
 *                       정확히 바뀌는지 확인. → 월건(월주) 전수 핀.
 *  2) 일주 앵커(일진)  : KASI 음양력 API의 일진(日辰) 간지와 일주가 일치하는지. → 일주 핀.
 *  (년주 세차는 입춘/설 경계 관습차가 있어 7~11월 표본만 참고 대조.)
 *
 * KASI 절입시각(월경계) + 일진(일앵커) + 오호둔·세차(결정론) 가 모두 핀되면
 * 명식 전체(년·월·일 간지)의 정확성이 KASI로 보장된다.
 *
 * 사용법:
 *   1. data.go.kr 에서 "한국천문연구원_특일 정보"(SpcdeInfoService) +
 *      "한국천문연구원_음양력 정보"(LrsrCldInfoService) 활용신청 → 인증키 발급
 *   2. manse/.env.local (또는 저장소 루트 .env.local) 에  KASI_SERVICE_KEY=발급키  추가
 *   3. npm run build -w @manse/engine   (dist 필요)
 *   4. node tools/kasi_validate.mjs terms 1970 2030     # 절기(월경계) 대조
 *      node tools/kasi_validate.mjs iljin 1950 2030 300 # 일진 표본 300건 대조
 *      node tools/kasi_validate.mjs all                 # 둘 다(기본 범위)
 *
 * 결과: 카테고리별 일치/불일치 건수 + 불일치 상세. exit code 0=전부일치, 1=불일치존재, 2=키없음.
 * 캐시: tools/.kasi_cache.json (같은 요청 재호출 방지 — KASI 무료쿼터 절약).
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// ── 엔진 로드 (Windows: file:// URL 필수) ──
let computeManse;
try {
  ({ computeManse } = await import(pathToFileURL(join(ROOT, "packages/engine/dist/index.js")).href));
} catch (e) {
  console.error("엔진 dist 로드 실패 — 먼저: npm run build -w @manse/engine\n  " + e.message);
  process.exit(2);
}

// ── 키 로드 (.env.local) ──
function loadKey() {
  for (const p of [join(ROOT, ".env.local"), join(ROOT, "..", ".env.local")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^KASI_SERVICE_KEY\s*=\s*(.+)$/.exec(line.trim());
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return process.env.KASI_SERVICE_KEY || null;
}
const KEY = loadKey();
if (!KEY) {
  console.error(
    "KASI_SERVICE_KEY 없음. data.go.kr 에서 특일정보+음양력정보 활용신청 후\n" +
    "manse/.env.local 에  KASI_SERVICE_KEY=발급키  추가하세요. (건너뜀)",
  );
  process.exit(2);
}

// ── 캐시 ──
const CACHE_PATH = join(HERE, ".kasi_cache.json");
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
let cacheDirty = false;
function saveCache() { if (cacheDirty) writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8"); }

async function kasiGet(url, cacheKey) {
  if (cache[cacheKey]) return cache[cacheKey];
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!text.includes("<") ) throw new Error("비XML 응답: " + text.slice(0, 120));
      if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ERROR|LIMITED_NUMBER/i.test(text))
        throw new Error("KASI 오류: " + (text.match(/<returnAuthMsg>(.*?)<|<errMsg>(.*?)</)?.[0] ?? text.slice(0, 160)));
      cache[cacheKey] = text; cacheDirty = true;
      await new Promise((r) => setTimeout(r, 120)); // 예의상 간격
      return text;
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
  }
  throw lastErr;
}

const BASE = "http://apis.data.go.kr/B090041/openapi/service";
const enc = encodeURIComponent(KEY);

// XML 태그 다건 추출
function items(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const o = {};
    for (const t of m[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[t[1]] = t[2].trim();
    return o;
  });
}
const hanjaOnly = (s) => (s || "").replace(/[^一-鿿]/g, ""); // "을미(乙未)" → "乙未"

// KASI 24절기 정보 (한 해)
async function kasiTerms(year) {
  const url = `${BASE}/SpcdeInfoService/get24DivisionsInfo?serviceKey=${enc}&solYear=${year}&numOfRows=30&pageNo=1`;
  return items(await kasiGet(url, `terms:${year}`));
}
// KASI 음양력(양력→) 정보 (하루)
async function kasiSol(y, m, d) {
  const url = `${BASE}/LrsrCldInfoService/getSolCalInfo?serviceKey=${enc}&solYear=${y}&solMonth=${String(m).padStart(2, "0")}&solDay=${String(d).padStart(2, "0")}`;
  return items(await kasiGet(url, `sol:${y}-${m}-${d}`))[0] || {};
}

// 12절(월지경계) 절기명 → 해당 월지 한자(그 절기 이후의 월)
const TERM_TO_BRANCH = {
  입춘: "寅", 경칩: "卯", 청명: "辰", 입하: "巳", 망종: "午", 소서: "未",
  입추: "申", 백로: "酉", 한로: "戌", 입동: "亥", 대설: "子", 소한: "丑",
};

// 절입 순간(KST) 기준, ±tol분에서 월지가 정확히 바뀌는지
function monthBranchAt(y, mo, d, hh, mi) {
  const c = computeManse({ birth: `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(hh).padStart(2,"0")}:${String(mi).padStart(2,"0")}`, gender: "M", longitude: 127.5 });
  return c.pillars.month.branch.hanja;
}
function addMin(y, mo, d, hh, mi, delta) {
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mi) + delta * 60000);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes()];
}

async function validateTerms(y0, y1, tol = 3) {
  let ok = 0, bad = 0;
  const fails = [];
  for (let y = y0; y <= y1; y++) {
    let terms;
    try { terms = await kasiTerms(y); } catch (e) { console.error(`  ${y} 절기조회 실패: ${e.message}`); continue; }
    for (const it of terms) {
      const branch = TERM_TO_BRANCH[it.dateName];
      if (!branch) continue; // 12절만(중기 제외)
      const ymd = it.locdate; // YYYYMMDD
      const hm = (it.kst || "0000").padStart(4, "0");
      const Y = +ymd.slice(0, 4), M = +ymd.slice(4, 6), D = +ymd.slice(6, 8);
      const H = +hm.slice(0, 2), Mi = +hm.slice(2, 4);
      const before = monthBranchAt(...addMin(Y, M, D, H, Mi, -tol));
      const after = monthBranchAt(...addMin(Y, M, D, H, Mi, +tol));
      // 절입 tol분 전엔 아직 이전 월지, tol분 후엔 이 절기의 월지여야 함
      if (after === branch && before !== branch) ok++;
      else { bad++; fails.push(`${y} ${it.dateName}(${ymd} ${hm}KST): 기대 ${branch}, 실측 전=${before} 후=${after}`); }
    }
    process.stdout.write(`\r  절기 대조 ${y}...   `);
  }
  console.log(`\n[절기/월경계] 일치 ${ok} · 불일치 ${bad}`);
  fails.slice(0, 40).forEach((f) => console.log("   ✗ " + f));
  if (fails.length > 40) console.log(`   … 외 ${fails.length - 40}건`);
  return bad === 0;
}

function rand(seed) { // 결정론 난수(재현성)
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
async function validateIljin(y0, y1, n = 300) {
  const rng = rand(20260703);
  let dayOk = 0, dayBad = 0, secOk = 0, secBad = 0;
  const fails = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + Math.floor(rng() * (y1 - y0 + 1));
    const m = 1 + Math.floor(rng() * 12);
    const dim = new Date(y, m, 0).getDate();
    const d = 1 + Math.floor(rng() * dim);
    let row;
    try { row = await kasiSol(y, m, d); } catch (e) { console.error(`  ${y}-${m}-${d} 조회실패 ${e.message}`); continue; }
    const kasiIljin = hanjaOnly(row.lunIljin);
    const kasiSecha = hanjaOnly(row.lunSecha);
    if (!kasiIljin) continue;
    const c = computeManse({ birth: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T12:00`, gender: "M" });
    if (c.pillars.day.ganzhi === kasiIljin) dayOk++;
    else { dayBad++; fails.push(`일진 ${y}-${m}-${d}: KASI ${kasiIljin} ≠ 엔진 ${c.pillars.day.ganzhi}`); }
    // 세차는 입춘/설 경계(1/1~2/5) 제외하고만 참고 대조
    if (kasiSecha && !(m === 1 || (m === 2 && d <= 5))) {
      if (c.pillars.year.ganzhi === kasiSecha) secOk++;
      else { secBad++; fails.push(`세차 ${y}-${m}-${d}: KASI ${kasiSecha} ≠ 엔진 ${c.pillars.year.ganzhi}`); }
    }
    if (i % 20 === 0) process.stdout.write(`\r  일진 대조 ${i}/${n}...   `);
  }
  console.log(`\n[일진/일주] 일치 ${dayOk} · 불일치 ${dayBad}    [세차/년주(참고)] 일치 ${secOk} · 불일치 ${secBad}`);
  fails.slice(0, 40).forEach((f) => console.log("   ✗ " + f));
  return dayBad === 0;
}

// ── main ──
const [mode = "all", a, b, c] = process.argv.slice(2);
let pass = true;
try {
  if (mode === "terms") pass = await validateTerms(+(a || 1970), +(b || 2030));
  else if (mode === "iljin") pass = await validateIljin(+(a || 1950), +(b || 2030), +(c || 300));
  else {
    const t = await validateTerms(+(a || 1970), +(b || 2030));
    const j = await validateIljin(+(a || 1950), +(b || 2030), +(c || 200));
    pass = t && j;
  }
} finally {
  saveCache();
}
console.log(pass ? "\n✅ KASI 대조 전부 일치 — 만세력 정확도 핀 통과" : "\n⛔ 불일치 존재 — 위 항목 확인 필요");
process.exit(pass ? 0 : 1);
