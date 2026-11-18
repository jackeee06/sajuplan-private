/**
 * 명식 심화 분석 — 오행 분포 · 십성 분포 · 신살 · 세운(연운)
 * ──────────────────────────────────────────────────────────────
 * 모두 사주 4기둥에서 파생되는 결정적 계산. (엔진이 이미 낸 데이터 위에 얹음)
 */

import {
  STEM_ELEMENT, BRANCH_ELEMENT, HIDDEN_STEMS, ELEMENTS, CHANGSAENG_BRANCH,
  BRANCHES_KO, BRANCHES_HANJA, STEMS_KO, tenGodOf, ganzhi, generates, controls,
  type Element, type TenGod,
} from "./constants.js";
import { dayGanzhiIndexOf, type FourPillars, type Pillar } from "./pillars.js";
import { julianDayUT, jdUTtoTT } from "./julian.js";
import { sunApparentLongitude } from "./astronomy.js";

const elIdx = (e: Element) => ELEMENTS.indexOf(e);

// 납음오행(納音) — 60갑자 2개당 1개(총 30). gzIndex = (6*천간 - 5*지지) mod 60
const NAYIN30 = [
  "해중금", "노중화", "대림목", "노방토", "검봉금", "산두화", "간하수", "성두토", "백랍금", "양류목",
  "천중수", "옥상토", "벽력화", "송백목", "장류수", "사중금", "산하화", "평지목", "벽상토", "금박금",
  "복등화", "천하수", "대역토", "차천금", "상자목", "대계수", "사중토", "천상화", "석류목", "대해수",
];
export function nayinOf(stem: number, branch: number): string {
  const gz = ((6 * stem - 5 * branch) % 60 + 60) % 60;
  return NAYIN30[Math.floor(gz / 2)]!;
}

/** 오행 → 일간 기준 십성 그룹 (오행 관계도 라벨용) */
export function elementRole(dayEl: Element, el: Element): string {
  if (el === dayEl) return "비겁";
  if (generates(el, dayEl)) return "인성"; // el이 일간을 생
  if (generates(dayEl, el)) return "식상"; // 일간이 el을 생
  if (controls(dayEl, el)) return "재성"; // 일간이 el을 극
  return "관성"; // el이 일간을 극
}

// ── 오행 분포 (천간4 + 지지4, 균등) ─────────────────────────────
export interface ElementDist {
  element: Element;
  count: number;
  percent: number;
  level: "부족" | "적정" | "발달" | "과다";
  role: string; // 일간 기준 십성 그룹(비겁/인성/식상/재성/관성)
}

function levelOf(count: number): ElementDist["level"] {
  if (count === 0) return "부족";
  if (count === 1) return "적정";
  if (count === 2) return "발달";
  return "과다";
}

export function elementDistribution(p: FourPillars, includeHour: boolean): ElementDist[] {
  const dayEl = STEM_ELEMENT[p.day.stem]!;
  const counts: Record<Element, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const ps: Pillar[] = includeHour ? [p.year, p.month, p.day, p.hour] : [p.year, p.month, p.day];
  for (const x of ps) {
    counts[STEM_ELEMENT[x.stem]!]++;
    counts[BRANCH_ELEMENT[x.branch]!]++;
  }
  const total = ps.length * 2;
  return ELEMENTS.map((el) => ({
    element: el,
    count: counts[el],
    percent: Math.round((counts[el] / total) * 1000) / 10,
    level: levelOf(counts[el]),
    role: elementRole(dayEl, el),
  }));
}

// ── 십성 분포 (일간 제외 — 천간 + 지지 정기) ────────────────────
export interface TenGodDist {
  tenGod: TenGod;
  count: number;
  percent: number;
}
const TEN_GODS: TenGod[] = [
  "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인",
];

export function tenGodDistribution(p: FourPillars, includeHour: boolean): TenGodDist[] {
  const day = p.day.stem;
  const counts = new Map<TenGod, number>();
  const add = (tg: TenGod) => counts.set(tg, (counts.get(tg) ?? 0) + 1);
  // 천간(일간 제외)
  const stems = includeHour ? [p.year, p.month, p.hour] : [p.year, p.month];
  for (const x of stems) add(tenGodOf(day, x.stem));
  // 지지 정기
  const branches = includeHour ? [p.year, p.month, p.day, p.hour] : [p.year, p.month, p.day];
  for (const x of branches) {
    const hidden = HIDDEN_STEMS[x.branch]!;
    add(tenGodOf(day, hidden[hidden.length - 1]!));
  }
  const total = stems.length + branches.length;
  // 0개 십성도 포함해 10종 전부 반환 (경쟁사처럼 완전한 분포 표시)
  return TEN_GODS.map((tg) => {
    const c = counts.get(tg) ?? 0;
    return { tenGod: tg, count: c, percent: Math.round((c / total) * 1000) / 10 };
  });
}

