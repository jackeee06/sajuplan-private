/**
 * 음력(태음태양력) 변환 — 천문 계산 기반 (KASI 데이터 없이 직접 구현)
 * ──────────────────────────────────────────────────────────────
 * 알고리즘(표준 음양력):
 *  - 삭(신월) 시각 = Meeus "Astronomical Algorithms" ch.49 (월삭).
 *  - 음력 달 = 삭에서 다음 삭 전까지. 한국시(KST) 자정 기준 날짜로 환산.
 *  - 동지(태양황경 270°)가 든 달 = 11월.
 *  - 윤달 = 중기(中氣, 태양황경 30°배수)가 없는 달.
 *
 * 🔴 검증: 설날(음력 1/1) 2024-02-10·2025-01-29·2026-02-17, 2000-01-01=음력 1999.11.25
 */
import { deltaTSeconds, julianDayUT, jdToGregorianUT, jdUTtoTT } from "./julian.js";
import { sunApparentLongitude, findSolarTermJD } from "./astronomy.js";

const DEG = Math.PI / 180;
const KST = 9 / 24;

/** k번째 삭(신월)의 JDE(TD). Meeus ch.49 (주요 주기항). */
function newMoonJDE(k: number): number {
  const T = k / 1236.85;
  let jde =
    2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const s = (x: number) => Math.sin(x * DEG);
  let c = 0;
  c += -0.4072 * s(Mp);
  c += 0.17241 * E * s(M);
  c += 0.01608 * s(2 * Mp);
  c += 0.01039 * s(2 * F);
  c += 0.00739 * E * s(Mp - M);
  c += -0.00514 * E * s(Mp + M);
  c += 0.00208 * E * E * s(2 * M);
  c += -0.00111 * s(Mp - 2 * F);
  c += -0.00057 * s(Mp + 2 * F);
  c += 0.00056 * E * s(2 * Mp + M);
  c += -0.00042 * s(3 * Mp);
  c += 0.00042 * E * s(M + 2 * F);
  c += 0.00038 * E * s(M - 2 * F);
  c += -0.00024 * E * s(2 * Mp - M);
  c += -0.00017 * s(Om);
  c += -0.00007 * s(Mp + 2 * M);
  c += 0.00004 * s(2 * Mp - 2 * F);
  c += 0.00004 * s(3 * M);
  c += 0.00003 * s(Mp + M - 2 * F);
  c += 0.00003 * s(2 * Mp + 2 * F);
  c += -0.00003 * s(Mp + M + 2 * F);
  c += 0.00003 * s(Mp - M + 2 * F);
  c += -0.00002 * s(Mp - M - 2 * F);
  c += -0.00002 * s(3 * Mp + M);
  c += 0.00002 * s(4 * Mp);
  jde += c;
  // 추가 행성항(주요)
  const A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
  jde += 0.000325 * s(A1);
  jde += 0.000165 * s(251.88 + 0.016321 * k);
  jde += 0.000164 * s(251.83 + 26.651886 * k);
  jde += 0.000126 * s(349.42 + 36.412478 * k);
  jde += 0.00011 * s(84.66 + 18.206239 * k);
  return jde;
}

/** JD(UT) → KST 자정 기준 정수 일번호 */
function dayNumFromJDUT(jdUT: number): number {
  return Math.floor(jdUT + KST + 0.5);
}
/** 양력 날짜 → KST 일번호 (dayGanzhiIndexOf 와 동일 기준) */
function solarDayNum(y: number, m: number, d: number): number {
  return Math.floor(julianDayUT(y, m, d) + 0.5);
}
/** k번째 삭의 KST 일번호 */
function newMoonDayNum(k: number): number {
  const jde = newMoonJDE(k);
  const { year } = jdToGregorianUT(jde);
  const jdUT = jde - deltaTSeconds(year) / 86400;
  return dayNumFromJDUT(jdUT);
}
/** 동지(270°)가 든 KST 일번호 — wy년 12월 */
function dongjiDayNum(wy: number): number {
  const jdUT = findSolarTermJD(270, julianDayUT(wy, 12, 22));
  return dayNumFromJDUT(jdUT);
}
/** dn 이하의 가장 가까운 삭의 (k, dayNum) */
function newMoonOnOrBefore(dn: number): { k: number; day: number } {
  let k = Math.round((dn - 2451550.09766) / 29.530588861);
  while (newMoonDayNum(k) > dn) k--;
  while (newMoonDayNum(k + 1) <= dn) k++;
  return { k, day: newMoonDayNum(k) };
}
/** 삭 시점의 태양황경 30°버킷 (중기 판정용). 삭 JDE 는 이미 TD. */
function zodiacOf(k: number): number {
  return Math.floor(((sunApparentLongitude(newMoonJDE(k)) % 360) + 360) % 360 / 30);
}

