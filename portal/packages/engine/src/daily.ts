// 매일 콘텐츠 엔진 — 오늘의 운세 / 띠별 / 별자리. 결정론적·재미 맛보기.
// ⚠️ 완결적 AI 분석 아님(규칙기반 맛보기). 깊은 풀이는 상담으로(플랫폼 원칙).
// 날짜는 호출부(UI)가 넘긴다(엔진은 Date.now 미사용 — 순수·결정론 유지).
import { hashString, mulberry32, pickUnique } from "./seed.js";

export interface Zodiac {
  id: string;
  name: string;
  emoji: string;
}
// 12간지 띠
export const ZODIAC: Zodiac[] = [
  { id: "rat", name: "쥐띠", emoji: "🐭" },
  { id: "ox", name: "소띠", emoji: "🐮" },
  { id: "tiger", name: "호랑이띠", emoji: "🐯" },
  { id: "rabbit", name: "토끼띠", emoji: "🐰" },
  { id: "dragon", name: "용띠", emoji: "🐲" },
  { id: "snake", name: "뱀띠", emoji: "🐍" },
  { id: "horse", name: "말띠", emoji: "🐴" },
  { id: "goat", name: "양띠", emoji: "🐑" },
  { id: "monkey", name: "원숭이띠", emoji: "🐵" },
  { id: "rooster", name: "닭띠", emoji: "🐔" },
  { id: "dog", name: "개띠", emoji: "🐶" },
  { id: "pig", name: "돼지띠", emoji: "🐷" },
];

/** 출생연도 → 띠 인덱스 (쥐=0). 4년이 쥐의 해 기준. */
export function zodiacOfYear(year: number): Zodiac {
  const idx = ((((year - 4) % 12) + 12) % 12);
  return ZODIAC[idx];
}

export interface Star {
  id: string;
  name: string;
  emoji: string;
  range: string;
}
// 12별자리
export const STAR: Star[] = [
  { id: "aries", name: "양자리", emoji: "♈", range: "3.21~4.19" },
  { id: "taurus", name: "황소자리", emoji: "♉", range: "4.20~5.20" },
  { id: "gemini", name: "쌍둥이자리", emoji: "♊", range: "5.21~6.21" },
  { id: "cancer", name: "게자리", emoji: "♋", range: "6.22~7.22" },
  { id: "leo", name: "사자자리", emoji: "♌", range: "7.23~8.22" },
  { id: "virgo", name: "처녀자리", emoji: "♍", range: "8.23~9.22" },
  { id: "libra", name: "천칭자리", emoji: "♎", range: "9.23~10.22" },
  { id: "scorpio", name: "전갈자리", emoji: "♏", range: "10.23~11.22" },
  { id: "sagittarius", name: "사수자리", emoji: "♐", range: "11.23~12.24" },
  { id: "capricorn", name: "염소자리", emoji: "♑", range: "12.25~1.19" },
  { id: "aquarius", name: "물병자리", emoji: "♒", range: "1.20~2.18" },
  { id: "pisces", name: "물고기자리", emoji: "♓", range: "2.19~3.20" },
];

// 별자리 시작일(월,일) — 해당일 이상이면 그 별자리. 염소자리는 12.25~익년 1.19로 경계 처리.
const STAR_CUTOFF: { id: string; m: number; d: number }[] = [
  { id: "capricorn", m: 1, d: 1 },
  { id: "aquarius", m: 1, d: 20 },
  { id: "pisces", m: 2, d: 19 },
  { id: "aries", m: 3, d: 21 },
  { id: "taurus", m: 4, d: 20 },
  { id: "gemini", m: 5, d: 21 },
  { id: "cancer", m: 6, d: 22 },
  { id: "leo", m: 7, d: 23 },
  { id: "virgo", m: 8, d: 23 },
  { id: "libra", m: 9, d: 23 },
  { id: "scorpio", m: 10, d: 23 },
  { id: "sagittarius", m: 11, d: 23 },
  { id: "capricorn", m: 12, d: 25 },
];

/** 생년월일(월,일) → 별자리. */
export function starOfDate(month: number, day: number): Star {
  let id = "capricorn";
  for (const c of STAR_CUTOFF) {
    if (month > c.m || (month === c.m && day >= c.d)) id = c.id;
  }
  return STAR.find((s) => s.id === id) ?? STAR[0];
}

const LUCKY_COLORS = [
  "레드", "오렌지", "옐로우", "그린", "블루", "네이비", "퍼플", "핑크", "화이트", "골드", "민트", "라벤더",
];

export interface FieldFortune {
  key: "love" | "money" | "work" | "health";
  label: string;
  score: number;
  text: string;
}

export interface DailyFortune {
  /** 종합 점수 0~100 */
  overall: number;
  /** 총운 요약 */
  summary: string;
  /** 분야별 4개 */
  fields: FieldFortune[];
  /** 행운 숫자(1~45, 3개) — 로또 타일과 연결 */
  luckyNumbers: number[];
  luckyColor: string;
  luckyItem: string;
}

