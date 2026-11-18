// 궁합 v2 — 만세 엔진(@manse/engine) computeCompatibility(두 명식 + 점수 + 합충 근거)에
// 풍성한 룰베이스 풀이(분야별·관계 타임라인·갈등팁)를 입혀 경쟁사 상위호환으로.
// ⚠️ 원칙: 계산(간지·합충·오행·신살)은 만세 엔진이 정확. 점수·문장은 해석(과장 OK).
//   완결 분석은 안 함 → 깊은 건 상담 CTA. 결정론적(같은 두 생일 = 같은 결과, 순서 무관).
//   포털→만세엔진 단방향(원칙 준수).
import { computeCompatibility, type CompatibilityResult, type ManseChart } from "@manse/engine";
import { hashString, mulberry32, pickUnique } from "@portal/engine";
import { isValidDate } from "./dateKey.js";
import type { Profile } from "./profile.js";

export type { ManseChart };
export type CompatFactor = CompatibilityResult["compat"]["factors"][number];

export interface CoupleField {
  key: string;
  label: string;
  emoji: string;
  score: number;
  text: string;
}
export interface TimelinePhase {
  label: string;
  emoji: string;
  text: string;
}
export interface SinsalChemi {
  name: string;
  who: string; // "나" | "상대" | "둘 다"
  meaning: string;
  good: boolean;
}
export interface ElementSum {
  element: string; // 목화토금수
  a: number;
  b: number;
  total: number;
  percent: number; // 합산 비율
}
export interface CoupleType {
  name: string;
  emoji: string;
  desc: string;
}
export interface TenGodRel {
  tenGod: string;
  text: string;
}
export interface BondCode {
  name: string; // "천간합" | "일지 육합" ...
  good: boolean;
  strong: boolean; // 핵심 인연 코드 강조
  text: string;
}
export interface PersonStyle {
  who: string;
  title: string;
  text: string;
}
export interface CoupleFortune {
  a: ManseChart;
  b: ManseChart;
  score: number;
  level: string;
  innerScore: number; // 속궁합(일주·사주)
  outerScore: number; // 겉궁합(띠)
  // v3 — 읽을거리·재미
  coupleType: CoupleType;
  hashtags: string[];
  narrative: string[]; // 롱폼 종합 서사
  tenGodToMe: TenGodRel; // 상대는 나에게
  tenGodToPartner: TenGodRel; // 나는 상대에게
  bondCodes: BondCode[]; // 천간합·일지 관계·띠 관계
  loveStyles: PersonStyle[]; // 두 사람 연애 스타일
  treatTips: PersonStyle[]; // 상대를 대하는 법
  crisisSituation: string;
  crisisOvercome: string;
  pastLife: string;
  intimacyScore: number;
  intimacyText: string;
  // 기존
  factors: CompatFactor[];
  elementSums: ElementSum[];
  complementText: string;
  sinsalChemi: SinsalChemi[];
  fields: CoupleField[];
  timeline: TimelinePhase[];
  good: string;
  caution: string;
  conflictTip: string;
  tldr: string;
  luckyNumbers: number[];
}

const EL_ORDER = ["목", "화", "토", "금", "수"];
// 오행 상생(낳음): 목→화→토→금→수→목
const SAENG: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
// 오행 상극(이김): 목→토→수→화→금→목
const GEUK: Record<string, string> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

// ── 지지(0子~11亥) 관계 테이블 ───────────────────────
const inPair = (set: [number, number][], x: number, y: number) => set.some(([m, n]) => (m === x && n === y) || (m === y && n === x));
const BR_YUKHAP: [number, number][] = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
const BR_CHUNG: [number, number][] = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
const BR_WONJIN: [number, number][] = [[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]];
const BR_GWIMUN: [number, number][] = [[0, 9], [1, 6], [2, 7], [3, 8], [4, 11], [5, 10]];
const BR_HAE: [number, number][] = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const SAMHAP: number[][] = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]]; // 신자진水·해묘미木·인오술火·사유축金
const sameSamhap = (x: number, y: number) => x !== y && SAMHAP.some((g) => g.includes(x) && g.includes(y));

