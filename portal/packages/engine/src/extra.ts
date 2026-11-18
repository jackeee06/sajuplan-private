// 추가 운세 — 재물운 / 평생운세(대운 흐름) / 택일(좋은 날). 결정론적·재미 참고용.
// 사주 엔진(생년월일 시드) 재활용. 깊은 풀이는 상담으로(플랫폼 원칙).
import { hashString, mulberry32, pickUnique } from "./seed.js";

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function band(s: number): "high" | "mid" | "low" {
  return s >= 80 ? "high" : s >= 60 ? "mid" : "low";
}

/* ───────────── 재물운 ───────────── */
export interface WealthFortune {
  score: number;
  summary: string;
  timing: string; // 돈이 들어오는 시기
  caution: string; // 지출 주의
  luckyNumbers: number[];
}

const WEALTH_SUMMARY = {
  high: [
    "재물의 문이 활짝 열리는 흐름이에요. 들어오는 기운이 강합니다.",
    "노력이 돈으로 돌아오는 시기. 기회를 잡으면 크게 웃을 수 있어요.",
    "금전운이 무르익었어요. 뜻밖의 이득도 기대해볼 만합니다.",
  ],
  mid: [
    "큰 기복 없이 차곡차곡 모이는 흐름이에요. 꾸준함이 답입니다.",
    "들어오고 나가는 균형이 잡혀요. 작은 절약이 쏠쏠해집니다.",
    "무난한 재물 흐름. 새는 돈만 막아도 이득이에요.",
  ],
  low: [
    "지금은 모으기보다 지키는 시기예요. 큰 지출은 미뤄두세요.",
    "잠시 숨 고르는 흐름. 무리한 투자는 한 박자 쉬어가요.",
    "돈이 흩어지기 쉬운 때. 지갑을 단단히 단속하세요.",
  ],
};
const WEALTH_TIMING = [
  "월초보다 월말에 흐름이 좋아져요.",
  "오전보다 오후에 좋은 소식이 닿아요.",
  "예상치 못한 곳에서 작은 이득이 와요.",
  "사람을 통해 기회가 들어옵니다.",
  "기다리던 돈이 한 박자 늦게 들어와요.",
];
const WEALTH_CAUTION = [
  "충동구매와 보증은 멀리하세요.",
  "큰돈은 한 번 더 따져보고 결정해요.",
  "빌려주는 돈은 못 받을 각오로만.",
  "달콤한 투자 제안일수록 신중히.",
  "지름신이 오는 날엔 하루만 참아요.",
];

export function wealthFortune(birthKey: string, periodKey: string): WealthFortune {
  const seed = hashString(`wealth|${birthKey}|${periodKey}`);
  const rnd = mulberry32(seed);
  const score = 45 + Math.floor(rnd() * 55);
  return {
    score,
    summary: pick(WEALTH_SUMMARY[band(score)], rnd),
    timing: pick(WEALTH_TIMING, rnd),
    caution: pick(WEALTH_CAUTION, rnd),
    luckyNumbers: pickUnique((seed ^ 0x27d4eb2f) >>> 0, 3, 45),
  };
}

/* ───────────── 평생운세 (대운 흐름) ───────────── */
export interface LifePhase {
  age: string;
  score: number;
  text: string;
}
export interface LifeFortune {
  summary: string;
  phases: LifePhase[];
}

const LIFE_SUMMARY = [
  "타고난 기운이 단단해, 후반으로 갈수록 빛나는 사주예요.",
  "초년의 경험이 큰 자산이 되는 흐름. 중년에 꽃을 피웁니다.",
  "한 우물을 파면 크게 이루는 기운. 꾸준함이 무기예요.",
  "사람 복이 많은 사주. 인연을 통해 길이 열립니다.",
];
const PHASE_TEXT = {
  high: ["크게 도약하는 시기. 기회를 과감히 잡으세요.", "노력이 결실로 돌아오는 황금기예요.", "귀인을 만나 길이 넓어집니다."],
  mid: ["차근차근 쌓아가는 안정기예요.", "기반을 다지기 좋은 흐름.", "꾸준히 가면 무난히 풀립니다."],
  low: ["숨 고르며 내실을 다질 시기.", "무리보다 준비에 집중해요.", "한 박자 쉬어가도 좋은 때."],
};

export function lifeFortune(birthKey: string): LifeFortune {
  const seed = hashString(`life|${birthKey}`);
  const rnd = mulberry32(seed);
  const ages = ["10·20대", "30대", "40대", "50대", "60대 이후"];
  const phases: LifePhase[] = ages.map((age) => {
    const s = 50 + Math.floor(rnd() * 50);
    return { age, score: s, text: pick(PHASE_TEXT[band(s)], rnd) };
  });
  return { summary: pick(LIFE_SUMMARY, rnd), phases };
}

/* ───────────── 택일 (좋은 날) ───────────── */
export const TAEGIL_PURPOSES = ["이사", "결혼", "개업", "계약", "여행"] as const;
export type TaegilPurpose = (typeof TAEGIL_PURPOSES)[number];

export interface GoodDay {
  day: number; // 1~31
  weekday: string;
  grade: "대길" | "길일";
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 해당 월에서 목적별 좋은 날 추출(결정론적). year/month는 호출부가 전달. */
export function goodDays(purpose: string, year: number, month: number, firstWeekday: number, daysInMonth: number): GoodDay[] {
  const out: GoodDay[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const seed = hashString(`taegil|${purpose}|${year}-${month}-${day}`);
    const score = seed % 100;
    if (score >= 78) {
      out.push({
        day,
        weekday: WEEK[(firstWeekday + day - 1) % 7],
        grade: score >= 92 ? "대길" : "길일",
      });
    }
  }
  return out.slice(0, 8);
}