// 점수대별 문구 풀(low<60 / mid 60~79 / high>=80). 재미·격려 톤.
const SUMMARY = {
  high: [
    "오늘은 흐름이 시원하게 트이는 날이에요. 망설였던 일을 밀어붙이기 좋아요.",
    "기분 좋은 기운이 가득해요. 적극적으로 움직일수록 행운이 따라옵니다.",
    "막혔던 곳에 빛이 드는 하루. 좋은 소식이 들려올 수 있어요.",
  ],
  mid: [
    "잔잔하지만 단단한 하루예요. 평소 하던 대로 꾸준히 가면 좋아요.",
    "큰 기복 없이 무난한 흐름. 작은 기회를 잘 살피면 이득이 있어요.",
    "차분하게 페이스를 지키면 만족스러운 하루가 됩니다.",
  ],
  low: [
    "조금은 신중함이 필요한 날. 서두르기보다 한 박자 쉬어가세요.",
    "에너지가 살짝 가라앉을 수 있어요. 무리한 결정은 내일로 미뤄도 좋아요.",
    "작은 일에 흔들리지 말고 마음을 단단히 지키는 게 좋아요.",
  ],
};

const FIELD_TEXT: Record<FieldFortune["key"], { label: string; high: string[]; mid: string[]; low: string[] }> = {
  love: {
    label: "애정운",
    high: ["설레는 인연이 다가와요.", "마음을 표현하기 더없이 좋은 날.", "함께한 사람과 더 가까워져요."],
    mid: ["은은하게 따뜻한 기류가 흘러요.", "솔직한 한마디가 관계를 부드럽게 해요.", "작은 배려가 호감을 키워요."],
    low: ["오늘은 듣는 쪽이 좋아요.", "괜한 오해는 한 박자 쉬고 풀어요.", "혼자만의 시간도 약이 됩니다."],
  },
  money: {
    label: "금전운",
    high: ["뜻밖의 이득이 들어올 수 있어요.", "재물의 흐름이 활짝 열려요.", "투자·기회에 운이 따릅니다."],
    mid: ["작은 절약이 쏠쏠하게 모여요.", "지출을 점검하기 좋은 날.", "무난하게 균형이 잡혀요."],
    low: ["충동구매는 잠시 멈춰요.", "큰 지출은 다시 한번 따져봐요.", "지갑을 가볍게 단속하세요."],
  },
  work: {
    label: "직장·학업운",
    high: ["노력이 인정받는 하루.", "집중력이 최고조예요.", "귀인의 도움이 닿습니다."],
    mid: ["맡은 일을 차근차근 처리하기 좋아요.", "협업에서 좋은 호흡이 나와요.", "꾸준함이 빛을 발해요."],
    low: ["실수 점검을 한 번 더.", "욕심내기보다 마무리에 집중해요.", "쉬어가며 페이스 조절하세요."],
  },
  health: {
    label: "건강운",
    high: ["컨디션이 가뿐해요.", "활력이 넘치는 하루.", "몸도 마음도 가볍습니다."],
    mid: ["규칙적인 리듬을 지켜요.", "가벼운 산책이 도움이 돼요.", "수분 섭취를 챙기세요."],
    low: ["무리한 일정은 피해요.", "충분한 휴식이 필요해요.", "따뜻하게 몸을 챙기세요."],
  },
};

function band(score: number): "high" | "mid" | "low" {
  return score >= 80 ? "high" : score >= 60 ? "mid" : "low";
}

function pickFrom<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/**
 * 결정론적 일일 운세. 같은 (대상, 날짜)는 항상 같은 결과.
 * @param subjectKey 대상 식별자(생년월일 / 띠 id / 별자리 id)
 * @param dateKey 기준 날짜키(예 "2026-06-28" 또는 주간이면 "2026-W26")
 */
export function dailyFortune(subjectKey: string, dateKey: string): DailyFortune {
  const seed = hashString(`daily|${subjectKey}|${dateKey}`);
  const rnd = mulberry32(seed);

  const mkScore = () => 45 + Math.floor(rnd() * 55); // 45~99 (긍정 편향)
  const overall = mkScore();

  const fieldKeys: FieldFortune["key"][] = ["love", "money", "work", "health"];
  const fields: FieldFortune[] = fieldKeys.map((key) => {
    const s = mkScore();
    const meta = FIELD_TEXT[key];
    return { key, label: meta.label, score: s, text: pickFrom(meta[band(s)], rnd) };
  });

  const summary = pickFrom(SUMMARY[band(overall)], rnd);
  const luckyNumbers = pickUnique((seed ^ 0x9e3779b9) >>> 0, 3, 45);
  const luckyColor = pickFrom(LUCKY_COLORS, rnd);
  const luckyItem = pickFrom(
    ["커피", "노트", "이어폰", "향수", "모자", "반지", "텀블러", "운동화", "책", "꽃"],
    rnd,
  );

  return { overall, summary, fields, luckyNumbers, luckyColor, luckyItem };
}
