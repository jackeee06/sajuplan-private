// 꽃잎점 v2 "짝사랑 종합 리포트" — 이름 기반 결정론. 단순 마음 게이지 1개를 종합 리포트로 확장.
// ⚠️ 사주·생년월일 무관(이름 시드) → 만세엔진 재사용 불가, 순수 콘텐츠. 100% 재미·참고용.
//   설계: 핵심(게이지·단계·꽃·FLAMES)은 이름쌍 고정 시드(매번 같은 결과=믿음직, 순서 무관 정렬),
//        오늘의 한 줄·행운요소만 날짜 시드(매일 다시 보게). 깊은 인연은 상담으로.
import { hashString, mulberry32 } from "@portal/engine";

export interface PetalReport {
  percent: number; label: string; emoji: string; line: string;
  heartTemp: number; // 마음 온도(°C, 연애온도 메타포)
  fiveAxis: { label: string; score: number }[]; // 성격·대화·애정·신뢰·미래
  petals: number; finalLoves: boolean; // 꽃잎 떼기(수·최종 결과)
  stage: { name: string; text: string };
  innerVoice: string; innerWhy: string;
  successRate: number; confessTiming: string; replyRate: number;
  actions: string[];
  flower: { name: string; emoji: string; meaning: string };
  flames: { type: string; emoji: string; text: string };
  todayLine: string; moodWeather: string;
  lucky: { day: string; color: string; place: string };
}

// 마음 게이지 5단계(프랑스 marguerite 5단계 영감)
const LEVELS = [
  { min: 85, label: "미치도록 좋아해요", emoji: "💞", line: "두 사람 사이에 보이지 않는 인연의 실이 단단히 묶여 있어요. 표현만 하면 바로 이어질 사이예요." },
  { min: 70, label: "많이 좋아해요", emoji: "💗", line: "표현이 서툴 뿐, 마음은 이미 당신을 향하고 있어요. 작은 신호를 보내면 화답이 올 거예요." },
  { min: 55, label: "은근히 신경 써요", emoji: "💛", line: "겉으론 무심해 보여도 속으론 자꾸 당신을 떠올리고 있어요. 조금만 더 가까이 다가가 보세요." },
  { min: 40, label: "조금씩 가까워져요", emoji: "🌱", line: "지금처럼 천천히, 함께한 시간이 쌓이면 곧 마음이 통할 거예요. 조급해하지 마세요." },
  { min: 0, label: "아직은 친구 사이", emoji: "🤝", line: "서두르기보다 편안한 사이부터 차곡차곡 쌓아보세요. 좋은 친구가 좋은 인연이 되기도 해요." },
];

const STAGES = [
  { min: 82, name: "연애 직전 💓", text: "썸을 넘어 연애 문턱에 와 있어요. 한 사람만 용기 내면 바로 시작돼요." },
  { min: 64, name: "썸 타는 중 ✨", text: "서로를 의식하는 설레는 단계예요. 밀당보다 솔직한 표현이 관계를 키워요." },
  { min: 48, name: "호감 싹트는 중 🌸", text: "마음에 살짝 들어온 단계예요. 자연스러운 접점을 늘리면 호감이 깊어져요." },
  { min: 0, name: "아직 알아가는 사이 🌱", text: "서로를 막 알아가는 단계예요. 편안한 대화로 거리를 좁혀보세요." },
];

const INNER_VOICE = {
  hi: ["'이 사람, 자꾸 생각나네…' 하고 있어요.", "'나한테 관심 있나?' 하며 당신 반응을 살피고 있어요.", "'먼저 연락해볼까?' 망설이는 중이에요."],
  mid: ["'은근히 괜찮은 사람인데?' 하고 보고 있어요.", "'조금 더 알고 싶다' 생각하는 중이에요.", "'편하다' 느끼며 마음을 조금씩 열고 있어요."],
  lo: ["'좋은 사람 같다' 정도로 보고 있어요.", "아직은 '그냥 아는 사이'로 느껴요.", "'더 친해지면 어떨까' 하는 정도예요."],
};
const INNER_WHY = {
  hi: "함께 있을 때 편안함과 설렘을 동시에 느껴서예요. 당신의 작은 배려가 마음에 콕 박혔어요.",
  mid: "당신의 분위기와 말투가 은근히 끌려서예요. 다만 확신이 없어 신중해진 거예요.",
  lo: "아직 함께한 시간이 적어 마음이 무르익지 않았을 뿐이에요. 접점이 늘면 달라져요.",
};

