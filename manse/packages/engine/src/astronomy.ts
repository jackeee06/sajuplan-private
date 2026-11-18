/**
 * 천문 계산 — 태양 황경 / 24절기 시각 / 균시차(진태양시)
 * ──────────────────────────────────────────────────────────────
 * 만세력에서 "직접 짜면 NASA 재발명"인 유일한 어려운 부분.
 * Jean Meeus, "Astronomical Algorithms" ch.25(태양 위치) 저정밀(±0.01°) 공식 사용.
 * ±0.01° ≈ 절기 시각 ±수십 초 정밀 → 분 단위 만세력에 충분.
 *
 * 🔴 검증 게이트: 여기서 나온 절기 시각이 한국천문연구원(KASI) 절기표와
 *    분 단위로 일치해야 "정확한 만세력". test/ 골든 케이스로 핀.
 */

import { jdUTtoTT, jdToGregorianUT, julianDayUT } from "./julian.js";

const DEG = Math.PI / 180;
const norm360 = (x: number): number => ((x % 360) + 360) % 360;

/**
 * 태양의 겉보기 황경(apparent longitude), 도(°) [0,360).
 * @param jdeTT 율리우스력일 (TT/지구역학시 기준)
 */
export function sunApparentLongitude(jdeTT: number): number {
  const T = (jdeTT - 2451545.0) / 36525;

  // 기하 평균 황경 L0
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  // 평균 근점이각 M
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * DEG;
  // 중심차 C (equation of center)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);

  const trueLong = L0 + C;
  // 장동·광행차 근사 → 겉보기 황경
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  return norm360(lambda);
}

/** 평균 황도경사 ε (도) */
function meanObliquity(jdeTT: number): number {
  const T = (jdeTT - 2451545.0) / 36525;
  // Meeus (22.2) 근사
  return 23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T ** 3;
}

/**
 * 균시차(Equation of Time), 분(minute). (진태양시 − 평균태양시)
 * 진태양시 보정 = 경도보정 + 균시차.
 */
export function equationOfTimeMinutes(jdeTT: number): number {
  const T = (jdeTT - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const lambda = sunApparentLongitude(jdeTT);
  const eps = meanObliquity(jdeTT);

  // 적경 α
  const alpha =
    Math.atan2(Math.cos(eps * DEG) * Math.sin(lambda * DEG), Math.cos(lambda * DEG)) / DEG;
  let E = L0 - 0.0057183 - norm360(alpha);
  // [-180,180] 정규화 후 도→분 (1° = 4분)
  E = ((E + 180) % 360) - 180;
  return E * 4;
}

/**
 * 특정 황경(targetDeg)에 도달하는 절기 시각을 JD(UT)로 반환.
 * @param estJD 근방 추정 JD(UT)
 * 뉴턴식 반복(태양 황경 변화율 ≈ 0.98565°/일)으로 분 단위까지 수렴.
 */
export function findSolarTermJD(targetDeg: number, estJD: number): number {
  let jd = estJD;
  for (let i = 0; i < 8; i++) {
    const { year } = jdToGregorianUT(jd);
    const lambda = sunApparentLongitude(jdUTtoTT(jd, year));
    // 목표와의 차(°), [-180,180]
    let diff = ((targetDeg - lambda + 540) % 360) - 180;
    if (Math.abs(diff) < 1e-7) break;
    jd += diff / 0.98565; // °→일
  }
  return jd;
}

/** 24절기 중 만세력에 쓰는 12절(節)의 황경. 월지 경계. */
export const MONTH_TERMS = [
  { name: "입춘", deg: 315, branch: 2 }, // 寅
  { name: "경칩", deg: 345, branch: 3 }, // 卯
  { name: "청명", deg: 15, branch: 4 }, // 辰
  { name: "입하", deg: 45, branch: 5 }, // 巳
  { name: "망종", deg: 75, branch: 6 }, // 午
  { name: "소서", deg: 105, branch: 7 }, // 未
  { name: "입추", deg: 135, branch: 8 }, // 申
  { name: "백로", deg: 165, branch: 9 }, // 酉
  { name: "한로", deg: 195, branch: 10 }, // 戌
  { name: "입동", deg: 225, branch: 11 }, // 亥
  { name: "대설", deg: 255, branch: 0 }, // 子
  { name: "소한", deg: 285, branch: 1 }, // 丑
] as const;

/**
 * 주어진 해의 입춘 시각 JD(UT). (년주 경계)
 * 입춘은 매년 2/3~2/5 → 2/4 근방에서 수렴.
 */
export function ipchunJD(year: number): number {
  const est = julianDayUT(year, 2, 4.0);
  return findSolarTermJD(315, est);
}

/**
 * 주어진 순간(jdUT)의 태양 황경으로 월지(月支) index 와
 * 직전 절입(節入) 시각을 계산. (월주·대운에 사용)
 */
export function monthBranchAndTerm(jdUT: number): {
  branch: number;
  termDeg: number;
  termJD: number;
  nextTermJD: number;
} {
  const { year } = jdToGregorianUT(jdUT);
  const lambda = sunApparentLongitude(jdUTtoTT(jdUT, year));
  // 315° 기준 30° 버킷 → k (0=寅)
  const k = Math.floor(norm360(lambda - 315) / 30);
  const branch = (2 + k) % 12;
  const termDeg = norm360(315 + 30 * k); // 직전 절입 황경
  const nextDeg = norm360(termDeg + 30);
  // 직전/다음 절입 시각(대운 거리 계산용)
  const termJD = findSolarTermJD(termDeg, jdUT - 16);
  const nextTermJD = findSolarTermJD(nextDeg, jdUT + 16);
  return { branch, termDeg, termJD, nextTermJD };
}