export interface LunarDate {
  year: number;
  month: number;
  day: number;
  leap: boolean;
}

/** 한 sui(동지~다음동지)의 달 목록 구성 — baseYear 12월 동지가 11월. */
function buildSui(baseYear: number): {
  starts: number[];
  nums: { no: number; leap: boolean }[];
  suiEndDay: number;
} {
  const suiStartDay = newMoonOnOrBefore(dongjiDayNum(baseYear)).day;
  const suiEndDay = newMoonOnOrBefore(dongjiDayNum(baseYear + 1)).day;
  let k = newMoonOnOrBefore(suiStartDay).k;
  const starts: number[] = [];
  const zods: number[] = [];
  while (newMoonDayNum(k) < suiEndDay) {
    starts.push(newMoonDayNum(k));
    zods.push(zodiacOf(k));
    k++;
  }
  const count = starts.length;
  // 윤달 = 중기(中氣) 없는 달. 달 j 가 중기 없음 ⟺ zodiac(start_{j+1}) == zodiac(start_j).
  // (start_i 의 황경 30°버킷이 다음 삭에서 안 바뀌면 그 달엔 30°배수 중기가 안 듦)
  let leapIndex = -1;
  if (count === 13) {
    for (let j = 1; j < count - 1; j++) {
      if (((zods[j + 1]! - zods[j]!) % 12 + 12) % 12 === 0) { leapIndex = j; break; }
    }
    if (leapIndex === -1) leapIndex = count - 1;
  }
  const nums: { no: number; leap: boolean }[] = [];
  let no = 11;
  for (let i = 0; i < count; i++) {
    if (i === leapIndex) nums.push({ no, leap: true });
    else { if (i > 0) no = (no % 12) + 1; nums.push({ no, leap: false }); }
  }
  return { starts, nums, suiEndDay };
}

/** 양력(KST) → 음력 */
export function solarToLunar(y: number, m: number, d: number): LunarDate {
  const dn = solarDayNum(y, m, d);
  const m11this = newMoonOnOrBefore(dongjiDayNum(y)).day;
  const baseYear = dn >= m11this ? y : y - 1;
  const { starts, nums, suiEndDay } = buildSui(baseYear);
  let idx = 0;
  for (let i = 0; i < starts.length; i++) {
    const e = i + 1 < starts.length ? starts[i + 1]! : suiEndDay;
    if (dn >= starts[i]! && dn < e) { idx = i; break; }
  }
  const month = nums[idx]!.no;
  const leap = nums[idx]!.leap;
  const day = dn - starts[idx]! + 1;
  const lunarYear = month >= 11 ? baseYear : baseYear + 1;
  return { year: lunarYear, month, day, leap };
}

/** 음력 → 양력(KST). leap=윤달 여부. */
export function lunarToSolar(ly: number, lm: number, ld: number, leap = false): { year: number; month: number; day: number } {
  const baseYear = lm >= 11 ? ly : ly - 1;
  const { nums, starts } = buildSui(baseYear);
  let idx = nums.findIndex((n) => n.no === lm && n.leap === leap);
  if (idx < 0) idx = nums.findIndex((n) => n.no === lm); // 윤달 아닌 평달로 폴백
  if (idx < 0) throw new Error(`음력 ${ly}.${lm}.${ld} 변환 실패`);
  const dn = starts[idx]! + (ld - 1);
  const g = jdToGregorianUT(dn); // JDN(정오) → 양력
  return { year: g.year, month: g.month, day: g.day };
}
