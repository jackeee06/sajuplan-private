// 가벼운 재미 운세 — 포춘쿠키 · 꽃잎점 · 혈액형 궁합. 결정론적(같은 입력=같은 결과).
import { hashString, mulberry32 } from "./seed.js";

// ── 포춘쿠키 ──────────────────────────────────────────────
const COOKIE_MSG = [
  "망설이던 일에 답이 보이는 하루예요.",
  "오늘의 작은 친절이 큰 행운으로 돌아옵니다.",
  "미뤄둔 연락 한 통이 좋은 소식을 부릅니다.",
  "지갑보다 마음을 먼저 여는 날, 인복이 따라요.",
  "조급함을 내려놓으면 길이 절로 열립니다.",
  "오늘 만난 사람 중에 귀인이 숨어 있어요.",
  "작은 결심이 내일의 큰 변화를 만듭니다.",
  "웃는 얼굴에 복이 모이는 하루입니다.",
  "용기 내어 한 걸음, 그게 정답이에요.",
  "기다리던 기회가 생각보다 가까이 있어요.",
  "오늘은 직감을 믿어도 좋은 날입니다.",
  "버린다고 생각한 것에서 보물이 나옵니다.",
  "느긋하게 가도 늦지 않아요. 흐름을 타세요.",
  "마음먹은 일을 시작하기 딱 좋은 타이밍.",
  "오늘의 정성은 반드시 알아주는 사람이 있어요.",
  "사소한 행운이 줄지어 찾아오는 하루.",
  "고민하던 선택, 첫 마음이 정답입니다.",
  "오래 묵은 오해가 풀릴 기회가 와요.",
  "베푼 만큼 두 배로 돌아오는 날입니다.",
  "오늘 흘린 땀은 가까운 날 빛이 됩니다.",
  "한 박자 쉬어가도 괜찮아요. 운이 채워집니다.",
  "예상 밖의 칭찬이나 인정이 따르는 하루.",
  "작은 도전이 의외의 행운을 부릅니다.",
  "마음의 문을 열면 좋은 인연이 들어와요.",
];
const COOKIE_ACT = [
  "오늘 미뤘던 연락 한 통 보내기",
  "감사 인사를 먼저 건네기",
  "평소 안 가던 길로 걸어보기",
  "작은 선물이나 커피 한 잔 사기",
  "오래 미룬 일 딱 10분만 시작하기",
  "거울 보고 한 번 활짝 웃기",
  "초록색 소품을 곁에 두기",
  "물 한 잔 더 마시고 깊게 숨쉬기",
];

export interface FortuneCookie { message: string; action: string; lucky: number; }
export function fortuneCookie(seedKey: string): FortuneCookie {
  const seed = hashString(`cookie|${seedKey}`);
  const r = mulberry32(seed);
  return {
    message: COOKIE_MSG[Math.floor(r() * COOKIE_MSG.length)]!,
    action: COOKIE_ACT[Math.floor(r() * COOKIE_ACT.length)]!,
    lucky: 1 + Math.floor(r() * 45),
  };
}

// ── 꽃잎점 ────────────────────────────────────────────────
const PETAL_RESULTS: { label: string; emoji: string; line: string; min: number }[] = [
  { label: "운명적으로 끌려요", emoji: "💞", line: "두 사람 사이에 보이지 않는 인연의 실이 단단해요.", min: 88 },
  { label: "많이 좋아해요", emoji: "💗", line: "표현이 서툴 뿐, 마음은 이미 당신을 향하고 있어요.", min: 72 },
  { label: "은근히 신경 써요", emoji: "💛", line: "겉으론 무심해도 속으론 자꾸 떠올리고 있어요.", min: 55 },
  { label: "조금씩 가까워져요", emoji: "🌱", line: "지금처럼 천천히, 곧 마음이 통할 거예요.", min: 38 },
  { label: "친구로 편하게 봐요", emoji: "🤝", line: "서두르기보다 함께한 시간을 쌓아보세요.", min: 0 },
];
export interface Petal { percent: number; label: string; emoji: string; line: string; petals: number; }
export function petalOracle(seedKey: string): Petal {
  const seed = hashString(`petal|${seedKey}`);
  const r = mulberry32(seed);
  const percent = 18 + Math.floor(r() * 82); // 18~99
  const res = PETAL_RESULTS.find((p) => percent >= p.min)!;
  const petals = 5 + Math.floor(r() * 4); // 5~8장
  return { percent, label: res.label, emoji: res.emoji, line: res.line, petals };
}

// ── 혈액형 궁합 ────────────────────────────────────────────
export type Blood = "A" | "B" | "O" | "AB";
export const BLOODS: Blood[] = ["A", "B", "O", "AB"];
const BLOOD_TRAIT: Record<Blood, string> = {
  A: "섬세하고 배려 깊은",
  B: "자유롭고 솔직한",
  O: "다정하고 리더십 있는",
  AB: "독특하고 신비로운",
};
// 16조합 기본 점수(전통 혈액형 궁합 통념 기반·재미용)
const BLOOD_SCORE: Record<string, number> = {
  "A-A": 78, "A-B": 62, "A-O": 88, "A-AB": 72,
  "B-A": 62, "B-B": 74, "B-O": 70, "B-AB": 85,
  "O-A": 88, "O-B": 70, "O-O": 66, "O-AB": 76,
  "AB-A": 72, "AB-B": 85, "AB-O": 76, "AB-AB": 80,
};
export interface BloodCompat { score: number; title: string; summary: string; good: string; tip: string; }
export function bloodCompat(me: Blood, you: Blood): BloodCompat {
  const score = BLOOD_SCORE[`${me}-${you}`] ?? 70;
  const title = score >= 85 ? "환상의 케미" : score >= 72 ? "잘 맞는 사이" : score >= 64 ? "노력하면 좋은 사이" : "다름이 매력인 사이";
  return {
    score,
    title,
    summary: `${BLOOD_TRAIT[me]} ${me}형과 ${BLOOD_TRAIT[you]} ${you}형의 만남이에요. ${
      score >= 80 ? "서로의 부족함을 자연스럽게 채워주는 조합입니다." : score >= 68 ? "처음엔 다르게 느껴져도 알아갈수록 편안해지는 사이예요." : "서로의 다름을 인정하면 오래 가는 관계가 됩니다."
    }`,
    good: `${BLOOD_TRAIT[me]} ${me}형의 매력과 ${BLOOD_TRAIT[you]} ${you}형의 매력이 서로를 끌어당겨요.`,
    tip: score >= 80 ? "지금처럼 솔직하게 표현하면 더 단단해져요." : "기대를 살짝 내려놓고 상대의 속도를 존중해 보세요.",
  };
}