// ── 신살 ────────────────────────────────────────────────────────
// 삼합국별 도화/역마/화개 (기준 지지 → 해당 신살 지지)
const SAMHAP: { group: number[]; dohwa: number; yeokma: number; hwagae: number }[] = [
  { group: [2, 6, 10], dohwa: 3, yeokma: 8, hwagae: 10 }, // 寅午戌 火
  { group: [8, 0, 4], dohwa: 9, yeokma: 2, hwagae: 4 },   // 申子辰 水
  { group: [5, 9, 1], dohwa: 6, yeokma: 11, hwagae: 1 },  // 巳酉丑 金
  { group: [11, 3, 7], dohwa: 0, yeokma: 5, hwagae: 7 },  // 亥卯未 木
];
// 천을귀인: 일간 → 지지 2
const CHEONEUL: Record<number, number[]> = {
  0: [1, 7], 4: [1, 7], 6: [1, 7], // 甲戊庚 丑未
  1: [0, 8], 5: [0, 8],            // 乙己 子申
  2: [11, 9], 3: [11, 9],          // 丙丁 亥酉
  7: [2, 6],                        // 辛 寅午
  8: [3, 5], 9: [3, 5],            // 壬癸 卯巳
};
// 양인: 양간 → 지지
const YANGIN: Record<number, number> = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 甲卯 丙戊午 庚酉 壬子
// 문창귀인: 일간 → 지지
const MUNCHANG: Record<number, number> = {
  0: 5, 1: 6, 2: 8, 3: 9, 4: 8, 5: 9, 6: 11, 7: 0, 8: 2, 9: 3,
};
// 정록(건록): 일간 → 록지
const NOK: Record<number, number> = { 0: 2, 1: 3, 2: 5, 3: 6, 4: 5, 5: 6, 6: 8, 7: 9, 8: 11, 9: 0 };
// 암록: 일간 → 지지
const AMNOK: Record<number, number> = { 0: 11, 1: 10, 2: 8, 3: 7, 4: 8, 5: 7, 6: 5, 7: 4, 8: 2, 9: 1 };
// 학당귀인 = 일간 장생지 (CHANGSAENG_BRANCH 재사용)
// 괴강살: 일주 간지(특정) — [천간,지지]
const GOEGANG: [number, number][] = [[6, 4], [6, 10], [8, 4], [8, 10], [4, 10], [4, 4]]; // 庚辰庚戌壬辰壬戌戊戌戊辰
// 백호살: 간지(특정) — 전 기둥
const BAEKHO: [number, number][] = [[0, 4], [1, 7], [2, 10], [3, 1], [4, 4], [8, 10], [9, 1]]; // 甲辰乙未丙戌丁丑戊辰壬戌癸丑
// 천덕귀인: 월지 → 천간(s) 또는 지지(b) 타깃 (혼합)
const CHEONDEOK: Record<number, { s?: number; b?: number }> = {
  0: { b: 5 }, 1: { s: 6 }, 2: { s: 3 }, 3: { b: 8 }, 4: { s: 8 }, 5: { s: 7 },
  6: { b: 11 }, 7: { s: 0 }, 8: { s: 9 }, 9: { b: 2 }, 10: { s: 2 }, 11: { s: 1 },
};
// 월덕귀인: 월지 삼합국 → 천간
const WOLDEOK: { group: number[]; stem: number }[] = [
  { group: [2, 6, 10], stem: 2 }, // 寅午戌 → 丙
  { group: [8, 0, 4], stem: 8 },  // 申子辰 → 壬
  { group: [5, 9, 1], stem: 6 },  // 巳酉丑 → 庚
  { group: [11, 3, 7], stem: 0 }, // 亥卯未 → 甲
];
// 금여(금여록): 일간 → 지지
const GEUMYEO: Record<number, number> = { 0: 4, 1: 5, 2: 7, 3: 8, 4: 7, 5: 8, 6: 10, 7: 11, 8: 1, 9: 2 };
// 태극귀인: 일간 → 지지(복수)
const TAEGEUK: Record<number, number[]> = {
  0: [0, 6], 1: [0, 6], 2: [3, 9], 3: [3, 9], 4: [4, 10, 1, 7], 5: [4, 10, 1, 7],
  6: [2, 11], 7: [2, 11], 8: [5, 8], 9: [5, 8],
};
// 문곡귀인: 일간 → 지지 (문창의 충)
const MUNGOK: Record<number, number> = { 0: 11, 1: 0, 2: 2, 3: 3, 4: 2, 5: 3, 6: 5, 7: 6, 8: 8, 9: 9 };
// 홍염살: 일간 → 지지
const HONGYEOM: Record<number, number> = { 0: 6, 1: 6, 2: 2, 3: 7, 4: 4, 5: 4, 6: 10, 7: 9, 8: 0, 9: 8 };
// 현침살 글자: 천간 甲(0)·辛(7) / 지지 卯(3)·午(6)·申(8)
const HYEONCHIM_STEM = new Set([0, 7]);
const HYEONCHIM_BRANCH = new Set([3, 6, 8]);
// 비인살: 양인의 충 (양간만) — 일간 → 지지
const BIIN: Record<number, number> = { 0: 9, 2: 0, 4: 0, 6: 3, 8: 6 };
// 고신살/과숙살: 년지 방합 그룹 → [고신, 과숙] 지지
const GOSIN_GWASUK: { group: number[]; gosin: number; gwasuk: number }[] = [
  { group: [11, 0, 1], gosin: 2, gwasuk: 10 },  // 亥子丑 → 寅·戌
  { group: [2, 3, 4], gosin: 5, gwasuk: 1 },    // 寅卯辰 → 巳·丑
  { group: [5, 6, 7], gosin: 8, gwasuk: 4 },    // 巳午未 → 申·辰
  { group: [8, 9, 10], gosin: 11, gwasuk: 7 },  // 申酉戌 → 亥·未
];
// 귀문관살: 지지 쌍
const GWIMUN: [number, number][] = [[0, 9], [1, 6], [2, 7], [3, 8], [4, 11], [5, 10]];

