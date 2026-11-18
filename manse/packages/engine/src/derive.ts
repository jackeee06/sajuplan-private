/**
 * 파생 계산 — 십성 · 지장간 · 12운성 · 공망 · 대운
 */

import {
  HIDDEN_STEMS,
  tenGodOf,
  twelveStageOf,
  gongmangOf,
  ganzhi,
  STEM_POLARITY,
  type TenGod,
} from "./constants.js";
import type { FourPillars, Pillar } from "./pillars.js";

export interface HiddenStem {
  stem: number;
  tenGod: TenGod;
}

export interface PillarDerived {
  /** 천간 십성 (일간 기준). 일주는 일원(自身)이라 null */
  stemTenGod: TenGod | null;
  /** 지지 십성 (지장간 정기 기준) */
  branchTenGod: TenGod;
  /** 지장간 [여기..정기] + 각 십성 */
  hiddenStems: HiddenStem[];
  /** 12운성 (일간이 이 지지에서 갖는 단계) */
  twelveStage: string;
}

export interface DaewoonItem {
  age: number;
  stem: number;
  branch: number;
  ganzhiIndex: number;
}

export interface Daewoon {
  direction: "forward" | "reverse";
  /** 대운수 (첫 대운 시작 만나이 근사) */
  startAge: number;
  /** 경계 절기까지 일수(추적용) */
  daysToTerm: number;
  list: DaewoonItem[];
}

/** 한 기둥의 파생값. dayStem = 일간 index */
function derivePillar(pillar: Pillar, dayStemIdx: number, isDayPillar: boolean): PillarDerived {
  const hidden = HIDDEN_STEMS[pillar.branch]!;
  const mainHidden = hidden[hidden.length - 1]!; // 정기
  return {
    stemTenGod: isDayPillar ? null : tenGodOf(dayStemIdx, pillar.stem),
    branchTenGod: tenGodOf(dayStemIdx, mainHidden),
    hiddenStems: hidden.map((s) => ({ stem: s, tenGod: tenGodOf(dayStemIdx, s) })),
    twelveStage: twelveStageOf(dayStemIdx, pillar.branch),
  };
}

export interface AllDerived {
  year: PillarDerived;
  month: PillarDerived;
  day: PillarDerived;
  hour: PillarDerived;
  gongmang: [number, number]; // 공망 지지 2
  daewoon: Daewoon;
}

/**
 * @param gender "M" | "F" — 대운 방향
 */
export function deriveAll(pillars: FourPillars, gender: "M" | "F"): AllDerived {
  const dayStem = pillars.day.stem;

  // ── 대운 방향: 양년남/음년녀 = 순행, 음년남/양년녀 = 역행 ──
  const yearYang = STEM_POLARITY[pillars.year.stem] === "양";
  const male = gender === "M";
  const forward = (yearYang && male) || (!yearYang && !male);

  // ── 대운수: 출생 → 경계 절기 일수 ÷ 3 ──
  const { birthJD, termJD, nextTermJD } = pillars.correction;
  const daysToTerm = forward ? nextTermJD - birthJD : birthJD - termJD;
  const startAge = Math.max(1, Math.round(daysToTerm / 3));

  // ── 대운 간지: 월주에서 ±1씩 (10년 단위) ──
  const list: DaewoonItem[] = [];
  for (let i = 0; i < 10; i++) {
    const gz = ((pillars.month.ganzhiIndex + (forward ? i + 1 : -(i + 1))) % 60 + 60) % 60;
    const { stem, branch } = ganzhi(gz);
    list.push({ age: startAge + i * 10, stem, branch, ganzhiIndex: gz });
  }

  return {
    year: derivePillar(pillars.year, dayStem, false),
    month: derivePillar(pillars.month, dayStem, false),
    day: derivePillar(pillars.day, dayStem, true),
    hour: derivePillar(pillars.hour, dayStem, false),
    gongmang: gongmangOf(pillars.day.ganzhiIndex),
    daewoon: { direction: forward ? "forward" : "reverse", startAge, daysToTerm: round1(daysToTerm), list },
  };
}

const round1 = (x: number): number => Math.round(x * 10) / 10;
