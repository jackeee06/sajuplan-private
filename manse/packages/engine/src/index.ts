/**
 * @manse/engine — 진입점
 * ──────────────────────────────────────────────────────────────
 * computeManse(input) → 명식 JSON (ManseChart)
 *
 * ⚠️ 분리 원칙: 이 패키지는 사주플랜을 모른다. 순수 계산만 한다.
 */

import {
  STEMS_HANJA, STEMS_KO, STEM_ELEMENT, STEM_POLARITY,
  BRANCHES_HANJA, BRANCHES_KO, BRANCH_ELEMENT, BRANCH_POLARITY, BRANCH_ANIMAL,
} from "./constants.js";
import { computeFourPillars, type Pillar, type PillarInput } from "./pillars.js";
import { deriveAll, type PillarDerived } from "./derive.js";
import {
  elementDistribution, tenGodDistribution, sinsal, sewoon, monthlyWoon, strength, gyeokguk,
  hapchung, twelveSinsal, compatibilityScore, nayinOf, cheoneulBranches, type Compatibility,
} from "./analysis.js";
import { HIDDEN_STEMS, tenGodOf, twelveStageOf } from "./constants.js";
import { jdToGregorianUT } from "./julian.js";
import { MONTH_TERMS } from "./astronomy.js";

const KST_FRAC = 9 / 24;
/** 절입 JD(UT) + 절기 황경 → 절기명 + KST 입절 시각 라벨 */
function monthTermInfo(termJD: number, termDeg: number): { name: string; deg: number; at: string } {
  const g = jdToGregorianUT(termJD + KST_FRAC); // KST 민간시각
  const name = MONTH_TERMS.find((t) => t.deg === termDeg)?.name ?? "";
  return { name, deg: termDeg, at: fmtLocal(g) };
}
import type {
  ManseInput, ManseChart, PillarOut, StemLabel, BranchLabel,
} from "./types.js";

export const ENGINE_VERSION = "0.1.0";
export const SCHEMA_VERSION = "1.0";

/**
 * 일주 앵커 검증 완료(권위 기준일 1949-10-01=甲子 / 1592-12-31=甲申).
 * 년주(입춘)·월주(절기)·일주·시주 모두 검증 통과.
 * 잔여: 절입 ±초 경계의 분 단위 KASI 대조는 추후 골든 확대 시 추가(현재 알고리즘 오차 ±수십초).
 */
export const ACCURACY_PINNED = true;

export * from "./types.js";
// 일진 달력용(웹이 직접 호출)
export { monthDayPillars, firstWeekday, monthSolarTerms, type DayPillarCell } from "./analysis.js";
export { STEMS_HANJA, BRANCHES_HANJA, STEMS_KO, BRANCHES_KO } from "./constants.js";
export { solarToLunar, lunarToSolar, type LunarDate } from "./lunar.js";
// 일일운세(웹이 직접 호출)
export {
  computeDailyFortune,
  type DailyInput, type DailyFortune, type DailyField, type DailyLuck,
  type DailyFieldKey, type DailyTargetDate,
  type DailyTimeSlot, type DailySlotGrade, type DailyGuide, type DailyZodiacMatch,
  type DailyChart, type DailyChartPillar,
} from "./daily.js";

// ── 연운/월운 재계산 헬퍼 (대운→연운→월운 드릴다운용, 웹이 직접 호출) ──
export interface LuckYear { year: number; ganzhi: string; ganzhiKo: string; stemTenGod: string; branchTenGod: string; element: string }
export interface LuckMonth { monthLabel: string; ganzhi: string; ganzhiKo: string; stemTenGod: string; branchTenGod: string; element: string }

/** 임의 시작연도부터 count년치 연운(세운) */
export function yearLuck(dayStemIndex: number, startYear: number, count = 10): LuckYear[] {
  return sewoon(startYear, dayStemIndex, count).map((s) => ({
    year: s.year,
    ganzhi: STEMS_HANJA[s.stem]! + BRANCHES_HANJA[s.branch]!,
    ganzhiKo: STEMS_KO[s.stem]! + BRANCHES_KO[s.branch]!,
    stemTenGod: s.stemTenGod,
    branchTenGod: s.branchTenGod,
    element: STEM_ELEMENT[s.stem]!,
  }));
}
/** 특정 연도의 12개월 월운 */
export function monthLuck(dayStemIndex: number, year: number): LuckMonth[] {
  return monthlyWoon(year, dayStemIndex).map((w) => ({
    monthLabel: BRANCHES_KO[w.branch]! + "월",
    ganzhi: STEMS_HANJA[w.stem]! + BRANCHES_HANJA[w.branch]!,
    ganzhiKo: STEMS_KO[w.stem]! + BRANCHES_KO[w.branch]!,
    stemTenGod: w.stemTenGod,
    branchTenGod: w.branchTenGod,
    element: STEM_ELEMENT[w.stem]!,
  }));
}