function matchGz(set: [number, number][], stem: number, branch: number): boolean {
  return set.some(([s, b]) => s === stem && b === branch);
}

export interface SinsalHit {
  name: string;
  pillar: "year" | "month" | "day" | "hour";
}

export function sinsal(p: FourPillars, includeHour: boolean): SinsalHit[] {
  const dayStem = p.day.stem;
  const dayBranch = p.day.branch;
  const slots: { key: SinsalHit["pillar"]; pillar: Pillar }[] = [
    { key: "year", pillar: p.year },
    { key: "month", pillar: p.month },
    { key: "day", pillar: p.day },
  ];
  if (includeHour) slots.push({ key: "hour", pillar: p.hour });

  // 도화/역마/화개 = 년지·일지 삼합 둘 다 기준 (전통 관례 — 더 정확·풍부)
  const samDay = SAMHAP.find((s) => s.group.includes(dayBranch))!;
  const samYear = SAMHAP.find((s) => s.group.includes(p.year.branch))!;
  const samSet = samDay === samYear ? [samDay] : [samDay, samYear];
  const cheoneul = CHEONEUL[dayStem] ?? [];
  const yangin = YANGIN[dayStem];
  const munchang = MUNCHANG[dayStem];
  const nok = NOK[dayStem];
  const amnok = AMNOK[dayStem];
  const hakdang = CHANGSAENG_BRANCH[dayStem];
  // 월지 기준 신살
  const monthBranch = p.month.branch;
  const cheondeok = CHEONDEOK[monthBranch];
  const woldeok = WOLDEOK.find((w) => w.group.includes(monthBranch));
  const cheonui = (monthBranch - 1 + 12) % 12; // 천의성: 월지 직전 지지
  // 일간 기준 신살
  const geumyeo = GEUMYEO[dayStem];
  const taegeuk = TAEGEUK[dayStem] ?? [];
  const mungok = MUNGOK[dayStem];
  const hongyeom = HONGYEOM[dayStem];
  const biin = BIIN[dayStem];
  // 년지 기준 신살
  const gosinGwasuk = GOSIN_GWASUK.find((g) => g.group.includes(p.year.branch))!;

  const hits: SinsalHit[] = [];
  for (const { key, pillar } of slots) {
    const b = pillar.branch;
    if (cheoneul.includes(b)) hits.push({ name: "천을귀인", pillar: key });
    for (const sam of samSet) {
      if (b === sam.dohwa) hits.push({ name: "도화살", pillar: key });
      if (b === sam.yeokma) hits.push({ name: "역마살", pillar: key });
      if (b === sam.hwagae) hits.push({ name: "화개살", pillar: key });
    }
    // 사생지(寅申巳亥) 자체도 역마성으로 표기 (전통 관례 — 이동·변동의 글자)
    if (b === 2 || b === 8 || b === 5 || b === 11) hits.push({ name: "역마살", pillar: key });
    if (yangin !== undefined && b === yangin) hits.push({ name: "양인살", pillar: key });
    if (munchang !== undefined && b === munchang) hits.push({ name: "문창귀인", pillar: key });
    if (nok !== undefined && b === nok) hits.push({ name: "건록", pillar: key });
    if (amnok !== undefined && b === amnok) hits.push({ name: "암록", pillar: key });
    if (hakdang !== undefined && b === hakdang) hits.push({ name: "학당귀인", pillar: key });
    if (matchGz(BAEKHO, pillar.stem, b)) hits.push({ name: "백호살", pillar: key });
    // ── 추가 길성/신살 ──
    if (cheondeok?.s !== undefined && pillar.stem === cheondeok.s) hits.push({ name: "천덕귀인", pillar: key });
    if (cheondeok?.b !== undefined && b === cheondeok.b) hits.push({ name: "천덕귀인", pillar: key });
    if (woldeok && pillar.stem === woldeok.stem) hits.push({ name: "월덕귀인", pillar: key });
    if (b === cheonui) hits.push({ name: "천의성", pillar: key });
    if (geumyeo !== undefined && b === geumyeo) hits.push({ name: "금여", pillar: key });
    if (taegeuk.includes(b)) hits.push({ name: "태극귀인", pillar: key });
    if (mungok !== undefined && b === mungok) hits.push({ name: "문곡귀인", pillar: key });
    if (hongyeom !== undefined && b === hongyeom) hits.push({ name: "홍염살", pillar: key });
    if (HYEONCHIM_STEM.has(pillar.stem) || HYEONCHIM_BRANCH.has(b)) hits.push({ name: "현침살", pillar: key });
    if (b === 10 || b === 11) hits.push({ name: "천문성", pillar: key });
    if (biin !== undefined && b === biin) hits.push({ name: "비인살", pillar: key });
    if (b === gosinGwasuk.gosin) hits.push({ name: "고신살", pillar: key });
    if (b === gosinGwasuk.gwasuk) hits.push({ name: "과숙살", pillar: key });
  }
  // 쌍 기준 신살 — 귀문관살(지지쌍) · 천라지망(戌亥/辰巳)
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const bi = slots[i]!.pillar.branch, bj = slots[j]!.pillar.branch;
      const pair = (x: number, y: number) => (bi === x && bj === y) || (bi === y && bj === x);
      if (GWIMUN.some(([x, y]) => pair(x, y))) {
        hits.push({ name: "귀문관살", pillar: slots[i]!.key });
        hits.push({ name: "귀문관살", pillar: slots[j]!.key });
      }
      if (pair(10, 11) || pair(4, 5)) { // 천라(戌亥) / 지망(辰巳)
        hits.push({ name: "천라지망", pillar: slots[i]!.key });
        hits.push({ name: "천라지망", pillar: slots[j]!.key });
      }
    }
  }
  // 괴강살: 일주만
  if (matchGz(GOEGANG, p.day.stem, p.day.branch)) hits.push({ name: "괴강살", pillar: "day" });
  // 중복 제거 (년지·일지 삼합 겹침 등)
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.name}:${h.pillar}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── 격국 (월지 정기 십성 기준, 간단판) ──────────────────────────
const GYEOK_BY_TENGOD: Record<TenGod, string> = {
  비견: "건록격", 겁재: "양인격",
  식신: "식신격", 상관: "상관격",
  편재: "편재격", 정재: "정재격",
  편관: "편관격(칠살)", 정관: "정관격",
  편인: "편인격", 정인: "정인격",
};

