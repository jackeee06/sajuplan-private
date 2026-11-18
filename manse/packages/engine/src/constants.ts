/**
 * 명리 상수 테이블 (진실원)
 * ──────────────────────────────────────────────────────────────
 * 천간 10 · 지지 12 · 60갑자 · 오행 · 음양 · 지장간 · 십성 · 12운성.
 * 이 값들은 명리학적으로 확정(불변)이라 외부 검증 없이 정확하다.
 * (검증 핀이 필요한 건 "일주 앵커"와 "절기 시각" 뿐 — constants 아님)
 */

/** 오행 (Five Elements) */
export type Element = "목" | "화" | "토" | "금" | "수";
export const ELEMENTS: Element[] = ["목", "화", "토", "금", "수"];

/** 음양 */
export type Polarity = "양" | "음";

// ── 천간 (Heavenly Stems) ───────────────────────────────────────
export const STEMS_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const STEMS_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
/** 천간별 오행: 甲乙목 丙丁화 戊己토 庚辛금 壬癸수 */
export const STEM_ELEMENT: Element[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
/** 천간별 음양: 짝수 index(甲丙戊庚壬)=양, 홀수=음 */
export const STEM_POLARITY: Polarity[] = STEMS_HANJA.map((_, i) => (i % 2 === 0 ? "양" : "음"));

// ── 지지 (Earthly Branches) ─────────────────────────────────────
export const BRANCHES_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export const BRANCHES_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;
/** 지지별 오행: 子해수, 寅卯목, 巳午화, 申酉금, 辰戌丑未토 */
export const BRANCH_ELEMENT: Element[] = [
  "수", // 子
  "토", // 丑
  "목", // 寅
  "목", // 卯
  "토", // 辰
  "화", // 巳
  "화", // 午
  "토", // 未
  "금", // 申
  "금", // 酉
  "토", // 戌
  "수", // 亥
];
/** 지지별 음양: 子寅辰午申戌=양(짝수 index), 丑卯巳未酉亥=음 */
export const BRANCH_POLARITY: Polarity[] = BRANCHES_HANJA.map((_, i) => (i % 2 === 0 ? "양" : "음"));

/** 지지별 띠 (참고용) */
export const BRANCH_ANIMAL = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;

// ── 지장간 (Hidden Stems) ───────────────────────────────────────
// 각 지지에 숨은 천간 [여기, 중기, 정기]. 정기(main)는 배열 마지막.
// (전통 표준 배분 — 여기/중기 없는 지지는 정기만)
export const HIDDEN_STEMS: number[][] = [
  /* 子 */ [9, 9], // 壬(여기) 癸(정기) → 단순화: [壬, 癸] = [8, 9]
  /* 丑 */ [9, 7, 5], // 癸 辛 己
  /* 寅 */ [4, 2, 0], // 戊 丙 甲
  /* 卯 */ [0, 1], // 甲 乙
  /* 辰 */ [1, 9, 4], // 乙 癸 戊
  /* 巳 */ [4, 6, 2], // 戊 庚 丙
  /* 午 */ [2, 5, 3], // 丙 己 丁
  /* 未 */ [3, 1, 5], // 丁 乙 己
  /* 申 */ [4, 8, 6], // 戊 壬 庚
  /* 酉 */ [6, 7], // 庚 辛
  /* 戌 */ [7, 3, 4], // 辛 丁 戊
  /* 亥 */ [4, 0, 8], // 戊 甲 壬
];
// 子 정정: 壬(8) 癸(9)
HIDDEN_STEMS[0] = [8, 9];

// ── 십성 (Ten Gods) ─────────────────────────────────────────────
export type TenGod =
  | "비견" | "겁재"   // 같은 오행
  | "식신" | "상관"   // 일간이 생하는 오행
  | "편재" | "정재"   // 일간이 극하는 오행
  | "편관" | "정관"   // 일간을 극하는 오행
  | "편인" | "정인";  // 일간을 생하는 오행

/** 오행 상생: 목→화→토→금→수→목 (index 기준 +1) */
export function generates(a: Element, b: Element): boolean {
  return (ELEMENTS.indexOf(a) + 1) % 5 === ELEMENTS.indexOf(b);
}
/** 오행 상극: 목→토→수→화→금→목 (index 기준 +2) */
export function controls(a: Element, b: Element): boolean {
  return (ELEMENTS.indexOf(a) + 2) % 5 === ELEMENTS.indexOf(b);
}

/**
 * 십성 판정: 일간(dayStem) 기준 대상 천간(target)의 십성.
 * @param dayStemIdx 일간 천간 index (0~9)
 * @param targetStemIdx 대상 천간 index (0~9)
 */
export function tenGodOf(dayStemIdx: number, targetStemIdx: number): TenGod {
  const de = STEM_ELEMENT[dayStemIdx]!;
  const te = STEM_ELEMENT[targetStemIdx]!;
  const samePolarity = STEM_POLARITY[dayStemIdx] === STEM_POLARITY[targetStemIdx];

  if (de === te) return samePolarity ? "비견" : "겁재";
  if (generates(de, te)) return samePolarity ? "식신" : "상관"; // 일간이 생함 → 식상
  if (controls(de, te)) return samePolarity ? "편재" : "정재";   // 일간이 극함 → 재성
  if (controls(te, de)) return samePolarity ? "편관" : "정관";   // 대상이 일간을 극함 → 관성
  // 남은 경우: 대상이 일간을 생함 → 인성
  return samePolarity ? "편인" : "정인";
}

// ── 12운성 (Twelve Stages) ──────────────────────────────────────
export const TWELVE_STAGES = [
  "장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양",
] as const;
/** 천간별 장생 지지 index. 양간 순행 / 음간 역행. (戊=丙동궁, 己=丁동궁) */
export const CHANGSAENG_BRANCH: number[] = [
  11, // 甲 → 亥
  6,  // 乙 → 午
  2,  // 丙 → 寅
  9,  // 丁 → 酉
  2,  // 戊 → 寅 (화토동궁)
  9,  // 己 → 酉
  5,  // 庚 → 巳
  0,  // 辛 → 子
  8,  // 壬 → 申
  3,  // 癸 → 卯
];

/**
 * 12운성: 일간(stemIdx) 이 특정 지지(branchIdx)에서 갖는 단계.
 */
export function twelveStageOf(stemIdx: number, branchIdx: number): string {
  const start = CHANGSAENG_BRANCH[stemIdx]!;
  const forward = STEM_POLARITY[stemIdx] === "양"; // 양간 순행, 음간 역행
  const diff = forward
    ? (branchIdx - start + 12) % 12
    : (start - branchIdx + 12) % 12;
  return TWELVE_STAGES[diff]!;
}

// ── 공망 (Void) ─────────────────────────────────────────────────
/**
 * 일주 60갑자 index(0~59) 의 공망 지지 2개 index 반환.
 * 旬首(해당 순의 甲)의 지지에서 +10, +11 한 지지가 공망.
 */
export function gongmangOf(dayGanzhiIdx: number): [number, number] {
  const sunStart = dayGanzhiIdx - (dayGanzhiIdx % 10); // 旬首 ganzhi index
  const sunStartBranch = sunStart % 12;
  return [(sunStartBranch + 10) % 12, (sunStartBranch + 11) % 12];
}

// ── 60갑자 ──────────────────────────────────────────────────────
/** ganzhi index(0~59) → { stem, branch } */
export function ganzhi(idx: number): { stem: number; branch: number } {
  const i = ((idx % 60) + 60) % 60;
  return { stem: i % 10, branch: i % 12 };
}
/** stem·branch index → 60갑자 index(0~59). (중국식 결합: 양간↔양지, 음간↔음지만 성립) */
export function ganzhiIndex(stem: number, branch: number): number {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stem && i % 12 === branch) return i;
  }
  throw new Error(`잘못된 간지 결합: 천간 ${stem}, 지지 ${branch}`);
}
