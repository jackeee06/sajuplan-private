/**
 * 사주 기둥(四柱) 계산
 * ──────────────────────────────────────────────────────────────
 * 년주 = 입춘 기준 / 월주 = 절기(節) 기준 / 일주 = JDN 60갑자 / 시주 = 오서둔
 *
 * ✅ 일주 앵커 검증 완료(2026-06-24): 1949-10-01=甲子 / 1592-12-31=甲申 동시 만족.
 */

import { ganzhi } from "./constants.js";
import {
  localToJD,
  julianDayUT,
  jdToGregorianUT,
  jdUTtoTT,
  KST_OFFSET_HOURS,
} from "./julian.js";
import {
  ipchunJD,
  monthBranchAndTerm,
  equationOfTimeMinutes,
} from "./astronomy.js";

/**
 * ✅ PINNED — 일주 60갑자 앵커.
 * dayGanzhiIndex = (지역자정 JDN + DAY_PILLAR_OFFSET) mod 60.
 * 권위 기준일로 검증됨(test/engine.test.ts 골든):
 *   1949-10-01 = 甲子(index 0), 1592-12-31 = 甲申(index 20) 동시 만족.
 *   (출처: Wikipedia "Sexagenary cycle" 일진 worked example)
 */
export const DAY_PILLAR_OFFSET = 49;

/** 한국 표준시 자오선(경도). 진태양시 경도보정 기준. */
export const KST_MERIDIAN = 135;

export interface PillarInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 출생지 경도(°E). 진태양시 경도보정. 기본 한국 평균 127.5 */
  longitude: number;
  /** 표준시 오프셋(시간). 기본 KST +9. (역사적 표준시/서머타임은 호출부에서 조정) */
  tzOffsetHours: number;
  /** 진태양시(경도+균시차) 적용 여부 */
  trueSolarTime: boolean;
  /** 일주/시주 경계 학파: midnight=자정 기준 / ziShi=23시(야자시) 익일 */
  hourBoundary: "midnight" | "ziShi";
}

export interface Pillar {
  stem: number; // 천간 index 0~9
  branch: number; // 지지 index 0~11
  ganzhiIndex: number; // 60갑자 index 0~59
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  /** 보정 내역(추적용) */
  correction: {
    birthJD: number;
    longitudeMinutes: number;
    equationOfTimeMinutes: number;
    correctedLocal: { year: number; month: number; day: number; hour: number; minute: number };
    ipchunJD: number;
    sajuYear: number;
    monthTermDeg: number;
    termJD: number;
    nextTermJD: number;
  };
}

function makePillar(gzIndex: number): Pillar {
  const { stem, branch } = ganzhi(gzIndex);
  return { stem, branch, ganzhiIndex: ((gzIndex % 60) + 60) % 60 };
}

/** 지역 자정 기준 정수 일번호(JDN). 하루마다 +1. 일주 60갑자 카운트 기반. */
function localDayNumber(year: number, month: number, day: number): number {
  // 해당 지역 날짜 00:00 의 JD → 정수화
  const jdMidnightUT = julianDayUT(year, month, day); // 00:00 (그 지역시각을 UT로 본 값)
  return Math.floor(jdMidnightUT + 0.5);
}

export function computeFourPillars(input: PillarInput): FourPillars {
  const { year, month, day, hour, minute, longitude, tzOffsetHours, trueSolarTime, hourBoundary } =
    input;

  // ── 물리적 출생 순간(UT 기준 JD). 절기 비교에 사용 ──
  const birthJD_UT = localToJD(year, month, day, hour, minute, tzOffsetHours);
  const eot = equationOfTimeMinutes(jdUTtoTT(birthJD_UT, year));
  const lonCorrMin = (longitude - KST_MERIDIAN) * 4; // 경도보정(분)
  const totalCorrMin = trueSolarTime ? lonCorrMin + eot : 0;

  // ── 보정된 현지 민간시(시주/일주 경계용) ──
  const correctedLocalJD = birthJD_UT + totalCorrMin / 1440 + tzOffsetHours / 24;
  const cl = jdToGregorianUT(correctedLocalJD);

  // ── 년주: 입춘 기준 ──
  const ipchun = ipchunJD(year);
  const sajuYear = birthJD_UT < ipchun ? year - 1 : year;
  const yearGzIndex = (((sajuYear - 4) % 60) + 60) % 60;
  const yearPillar = makePillar(yearGzIndex);

  // ── 월주: 절기(節) 기준 ──
  const mb = monthBranchAndTerm(birthJD_UT);
  // 오호둔(五虎遁): 寅월 천간 = (년간%5)*2 + 2. 월지 진행만큼 +.
  const yinStem = ((yearPillar.stem % 5) * 2 + 2) % 10;
  const monthsFromYin = ((mb.branch - 2) + 12) % 12;
  const monthStem = (yinStem + monthsFromYin) % 10;
  const monthPillar: Pillar = {
    stem: monthStem,
    branch: mb.branch,
    ganzhiIndex: gzFromStemBranch(monthStem, mb.branch),
  };

  // ── 일주: JDN 60갑자 + 야자시 보정 ──
  let dayShift = 0;
  if (hourBoundary === "ziShi" && cl.hour >= 23) dayShift = 1; // 야자시 → 익일 일진
  const baseDayNum = localDayNumber(cl.year, cl.month, cl.day) + dayShift;
  const dayGzIndex = ((baseDayNum + DAY_PILLAR_OFFSET) % 60 + 60) % 60;
  const dayPillar = makePillar(dayGzIndex);

  // ── 시주: 시지(보정시각) + 오서둔(五鼠遁) ──
  const hourBranch = Math.floor(((cl.hour + 1) % 24) / 2);
  // 子시 천간 = (일간%5)*2. 시지 진행만큼 +.
  const ziStem = ((dayPillar.stem % 5) * 2) % 10;
  const hourStem = (ziStem + hourBranch) % 10;
  const hourPillar: Pillar = {
    stem: hourStem,
    branch: hourBranch,
    ganzhiIndex: gzFromStemBranch(hourStem, hourBranch),
  };

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    correction: {
      birthJD: birthJD_UT,
      longitudeMinutes: round1(lonCorrMin),
      equationOfTimeMinutes: round1(eot),
      correctedLocal: cl,
      ipchunJD: ipchun,
      sajuYear,
      monthTermDeg: mb.termDeg,
      termJD: mb.termJD,
      nextTermJD: mb.nextTermJD,
    },
  };
}

/** 천간·지지 index → 60갑자 index. (양간↔양지/음간↔음지만 성립) */
function gzFromStemBranch(stem: number, branch: number): number {
  for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
  throw new Error(`간지 결합 불가: 천간 ${stem}, 지지 ${branch}`);
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** 달력 날짜(자정 기준)의 일주 60갑자 index. 일진 달력용. */
export function dayGanzhiIndexOf(year: number, month: number, day: number): number {
  return ((localDayNumber(year, month, day) + DAY_PILLAR_OFFSET) % 60 + 60) % 60;
}

export { KST_OFFSET_HOURS };