export function gyeokguk(p: FourPillars): string {
  const monthHidden = HIDDEN_STEMS[p.month.branch]!;
  const main = monthHidden[monthHidden.length - 1]!; // 월지 정기
  const tg = tenGodOf(p.day.stem, main);
  return GYEOK_BY_TENGOD[tg];
}

// ── 일진 달력 ───────────────────────────────────────────────────
export interface DayPillarCell {
  day: number;
  stem: number;
  branch: number;
  ganzhiIndex: number;
  element: Element;
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

export function monthDayPillars(year: number, month: number): DayPillarCell[] {
  const out: DayPillarCell[] = [];
  const dim = daysInMonth(year, month);
  for (let d = 1; d <= dim; d++) {
    const gz = dayGanzhiIndexOf(year, month, d);
    const { stem, branch } = ganzhi(gz);
    out.push({ day: d, stem, branch, ganzhiIndex: gz, element: STEM_ELEMENT[stem]! });
  }
  return out;
}

// 24절기 — floor(태양황경/15) index 기준 이름 (k=0 → 춘분 0°)
const TERMS_24 = [
  "춘분", "청명", "곡우", "입하", "소만", "망종", "하지", "소서", "대서", "입추", "처서", "백로",
  "추분", "한로", "상강", "입동", "소설", "대설", "동지", "소한", "대한", "입춘", "우수", "경칩",
];

/** 해당 월에 드는 24절기 [{day, name}]. (태양황경이 15°배수를 넘는 날) */
export function monthSolarTerms(year: number, month: number): { day: number; name: string }[] {
  const out: { day: number; name: string }[] = [];
  const dim = daysInMonth(year, month);
  // 한국 정오(≈UT+3h) 기준 황경. 전일(0일) 포함해 경계 감지
  const kOf = (d: number) => {
    const jd = julianDayUT(year, month, d + 3 / 24);
    return Math.floor(sunApparentLongitude(jdUTtoTT(jd, year)) / 15);
  };
  let prev = kOf(0);
  for (let d = 1; d <= dim; d++) {
    const k = kOf(d);
    if (k !== prev) out.push({ day: d, name: TERMS_24[((k % 24) + 24) % 24]! });
    prev = k;
  }
  return out;
}

/** 해당 월 1일의 요일(0=일~6=토). 달력 그리드 정렬용. (Date 미사용 — Zeller) */
export function firstWeekday(year: number, month: number): number {
  let m = month;
  let y = year;
  if (m < 3) { m += 12; y -= 1; }
  const K = y % 100;
  const J = Math.floor(y / 100);
  // Zeller's congruence (그레고리력), 1일 기준
  const h = (1 + Math.floor((13 * (m + 1)) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
  // Zeller: 0=토,1=일,... → 0=일 기준으로 변환
  return (h + 6) % 7;
}

// ── 세운(연운) ──────────────────────────────────────────────────
export interface SewoonItem {
  year: number;
  stem: number;
  branch: number;
  ganzhiIndex: number;
  stemTenGod: TenGod;
  branchTenGod: TenGod;
}

export function sewoon(startYear: number, dayStem: number, count = 10): SewoonItem[] {
  const list: SewoonItem[] = [];
  for (let i = 0; i < count; i++) {
    const y = startYear + i;
    const gz = (((y - 4) % 60) + 60) % 60;
    const { stem, branch } = ganzhi(gz);
    const hidden = HIDDEN_STEMS[branch]!;
    list.push({
      year: y, stem, branch, ganzhiIndex: gz,
      stemTenGod: tenGodOf(dayStem, stem),
      branchTenGod: tenGodOf(dayStem, hidden[hidden.length - 1]!),
    });
  }
  return list;
}

// ── 월운 (12개월, 寅월부터) ─────────────────────────────────────
export interface WoonItem {
  monthBranch: number; // 지지 index (寅=2 …)
  stem: number;
  branch: number;
  ganzhiIndex: number;
  stemTenGod: TenGod;
  branchTenGod: TenGod;
}

export function monthlyWoon(year: number, dayStem: number): WoonItem[] {
  const yearStem = ganzhi((((year - 4) % 60) + 60) % 60).stem;
  const yinStem = ((yearStem % 5) * 2 + 2) % 10; // 오호둔 寅월 천간
  const list: WoonItem[] = [];
  for (let i = 0; i < 12; i++) {
    const branch = (2 + i) % 12; // 寅(2)부터
    const stem = (yinStem + i) % 10;
    let gz = -1;
    for (let k = 0; k < 60; k++) if (k % 10 === stem && k % 12 === branch) { gz = k; break; }
    const hidden = HIDDEN_STEMS[branch]!;
    list.push({
      monthBranch: branch, stem, branch, ganzhiIndex: gz,
      stemTenGod: tenGodOf(dayStem, stem),
      branchTenGod: tenGodOf(dayStem, hidden[hidden.length - 1]!),
    });
  }
  return list;
}

// ── 합·충 (천간/지지) ───────────────────────────────────────────
const STEM_HAP: [number, number][] = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]]; // 갑기 을경 병신 정임 무계
const STEM_CHUNG: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9]]; // 갑경 을신 병임 정계
const BR_YUKHAP: [number, number][] = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
const BR_CHUNG: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
// 형(刑): 삼형(寅巳申·丑戌未) 쌍 + 상형(子卯) — 자형은 별도
const BR_HYEONG: [number, number][] = [
  [2, 5], [5, 8], [2, 8], // 寅巳申
  [1, 10], [10, 7], [1, 7], // 丑戌未
  [0, 3], // 子卯
];
const JAHYEONG = new Set([4, 6, 9, 11]); // 辰午酉亥 자형
const BR_PA: [number, number][] = [[0, 9], [6, 3], [8, 5], [2, 11], [4, 1], [10, 7]]; // 자유 오묘 신사 인해 진축 술미
const BR_HAE: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]; // 자미 축오 인사 묘진 신해 유술
const BR_WONJIN: [number, number][] = [[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]]; // 자미 축오 인유 묘신 진해 사술