// 십성(상대→나 / 나→상대) → 연애 관계 역할 풀이
const TENGOD_ROLE: Record<string, string> = {
  정관: "듬직하게 지켜주고 책임져 주는 사람이에요. 안정감과 신뢰를 주어 '결혼하고 싶은 상대'로 느껴지는 관계예요.",
  편관: "강한 카리스마로 긴장과 설렘을 주는 사람이에요. 짜릿하게 끌리지만 가끔 버겁기도 한, 자극적인 관계예요.",
  정재: "내가 아끼고 챙기게 되는 사람이에요. 현실적이고 알뜰해서 함께 미래를 그리기 좋은 관계예요.",
  편재: "함께 있으면 즐겁고 활기가 도는 사람이에요. 자유롭고 화끈해서 연애가 신나는 관계예요.",
  식신: "편안하고 잘 챙겨주고 싶은 사람이에요. 다정하고 여유로워 마음이 푸근해지는 관계예요.",
  상관: "재치 있고 자극을 주는 사람이에요. 톡톡 튀어 지루할 틈이 없지만, 말로 부딪힐 수도 있는 관계예요.",
  정인: "엄마 품처럼 포근하게 보살펴 주는 사람이에요. 곁에 있으면 심리적으로 안정되는 관계예요.",
  편인: "묘하게 신경 쓰이고 자꾸 끌리는 사람이에요. 독특한 매력에 빠져드는, 알수록 깊은 관계예요.",
  비견: "친구처럼 편하고 잘 통하는 사람이에요. 동등하고 닮은 동지 같아 오래가는 관계예요.",
  겁재: "닮아서 끌리고 또 닮아서 부딪히는 사람이에요. 경쟁심과 애정이 공존하는 다이내믹한 관계예요.",
};
// 오행 → 연애 스타일(천간=표현)
const LOVE_STYLE: Record<string, string> = {
  목: "다정하고 배려심 많은 연애를 해요. 상대를 키우고 챙기는 따뜻한 스타일이에요.",
  화: "표현이 화끈하고 열정적인 연애를 해요. 좋으면 다 표현하는 솔직 담백한 스타일이에요.",
  토: "묵묵하고 한결같은 연애를 해요. 곁을 지키며 신뢰를 쌓는 든든한 스타일이에요.",
  금: "쿨하고 의리 있는 연애를 해요. 단단하고 명확하게 마음을 표현하는 스타일이에요.",
  수: "유연하고 센스 있는 연애를 해요. 분위기를 잘 맞추는 지혜롭고 다정한 스타일이에요.",
};
// 오행 → 그 사람을 대하는 법
const TREAT_BY_EL: Record<string, string> = {
  목: "자존심을 세워주고 진심으로 응원해 주세요. 인정받는다고 느낄 때 활짝 펴는 사람이에요.",
  화: "리액션과 표현을 아끼지 마세요. 마음이 식은 듯 보이면 금세 서운해하는 사람이에요.",
  토: "약속을 지키고 꾸준함을 보여주세요. 믿음이 쌓일 때 비로소 마음을 여는 사람이에요.",
  금: "쿨하게 존중하고 간섭을 줄여 주세요. 자기 공간을 지켜줄 때 가장 편안해하는 사람이에요.",
  수: "이야기를 끝까지 들어주고 공감해 주세요. 마음을 알아줄 때 깊어지는 사람이에요.",
};

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function deltaOf(factors: CompatFactor[], includes: string): number {
  return factors.filter((f) => f.label.includes(includes)).reduce((s, f) => s + f.delta, 0);
}
function elementCounts(chart: ManseChart): Record<string, number> {
  const c: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const e of chart.analysis.elements) c[e.element] = e.count;
  return c;
}

// 일간 오행 관계 → 성격 케미 (상생/동일/상극/그외)
function dayRelation(a: string, b: string): { kind: "상생" | "동일" | "상극" | "보통"; adjust: number } {
  if (a === b) return { kind: "동일", adjust: 4 };
  if (SAENG[a] === b || SAENG[b] === a) return { kind: "상생", adjust: 11 };
  if (GEUK[a] === b || GEUK[b] === a) return { kind: "상극", adjust: -7 };
  return { kind: "보통", adjust: 0 };
}

// ── 룰 텍스트 풀 (해요체·한자 최소·과장 OK) ─────────────────────────
const FIELD_TEXT: Record<string, [string[], string[], string[]]> = {
  // [상(잘맞음), 중(무난), 하(노력)]
  성격: [
    ["기질이 자연스럽게 맞물려, 함께 있으면 마음이 편안해져요.", "한쪽이 채워주면 다른 쪽이 받쳐주는 결이라 다툼이 적어요."],
    ["성향이 다른 듯하면서도 묘하게 균형이 맞는 사이예요.", "서로의 방식을 인정하면 의외로 합이 잘 맞아요."],
    ["고집의 결이 비슷해 부딪힐 수 있어요. 한 걸음씩 양보가 약이에요.", "표현 방식이 달라 오해가 생기기 쉬워요. 천천히 맞춰가요."],
  ],
  애정: [
    ["끌림이 강하고 애정 표현도 잘 통하는 사이예요.", "함께일수록 설렘이 오래가는 인연이에요."],
    ["은은하게 정이 드는 사랑이에요. 시간이 둘을 가깝게 해줘요.", "표현을 조금만 더하면 애정이 깊어져요."],
    ["마음은 있어도 표현이 엇갈리기 쉬워요. 자주 말해주세요.", "서운함을 쌓지 말고 그때그때 풀면 좋아져요."],
  ],
  금전: [
    ["돈을 대하는 가치관이 잘 맞아, 함께 모으는 힘이 좋아요.", "한 사람이 벌고 한 사람이 지키는 균형이 살아 있어요."],
    ["소비 성향이 조금 다르지만 대화로 맞추면 충분해요.", "큰 지출은 함께 정하면 마찰이 줄어요."],
    ["돈 쓰는 방식이 달라 신경전이 생길 수 있어요. 규칙을 정해요.", "공동 통장·예산을 정하면 갈등이 크게 줄어요."],
  ],
  결혼생활: [
    ["오래 함께해도 단단한, 가정운이 좋은 짝이에요.", "생활의 리듬이 잘 맞아 안정적인 가정을 꾸려요."],
    ["서로 맞춰가는 시간이 필요하지만 충분히 단단해져요.", "역할을 나누면 생활이 훨씬 편안해져요."],
    ["생활 습관 차이로 부딪힐 수 있어요. 작은 규칙이 큰 도움이 돼요.", "기대를 솔직히 나누면 결혼 후가 훨씬 수월해져요."],
  ],
};

