/**
 * 일일운세 — 오늘의 일진(日辰)과 사용자(사주 또는 띠)의 관계로 그날의 운세를 산출.
 *
 * ⚠️ 분리 원칙: 이 패키지는 사주플랜을 모른다. 순수 계산만 한다.
 *
 * 정확도 정책:
 *  - 일진(오늘의 간지)·십성·오행 생극·지지 충합은 검증된 엔진 헬퍼로 정확히 계산한다.
 *  - 점수/문장(풀이)은 명리 관계를 결정론적으로 매핑한 해석이다(마케팅용으로 풍성·단정적).
 *    같은 입력+같은 날짜는 항상 같은 결과(난수 없음).
 */
import {
  ELEMENTS, type Element, type TenGod,
  STEM_ELEMENT, BRANCH_ELEMENT, BRANCH_ANIMAL,
  STEMS_HANJA, STEMS_KO, BRANCHES_HANJA, BRANCHES_KO,
  HIDDEN_STEMS, tenGodOf, generates, controls,
} from "./constants.js";
import { computeFourPillars, type PillarInput } from "./pillars.js";
import { monthDayPillars, firstWeekday, strength, elementDistribution } from "./analysis.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ── 입력 ────────────────────────────────────────────────────────
export interface DailyTargetDate { year: number; month: number; day: number }

export type DailyInput =
  | { mode: "natal"; birth: string; gender: "M" | "F"; unknownHour?: boolean; longitude?: number }
  | { mode: "zodiac"; yearBranch: number }; // 띠 = 연지 index (0=쥐 … 11=돼지)

// ── 출력 ────────────────────────────────────────────────────────
export type DailyFieldKey = "love" | "wealth" | "work" | "health" | "relation" | "move";
export interface DailyField {
  key: DailyFieldKey;
  label: string;
  emoji: string;
  score: number;
  stars: number;
  comment: string;
  tip: string;
}
export type DailySlotGrade = "best" | "good" | "normal" | "caution";
export interface DailyTimeSlot { label: string; range: string; grade: DailySlotGrade; mark: string; note: string }
export interface DailyGuide { dos: string[]; donts: string[] }
export interface DailyZodiacMatch {
  best: { animal: string; emoji: string; reason: string };
  worst: { animal: string; emoji: string; reason: string };
}
export interface DailyLuck {
  element: Element;
  color: string; numbers: number[]; direction: string; time: string; item: string; food: string;
}
export interface DailyChartPillar { label: string; ganzhi: string; ganzhiKo: string; element: Element }
export interface DailyChart {
  pillars: DailyChartPillar[];
  elements: { element: Element; percent: number }[];
  strengthLabel: string;
}
export interface DailyFortune {
  date: string;        // 2026-06-25
  weekday: string;     // 목
  dayGanzhi: string;   // 丙午
  dayGanzhiKo: string; // 병오
  dayElement: Element;
  personalized: boolean;
  subjectLabel: string; // "임수 일간" or "말띠"
  oneLine: string;      // "오늘은 당신에게 '재물과 실속'의 날"
  todayRelation: string; // 오늘 일진이 나에게 어떤 작용인지 (십성 or 오행관계)
  title: string;        // "황금빛 대박 직전형"
  titleEmoji: string;
  hashtags: string[];   // ["#횡재수", "#귀인등장", …]
  percentile: number;   // 상위 N% (작을수록 좋음)
  scenario: string;     // 오늘의 짧은 운세 시나리오
  caution: string;      // 오늘의 주의보
  quote: string;        // 오늘의 명언
  chart: DailyChart | null;  // 정밀모드 미니 사주 명식 (띠 모드면 null)
  lotto: number[];      // 행운 로또번호 6개
  luckySurname: { cons: string; examples: string }; // 오늘 잘 맞는 성씨
  total: { score: number; stars: number; headline: string; lines: string[] };
  fields: DailyField[];
  timeSlots: DailyTimeSlot[];
  guide: DailyGuide;
  luck: DailyLuck;
  zodiacMatch: DailyZodiacMatch;
  basis: string;
}