export interface Relation {
  type: string; // 천간합/천간충/육합/충/삼합
  detail: string;
  pillars: string[]; // 관여 기둥 키: "year"|"month"|"day"|"hour"
  row: "stem" | "branch"; // 강조 행(천간/지지)
}

const PILLAR_LABELS = ["년", "월", "일", "시"];
const PILLAR_KEYS = ["year", "month", "day", "hour"];

export function hapchung(p: FourPillars, includeHour: boolean): Relation[] {
  const ps = includeHour ? [p.year, p.month, p.day, p.hour] : [p.year, p.month, p.day];
  const rels: Relation[] = [];
  const inSet = (set: [number, number][], a: number, b: number) =>
    set.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]!;
      const b = ps[j]!;
      const lab = `${PILLAR_LABELS[i]}-${PILLAR_LABELS[j]}`;
      const pk = [PILLAR_KEYS[i]!, PILLAR_KEYS[j]!];
      if (inSet(STEM_HAP, a.stem, b.stem)) rels.push({ type: "천간합", detail: `${lab} ${STEMS_KO[a.stem]}${STEMS_KO[b.stem]}합`, pillars: pk, row: "stem" });
      if (inSet(STEM_CHUNG, a.stem, b.stem)) rels.push({ type: "천간충", detail: `${lab} ${STEMS_KO[a.stem]}${STEMS_KO[b.stem]}충`, pillars: pk, row: "stem" });
      if (inSet(BR_YUKHAP, a.branch, b.branch)) rels.push({ type: "육합", detail: `${lab} ${BRANCHES_KO[a.branch]}${BRANCHES_KO[b.branch]}합`, pillars: pk, row: "branch" });
      if (inSet(BR_CHUNG, a.branch, b.branch)) rels.push({ type: "충", detail: `${lab} ${BRANCHES_KO[a.branch]}${BRANCHES_KO[b.branch]}충`, pillars: pk, row: "branch" });
      const bk = `${BRANCHES_KO[a.branch]}${BRANCHES_KO[b.branch]}`;
      if (inSet(BR_HYEONG, a.branch, b.branch)) rels.push({ type: "형", detail: `${lab} ${bk}형`, pillars: pk, row: "branch" });
      else if (a.branch === b.branch && JAHYEONG.has(a.branch)) rels.push({ type: "형", detail: `${lab} ${bk}형(자형)`, pillars: pk, row: "branch" });
      if (inSet(BR_PA, a.branch, b.branch)) rels.push({ type: "파", detail: `${lab} ${bk}파`, pillars: pk, row: "branch" });
      if (inSet(BR_HAE, a.branch, b.branch)) rels.push({ type: "해", detail: `${lab} ${bk}해`, pillars: pk, row: "branch" });
      if (inSet(BR_WONJIN, a.branch, b.branch)) rels.push({ type: "원진", detail: `${lab} ${bk}원진`, pillars: pk, row: "branch" });
    }
  }
  // 삼합(지지 3개 모두 존재)
  const branches = ps.map((x) => x.branch);
  const keysFor = (group: number[]) =>
    ps.map((x, idx) => (group.includes(x.branch) ? PILLAR_KEYS[idx]! : null)).filter((k): k is string => k !== null);
  for (const s of SAMHAP) {
    if (s.group.every((g) => branches.includes(g))) {
      rels.push({ type: "삼합", detail: `${s.group.map((g) => BRANCHES_KO[g]).join("")}삼합`, pillars: keysFor(s.group), row: "branch" });
    }
  }
  // 방합(같은 방위 지지 3개 모두 존재)
  const BANGHAP: { g: number[]; name: string }[] = [
    { g: [2, 3, 4], name: "동방목" }, // 寅卯辰
    { g: [5, 6, 7], name: "남방화" }, // 巳午未
    { g: [8, 9, 10], name: "서방금" }, // 申酉戌
    { g: [11, 0, 1], name: "북방수" }, // 亥子丑
  ];
  for (const s of BANGHAP) {
    if (s.g.every((g) => branches.includes(g))) {
      rels.push({ type: "방합", detail: `${s.g.map((g) => BRANCHES_KO[g]).join("")}방합(${s.name})`, pillars: keysFor(s.g), row: "branch" });
    }
  }
  return rels;
}

