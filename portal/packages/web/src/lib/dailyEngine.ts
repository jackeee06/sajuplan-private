// 오늘의 운세 = 만세 엔진(@manse/engine)의 일진론 일일운세 + 정밀 명식 결합.
// ⚠️ 포털→만세엔진 단방향(원칙). 결정론적(같은 입력+같은 날짜 = 같은 결과).
import {
  computeDailyFortune,
  computeManse,
  lunarToSolar,
  type DailyFortune,
  type DailyTargetDate,
  type ManseChart,
} from "@manse/engine";
import type { Profile } from "./profile.js";

export type { DailyFortune, ManseChart, DailyTargetDate };

export interface DailyBundle {
  daily: DailyFortune;
  /** 정밀 명식(8글자·십성·지장간·대운·신살) — 시간 모름이어도 시주만 빠지고 나머지는 나옴 */
  chart: ManseChart | null;
}

/** "YYYY-MM-DD"(양력) + 시각 → 엔진 birth 문자열 + 시간모름 여부 */
function birthString(p: Profile): { birth: string; unknownHour: boolean; gender: "M" | "F"; lon: number } {
  const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
  return {
    birth: `${p.birth}T${time ?? "12:00"}`,
    unknownHour: !time,
    gender: p.gender ?? "M",
    lon: p.lon ?? 127.5,
  };
}

/** 음력 양력 변환(입력 시 1회) — 프로필엔 항상 양력으로 저장. */
export function lunarToSolarDate(y: number, m: number, d: number, leap = false): string {
  const s = lunarToSolar(y, m, d, leap);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${s.year}-${pad(s.month)}-${pad(s.day)}`;
}

/** 정밀(생년월일) 모드 — 일진론 운세 + 정밀 명식. */
export function buildNatalDaily(p: Profile, target: DailyTargetDate, withChart = true): DailyBundle {
  const { birth, unknownHour, gender, lon } = birthString(p);
  const daily = computeDailyFortune({ mode: "natal", birth, gender, unknownHour, longitude: lon }, target);
  let chart: ManseChart | null = null;
  if (withChart) {
    try {
      chart = computeManse({ birth, gender, unknownHour, longitude: lon, calendar: "solar" });
    } catch {
      chart = null;
    }
  }
  return { daily, chart };
}

/** 띠 모드 — 연지(0=쥐…11=돼지)만으로 일진론 운세(명식 없음). */
export function buildZodiacDaily(yearBranch: number, target: DailyTargetDate): DailyBundle {
  return { daily: computeDailyFortune({ mode: "zodiac", yearBranch }, target), chart: null };
}

/** 출생연도 → 연지 index(0=쥐). 띠 자동 도출용. */
export function yearBranchOf(year: number): number {
  return (((year - 4) % 12) + 12) % 12;
}

/** 기준 날짜 → 오늘/내일 DailyTargetDate. (엔진은 Date 미사용 → UI가 주입) */
export function targetDate(offsetDays = 0, base: Date = new Date()): DailyTargetDate {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
