// 궁합 — 두 사람 생년월일 → 궁합 점수 + 풀이. 결정론적·재미 참고용.
// 순서 무관(A+B == B+A). 바이럴 핵심(서로 보내고 싶어짐).
import { hashString, mulberry32, pickUnique } from "./seed.js";

export interface Compatibility {
  /** 0~100 */
  score: number;
  title: string;
  summary: string;
  /** 잘 맞는 점 */
  good: string;
  /** 노력하면 좋은 점 */
  tip: string;
  /** 두 사람의 행운 숫자 */
  luckyNumbers: number[];
}

const TITLE = {
  best: ["천생연분", "전생의 인연", "환상의 짝꿍"],
  great: ["아주 잘 맞는 인연", "서로를 끌어당기는 사이", "따뜻한 단짝"],
  good: ["노력하면 빛나는 인연", "알아갈수록 좋은 사이", "은은하게 맞는 인연"],
  ok: ["서로 배워가는 인연", "다름이 매력인 사이", "조율이 필요한 인연"],
};

const SUMMARY = {
  best: [
    "말하지 않아도 통하는 깊은 인연이에요. 함께일수록 서로를 빛나게 합니다.",
    "마주 보는 것만으로 편안한 사이. 오래도록 단단하게 이어질 인연이에요.",
  ],
  great: [
    "기분 좋은 호흡이 흐르는 사이예요. 작은 배려가 관계를 더 깊게 만들어요.",
    "함께 있으면 즐거움이 커지는 인연. 솔직함이 둘을 더 가깝게 해줘요.",
  ],
  good: [
    "처음엔 천천히, 알아갈수록 정이 드는 사이예요. 대화가 열쇠랍니다.",
    "서로의 속도를 맞춰가면 단단해지는 인연. 기다림이 약이 돼요.",
  ],
  ok: [
    "성향이 달라 부딪힐 수 있지만, 그만큼 배울 게 많은 사이예요.",
    "다름을 인정하면 의외로 잘 맞아요. 솔직한 표현이 오해를 줄여줘요.",
  ],
};

const GOOD = [
  "가치관의 결이 비슷해 큰 다툼이 적어요.",
  "서로의 장점을 잘 알아봐 줘요.",
  "함께 있을 때 편안함을 느껴요.",
  "위기에서 서로를 챙기는 힘이 있어요.",
  "대화의 리듬이 잘 맞아요.",
];

const TIP = [
  "표현이 서툴 때가 있어요. 마음을 자주 말해주세요.",
  "각자의 시간을 존중하면 더 좋아져요.",
  "작은 약속을 잘 지키는 게 신뢰를 키워요.",
  "서운함은 쌓지 말고 바로 풀어요.",
  "취향 차이는 새로움으로 받아들여 보세요.",
];

function band(score: number): keyof typeof TITLE {
  return score >= 88 ? "best" : score >= 74 ? "great" : score >= 60 ? "good" : "ok";
}

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** 두 생년월일의 궁합(순서 무관·결정론적). */
export function compatibility(birthA: string, birthB: string): Compatibility {
  const key = [birthA, birthB].sort().join("|");
  const seed = hashString(`couple|${key}`);
  const rnd = mulberry32(seed);

  const score = 45 + Math.floor(rnd() * 55); // 45~99 (긍정 편향)
  const b = band(score);

  return {
    score,
    title: pick(TITLE[b], rnd),
    summary: pick(SUMMARY[b], rnd),
    good: pick(GOOD, rnd),
    tip: pick(TIP, rnd),
    luckyNumbers: pickUnique((seed ^ 0x5bd1e995) >>> 0, 3, 45),
  };
}