const CONFESS = {
  hi: "지금이 바로 그때예요. 분위기가 무르익었으니 용기를 내보세요.",
  mid: "2~3주 안, 둘만의 편한 순간이 왔을 때가 좋아요.",
  lo: "조금 더 친해진 뒤, 한 달 안쯤 자연스러운 흐름에서 고백하세요.",
  vlo: "서두르지 말고 인연을 충분히 쌓은 뒤를 노리세요.",
};

const ACTIONS = {
  hi: ["먼저 가벼운 연락으로 신호를 보내요.", "둘만의 시간을 자연스럽게 만들어요.", "마음이 확실하면 솔직하게 표현해요."],
  mid: ["공통 관심사로 대화의 접점을 늘려요.", "작은 칭찬과 관심으로 호감을 쌓아요.", "조급해하지 말고 편안한 분위기를 만들어요."],
  lo: ["인사·안부처럼 부담 없는 접촉부터 늘려요.", "함께할 일을 만들어 자연스럽게 가까워져요.", "진심을 보이되 상대의 속도를 존중해요."],
  vlo: ["편안한 친구로 신뢰부터 쌓아요.", "무리한 어필보다 한결같은 모습을 보여요.", "조급함을 내려놓고 인연을 기다려요."],
};

const FLOWERS = [
  { name: "데이지", emoji: "🌼", meaning: "순수한 마음 — 꾸밈없는 진심이 통하는 사이예요." },
  { name: "장미", emoji: "🌹", meaning: "열렬한 사랑 — 뜨겁게 끌리는 강한 인연이에요." },
  { name: "튤립", emoji: "🌷", meaning: "사랑의 고백 — 마음을 전하기 좋은 때가 왔어요." },
  { name: "벚꽃", emoji: "🌸", meaning: "설레는 마음 — 봄날처럼 두근거리는 사이예요." },
  { name: "물망초", emoji: "💙", meaning: "나를 잊지 마세요 — 오래 마음에 남는 인연이에요." },
  { name: "해바라기", emoji: "🌻", meaning: "한결같은 사랑 — 변치 않는 진심이 빛나요." },
];

const FLAMES_KO = [
  { key: "F", type: "친구", emoji: "🤝", text: "편안하고 오래가는 우정의 기운이에요. 친구로 시작해 연인이 되기도 해요." },
  { key: "L", type: "연인", emoji: "💗", text: "서로 끌리는 연인의 기운이에요. 마음을 표현하면 이어질 사이예요." },
  { key: "A", type: "애정", emoji: "🥰", text: "다정하게 아끼는 애정의 기운이에요. 따뜻함이 오래 이어져요." },
  { key: "M", type: "결혼", emoji: "💍", text: "평생을 함께할 만큼 깊은 인연의 기운이에요. 신뢰가 단단해요." },
  { key: "E", type: "앙숙", emoji: "⚡", text: "티격태격하지만 그만큼 강하게 끌리는 애증의 기운이에요." },
  { key: "S", type: "남매", emoji: "👫", text: "가족처럼 편하고 든든한 기운이에요. 서로를 지켜주는 사이예요." },
];

// FLAMES — 두 이름 공통 글자 제거 후 남은 수로 Josephus 제거
function flamesOf(a: string, b: string) {
  const arrA = [...a.replace(/\s/g, "")];
  const arrB = [...b.replace(/\s/g, "")];
  const usedB = new Array(arrB.length).fill(false);
  let common = 0;
  for (const ch of arrA) {
    const idx = arrB.findIndex((c, i) => !usedB[i] && c === ch);
    if (idx >= 0) { usedB[idx] = true; common++; }
  }
  const n = arrA.length + arrB.length - common * 2;
  let pool = [...FLAMES_KO];
  if (n <= 0) return pool[1]!; // 공통이 전부면 기본 연인
  let idx = 0;
  while (pool.length > 1) {
    idx = (idx + n - 1) % pool.length;
    pool.splice(idx, 1);
  }
  return pool[0]!;
}

