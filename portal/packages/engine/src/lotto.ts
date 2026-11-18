// 로또(행운번호) 순수 엔진 — "오늘의 행운번호" 첫 타일.
// ⚠️ 판매 아님. 번호 추천·생성·당첨확인 도구. "당첨 보장/예측" 표현 금지(재미·참고용).
import { hashString, mulberry32, pickUnique } from "./seed.js";

/** 로또 6/45 규격 */
export const LOTTO_MAX = 45;
export const LOTTO_PICK = 6;

/** 각 숫자에 입힌 운세 한 줄 풀이 — "의미 있는 번호"의 핵심(랜덤과 차별화). 재미·참고용. */
export const NUMBER_MEANING: Record<number, string> = {
  1: "시작과 우두머리의 수",
  2: "균형과 인연의 수",
  3: "창조와 재능의 수",
  4: "안정과 뿌리의 수",
  5: "변화와 기회의 수",
  6: "조화와 가정운의 수",
  7: "행운과 귀인의 수",
  8: "재물과 풍요의 수",
  9: "완성과 지혜의 수",
  10: "새 출발의 수",
  11: "직관과 영감의 수",
  12: "결실과 순환의 수",
  13: "반전과 도약의 수",
  14: "소통과 명예의 수",
  15: "사랑과 매력의 수",
  16: "통찰과 성찰의 수",
  17: "의지와 승리의 수",
  18: "풍족과 베풂의 수",
  19: "빛과 성공의 수",
  20: "각성과 전환의 수",
  21: "영광과 성취의 수",
  22: "큰 꿈과 건설의 수",
  23: "활력과 행운의 수",
  24: "보살핌과 복덕의 수",
  25: "분별과 성장의 수",
  26: "노력의 보상이 따르는 수",
  27: "자비와 인망의 수",
  28: "리더십과 재물의 수",
  29: "신뢰와 협력의 수",
  30: "표현과 즐거움의 수",
  31: "끈기와 기반의 수",
  32: "인연과 확장의 수",
  33: "헌신과 축복의 수",
  34: "실리와 결단의 수",
  35: "창의와 자유의 수",
  36: "봉사와 도량의 수",
  37: "학문과 명철의 수",
  38: "예술과 풍류의 수",
  39: "포용과 마무리의 수",
  40: "인내 끝 결실의 수",
  41: "명예와 권위의 수",
  42: "균형과 회복의 수",
  43: "의지와 추진의 수",
  44: "비전과 실현의 수",
  45: "완성과 대길의 수",
};

export function meaningOf(n: number): string {
  return NUMBER_MEANING[n] ?? "행운의 수";
}

export interface LuckyNumbers {
  /** 오름차순 6개 */
  numbers: number[];
  /** 각 숫자 + 운세 한 줄 */
  details: { n: number; meaning: string }[];
  /** 생성 근거 라벨 (예: "사주 운명번호", "이번주 행운번호") */
  source: string;
}

function toDetails(numbers: number[], source: string): LuckyNumbers {
  return {
    numbers,
    details: numbers.map((n) => ({ n, meaning: meaningOf(n) })),
    source,
  };
}

/**
 * 평생 운명번호 — 생년월일시로 뽑은 "내 번호"(평생 고정).
 * 같은 사람 = 항상 같은 6개. 통계사이트가 복제 못 하는 시그니처.
 * @param birth ISO 형식 "YYYY-MM-DDTHH:mm" 또는 "YYYY-MM-DD"
 * @param gender "M" | "F" (선택 — 있으면 시드에 반영)
 */
export function destinyNumbers(birth: string, gender?: string): LuckyNumbers {
  const seed = hashString(`destiny|${birth}|${gender ?? ""}`);
  return toDetails(pickUnique(seed, LOTTO_PICK, LOTTO_MAX), "사주 운명번호");
}

/**
 * 이번주 행운번호 — 같은 사람이라도 회차마다 다른 번호(주간 재방문 훅).
 * @param round 로또 회차(정수)
 */
export function weeklyLucky(birth: string, round: number, gender?: string): LuckyNumbers {
  const seed = hashString(`weekly|${birth}|${gender ?? ""}|${round}`);
  return toDetails(pickUnique(seed, LOTTO_PICK, LOTTO_MAX), `이번주 행운번호 (${round}회)`);
}

/**
 * 그냥 뽑기 — 의식(추첨 애니메이션)용. 결정성이 필요 없으므로 호출부에서 시드를 넘긴다
 * (엔진은 순수 유지: Math.random 미사용). 매번 다른 결과를 원하면 매번 다른 seed 전달.
 */
export function quickPick(seed: number): LuckyNumbers {
  return toDetails(pickUnique(seed >>> 0, LOTTO_PICK, LOTTO_MAX), "행운의 뽑기");
}

export interface WinResult {
  /** 1~5등, 미당첨이면 0 */
  rank: number;
  /** 일치한 본번호 개수 */
  matchCount: number;
  /** 보너스 일치 여부(2등 판정용) */
  bonusMatch: boolean;
  /** 일치한 번호들 */
  matchedNumbers: number[];
  label: string;
}

/**
 * 당첨 등수 판정 (로또 6/45 공식 규칙).
 * 1등=6개 / 2등=5개+보너스 / 3등=5개 / 4등=4개 / 5등=3개 / 그 외 미당첨.
 */
export function checkWinning(mine: number[], winning: number[], bonus: number): WinResult {
  const winSet = new Set(winning);
  const matchedNumbers = mine.filter((n) => winSet.has(n));
  const matchCount = matchedNumbers.length;
  const bonusMatch = mine.includes(bonus);

  let rank = 0;
  if (matchCount === 6) rank = 1;
  else if (matchCount === 5 && bonusMatch) rank = 2;
  else if (matchCount === 5) rank = 3;
  else if (matchCount === 4) rank = 4;
  else if (matchCount === 3) rank = 5;

  const label =
    rank === 0 ? "아쉽게 미당첨" : rank === 1 ? "1등!" : `${rank}등`;

  return { rank, matchCount, bonusMatch, matchedNumbers, label };
}

/** 로또공 색 구간(동행복권 관습) — 화면 표시용 */
export function ballColor(n: number): string {
  if (n <= 10) return "#fbc400"; // 노랑
  if (n <= 20) return "#69c8f2"; // 파랑
  if (n <= 30) return "#ff7272"; // 빨강
  if (n <= 40) return "#aaaaaa"; // 회색
  return "#b0d840"; // 초록
}