// ── 12신살 (년지 기준) ──────────────────────────────────────────
const SINSAL12 = [
  "겁살", "재살", "천살", "지살", "년살", "월살", "망신살", "장성살", "반안살", "역마살", "육해살", "화개살",
];
// 삼합국별 겁살 시작 지지
function sinsal12Start(yearBranch: number): number {
  if ([8, 0, 4].includes(yearBranch)) return 5; // 申子辰 水
  if ([11, 3, 7].includes(yearBranch)) return 8; // 亥卯未 木
  if ([2, 6, 10].includes(yearBranch)) return 11; // 寅午戌 火
  return 2; // 巳酉丑 金
}

export interface Sinsal12Hit {
  pillar: "year" | "month" | "day" | "hour";
  name: string;
}

// ── 궁합 (두 사주 매칭, 참고용) ─────────────────────────────────
export interface CompatFactor {
  label: string;
  delta: number; // 점수 가감
}
export interface Compatibility {
  score: number; // 0~100
  level: string; // 천생연분/좋은 궁합/무난한 궁합/노력이 필요한 궁합
  factors: CompatFactor[];
}

const POSITIVE_TENGOD = new Set<TenGod>(["정재", "정관", "정인", "식신", "편재", "비견"]);

export function compatibilityScore(a: FourPillars, b: FourPillars): Compatibility {
  const factors: CompatFactor[] = [];
  let score = 50;
  const inSet = (set: [number, number][], x: number, y: number) =>
    set.some(([m, n]) => (m === x && n === y) || (m === y && n === x));

  // 1) 일간 십성 관계 (서로)
  const tgAB = tenGodOf(a.day.stem, b.day.stem);
  const tgBA = tenGodOf(b.day.stem, a.day.stem);
  for (const [who, tg] of [["상대", tgAB], ["나", tgBA]] as const) {
    const good = POSITIVE_TENGOD.has(tg);
    const d = good ? 8 : 2;
    score += d;
    factors.push({ label: `일간 관계 — ${who}에게 ${tg}`, delta: d });
  }

  // 2) 일지 관계 (육합/충/동일)
  if (inSet(BR_YUKHAP, a.day.branch, b.day.branch)) {
    score += 15; factors.push({ label: "일지 육합 — 천생연분 기운", delta: 15 });
  } else if (inSet(BR_CHUNG, a.day.branch, b.day.branch)) {
    score -= 12; factors.push({ label: "일지 충 — 마찰·변동 주의", delta: -12 });
  } else if (a.day.branch === b.day.branch) {
    score += 5; factors.push({ label: "일지 동일 — 닮은 성향", delta: 5 });
  }

  // 3) 오행 상호보완
  const elems = (p: FourPillars) => {
    const c: Record<Element, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    for (const x of [p.year, p.month, p.day, p.hour]) {
      c[STEM_ELEMENT[x.stem]!]++; c[BRANCH_ELEMENT[x.branch]!]++;
    }
    return c;
  };
  const ca = elems(a); const cb = elems(b);
  let comp = 0;
  for (const el of ELEMENTS) {
    if (ca[el] === 0 && cb[el] > 0) comp++;
    if (cb[el] === 0 && ca[el] > 0) comp++;
  }
  if (comp > 0) { const d = comp * 4; score += d; factors.push({ label: `오행 상호보완 ${comp}개 — 부족함을 채워줌`, delta: d }); }

  // 4) 띠(년지) 합/충
  if (inSet(BR_YUKHAP, a.year.branch, b.year.branch)) {
    score += 6; factors.push({ label: "띠 육합 — 잘 맞는 띠", delta: 6 });
  } else if (inSet(BR_CHUNG, a.year.branch, b.year.branch)) {
    score -= 5; factors.push({ label: "띠 충 — 띠 상충", delta: -5 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? "천생연분" : score >= 65 ? "좋은 궁합" : score >= 50 ? "무난한 궁합" : "노력이 필요한 궁합";
  return { score, level, factors };
}

// baseBranch = 기준 지지(년지 또는 일지). 전통 만세력은 두 기준 다 본다.
export function twelveSinsal(p: FourPillars, includeHour: boolean, baseBranch: number): Sinsal12Hit[] {
  const start = sinsal12Start(baseBranch);
  const slots: { key: Sinsal12Hit["pillar"]; b: number }[] = [
    { key: "year", b: p.year.branch },
    { key: "month", b: p.month.branch },
    { key: "day", b: p.day.branch },
  ];
  if (includeHour) slots.push({ key: "hour", b: p.hour.branch });
  return slots.map(({ key, b }) => ({ pillar: key, name: SINSAL12[(b - start + 12) % 12]! }));
}

// 천을귀인 지지(일간 기준) — 요약 라벨용 (예: 卯巳)
export function cheoneulBranches(dayStem: number): string[] {
  return (CHEONEUL[dayStem] ?? []).map((b) => BRANCHES_HANJA[b]!);
}

// ── 신강/신약 + 용신 (억부법, 참고용) ───────────────────────────
// 일간을 돕는(비겁·인성) 글자 vs 빼는(식상·재성·관성) 글자를 위치 가중합.
export interface Strength {
  allyScore: number;
  total: number;
  ratio: number; // 0(극약)~1(극강)
  label: string; // 극약/태약/신약/중화신약/중화신강/신강/태강/극강
  yongsin: Element; // 억부 용신(참고)
  yongsinReason: string;
  deukRyeong: boolean; // 득령 — 월지가 일간을 도움
  deukJi: boolean;     // 득지 — 일지가 일간을 도움
  deukSe: boolean;     // 득세 — 나머지 세력이 일간 편
  bandPercent: number; // 이 강약 구간에 해당하는 인구 추정 비율(%) — 정규분포 모델 추정
}

// 표준정규 CDF (erf 근사, Abramowitz-Stegun)
function normalCDF(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / (sigma * Math.SQRT2);
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const y =
    1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  const erf = z >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

const STRENGTH_BANDS: [number, string][] = [
  [0.2, "극약"], [0.33, "태약"], [0.43, "신약"], [0.5, "중화신약"],
  [0.58, "중화신강"], [0.68, "신강"], [0.82, "태강"], [1.01, "극강"],
];

export function strength(p: FourPillars, includeHour: boolean): Strength {
  const dayEl = STEM_ELEMENT[p.day.stem]!;
  // (글자 오행, 위치가중) 목록 — 일간 자신은 제외
  const items: { el: Element; w: number }[] = [];
  // 천간: 년·월·(시)
  items.push({ el: STEM_ELEMENT[p.year.stem]!, w: 1 });
  items.push({ el: STEM_ELEMENT[p.month.stem]!, w: 1 });
  if (includeHour) items.push({ el: STEM_ELEMENT[p.hour.stem]!, w: 1 });
  // 지지: 월지3(월령) 일지2 년지·시지1
  items.push({ el: BRANCH_ELEMENT[p.year.branch]!, w: 1 });
  items.push({ el: BRANCH_ELEMENT[p.month.branch]!, w: 3 });
  items.push({ el: BRANCH_ELEMENT[p.day.branch]!, w: 2 });
  if (includeHour) items.push({ el: BRANCH_ELEMENT[p.hour.branch]!, w: 1 });

  let ally = 0;
  let total = 0;
  for (const { el, w } of items) {
    total += w;
    // 아군: 같은 오행(비겁) 또는 일간을 생하는 오행(인성)
    if (el === dayEl || generates(el, dayEl)) ally += w;
  }
  const ratio = total > 0 ? ally / total : 0.5;
  const label = STRENGTH_BANDS.find(([t]) => ratio < t)![1];

  // 억부 용신: 신강계열(ratio>=0.5) → 일간이 생하는 오행(식상, 설기) / 신약 → 일간을 생하는 오행(인성)
  const strong = ratio >= 0.5;
  const yongsin = strong
    ? ELEMENTS[(elIdx(dayEl) + 1) % 5]! // 일간이 생함 = 설기
    : ELEMENTS[(elIdx(dayEl) + 4) % 5]!; // 일간을 생함 = 인성(생조)
  const yongsinReason = strong ? "신강 → 기운을 빼주는 식상(설기)" : "신약 → 기운을 채워주는 인성(생조)";

  // 득령/득지/득세
  const isAlly = (el: Element) => el === dayEl || generates(el, dayEl);
  const deukRyeong = isAlly(BRANCH_ELEMENT[p.month.branch]!);
  const deukJi = isAlly(BRANCH_ELEMENT[p.day.branch]!);
  // 득세: 월지·일지 제외한 나머지 자리 중 아군이 절반 이상
  const rest: Element[] = [STEM_ELEMENT[p.year.stem]!, STEM_ELEMENT[p.month.stem]!, BRANCH_ELEMENT[p.year.branch]!];
  if (includeHour) { rest.push(STEM_ELEMENT[p.hour.stem]!, BRANCH_ELEMENT[p.hour.branch]!); }
  const allyRest = rest.filter(isAlly).length;
  const deukSe = allyRest * 2 >= rest.length;

  // 이 강약 구간 인구 추정 비율 — ratio ~ N(0.5, 0.15) 모델
  const bi = STRENGTH_BANDS.findIndex(([t]) => ratio < t);
  const low = bi <= 0 ? 0 : STRENGTH_BANDS[bi - 1]![0];
  const high = STRENGTH_BANDS[bi]![0];
  const bandPercent = Math.round((normalCDF(high, 0.5, 0.15) - normalCDF(low, 0.5, 0.15)) * 1000) / 10;

  return {
    allyScore: ally, total, ratio: Math.round(ratio * 1000) / 1000, label, yongsin, yongsinReason,
    deukRyeong, deukJi, deukSe, bandPercent,
  };
}