const TL_FIRST = {
  hi: ["처음 본 순간부터 묘하게 끌리는 기운이에요. 첫인상이 강하게 남아요.", "만나자마자 편안함을 느끼는, 시작이 좋은 인연이에요."],
  mid: ["서서히 눈이 가는 사이예요. 알아갈수록 매력이 보여요.", "처음엔 평범해도 두세 번 보면 마음이 열려요."],
  lo: ["첫인상은 서로 조심스러워요. 시간을 두면 진가가 드러나요.", "처음엔 거리감이 있지만, 그게 오히려 설렘이 돼요."],
};
const TL_LOVE = {
  hi: ["연애할수록 합이 잘 맞아 다툼이 적고 즐거움이 커져요.", "서로를 끌어당기는 힘이 강해, 사랑이 깊어지는 시기예요."],
  mid: ["속도를 맞춰가는 연애예요. 솔직한 대화가 관계를 키워요.", "밀당보다 진심이 통하는 사이. 표현이 열쇠예요."],
  lo: ["연애 중 작은 오해가 생기기 쉬워요. 자주 마음을 확인해요.", "서로 다른 연애 방식을 인정하면 한결 편해져요."],
};
const TL_MARRY = {
  hi: ["결혼 후 가정운이 좋아, 함께일수록 자리가 잡혀요.", "생활이 안정되고 서로를 든든하게 받쳐주는 가정이 돼요."],
  mid: ["결혼 후 역할을 나누면 점점 단단해지는 가정이에요.", "생활 리듬을 맞추는 초반만 지나면 평온해져요."],
  lo: ["결혼 후 생활 차이가 드러날 수 있어요. 규칙과 배려가 필요해요.", "서로의 가정문화를 존중하면 갈등이 크게 줄어요."],
};
const GOOD_POOL = [
  "가치관의 결이 비슷해 큰 다툼이 적어요.",
  "위기에서 서로를 챙기는 힘이 있어요.",
  "함께 있을 때 마음이 편안해지는 사이예요.",
  "서로의 장점을 잘 알아봐 줘요.",
];
const CAUTION_POOL = [
  "각자의 시간을 존중하지 않으면 답답해질 수 있어요.",
  "표현이 서툴러 마음이 엇갈릴 때가 있어요.",
  "비슷한 고집이 부딪힐 수 있으니 한 번씩 양보가 필요해요.",
];
const CONFLICT_POOL = [
  "서운함은 쌓지 말고 그날 안에 가볍게 풀어요.",
  "다툴 땐 '문제'를 말하고 '사람'을 탓하지 않기로 약속해요.",
  "한 사람이 흥분하면 다른 사람이 잠시 멈춰주는 신호를 정해요.",
];

// 관계에서 의미 있는 신살 → 케미 해석 (길성/흉살 구분)
const SINSAL_CHEMI: Record<string, { meaning: string; good: boolean }> = {
  도화살: { meaning: "매력·인기 — 서로에게 설렘을 주는 기운", good: true },
  홍염살: { meaning: "은근한 매력 — 끌림이 오래가요", good: true },
  천을귀인: { meaning: "귀인 — 서로에게 복을 부르는 인연", good: true },
  월덕귀인: { meaning: "덕 — 어려울 때 서로를 돕는 기운", good: true },
  천덕귀인: { meaning: "덕 — 마음이 따뜻하게 통해요", good: true },
  역마살: { meaning: "이동·활동 — 함께 다니면 즐거운 사이", good: true },
  화개살: { meaning: "예술·깊이 — 대화가 통하는 기운", good: true },
  양인살: { meaning: "강한 기운 — 가끔 부딪힐 수 있어 배려 필요", good: false },
  백호살: { meaning: "강렬함 — 감정이 격해질 땐 한 박자 쉬어요", good: false },
  괴강살: { meaning: "강한 개성 — 서로 존중하면 큰 힘이 돼요", good: false },
  귀문관살: { meaning: "예민함 — 말 한마디에 민감할 수 있어요", good: false },
};