const WEEK_DAY = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const COLORS = ["분홍", "하늘", "노랑", "연보라", "코랄", "민트"];
const PLACES = ["조용한 카페", "벚꽃 산책로", "전시회", "야경 좋은 거리", "단골 분식집", "한강 둔치"];
const TODAY_LINES = [
  "오늘은 용기 내어 한 발 다가가기 좋은 날이에요.", "오늘은 가벼운 안부 연락이 좋은 신호가 돼요.",
  "오늘은 서두르기보다 미소 한 번이 더 효과적이에요.", "오늘은 솔직한 한마디가 분위기를 바꿔요.",
  "오늘은 상대의 이야기를 들어주면 마음이 가까워져요.", "오늘은 작은 관심 표현이 오래 기억에 남아요.",
];
const MOOD_WEATHER = ["맑음 ☀️ — 마음이 화창해요", "구름 조금 ⛅ — 설렘이 살짝 끼어 있어요", "분홍빛 노을 🌅 — 로맨틱한 기운이 돌아요", "산들바람 🍃 — 편안한 흐름이에요"];

const band = (p: number): "hi" | "mid" | "lo" | "vlo" => (p >= 75 ? "hi" : p >= 58 ? "mid" : p >= 42 ? "lo" : "vlo");

export function buildPetalReport(meRaw: string, youRaw: string, dayKey: string): PetalReport {
  const me = meRaw.trim() || "나";
  const you = youRaw.trim();
  // 이름쌍 고정 시드(순서 무관 — 정렬)
  const nameSeed = hashString(`petal2|${[me, you].sort().join("|")}`);
  const nr = mulberry32(nameSeed);
  // 오늘 시드(매일 변동)
  const daySeed = hashString(`petalday|${[me, you].sort().join("|")}|${dayKey}`);
  const dr = mulberry32(daySeed);

  const percent = 38 + Math.floor(nr() * 60); // 38~97 (짝사랑은 희망적으로)
  const lv = LEVELS.find((l) => percent >= l.min)!;
  const stage = STAGES.find((s) => percent >= s.min)!;
  const bd = band(percent);

  // 꽃잎 — 시작 '좋아한다'(1장째). 최종 결과가 percent>=50이면 '좋아한다'로 끝나게 패리티 조정
  const finalLoves = percent >= 50;
  let petals = 7 + Math.floor(nr() * 6); // 7~12
  const endsLoves = petals % 2 === 1; // 홀수면 '좋아한다'로 끝(1장째가 좋아한다)
  if (endsLoves !== finalLoves) petals += 1;

  const pick = <T,>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)]!;

  const cx = (n: number) => Math.max(20, Math.min(98, Math.round(n)));
  const fiveAxis = [
    { label: "성격 궁합", score: cx(percent + nr() * 12 - 6) },
    { label: "대화 코드", score: cx(percent + nr() * 12 - 6) },
    { label: "애정·끌림", score: cx(percent + nr() * 12 - 6) },
    { label: "신뢰", score: cx(percent + nr() * 12 - 6) },
    { label: "미래 가능성", score: cx(percent + nr() * 12 - 6) },
  ];
  const heartTemp = Math.round((20 + percent * 0.62) * 10) / 10; // 약 33~80°C

  return {
    percent, label: lv.label, emoji: lv.emoji, line: lv.line,
    heartTemp, fiveAxis,
    petals, finalLoves,
    stage: { name: stage.name, text: stage.text },
    innerVoice: pick(INNER_VOICE[bd === "vlo" ? "lo" : bd], nr),
    innerWhy: INNER_WHY[bd === "vlo" ? "lo" : bd],
    successRate: Math.max(20, Math.min(97, percent - 4 + Math.floor(nr() * 9))),
    confessTiming: CONFESS[bd],
    replyRate: Math.max(25, Math.min(98, percent + 2 - Math.floor(nr() * 8))),
    actions: ACTIONS[bd],
    flower: FLOWERS[nameSeed % FLOWERS.length]!,
    flames: (() => { const f = flamesOf(me, you); return { type: f.type, emoji: f.emoji, text: f.text }; })(),
    todayLine: pick(TODAY_LINES, dr),
    moodWeather: pick(MOOD_WEATHER, dr),
    lucky: { day: pick(WEEK_DAY, dr), color: pick(COLORS, dr), place: pick(PLACES, dr) },
  };
}