function stemLabel(i: number): StemLabel {
  return { index: i, hanja: STEMS_HANJA[i]!, ko: STEMS_KO[i]!, element: STEM_ELEMENT[i]!, polarity: STEM_POLARITY[i]! };
}
function branchLabel(i: number): BranchLabel {
  return { index: i, hanja: BRANCHES_HANJA[i]!, ko: BRANCHES_KO[i]!, element: BRANCH_ELEMENT[i]!, polarity: BRANCH_POLARITY[i]!, animal: BRANCH_ANIMAL[i]! };
}

function pillarOut(p: Pillar, d: PillarDerived): PillarOut {
  return {
    stem: stemLabel(p.stem),
    branch: branchLabel(p.branch),
    ganzhi: STEMS_HANJA[p.stem]! + BRANCHES_HANJA[p.branch]!,
    ganzhiKo: STEMS_KO[p.stem]! + BRANCHES_KO[p.branch]!,
    stemTenGod: d.stemTenGod ?? "일원",
    branchTenGod: d.branchTenGod,
    hiddenStems: d.hiddenStems.map((h) => ({ hanja: STEMS_HANJA[h.stem]!, ko: STEMS_KO[h.stem]!, tenGod: h.tenGod })),
    twelveStage: d.twelveStage,
    selfStage: twelveStageOf(p.stem, p.branch),
    nayin: nayinOf(p.stem, p.branch),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtLocal(t: { year: number; month: number; day: number; hour: number; minute: number }): string {
  return `${t.year}-${pad2(t.month)}-${pad2(t.day)}T${pad2(t.hour)}:${pad2(t.minute)}`;
}

export function computeManse(input: ManseInput): ManseChart {
  const calendar = input.calendar ?? "solar";
  if (calendar === "lunar") {
    // 음력 변환은 KASI 음양력 데이터 필요 — 스펙 §10 미해결. 1차는 양력만.
    throw new Error("음력 입력은 아직 미지원(KASI 음양력 변환 데이터 연동 예정). solar 로 입력해 주세요.");
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input.birth);
  if (!m) throw new Error(`birth 형식 오류: "${input.birth}" (예: 1990-06-15T07:20)`);
  const [, ys, mo, da, ho, mi] = m;
  const year = +ys!, month = +mo!, day = +da!;
  const hour = input.unknownHour ? 12 : +ho!; // 시간 모름이면 정오 가정(시주는 출력서 null)
  const minute = input.unknownHour ? 0 : +mi!;

  const options = {
    trueSolarTime: input.options?.trueSolarTime ?? true,
    hourBoundary: input.options?.hourBoundary ?? "midnight",
  } as const;

  const pInput: PillarInput = {
    year, month, day, hour, minute,
    longitude: input.longitude ?? 127.5,
    tzOffsetHours: input.tzOffsetHours ?? 9,
    trueSolarTime: options.trueSolarTime,
    hourBoundary: options.hourBoundary,
  };

  const pillars = computeFourPillars(pInput);
  const derived = deriveAll(pillars, input.gender);

  const incHour = !input.unknownHour;
  const elements = elementDistribution(pillars, incHour);
  const tenGods = tenGodDistribution(pillars, incHour);
  const sinsalHits = sinsal(pillars, incHour);
  const sewoonList = sewoon(year, pillars.day.stem, 10);
  const woonList = monthlyWoon(year, pillars.day.stem);
  const strengthRes = strength(pillars, incHour);
  const hapchungList = hapchung(pillars, incHour);
  const sinsal12List = twelveSinsal(pillars, incHour, pillars.year.branch);
  const sinsal12DayList = twelveSinsal(pillars, incHour, pillars.day.branch);
  const cheoneulList = cheoneulBranches(pillars.day.stem);
  const dayStem = pillars.day.stem;
  const branchTG = (branch: number): string => {
    const h = HIDDEN_STEMS[branch]!;
    return tenGodOf(dayStem, h[h.length - 1]!);
  };

  const c = pillars.correction;

  return {
    version: SCHEMA_VERSION,
    dayStemIndex: dayStem, // 연운/월운 재계산용 일간 인덱스
    birthYear: year,
    input: {
      calendar,
      name: input.name,
      birth: input.birth,
      gender: input.gender,
      longitude: pInput.longitude,
      tzOffsetHours: pInput.tzOffsetHours,
      unknownHour: !!input.unknownHour,
      options,
    },
    corrected: {
      sajuYear: c.sajuYear,
      trueSolarLocal: fmtLocal(c.correctedLocal),
      longitudeMinutes: c.longitudeMinutes,
      equationOfTimeMinutes: c.equationOfTimeMinutes,
      trueSolarApplied: options.trueSolarTime,
      // 월주가 어느 절기(節)에 입절해 정해졌는지 — "달력 월 아님" 근거
      monthTerm: monthTermInfo(c.termJD, c.monthTermDeg),
    },
    pillars: {
      year: pillarOut(pillars.year, derived.year),
      month: pillarOut(pillars.month, derived.month),
      day: pillarOut(pillars.day, derived.day),
      hour: input.unknownHour ? null : pillarOut(pillars.hour, derived.hour),
    },
    gongmang: derived.gongmang.map((b) => BRANCHES_HANJA[b]!),
    daewoon: {
      direction: derived.daewoon.direction,
      directionKo: derived.daewoon.direction === "forward" ? "순행" : "역행",
      startAge: derived.daewoon.startAge,
      list: derived.daewoon.list.map((it) => ({
        age: it.age,
        ganzhi: STEMS_HANJA[it.stem]! + BRANCHES_HANJA[it.branch]!,
        ganzhiKo: STEMS_KO[it.stem]! + BRANCHES_KO[it.branch]!,
        element: STEM_ELEMENT[it.stem]!,
        stemTenGod: tenGodOf(dayStem, it.stem),
        branchTenGod: branchTG(it.branch),
      })),
    },
    analysis: {
      elements: elements.map((e) => ({ element: e.element, count: e.count, percent: e.percent, level: e.level, role: e.role })),
      tenGods: tenGods.map((t) => ({ tenGod: t.tenGod, count: t.count, percent: t.percent })),
      sinsal: sinsalHits.map((s) => ({ name: s.name, pillar: s.pillar })),
      sewoon: sewoonList.map((s) => ({
        year: s.year,
        ganzhi: STEMS_HANJA[s.stem]! + BRANCHES_HANJA[s.branch]!,
        ganzhiKo: STEMS_KO[s.stem]! + BRANCHES_KO[s.branch]!,
        stemTenGod: s.stemTenGod,
        branchTenGod: s.branchTenGod,
        element: STEM_ELEMENT[s.stem]!,
      })),
      woon: woonList.map((w) => ({
        monthLabel: BRANCHES_KO[w.branch]! + "월",
        ganzhi: STEMS_HANJA[w.stem]! + BRANCHES_HANJA[w.branch]!,
        ganzhiKo: STEMS_KO[w.stem]! + BRANCHES_KO[w.branch]!,
        stemTenGod: w.stemTenGod,
        branchTenGod: w.branchTenGod,
        element: STEM_ELEMENT[w.stem]!,
      })),
      strength: {
        ratio: strengthRes.ratio,
        label: strengthRes.label,
        yongsin: strengthRes.yongsin,
        yongsinReason: strengthRes.yongsinReason,
        deukRyeong: strengthRes.deukRyeong,
        deukJi: strengthRes.deukJi,
        deukSe: strengthRes.deukSe,
        bandPercent: strengthRes.bandPercent,
      },
      gyeokguk: gyeokguk(pillars),
      hapchung: hapchungList.map((r) => ({ type: r.type, detail: r.detail, pillars: r.pillars, row: r.row })),
      sinsal12: sinsal12List.map((s) => ({ pillar: s.pillar, name: s.name })),
      sinsal12Day: sinsal12DayList.map((s) => ({ pillar: s.pillar, name: s.name })),
      cheoneul: cheoneulList,
    },
    meta: {
      engineVersion: ENGINE_VERSION,
      accuracyPinned: ACCURACY_PINNED,
      validatedAgainst: ACCURACY_PINNED ? ["sexagenary-anchor-1949-10-01", "sexagenary-anchor-1592-12-31"] : [],
    },
  };
}

// ── 궁합 ────────────────────────────────────────────────────────
function toFourPillars(input: ManseInput) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input.birth);
  if (!m) throw new Error(`birth 형식 오류: "${input.birth}"`);
  const [, ys, mo, da, ho, mi] = m;
  return computeFourPillars({
    year: +ys!, month: +mo!, day: +da!,
    hour: input.unknownHour ? 12 : +ho!,
    minute: input.unknownHour ? 0 : +mi!,
    longitude: input.longitude ?? 127.5,
    tzOffsetHours: input.tzOffsetHours ?? 9,
    trueSolarTime: input.options?.trueSolarTime ?? true,
    hourBoundary: input.options?.hourBoundary ?? "midnight",
  });
}

export interface CompatibilityResult {
  a: ManseChart;
  b: ManseChart;
  compat: Compatibility;
}

/** 두 사람 궁합 — 각자 명식 + 궁합 점수/해석(참고용) */
export function computeCompatibility(inputA: ManseInput, inputB: ManseInput): CompatibilityResult {
  return {
    a: computeManse(inputA),
    b: computeManse(inputB),
    compat: compatibilityScore(toFourPillars(inputA), toFourPillars(inputB)),
  };
}

// jdToGregorianUT 재노출(테스트/디버깅 편의)
export { jdToGregorianUT };
