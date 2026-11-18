// 택일 v2 "최강 택일" — 만세 엔진(@manse/engine)의 일진(60갑자)·음양력 변환·절기를 결합해
// 정통 택일(손없는날·황도길일·건제12신·방위흉살·천을/월덕·삼재·절기)을 100% 결정론적으로 산출.
// ⚠️ 계산(간지·음력·절기·방위)은 만세 엔진/전통 정국표로 정확. 점수·문장은 해석(과장 OK).
//   완결 분석 안 함 → 깊은 건 상담 CTA. 만세 엔진 0% 수정(단방향 의존). 같은 날=항상 같은 결과.
//   생기복덕(개인 8괘)은 정본 조견표 확정 후 Phase 2로 보류. 현재 개인화는 천을귀인(규칙 확실)로.
import { monthDayPillars, solarToLunar, monthSolarTerms } from "@manse/engine";
import type { Profile } from "./profile.js";

export const TAEGIL_PURPOSES = ["이사", "결혼", "개업", "계약", "여행"] as const;
export type TaegilPurpose = (typeof TAEGIL_PURPOSES)[number];

const STEM_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const STEM_HJ = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BR_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const BR_HJ = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ZODIAC = ["쥐", "소", "범", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
const STEM_EL = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function daysInMonth(y: number, m: number): number {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

/* ── 손 없는 날: 음력 끝자리로 손(損) 방위 (8일 주기, 9·0=없음) ── */
function sonOf(lunarDay: number): { dir: string; free: boolean } {
  const u = lunarDay % 10;
  if (u === 1 || u === 2) return { dir: "동쪽", free: false };
  if (u === 3 || u === 4) return { dir: "남쪽", free: false };
  if (u === 5 || u === 6) return { dir: "서쪽", free: false };
  if (u === 7 || u === 8) return { dir: "북쪽", free: false };
  return { dir: "없음", free: true }; // 9·0일
}

/* ── 월지(절기 기준): 그 달의 節에서 월건이 바뀜 ── */
const JEOL: Record<string, number> = { 입춘: 2, 경칩: 3, 청명: 4, 입하: 5, 망종: 6, 소서: 7, 입추: 8, 백로: 9, 한로: 10, 입동: 11, 대설: 0, 소한: 1 };
function monthBranchTable(y: number, m: number): number[] {
  const terms = monthSolarTerms(y, m).filter((t) => t.name in JEOL).sort((a, b) => a.day - b.day);
  // 월초(첫 節 이전) 월지 = 첫 節 월지의 직전 지지
  let startBranch: number;
  if (terms.length) startBranch = (JEOL[terms[0]!.name]! + 11) % 12;
  else startBranch = fallbackMonthBranch(y, m);
  const dim = daysInMonth(y, m);
  const arr: number[] = new Array(dim + 1).fill(startBranch);
  for (let d = 1; d <= dim; d++) {
    let b = startBranch;
    for (const t of terms) if (d >= t.day) b = JEOL[t.name]!;
    arr[d] = b;
  }
  return arr;
}
function fallbackMonthBranch(y: number, m: number): number {
  // 節이 없는 달은 직전 달들에서 가장 최근 節을 찾음
  let yy = y, mm = m - 1;
  for (let i = 0; i < 3; i++) {
    if (mm < 1) { mm = 12; yy--; }
    const t = monthSolarTerms(yy, mm).filter((x) => x.name in JEOL).sort((a, b) => a.day - b.day);
    if (t.length) return JEOL[t[t.length - 1]!.name]!;
    mm--;
  }
  return 2; // 寅 fallback
}

/* ── 황도길일: 월지로 청룡 시작지지 → 12신장 순환 (6황도=길) ── */
const HWANGDO12 = ["청룡", "명당", "천형", "주작", "금궤", "천덕", "백호", "옥당", "천뢰", "현무", "사명", "구진"];
const HWANGDO_GIL = new Set([0, 1, 4, 5, 7, 10]); // 청룡·명당·금궤·천덕·옥당·사명
// 사신수 캐릭터(비주얼 강조 — 청룡/백호/주작/현무)
const SASIN: Record<string, { emoji: string; tone: "대길" | "길" | "흉" }> = {
  청룡: { emoji: "🐉", tone: "대길" }, 명당: { emoji: "🏛️", tone: "길" }, 금궤: { emoji: "💰", tone: "길" },
  천덕: { emoji: "🌟", tone: "길" }, 옥당: { emoji: "🪙", tone: "길" }, 사명: { emoji: "📜", tone: "길" },
  천형: { emoji: "⚔️", tone: "흉" }, 주작: { emoji: "🐦‍🔥", tone: "흉" }, 백호: { emoji: "🐯", tone: "흉" },
  천뢰: { emoji: "⛓️", tone: "흉" }, 현무: { emoji: "🐢", tone: "흉" }, 구진: { emoji: "🪤", tone: "흉" },
};
function hwangdoOf(monthBranch: number, dayBranch: number) {
  const start = (((monthBranch - 2) * 2) % 12 + 12) % 12; // 청룡 시작 지지
  const pos = ((dayBranch - start) % 12 + 12) % 12;
  const name = HWANGDO12[pos]!;
  return { name, gil: HWANGDO_GIL.has(pos), emoji: SASIN[name]!.emoji, tone: SASIN[name]!.tone };
}

/* ── 건제12신: 월건과 같은 지지의 날=建, 이후 순환 ── */
const JIANCHU_KO = ["건", "제", "만", "평", "정", "집", "파", "위", "성", "수", "개", "폐"];
const JIANCHU_HJ = ["建", "除", "滿", "平", "定", "執", "破", "危", "成", "收", "開", "閉"];
const JIANCHU_EMOJI = ["🏗️", "🧹", "🌕", "⚖️", "📌", "🤝", "💥", "🧗", "✅", "🧺", "🔓", "🔒"];
const JIANCHU_GIL = new Set([1, 4, 5, 7, 8, 10]); // 제·정·집·위·성·개
const JIANCHU_DESC = [
  "세우는 날 — 출행·취임엔 좋으나 큰 공사는 피해요", "비우는 날 — 치료·혼인·묵은 것 정리에 좋아요",
  "가득 찬 날 — 개업·구재엔 길, 이사·파종은 피해요", "평탄한 날 — 길흉이 무던한 보통의 날이에요",
  "자리잡는 날 — 약속·안정·계약에 좋은 날이에요", "잡는 날 — 다잡는 일엔 좋고 개업·이사는 피해요",
  "깨지는 날 — 큰일은 모두 피하는 흉한 날이에요", "위태로운 날 — 제사엔 좋으나 높은 곳·이전은 조심",
  "이루는 날 — 개업·혼인·이사·시작에 최고의 날이에요", "거두는 날 — 돈 받기엔 좋고 출행은 피해요",
  "여는 날 — 개업·혼인·시작에 활짝 열리는 길일이에요", "닫는 날 — 막고 메우는 일 외엔 피하는 날이에요",
];
function jianchuOf(monthBranch: number, dayBranch: number) {
  const idx = ((dayBranch - monthBranch) % 12 + 12) % 12;
  return { idx, ko: JIANCHU_KO[idx]!, hj: JIANCHU_HJ[idx]!, emoji: JIANCHU_EMOJI[idx]!, gil: JIANCHU_GIL.has(idx), desc: JIANCHU_DESC[idx]! };
}

/* ── 천을귀인: 일간 기준 귀인 든 지지 (개인화: 내 일간으로 길일 표시) ── */
const CHEONEUL: Record<number, number[]> = {
  0: [1, 7], 4: [1, 7], 6: [1, 7], // 甲戊庚 → 丑未
  1: [0, 8], 5: [0, 8], // 乙己 → 子申
  2: [11, 9], 3: [11, 9], // 丙丁 → 亥酉
  7: [2, 6], // 辛 → 寅午
  8: [5, 3], 9: [5, 3], // 壬癸 → 巳卯
};

/* ── 월덕귀인: 월지 삼합 → 길한 천간 (그 천간의 날=월덕일, 흉살 해소 길신) ── */
function woldeokStem(monthBranch: number): number {
  if ([2, 6, 10].includes(monthBranch)) return 2; // 寅午戌 → 丙
  if ([8, 0, 4].includes(monthBranch)) return 8; // 申子辰 → 壬
  if ([11, 3, 7].includes(monthBranch)) return 0; // 亥卯未 → 甲
  return 6; // 巳酉丑 → 庚
}

/* ── 연 단위 방위 흉살 (연지 기준) ── */
function yearBranch(year: number): number {
  return ((year - 4) % 12 + 12) % 12;
}
export function yearTaboo(year: number) {
  const yb = yearBranch(year);
  // 삼살방(이사·이동 흉)
  let samsal = "북쪽";
  if ([8, 0, 4].includes(yb)) samsal = "남쪽"; // 申子辰
  else if ([2, 6, 10].includes(yb)) samsal = "북쪽"; // 寅午戌
  else if ([5, 9, 1].includes(yb)) samsal = "동쪽"; // 巳酉丑
  else if ([11, 3, 7].includes(yb)) samsal = "서쪽"; // 亥卯未
  // 대장군방(수리·건축 흉)
  let daejang = "서쪽";
  if ([11, 0, 1].includes(yb)) daejang = "서쪽"; // 亥子丑
  else if ([2, 3, 4].includes(yb)) daejang = "북쪽"; // 寅卯辰
  else if ([5, 6, 7].includes(yb)) daejang = "동쪽"; // 巳午未
  else if ([8, 9, 10].includes(yb)) daejang = "남쪽"; // 申酉戌
  // 삼재 띠 (그 해 삼재 드는 생년 삼합)
  let samjae: string[] = [];
  if ([5, 6, 7].includes(yb)) samjae = ["돼지", "토끼", "양"]; // 亥卯未생
  else if ([8, 9, 10].includes(yb)) samjae = ["범", "말", "개"]; // 寅午戌생
  else if ([11, 0, 1].includes(yb)) samjae = ["뱀", "닭", "소"]; // 巳酉丑생
  else if ([2, 3, 4].includes(yb)) samjae = ["원숭이", "쥐", "용"]; // 申子辰생
  return { samsal, daejang, samjae, yearGanzhi: STEM_HJ[((year - 4) % 10 + 10) % 10]! + BR_HJ[yb]!, yearZodiac: ZODIAC[yb]! };
}

/* ── 결혼 특수: 살부대기월(여자 띠별 피할 음력월) + 대리월(가장 좋은 달) ── */
const SALBU: Record<number, number[]> = {
  0: [1], 1: [4], 2: [7], 3: [12], 4: [4], 5: [5], 6: [8, 12], 7: [6, 7], 8: [6, 7], 9: [8], 10: [12], 11: [7, 8],
};
function daeriMonths(brideBranch: number): number[] {
  const g = brideBranch % 6;
  return [[6, 12], [5, 11], [2, 8], [1, 7], [4, 10], [3, 9]][g]!; // 子午/丑未/寅申/卯酉/辰戌/巳亥
}

/* ── 절기·삼복 ── */
function termsOfMonth(y: number, m: number) {
  return monthSolarTerms(y, m); // [{day,name}]
}

/* ── 한 날의 모든 택일 정보 ── */
export interface DayCore {
  day: number; weekday: string;
  lunarMonth: number; lunarDay: number; lunarLeap: boolean;
  stem: number; branch: number; ganzhiHj: string; ganzhiKo: string; gzNum: number; element: string; zodiac: string;
  son: { dir: string; free: boolean };
  hwangdo: { name: string; gil: boolean; emoji: string; tone: "대길" | "길" | "흉" };
  jianchu: { idx: number; ko: string; hj: string; emoji: string; gil: boolean; desc: string };
  woldeok: boolean;
  cheoneul: boolean; // 개인화(프로필 일간 기준)
  scores: Record<TaegilPurpose, number>;
  topGrade: "대길" | "길일" | "보통" | "주의";
}

/* 건제12신 용도별 가중치 */
const J_BASE = [-6, 8, -6, -4, 10, 6, -18, 8, 14, -6, 12, -8];
const J_OVER: Record<TaegilPurpose, Record<number, number>> = {
  이사: { 5: -8, 2: -8, 8: 16, 10: 13 },
  결혼: { 5: -12, 11: -12, 9: -8, 1: 12, 8: 14, 10: 13 },
  개업: { 2: 6, 5: -10, 8: 15, 10: 14 },
  계약: { 4: 13, 8: 14, 5: -4 },
  여행: { 0: -10, 5: -10, 6: -16, 9: -8, 11: -8, 8: 12, 10: 12 },
};

function profileDayStem(profile?: Profile | null): number | null {
  if (!profile?.birth) return null;
  const by = Number(profile.birth.slice(0, 4)), bm = Number(profile.birth.slice(5, 7)), bd = Number(profile.birth.slice(8, 10));
  if (!by || !bm || !bd) return null;
  const cells = monthDayPillars(by, bm);
  const c = cells[bd - 1];
  return c ? c.stem : null;
}

function gradeOf(s: number): DayCore["topGrade"] {
  return s >= 85 ? "대길" : s >= 70 ? "길일" : s >= 50 ? "보통" : "주의";
}

/** 한 달 전체 날짜의 택일 코어 (달력·리스트·상세 공용). */
export function monthTaegil(year: number, month: number, profile?: Profile | null): DayCore[] {
  const cells = monthDayPillars(year, month);
  const mbTable = monthBranchTable(year, month);
  const firstWd = new Date(year, month - 1, 1).getDay();
  const myStem = profileDayStem(profile);
  const cheonTargets = myStem != null ? CHEONEUL[myStem] ?? [] : [];
  const out: DayCore[] = [];
  for (const cell of cells) {
    const day = cell.day;
    const mb = mbTable[day]!;
    const lunar = solarToLunar(year, month, day);
    const son = sonOf(lunar.day);
    const hd = hwangdoOf(mb, cell.branch);
    const jc = jianchuOf(mb, cell.branch);
    const wd = cell.stem === woldeokStem(mb);
    const ce = cheonTargets.includes(cell.branch);
    const scores = {} as Record<TaegilPurpose, number>;
    for (const pp of TAEGIL_PURPOSES) {
      let s = 50;
      s += hd.gil ? 16 : hd.tone === "흉" ? -10 : 0;
      s += (J_OVER[pp][jc.idx] ?? J_BASE[jc.idx]!);
      if (pp === "이사" || pp === "여행") s += son.free ? 12 : 4;
      else s += son.free ? 5 : 0;
      if (wd) s += 10;
      if (ce) s += 10;
      scores[pp] = Math.max(2, Math.min(99, Math.round(s)));
    }
    const topGrade = gradeOf(Math.max(...Object.values(scores)));
    out.push({
      day, weekday: WEEK[(firstWd + day - 1) % 7]!,
      lunarMonth: lunar.month, lunarDay: lunar.day, lunarLeap: lunar.leap,
      stem: cell.stem, branch: cell.branch,
      ganzhiHj: STEM_HJ[cell.stem]! + BR_HJ[cell.branch]!, ganzhiKo: STEM_KO[cell.stem]! + BR_KO[cell.branch]!,
      gzNum: cell.ganzhiIndex + 1, element: STEM_EL[cell.stem]!, zodiac: ZODIAC[cell.branch]!,
      son, hwangdo: hd, jianchu: jc, woldeok: wd, cheoneul: ce, scores, topGrade,
    });
  }
  return out;
}

export interface TaegilMonth {
  year: number; month: number;
  days: DayCore[];
  firstWeekday: number;
  terms: { day: number; name: string }[];
  taboo: ReturnType<typeof yearTaboo>;
  personalized: boolean;
}

export function buildTaegil(year: number, month: number, profile?: Profile | null): TaegilMonth {
  return {
    year, month,
    days: monthTaegil(year, month, profile),
    firstWeekday: new Date(year, month - 1, 1).getDay(),
    terms: termsOfMonth(year, month),
    taboo: yearTaboo(year),
    personalized: profileDayStem(profile) != null,
  };
}

/* 결혼 특수(여자 띠 기준) — 프로필 여성일 때 */
export function marriageNote(profile?: Profile | null): { brideZodiac: string; avoidMonths: number[]; goodMonths: number[] } | null {
  if (!profile?.birth) return null;
  const by = Number(profile.birth.slice(0, 4));
  if (!by) return null;
  const yb = yearBranch(by);
  return { brideZodiac: ZODIAC[yb]!, avoidMonths: SALBU[yb] ?? [], goodMonths: daeriMonths(yb) };
}

/* 용도별 한 줄 가이드(상세 카드 문구) */
export const PURPOSE_GUIDE: Record<TaegilPurpose, string> = {
  이사: "이사·입주는 손없는 날과 황도길일, 그리고 삼살·대장군 방위를 함께 봐요.",
  결혼: "혼인은 방위는 안 보고, 황도(成·開·定일)와 신부 띠의 가취월·살부대기월을 봐요.",
  개업: "개업은 사람을 부르는 일이라 방위 무관, 황도와 건제(開·成·滿)·재물 길신을 봐요.",
  계약: "계약은 약속을 굳히는 일이라 정(定)·성(成)일과 천을귀인 든 날이 좋아요.",
  여행: "여행·출행은 성(成)·개(開)일이 좋고 건·집·파·수·폐일은 피해요.",
};