function relevantSinsal(chart: ManseChart, who: string): SinsalChemi[] {
  const out: SinsalChemi[] = [];
  const seen = new Set<string>();
  for (const s of chart.analysis.sinsal) {
    const m = SINSAL_CHEMI[s.name];
    if (m && !seen.has(s.name)) {
      seen.add(s.name);
      out.push({ name: s.name, who, meaning: m.meaning, good: m.good });
    }
  }
  return out;
}

/** "YYYY-MM-DD"(양력) + 선택 시각 → 엔진 birth 문자열. */
function profileBirth(p: Profile): { birth: string; unknownHour: boolean; gender: "M" | "F"; lon: number } {
  const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
  return { birth: `${p.birth}T${time ?? "12:00"}`, unknownHour: !time, gender: p.gender ?? "M", lon: p.lon ?? 127.5 };
}

/**
 * 궁합 v2 — 나(프로필) + 상대 생년월일("YYYY-MM-DD") → 풍성한 궁합 풀이.
 * 상대는 생일만 받음(시각 모름) — 상대 성별은 내 반대로 가정(대운 방향용, 점수엔 무관).
 */
export function buildCoupleFortune(profile: Profile, partnerBirth: string): CoupleFortune | null {
  if (!profile?.birth || !isValidDate(profile.birth) || !isValidDate(partnerBirth)) return null;
  const me = profileBirth(profile);
  const partnerGender: "M" | "F" = me.gender === "M" ? "F" : "M";

  let res: CompatibilityResult;
  try {
    res = computeCompatibility(
      { birth: me.birth, gender: me.gender, unknownHour: me.unknownHour, longitude: me.lon, calendar: "solar" },
      { birth: `${partnerBirth}T12:00`, gender: partnerGender, unknownHour: true, calendar: "solar" },
    );
  } catch {
    return null;
  }

  const { a, b, compat } = res;
  const factors = compat.factors;
  const seed = hashString(`couplev2|${[profile.birth, partnerBirth].sort().join("|")}`);
  const rnd = mulberry32(seed);

  // 속궁합(일주·사주) / 겉궁합(띠)
  const innerScore = clamp(50 + deltaOf(factors, "일간 관계") + deltaOf(factors, "일지"));
  const outerScore = clamp(50 + deltaOf(factors, "띠") + deltaOf(factors, "오행 상호보완") * 0.5);

  // 오행 상보 그래프(두 사람 합산)
  const ca = elementCounts(a);
  const cb = elementCounts(b);
  const totalAll = EL_ORDER.reduce((s, el) => s + ca[el]! + cb[el]!, 0) || 1;
  const elementSums: ElementSum[] = EL_ORDER.map((el) => ({
    element: el,
    a: ca[el]!,
    b: cb[el]!,
    total: ca[el]! + cb[el]!,
    percent: Math.round(((ca[el]! + cb[el]!) / totalAll) * 100),
  }));
  // 상보 카피 — 한쪽이 0인데 상대가 채워주는 오행
  const complements: string[] = [];
  for (const el of EL_ORDER) {
    if (ca[el] === 0 && cb[el]! > 0) complements.push(`부족한 ${el} 기운을 상대가 채워줘요`);
    else if (cb[el] === 0 && ca[el]! > 0) complements.push(`상대의 부족한 ${el} 기운을 내가 채워줘요`);
  }
  const complementText = complements.length
    ? complements.slice(0, 2).join(" · ")
    : "두 사람의 오행이 고르게 어우러져 균형이 좋아요.";

  // 신살 케미
  const chemiRaw = [...relevantSinsal(a, "나"), ...relevantSinsal(b, "상대")];
  const merged = new Map<string, SinsalChemi>();
  for (const c of chemiRaw) {
    const ex = merged.get(c.name);
    if (ex) ex.who = "둘 다";
    else merged.set(c.name, { ...c });
  }
  const sinsalChemi = [...merged.values()];

  // 분야별 4
  const rel = dayRelation(a.pillars.day.stem.element, b.pillars.day.stem.element);
  const dohwa = sinsalChemi.some((s) => s.name === "도화살" || s.name === "홍염살");
  const jaeseong = deltaOf(factors, "정재") + deltaOf(factors, "편재") > 0 || factors.some((f) => /정재|편재/.test(f.label));
  const ilji = deltaOf(factors, "일지");
  const ttiDelta = deltaOf(factors, "띠");
  const band = (s: number) => (s >= 72 ? 0 : s >= 58 ? 1 : 2);
  function fieldText(key: string, s: number): string {
    const [hi, mid, lo] = FIELD_TEXT[key]!;
    return pick([hi, mid, lo][band(s)]!, rnd);
  }
  const sc성격 = clamp(compat.score + rel.adjust + (rnd() * 8 - 4));
  const sc애정 = clamp(compat.score + ilji * 0.8 + (dohwa ? 6 : 0) + (rnd() * 8 - 4));
  const sc금전 = clamp(compat.score + (jaeseong ? 8 : -2) + (rnd() * 8 - 4));
  const sc결혼 = clamp(compat.score * 0.5 + innerScore * 0.5 + ilji * 0.4 + (rnd() * 6 - 3));
  const fields: CoupleField[] = [
    { key: "성격", label: "성격 케미", emoji: "🧩", score: sc성격, text: fieldText("성격", sc성격) },
    { key: "애정", label: "애정·연애", emoji: "💗", score: sc애정, text: fieldText("애정", sc애정) },
    { key: "금전", label: "금전·재물", emoji: "💰", score: sc금전, text: fieldText("금전", sc금전) },
    { key: "결혼생활", label: "결혼생활", emoji: "🏠", score: sc결혼, text: fieldText("결혼생활", sc결혼) },
  ];

  // 관계 시계열 타임라인 (첫인상→연애→결혼 후)
  const firstBand = ttiDelta > 0 || rel.kind === "상생" ? "hi" : rel.kind === "상극" ? "lo" : "mid";
  const loveBand = compat.score >= 72 ? "hi" : compat.score >= 58 ? "mid" : "lo";
  const marryBand = ilji > 0 ? "hi" : ilji < 0 ? "lo" : "mid";
  const timeline: TimelinePhase[] = [
    { label: "첫인상", emoji: "✨", text: pick(TL_FIRST[firstBand], rnd) },
    { label: "연애 시절", emoji: "💞", text: pick(TL_LOVE[loveBand], rnd) },
    { label: "결혼 후 가정운", emoji: "🏡", text: pick(TL_MARRY[marryBand], rnd) },
  ];

  // 좋은점 / 조심할점 / 갈등 대처법
  const topPos = factors.filter((f) => f.delta > 0).sort((x, y) => y.delta - x.delta)[0];
  const topNeg = factors.filter((f) => f.delta < 0).sort((x, y) => x.delta - y.delta)[0];
  const good = topPos ? `${topPos.label.replace(/^.*— /, "")} — ${pick(GOOD_POOL, rnd)}` : pick(GOOD_POOL, rnd);
  const caution = topNeg ? `${topNeg.label.replace(/^.*— /, "")} — ${pick(CAUTION_POOL, rnd)}` : pick(CAUTION_POOL, rnd);
  const hasChung = factors.some((f) => f.label.includes("충"));
  const conflictTip = hasChung
    ? "두 사람은 가끔 부딪히는 기운이 있어요. " + pick(CONFLICT_POOL, rnd)
    : pick(CONFLICT_POOL, rnd);

  const tldr =
    compat.score >= 80
      ? "한마디로, 오래갈 천생연분이에요 🍀"
      : compat.score >= 65
        ? "한마디로, 노력보다 끌림이 앞서는 좋은 인연이에요 💕"
        : compat.score >= 50
          ? "한마디로, 알아갈수록 깊어지는 사이예요 🌱"
          : "한마디로, 서로 배워가며 단단해지는 인연이에요 🤝";

  const luckyNumbers = pickUnique((seed ^ 0x5bd1e995) >>> 0, 3, 45);

  // ── v3: 읽을거리·재미 ───────────────────────────────
  const meEl = a.pillars.day.stem.element;
  const partnerEl = b.pillars.day.stem.element;
  const dsA = a.pillars.day.stem.index;
  const dsB = b.pillars.day.stem.index;
  const dbA = a.pillars.day.branch.index;
  const dbB = b.pillars.day.branch.index;
  const ybA = a.pillars.year.branch.index;
  const ybB = b.pillars.year.branch.index;
  const myName = profile.name?.trim() || "나";

  // 일간 십성 양방향 (관계의 핵심)
  const fToMe = factors.find((f) => f.label.includes("상대에게"));
  const fToPartner = factors.find((f) => f.label.includes("나에게"));
  const tgAB = fToMe ? fToMe.label.split("상대에게 ")[1]! : "비견";
  const tgBA = fToPartner ? fToPartner.label.split("나에게 ")[1]! : "비견";
  const tenGodToMe: TenGodRel = { tenGod: tgAB, text: `상대는 당신에게 ${TENGOD_ROLE[tgAB] ?? "특별한 의미를 주는 사람이에요."}` };
  const tenGodToPartner: TenGodRel = { tenGod: tgBA, text: `당신은 상대에게 ${TENGOD_ROLE[tgBA] ?? "특별한 의미를 주는 사람이에요."}` };

  // 인연 코드 (천간합 · 일지 관계 · 띠 관계)
  const bondCodes: BondCode[] = [];
  if (Math.abs(dsA - dsB) === 5) bondCodes.push({ name: "천간합 (일간)", good: true, strong: true, text: "두 사람의 일간이 천간합으로 묶였어요. 자석처럼 끌리는 찰떡 인연 — 말하지 않아도 통하는 깊은 합이에요." });
  // 일지(속마음·배우자궁) — 우선순위 1개
  if (dbA === dbB) bondCodes.push({ name: "일지 동일", good: true, strong: false, text: "일지가 같아요 — 닮은꼴 데칼코마니. 취향도 속마음도 잘 통하지만, 똑 닮아서 가끔 부딪히기도 해요." });
  else if (inPair(BR_YUKHAP, dbA, dbB)) bondCodes.push({ name: "일지 육합", good: true, strong: true, text: "일지가 육합 — 속궁합 최고의 합이에요. 몸도 마음도 착 붙는, 함께 있으면 한없이 편안한 천생연분 기운이에요." });
  else if (sameSamhap(dbA, dbB)) bondCodes.push({ name: "일지 삼합", good: true, strong: true, text: "일지가 삼합 — 같은 목표를 향해 손잡는 환상의 팀워크예요. 함께할수록 시너지가 커지는 사이예요." });
  else if (inPair(BR_CHUNG, dbA, dbB)) bondCodes.push({ name: "일지 충", good: false, strong: true, text: "일지가 충 — 불꽃 튀는 애증의 케미예요. 강하게 끌리지만 부딪힘도 커서, 밀당과 화해가 잦은 다이내믹한 사이예요." });
  else if (inPair(BR_WONJIN, dbA, dbB)) bondCodes.push({ name: "일지 원진", good: false, strong: true, text: "일지가 원진 — 이유 없이 신경 쓰이고 미운 정 고운 정 드는 묘한 관계예요. 애증이 깊어 헤어지기 힘든 사이예요." });
  else if (inPair(BR_GWIMUN, dbA, dbB)) bondCodes.push({ name: "일지 귀문", good: false, strong: false, text: "일지가 귀문 — 텔레파시처럼 통하지만 예민하게 부딪히기도 하는 독특한 인연이에요." });
  else if (inPair(BR_HAE, dbA, dbB)) bondCodes.push({ name: "일지 해", good: false, strong: false, text: "일지가 해 — 작은 오해가 생기기 쉬우니, 표현을 자주 하면 훨씬 좋아지는 사이예요." });
  // 띠(겉궁합)
  if (inPair(BR_YUKHAP, ybA, ybB)) bondCodes.push({ name: "띠 육합", good: true, strong: false, text: "띠끼리 육합 — 첫인상부터 편안하고 잘 맞는 띠 궁합이에요." });
  else if (sameSamhap(ybA, ybB)) bondCodes.push({ name: "띠 삼합", good: true, strong: false, text: "띠끼리 삼합 — 죽이 잘 맞는 단짝 띠 궁합이에요." });
  else if (inPair(BR_CHUNG, ybA, ybB)) bondCodes.push({ name: "띠 충", good: false, strong: false, text: "띠끼리 충 — 성향이 정반대라 신선하지만, 가끔 티격태격하는 띠 궁합이에요." });
  if (bondCodes.length === 0) bondCodes.push({ name: "담백한 인연", good: true, strong: false, text: "강한 합·충은 약하지만, 그래서 더 천천히 스며들 듯 깊어지는 담백한 인연이에요." });

  const hasHapBond = bondCodes.some((c) => /천간합|육합|삼합/.test(c.name));
  const hasChungBond = bondCodes.some((c) => /충|원진|귀문/.test(c.name));

  // 궁합 유형 캐릭터
  let coupleType: CoupleType;
  if (compat.score >= 82) coupleType = { name: "천생연분형", emoji: "💞", desc: "전생부터 이어진 듯 깊게 통하는, 만나야 할 운명의 짝이에요." };
  else if (compat.score >= 68) coupleType = hasHapBond ? { name: "찰떡 케미형", emoji: "🧲", desc: "자석처럼 끌려 척하면 척, 함께 있으면 시간 가는 줄 모르는 사이예요." } : { name: "단짝 연인형", emoji: "🌷", desc: "잔잔하지만 단단하게 정이 쌓이는, 오래갈 든든한 사이예요." };
  else if (compat.score >= 55) coupleType = hasChungBond ? { name: "애증 밀당형", emoji: "🔥", desc: "끌림도 부딪힘도 강한, 한순간도 지루할 틈 없는 다이내믹한 사이예요." } : { name: "성장하는 연인형", emoji: "🌱", desc: "알아갈수록 깊어지는, 함께 자라며 단단해지는 사이예요." };
  else coupleType = { name: "노력으로 빛나는형", emoji: "💪", desc: "다름이 많지만 그만큼 배울 게 많은, 맞춰갈수록 빛나는 사이예요." };

  // 케미 해시태그
  const tagSet = new Set<string>();
  if (hasHapBond) { tagSet.add("#천생연분"); tagSet.add("#티키타카"); }
  if (hasChungBond) { tagSet.add("#불꽃케미"); tagSet.add("#미운정고운정"); }
  if (/삼합/.test(bondCodes.map((c) => c.name).join())) tagSet.add("#환상의팀");
  if (complements.length) tagSet.add("#서로채워줌");
  const TAG_BY_TG: Record<string, string> = { 정관: "#듬직한사람", 편관: "#치명적매력", 정재: "#현실연애", 편재: "#설레는연애", 식신: "#편안한사이", 상관: "#밀당고수", 정인: "#포근한사람", 편인: "#묘한끌림", 비견: "#베프같은연인", 겁재: "#닮은꼴" };
  if (TAG_BY_TG[tgAB]) tagSet.add(TAG_BY_TG[tgAB]!);
  if (dohwa) tagSet.add("#매력폭발");
  const hashtags = [...tagSet].slice(0, 5);
  if (hashtags.length < 2) hashtags.push("#알아갈수록", "#담백한인연");

  // 연애 스타일 / 상대 대하는 법
  const loveStyles: PersonStyle[] = [
    { who: myName, title: `${myName}의 연애 스타일`, text: LOVE_STYLE[meEl] ?? "" },
    { who: "상대", title: "상대의 연애 스타일", text: LOVE_STYLE[partnerEl] ?? "" },
  ];
  const treatTips: PersonStyle[] = [
    { who: "", title: "💗 상대의 마음을 여는 법", text: TREAT_BY_EL[partnerEl] ?? "" },
    { who: "", title: "💝 내 마음이 열리는 법", text: TREAT_BY_EL[meEl] ?? "" },
  ];

  // 위기와 극복
  let crisisSituation: string;
  let crisisOvercome: string;
  if (hasChungBond) {
    crisisSituation = "한 번 부딪히면 감정이 크게 폭발하는 게 위기예요. 자존심 싸움으로 번지면 상처가 깊어질 수 있어요.";
    crisisOvercome = "화가 날 땐 잠시 거리를 두었다가, 진정된 뒤 '너 때문에'가 아니라 '나는 이렇게 느꼈어'로 말해보세요. 부딪힘이 오히려 더 단단한 사이를 만들어요.";
  } else if (complements.length === 0) {
    crisisSituation = "너무 닮아 권태가 오거나, 사소한 일로 은근히 경쟁하는 게 위기예요.";
    crisisOvercome = "각자의 취미와 공간을 인정하고, 새로운 경험을 함께 만들어 보세요. 닮은 만큼 함께하면 시너지가 폭발해요.";
  } else if (rel.kind === "상극") {
    crisisSituation = "가치관 차이로 자존심 싸움이 나기 쉬운 게 위기예요.";
    crisisOvercome = "이기려 하기보다 '다름'을 인정하면, 서로의 빈 곳을 채우는 최고의 파트너가 돼요.";
  } else {
    crisisSituation = "큰 위기는 적지만, 익숙함에 표현이 줄어드는 권태가 올 수 있어요.";
    crisisOvercome = "작은 이벤트와 자주 하는 표현으로 설렘을 채우면, 오래오래 가는 사이가 돼요.";
  }

  // 전생 인연
  const pastLife = hasHapBond
    ? "전생에 두 사람은 끝내 약속을 지킨 연인이었어요. 못다 한 인연이 이번 생에 다시 이어진 거예요. 그래서 처음부터 낯익고 편안한 거랍니다."
    : hasChungBond
      ? "전생에 두 사람은 서로에게 빚이 있던 사이였어요. 그 마음을 갚으러 이번 생에 다시 만난, 풀어야 할 숙제 같은 깊은 인연이에요."
      : pick(
          [
            "전생에 두 사람은 스쳐 지나간 인연이었어요. 못다 나눈 이야기를 이번 생에 마저 나누려 다시 만난 거예요.",
            "전생에 두 사람은 먼 길을 함께한 길동무였어요. 그 인연의 끈이 이번 생까지 이어졌어요.",
          ],
          rnd,
        );

  // 속궁합 케미 (브랜드 안전선 — 표현·친밀감 중심)
  const intimacyScore = clamp(innerScore + (hasHapBond ? 6 : hasChungBond ? 4 : 0));
  const intimacyText = bondCodes.some((c) => /육합|삼합/.test(c.name))
    ? "마음도 표현도 잘 통하는 편이에요. 함께 있을 때 편안함과 설렘이 공존해, 애정 표현이 자연스러운 사이예요."
    : bondCodes.some((c) => /충/.test(c.name))
      ? "강하게 끌리는 불꽃 케미예요. 표현이 격정적이라 권태가 적고, 다툰 뒤에도 금세 다시 가까워져요."
      : bondCodes.some((c) => /원진|귀문/.test(c.name))
        ? "묘하게 끌리고 신경 쓰이는 사이예요. 츤데레처럼 밀당하다가 더 깊어지는 케미예요."
        : "서로 맞춰갈수록 깊어지는 스타일이에요. 솔직한 표현이 친밀감을 차곡차곡 키워줘요.";

  // 롱폼 종합 서사 (10문단) — 사주 데이터를 흐르는 이야기로. 개별 섹션은 항목별 상세, 여긴 큰 그림·통찰.
  const narrative: string[] = [
    `두 사람은 '${coupleType.name}'이에요. ${compat.level}으로 ${compat.score}점이 나왔어요. ${coupleType.desc}`,
    compat.score >= 80
      ? `처음 만났을 때부터 두 사람 사이엔 설명하기 어려운 끌림이 흘렀을 거예요. 사주가 그리는 인연의 선이 자연스럽게 둘을 가깝게 이어주거든요. 우연처럼 보이는 만남도, 들여다보면 우연이 아닌 경우가 많아요.`
      : compat.score >= 65
        ? `처음엔 천천히, 하지만 알아갈수록 '이 사람 참 편하다'는 느낌이 커지는 사이예요. 불꽃처럼 타오르기보다 은근하게 스며드는 인연이라, 시간이 두 사람의 편이에요.`
        : `처음엔 서로 다른 결 때문에 조금 낯설 수 있어요. 하지만 그 다름이 오히려 서로를 채워주는 인연이에요. 익숙해질수록 '내게 없는 걸 가진 사람'이라는 매력을 발견하게 돼요.`,
    `두 사람 사이에서 가장 중요한 건 서로가 서로에게 '어떤 존재인가'예요. ${tenGodToMe.text}`,
    `그리고 당신은 상대에게 또 다른 의미를 지녀요. ${tenGodToPartner.text} 이렇게 두 사람은 서로 다른 역할을 주고받으며 한 폭의 그림을 함께 완성해가는 사이예요.`,
    `사주에는 두 사람을 잇는 인연의 매듭이 새겨져 있어요. ${bondCodes[0]!.text}`,
    `궁합은 두 겹으로 봐요. 첫인상과 분위기를 보는 '겉궁합'은 ${outerScore}점, 속마음과 깊은 결을 보는 '속궁합'은 ${innerScore}점이에요. ${innerScore >= outerScore ? "겉보다 속이 더 잘 맞는, 알수록 깊어지는 사이예요. 시간이 지날수록 진가가 드러나죠." : "첫인상의 설렘과 끌림이 강한 사이예요. 그 두근거림을 깊은 신뢰로 천천히 익혀가면 더없이 좋아요."}`,
    `${complementText}`,
    compat.score >= 70
      ? `함께 있을 때 두 사람은 가장 편안한 자기 자신이 돼요. 특별한 걸 하지 않아도 곁에 있는 것만으로 충전이 되는, 그런 공기를 가진 사이죠. 같이 밥 먹고 같이 걷는 평범한 시간이 가장 행복하게 느껴질 거예요.`
      : `함께 있을 때 두 사람은 서로에게 좋은 자극이자 거울이 돼요. 닮은 점에서 안정감을, 다른 점에서 성장을 얻죠. 가끔 삐걱대도 그만큼 서로를 더 알아가는 과정이에요.`,
    hasChungBond
      ? `다만 두 사람 사이엔 부딪히는 기운(충·沖)도 있어요. 가끔 불꽃이 튀고 신경전이 벌어지지만, 그건 그만큼 서로에게 무관심할 수 없다는 증거예요. 돌려 말하지 말고 솔직하게 표현하고 한 발씩 물러서면, 그 부딪힘이 오히려 관계를 더 단단하게 다져줘요.`
      : `두 사람은 큰 풍파 없이 서로를 채워주는 인연이라, 관계가 잔잔하고 안정적이에요. 다만 너무 편안한 나머지 표현을 아끼게 되기 쉬우니, 작은 고마움과 애정을 그때그때 말로 전하면 정이 더 깊어져요.`,
    `시간이 흐를수록 두 사람의 인연은 ${compat.score >= 75 ? "더 단단하고 깊어질 거예요. 첫 설렘이 신뢰로, 신뢰가 다시 평생의 동반자 정으로 익어가는 귀한 사이예요." : "천천히, 그러나 분명히 깊어질 거예요. 서로의 속도를 존중하고 마음을 자주 나눈다면, 오래도록 곁에 두고 싶은 인연이 돼요."} 사주는 두 사람 인연의 밑그림일 뿐이에요. 그 위에 어떤 그림을 그릴지는, 결국 두 사람의 마음에 달려 있답니다.`,
  ];

  return {
    a,
    b,
    score: compat.score,
    level: compat.level,
    innerScore,
    outerScore,
    coupleType,
    hashtags,
    narrative,
    tenGodToMe,
    tenGodToPartner,
    bondCodes,
    loveStyles,
    treatTips,
    crisisSituation,
    crisisOvercome,
    pastLife,
    intimacyScore,
    intimacyText,
    factors,
    elementSums,
    complementText,
    sinsalChemi,
    fields,
    timeline,
    good,
    caution,
    conflictTip,
    tldr,
    luckyNumbers,
  };
}