// ── 지지 관계 (충/육합/삼합) ───────────────────────────────────────
type BranchRel = "삼합" | "육합" | "충" | "중립";
const SIX_HAP: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7], // 자축·인해·묘술·진유·사신·오미
];
const SAM_HAP: ReadonlyArray<readonly number[]> = [
  [8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7], // 신자진·인오술·사유축·해묘미
];
function branchRelation(a: number, b: number): BranchRel {
  if (a === b) return "중립";
  if ((a + 6) % 12 === b) return "충";
  if (SIX_HAP.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "육합";
  if (SAM_HAP.some((g) => g.includes(a) && g.includes(b))) return "삼합";
  return "중립";
}

// ── 매핑 테이블 ────────────────────────────────────────────────
const TG_SCORE: Record<TenGod, number> = {
  비견: 4, 겁재: -5, 식신: 9, 상관: -2, 정재: 12, 편재: 7,
  정관: 12, 편관: -3, 정인: 9, 편인: 3,
};
const LUCK_COLOR: Record<Element, string> = { 목: "초록·연두", 화: "빨강·분홍", 토: "노랑·베이지", 금: "흰색·은색", 수: "파랑·검정" };
const LUCK_DIR: Record<Element, string> = { 목: "동쪽", 화: "남쪽", 토: "중앙·남서", 금: "서쪽", 수: "북쪽" };
const LUCK_NUM: Record<Element, number[]> = { 수: [1, 6], 화: [2, 7], 목: [3, 8], 금: [4, 9], 토: [5, 10] };
const LUCK_TIME: Record<Element, string> = { 목: "오전 5~7시", 화: "낮 11~1시", 토: "오후 1~3시", 금: "오후 5~7시", 수: "밤 9~11시" };
const LUCK_ITEM: Record<Element, string> = { 목: "화분·나무 소품·책", 화: "향초·조명·빨간 액세서리", 토: "도자기·천연석·다이어리", 금: "시계·귀금속·금속 소품", 수: "텀블러·거울·유리 소품" };
const LUCK_FOOD: Record<Element, string> = { 목: "채소·새콤한 과일", 화: "따뜻한 국물·쓴맛 채소", 토: "곡물·달콤한 디저트", 금: "흰살 생선·견과류", 수: "해산물·짭짤한 음식" };

const ANIMAL_EMOJI = ["🐭", "🐮", "🐯", "🐰", "🐲", "🐍", "🐴", "🐑", "🐵", "🐔", "🐶", "🐷"];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const toStars = (score: number) => clamp(Math.round(score / 20), 1, 5);

// ── 문장 생성 ────────────────────────────────────────────────
function headlineOf(score: number): string {
  if (score >= 82) return "활짝 열리는 하루";
  if (score >= 70) return "흐름이 순조로운 하루";
  if (score >= 56) return "무난하게 풀리는 하루";
  if (score >= 42) return "차분히 다지는 하루";
  return "한 박자 쉬어가는 하루";
}
const TG_THEME: Partial<Record<TenGod, string>> = {
  정재: "재물과 실속", 편재: "기회와 활동", 정관: "인정과 책임", 편관: "도전과 돌파",
  식신: "여유와 표현", 상관: "끼와 변화", 정인: "배움과 귀인", 편인: "통찰과 아이디어",
  비견: "동료와 협력", 겁재: "변동과 정리",
};
const TG_ACT: Partial<Record<TenGod, string>> = {
  정재: "재물·실속의 기운이 들어와 차근차근 쌓기 좋은", 편재: "활동적인 재물 기운이 돌아 움직인 만큼 얻는",
  정관: "책임과 인정을 부르는 관운이 들어와 신뢰를 얻기 좋은", 편관: "강한 압박과 도전의 기운이 있어 정면돌파가 통하는",
  식신: "표현과 여유의 기운이 살아나 즐기며 풀어내기 좋은", 상관: "끼와 말의 기운이 강해 튀어도 통하는",
  정인: "배움과 귀인의 기운이 받쳐줘 도움을 얻기 좋은", 편인: "통찰과 아이디어의 기운이 돌아 한 수 앞을 보는",
  비견: "동료·경쟁의 기운이 함께해 사람으로 풀리는", 겁재: "변동과 소비의 기운이 있어 단속이 필요한",
};

function fieldText(key: DailyFieldKey, score: number): { comment: string; tip: string } {
  const i = score >= 67 ? 0 : score >= 50 ? 1 : 2;
  const POOL: Record<DailyFieldKey, { c: [string, string, string]; t: [string, string, string] }> = {
    love: {
      c: ["마음이 통하는 날. 먼저 다가가면 좋은 반응이 옵니다.", "잔잔하게 흐르는 하루, 큰 기대보단 자연스럽게.", "오해가 생기기 쉬우니 말은 한 번 더 고르세요."],
      t: ["저녁에 짧은 연락 한 통이 분위기를 살립니다.", "함께 식사하며 가볍게 안부를 나눠보세요.", "예민한 주제는 오늘 꺼내지 않는 게 안전."],
    },
    wealth: {
      c: ["예상 밖 이득이나 좋은 거래가 따를 수 있어요.", "들고 남이 비슷한 날, 큰 지출은 잠시 보류.", "충동구매·금전 약속은 오늘만큼은 미루세요."],
      t: ["작은 투자·계약은 오전에 결정하면 유리.", "지갑을 닫고 가계부만 정리해도 이득.", "보증·대여 요청은 정중히 미루세요."],
    },
    work: {
      c: ["맡은 일에서 인정받기 좋은 흐름이에요.", "묵묵히 처리하면 무난하게 마무리됩니다.", "실수가 잦을 수 있으니 한 번 더 확인하세요."],
      t: ["중요한 보고·발표는 오늘 밀어붙여 보세요.", "급한 일보다 밀린 일부터 차근차근.", "메일·계약서는 보내기 전 재확인 필수."],
    },
    health: {
      c: ["컨디션이 좋아 활력이 도는 하루예요.", "평범한 컨디션, 과로만 피하면 됩니다.", "피로가 쌓이기 쉬우니 충분히 쉬어가세요."],
      t: ["가벼운 운동으로 기운을 끌어올려 보세요.", "물을 자주 마시고 스트레칭 한 번.", "일찍 자고 카페인은 줄이는 게 좋아요."],
    },
    relation: {
      c: ["사람 복이 있는 날. 좋은 인연·도움이 들어와요.", "무난한 교류의 하루, 평소대로면 충분.", "말 한마디로 틀어지기 쉬우니 톤을 낮추세요."],
      t: ["오래 미룬 연락을 먼저 건네보세요.", "모임은 짧고 가볍게가 정답.", "논쟁이 될 자리는 오늘 피하는 게 상책."],
    },
    move: {
      c: ["이동·계약·새 시작에 기운이 따르는 날.", "큰 변화보단 현 상태 유지가 무난.", "이동·계약은 한 박자 늦추는 편이 안전."],
      t: ["미뤘던 외출·약속을 실행하기 좋아요.", "급한 이사·이직 결정은 며칠 더 살펴보세요.", "서명·이사는 가능하면 다른 날로."],
    },
  };
  return { comment: POOL[key].c[i], tip: POOL[key].t[i] };
}

// 시간대 (사방위·하루 4구간 대표 지지)
const SLOTS: { label: string; range: string; branch: number }[] = [
  { label: "오전", range: "06~12시", branch: 3 }, // 卯 목
  { label: "오후", range: "12~18시", branch: 6 }, // 午 화
  { label: "저녁", range: "18~24시", branch: 9 }, // 酉 금
  { label: "새벽", range: "00~06시", branch: 0 }, // 子 수
];
const GRADE_MARK: Record<DailySlotGrade, string> = { best: "◎", good: "▲", normal: "◇", caution: "▽" };
const GRADE_NOTE: Record<DailySlotGrade, string> = {
  best: "기운이 가장 좋은 때 — 중요한 일은 이때", good: "흐름이 살아나는 때 — 추진에 적기",
  normal: "무난하게 흘러가는 때", caution: "한 박자 쉬어갈 때 — 무리 금물",
};
function slotGrade(slotEl: Element, ref: Element): DailySlotGrade {
  if (slotEl === ref) return "best";
  if (generates(slotEl, ref)) return "good";
  if (controls(slotEl, ref)) return "caution";
  return "normal";
}
function buildTimeSlots(ref: Element): DailyTimeSlot[] {
  return SLOTS.map((s) => {
    const grade = slotGrade(BRANCH_ELEMENT[s.branch]!, ref);
    return { label: s.label, range: s.range, grade, mark: GRADE_MARK[grade], note: GRADE_NOTE[grade] };
  });
}

function buildGuide(luck: DailyLuck, score: number, rel: BranchRel): DailyGuide {
  const dos = [
    `${luck.color} 계열 소지품을 곁에 두기`,
    `중요한 일은 ${luck.direction} 방향·${luck.time}에 처리하기`,
    score >= 68 ? "미뤘던 일을 과감히 밀어붙이기" : "욕심내지 말고 평소 페이스 지키기",
  ];
  const donts = [
    score < 48 ? "큰 계약·금전 결정 미루기" : "직감만 믿고 즉흥적으로 결정하기",
    rel === "충" ? "감정적인 말다툼·충동적인 이동" : "과한 지출과 충동구매",
    "무리한 일정과 늦은 밤 과로",
  ];
  return { dos, donts };
}

function buildZodiacMatch(myBranch: number): DailyZodiacMatch {
  const hap = SIX_HAP.find(([x, y]) => x === myBranch || y === myBranch);
  const hapBranch = hap ? (hap[0] === myBranch ? hap[1] : hap[0]) : myBranch;
  const chung = (myBranch + 6) % 12;
  return {
    best: { animal: BRANCH_ANIMAL[hapBranch]!, emoji: ANIMAL_EMOJI[hapBranch]!, reason: "서로 끌어주고 합이 잘 맞아요" },
    worst: { animal: BRANCH_ANIMAL[chung]!, emoji: ANIMAL_EMOJI[chung]!, reason: "기운이 부딪혀 오늘은 한발 거리 두기" },
  };
}

function makeLuck(el: Element): DailyLuck {
  return { element: el, color: LUCK_COLOR[el], numbers: LUCK_NUM[el], direction: LUCK_DIR[el], time: LUCK_TIME[el], item: LUCK_ITEM[el], food: LUCK_FOOD[el] };
}

// ── 별명·랭킹·해시태그·시나리오·주의보·명언 ──
function titleOf(score: number): [string, string] {
  if (score >= 82) return ["황금빛 대박 직전형", "🐉"];
  if (score >= 70) return ["순풍에 돛 단 형", "🍀"];
  if (score >= 56) return ["잔잔한 호수형", "🌤️"];
  if (score >= 42) return ["돌다리 두드리는 형", "🛡️"];
  return ["재충전이 필요한 형", "🔋"];
}
function percentileOf(score: number): number { return clamp(Math.round((100 - score) * 0.5), 3, 60); }

const TAG_TOP: Record<DailyFieldKey, string> = { wealth: "#횡재수", love: "#썸각", work: "#인정받는날", health: "#컨디션최고", relation: "#귀인등장", move: "#이동수" };
const TAG_LOW: Record<DailyFieldKey, string> = { wealth: "#지출주의", love: "#말조심", work: "#실수주의", health: "#무리금지", relation: "#구설주의", move: "#계약조심" };
function buildHashtags(top: DailyFieldKey, low: DailyFieldKey, rel: BranchRel, score: number): string[] {
  const tags = [TAG_TOP[top]];
  if (score >= 75) tags.push("#오늘은_나의날");
  if (rel === "삼합" || rel === "육합") tags.push("#인연운"); else if (rel === "충") tags.push("#변동수");
  tags.push(TAG_LOW[low]);
  return [...new Set(tags)].slice(0, 4);
}

const SCENARIO: Record<DailyFieldKey, string> = {
  wealth: "뜻밖의 이득이나 좋은 거래 소식이 들려올 수 있어요.",
  love: "무심히 건넨 한마디가 설레는 인연으로 이어질 수 있어요.",
  work: "미뤄둔 일에서 인정받을 결정적 순간이 찾아옵니다.",
  health: "몸이 가벼워져 미뤘던 일에 시동을 걸기 좋아요.",
  relation: "오랜만의 연락이나 귀인의 도움이 닿을 수 있어요.",
  move: "새로운 이동·시작이 뜻밖의 전환점이 될 수 있어요.",
};
function buildScenario(top: DailyFieldKey, slot: string): string { return `${slot} 무렵, ${SCENARIO[top]}`; }

const CAUTION: Record<DailyFieldKey, string> = {
  wealth: "충동구매·금전 약속은 오늘만큼은 미루세요.",
  love: "감정 섞인 말 한마디가 오해를 키울 수 있으니 조심하세요.",
  work: "작은 실수가 커질 수 있으니 마무리 점검은 두 번씩.",
  health: "과로와 늦은 밤 활동이 컨디션을 무너뜨릴 수 있어요.",
  relation: "구설수·말다툼에 휘말리지 않게 입을 가볍게 가세요.",
  move: "성급한 이동·계약은 며칠 더 살펴보는 게 안전합니다.",
};
function buildCaution(low: DailyFieldKey): string { return CAUTION[low]; }

// 행운 로또번호 6개 — 결정론적(난수 없음). 시드는 사람+오늘 일진+점수로 매일·매인 달라짐.
function buildLotto(seed: number): number[] {
  const nums = new Set<number>();
  let s = ((seed % 233280) + 233280) % 233280;
  let guard = 0;
  while (nums.size < 6 && guard++ < 200) {
    s = (s * 9301 + 49297) % 233280;
    nums.add((s % 45) + 1);
  }
  return [...nums].sort((a, b) => a - b);
}

// 행운 오행 → 성씨 자음(성명학 자음오행) + 대표 성씨
const SURNAME: Record<Element, { cons: string; examples: string }> = {
  목: { cons: "ㄱ·ㅋ", examples: "김·고·구·곽" },
  화: { cons: "ㄴ·ㄷ·ㄹ·ㅌ", examples: "이·노·도·류" },
  토: { cons: "ㅇ·ㅎ", examples: "오·안·황·홍" },
  금: { cons: "ㅅ·ㅈ·ㅊ", examples: "서·신·정·최" },
  수: { cons: "ㅁ·ㅂ·ㅍ", examples: "문·박·배·표" },
};

const QUOTES = [
  "오늘의 작은 선택이 내일의 큰 길을 엽니다.",
  "흐르는 물은 바위를 탓하지 않습니다 — 오늘도 유연하게.",
  "준비된 사람에게 운은 기회의 얼굴로 찾아옵니다.",
  "서두르지 않되 멈추지도 않는 하루가 되기를.",
  "빛나는 날엔 겸손이, 흐린 날엔 용기가 당신을 지킵니다.",
];
function quoteOf(score: number): string {
  const i = score >= 80 ? 2 : score >= 64 ? 0 : score >= 48 ? 3 : score >= 32 ? 4 : 1;
  return QUOTES[i]!;
}

function todayPillar(date: DailyTargetDate): { stem: number; branch: number } {
  const cells = monthDayPillars(date.year, date.month);
  const cell = cells.find((c) => c.day === date.day);
  if (!cell) throw new Error(`날짜 범위 오류: ${date.year}-${date.month}-${date.day}`);
  return { stem: cell.stem, branch: cell.branch };
}

// ── 메인 ────────────────────────────────────────────────────────
export function computeDailyFortune(input: DailyInput, date: DailyTargetDate): DailyFortune {
  const { stem: tStem, branch: tBranch } = todayPillar(date);
  const dayElement = STEM_ELEMENT[tStem]!;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
  const weekday = WEEKDAYS[(firstWeekday(date.year, date.month) + (date.day - 1)) % 7]!;
  const dayGanzhi = STEMS_HANJA[tStem]! + BRANCHES_HANJA[tBranch]!;
  const dayGanzhiKo = STEMS_KO[tStem]! + BRANCHES_KO[tBranch]!;

  let total: number;
  let lines: string[];
  let oneLine: string;
  let todayRelation: string;
  let fieldBias: Record<DailyFieldKey, number>;
  let personalized: boolean;
  let subjectLabel: string;
  let luckElement: Element;
  let basis: string;
  let myZodiacBranch: number;
  let rel: BranchRel;
  let chart: DailyChart | null;

  if (input.mode === "natal") {
    personalized = true;
    const pin: PillarInput = {
      year: 0, month: 1, day: 1, hour: 12, minute: 0,
      longitude: input.longitude ?? 127.5, tzOffsetHours: 9, trueSolarTime: true, hourBoundary: "midnight",
    };
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input.birth);
    if (!m) throw new Error(`birth 형식 오류: "${input.birth}" (예: 1990-06-15T07:20)`);
    pin.year = +m[1]!; pin.month = +m[2]!; pin.day = +m[3]!;
    pin.hour = input.unknownHour ? 12 : +m[4]!;
    pin.minute = input.unknownHour ? 0 : +m[5]!;
    const pillars = computeFourPillars(pin);
    const incHour = !input.unknownHour;
    const myStem = pillars.day.stem;
    const myBranch = pillars.day.branch;
    myZodiacBranch = pillars.year.branch;
    const st = strength(pillars, incHour);
    const yongsin = st.yongsin;
    subjectLabel = `${STEMS_KO[myStem]}(${STEM_ELEMENT[myStem]}) 일간`;
    const cp: DailyChartPillar[] = [];
    const pushP = (label: string, p: { stem: number; branch: number }) =>
      cp.push({ label, ganzhi: STEMS_HANJA[p.stem]! + BRANCHES_HANJA[p.branch]!, ganzhiKo: STEMS_KO[p.stem]! + BRANCHES_KO[p.branch]!, element: STEM_ELEMENT[p.stem]! });
    pushP("년", pillars.year); pushP("월", pillars.month); pushP("일", pillars.day);
    if (incHour) pushP("시", pillars.hour);
    chart = { pillars: cp, elements: elementDistribution(pillars, incHour).map((e) => ({ element: e.element, percent: e.percent })), strengthLabel: st.label };

    const tg = tenGodOf(myStem, tStem);
    const hb = HIDDEN_STEMS[tBranch]!;
    const branchTg = tenGodOf(myStem, hb[hb.length - 1]!);

    let s = 50 + TG_SCORE[tg] + TG_SCORE[branchTg] * 0.5;
    if (dayElement === yongsin) s += 14;
    else if (controls(dayElement, yongsin)) s -= 8;
    rel = branchRelation(myBranch, tBranch);
    if (rel === "삼합") s += 12; else if (rel === "육합") s += 9; else if (rel === "충") s -= 12;
    total = clamp(Math.round(s), 12, 96);

    oneLine = `오늘은 당신에게 '${TG_THEME[tg] ?? "전환"}'의 날`;
    todayRelation = `일간 ${STEMS_KO[myStem]}에게 오늘 천간 ${STEMS_KO[tStem]}은(는) ${tg}`;
    lines = [
      `오늘 일진 ${dayGanzhi}은(는) ${TG_ACT[tg] ?? `${dayElement} 기운이 작용하는`} 흐름입니다.`,
      dayElement === yongsin
        ? `특히 오늘 들어온 ${dayElement} 기운이 당신에게 꼭 필요한 용신(${yongsin})과 맞아떨어져, 평소보다 일이 매끄럽게 풀립니다.`
        : controls(dayElement, yongsin)
          ? `다만 오늘 ${dayElement} 기운이 당신의 용신(${yongsin})을 누르는 흐름이라, 무리수보다 안전한 선택이 이롭습니다.`
          : `오늘 ${dayElement} 기운은 당신과 큰 마찰 없이 흘러갑니다.`,
      `사람과의 관계에서는 ${tg === "편관" || tg === "상관" || tg === "겁재" ? "말과 감정을 한 번 누르고 한 발 물러서는 지혜" : "먼저 다가가 마음을 나누는 따뜻한 태도"}가 오늘 특히 빛을 발합니다.`,
      `재물과 일에서는 ${total >= 60 ? "벌여둔 일을 매듭짓고 결실을 거두기에 좋은 날" : "크게 벌이기보다 가진 것을 지키고 다듬는 데 집중할 날"}입니다.`,
      total >= 70 ? "기회가 보이면 망설이지 마세요. 오늘의 결단이 좋은 결과로 이어집니다."
        : total >= 55 ? "큰 변수 없이 흘러가는 하루, 평소의 리듬을 지키면 충분합니다."
          : "서두르면 탈이 납니다. 한 박자 늦추고 컨디션부터 챙기세요.",
    ];

    const has = (set: TenGod[]) => set.includes(tg);
    fieldBias = {
      love: has(["정관", "편관", "정재", "편재"]) ? 9 : has(["비견", "겁재"]) ? -6 : 0,
      wealth: has(["정재", "편재"]) ? 12 : tg === "겁재" ? -9 : tg === "비견" ? -4 : 0,
      work: has(["정관", "정인"]) ? 10 : tg === "상관" ? -9 : tg === "편관" ? 2 : 0,
      health: has(["식신", "정인"]) ? 7 : has(["편관", "상관", "겁재"]) ? -7 : 0,
      relation: has(["식신", "상관", "비견"]) ? 8 : tg === "편관" ? -5 : 0,
      move: rel === "충" ? 10 : has(["편재", "편관"]) ? 6 : 0,
    };
    luckElement = yongsin;
    basis = `일간 ${STEMS_KO[myStem]}(${STEM_ELEMENT[myStem]}) · 용신 ${yongsin} 기준, 오늘 일진 ${dayGanzhi}(${dayElement})와의 십성·지지 관계로 산출`;
  } else {
    personalized = false;
    myZodiacBranch = ((input.yearBranch % 12) + 12) % 12;
    const myEl = BRANCH_ELEMENT[myZodiacBranch]!;
    subjectLabel = `${BRANCH_ANIMAL[myZodiacBranch]}띠`;
    chart = null;

    let s = 50;
    let relWord = "큰 영향 없이 흘러갑니다";
    if (generates(dayElement, myEl)) { s += 14; relWord = "당신을 북돋아 주는 기운입니다"; }
    else if (dayElement === myEl) { s += 6; relWord = "같은 기운이 더해져 힘이 실립니다"; }
    else if (controls(myEl, dayElement)) { s += 9; relWord = "당신이 다스리기 좋은 기운입니다"; }
    else if (controls(dayElement, myEl)) { s -= 12; relWord = "당신을 누르는 기운이라 조심스러운 날입니다"; }
    else if (generates(myEl, dayElement)) { s -= 4; relWord = "당신의 힘을 빼가는 기운입니다"; }
    rel = branchRelation(myZodiacBranch, tBranch);
    if (rel === "삼합") s += 12; else if (rel === "육합") s += 9; else if (rel === "충") s -= 12;
    total = clamp(Math.round(s), 12, 96);

    oneLine = total >= 68 ? "오늘은 기운이 당신을 받쳐주는 날" : total >= 50 ? "오늘은 차분히 흐름을 타는 날" : "오늘은 한 발 물러서야 하는 날";
    todayRelation = `${BRANCH_ANIMAL[myZodiacBranch]}띠(${myEl})에게 오늘 ${dayElement} 기운은 ${relWord}`;
    const relHead = rel === "삼합" ? "오늘 일진과 삼합으로 맞물려 협력·인연의 기운이 강한 날이에요. "
      : rel === "육합" ? "오늘 일진과 육합으로 어울려 관계운이 좋은 날이에요. "
        : rel === "충" ? "오늘 일진과 충(沖)이 들어 변동·이동수가 있는 날이에요. " : "";
    lines = [
      `${relHead}${todayRelation}.`,
      `${BRANCH_ANIMAL[myZodiacBranch]}띠에게 오늘은 ${total >= 60 ? "움직일수록 기회가 따라오는" : "무리하지 않을수록 손실이 줄어드는"} 하루입니다.`,
      total >= 70 ? "기회가 보이면 적극적으로 잡아보세요. 움직인 만큼 돌아옵니다."
        : total >= 55 ? "평소처럼 차분히 움직이면 무난하게 풀립니다."
          : "서두르지 말고 안전하게 가는 게 이로운 하루입니다.",
    ];

    fieldBias = {
      love: rel === "육합" ? 12 : rel === "삼합" ? 8 : rel === "충" ? -10 : 0,
      wealth: controls(myEl, dayElement) ? 12 : controls(dayElement, myEl) ? -6 : 0,
      work: controls(dayElement, myEl) ? 4 : rel === "삼합" ? 8 : 0,
      health: generates(dayElement, myEl) ? 10 : controls(dayElement, myEl) ? -10 : dayElement === myEl ? 4 : 0,
      relation: rel === "육합" || rel === "삼합" ? 10 : rel === "충" ? -6 : 0,
      move: rel === "충" ? 10 : controls(myEl, dayElement) ? 4 : 0,
    };
    luckElement = ELEMENTS.find((e) => generates(e, myEl)) ?? dayElement;
    basis = `${BRANCH_ANIMAL[myZodiacBranch]}띠(${myEl}) 기준, 오늘 일진 ${dayGanzhi}(${dayElement})와의 오행·지지 관계로 산출`;
  }

  const FIELD_META: Record<DailyFieldKey, { label: string; emoji: string }> = {
    love: { label: "애정운", emoji: "💕" },
    wealth: { label: "재물운", emoji: "💰" },
    work: { label: "직장·학업운", emoji: "💼" },
    health: { label: "건강운", emoji: "🩺" },
    relation: { label: "인간관계운", emoji: "🤝" },
    move: { label: "이동·계약운", emoji: "🚗" },
  };
  const fields: DailyField[] = (Object.keys(FIELD_META) as DailyFieldKey[]).map((key) => {
    const score = clamp(Math.round(total + fieldBias[key]), 10, 97);
    const { comment, tip } = fieldText(key, score);
    return { key, ...FIELD_META[key], score, stars: toStars(score), comment, tip };
  });

  const luck = makeLuck(luckElement);
  const timeSlots = buildTimeSlots(luckElement);
  const sorted = [...fields].sort((a, b) => b.score - a.score);
  const topKey = sorted[0]!.key, lowKey = sorted[sorted.length - 1]!.key;
  const bestSlot = timeSlots.find((s) => s.grade === "best") ?? timeSlots.find((s) => s.grade === "good") ?? timeSlots[0]!;
  const [title, titleEmoji] = titleOf(total);
  const personSeed = (myZodiacBranch + 1) * 31 + (input.mode === "natal" ? 7 : 13);
  const lotto = buildLotto(personSeed + tStem * 137 + tBranch * 19 + total * 7);
  const luckySurname = SURNAME[luckElement];

  return {
    date: dateStr, weekday, dayGanzhi, dayGanzhiKo, dayElement,
    personalized, subjectLabel, oneLine, todayRelation,
    title, titleEmoji,
    hashtags: buildHashtags(topKey, lowKey, rel, total),
    percentile: percentileOf(total),
    scenario: buildScenario(topKey, bestSlot.label),
    caution: buildCaution(lowKey),
    quote: quoteOf(total),
    chart, lotto, luckySurname,
    total: { score: total, stars: toStars(total), headline: headlineOf(total), lines },
    fields,
    timeSlots,
    guide: buildGuide(luck, total, rel),
    luck,
    zodiacMatch: buildZodiacMatch(myZodiacBranch),
    basis,
  };
}
