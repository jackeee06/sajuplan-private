// 포춘쿠키 v2 "오늘의 포춘쿠키 종합" — 날짜+이름 시드 결정론. 단순 메시지 1줄을 종합 카드로 확장.
// ⚠️ 사주·생년월일 무관(날짜+이름 시드) → 만세엔진 재사용 불가, 순수 콘텐츠. 100% 재미·참고용.
//   설계: 오늘의 쿠키는 '오늘+이름' 고정(하루종일 같음·신뢰), 테마 쿠키는 '오늘+이름+테마' 고정.
//        매직8볼식 질문답은 '질문' 시드(같은 질문=같은 답). 도감은 뷰가 localStorage 누적.
import { hashString, mulberry32, pickUnique } from "@portal/engine";

/* ── 5톤 메시지 풀(격언·예언·위로·유머·응원) ── */
const MSG_PROVERB = [
  "급할수록 돌아가는 길이 가장 빠른 길이에요.", "콩 심은 데 콩 나듯, 오늘 뿌린 정성은 반드시 돌아와요.",
  "어둠이 깊을수록 별은 더 또렷이 빛납니다.", "쥐구멍에도 볕 들 날 있으니, 오늘이 그날일지 몰라요.",
  "흐르는 물은 바위를 탓하지 않고 돌아서 갑니다.", "큰 나무도 작은 씨앗에서 시작됩니다.",
  "바람이 멈춰야 잎은 자신이 얼마나 기대왔는지 압니다.", "참는 자에게 복이 오고, 웃는 자에게 길이 열립니다.",
  "가진 것에 만족할 줄 아는 사람이 가장 부유합니다.", "한 걸음이 천 리 길의 시작입니다.",
];
const MSG_PROPHECY = [
  "오늘, 뜻밖의 반가운 소식이 찾아옵니다.", "기다리던 좋은 일이 생각보다 가까이 와 있어요.",
  "잊고 지내던 인연에게서 연락이 올지도 몰라요.", "작은 행운이 줄지어 당신을 향해 오고 있습니다.",
  "오늘 만난 사람 중에 귀인이 숨어 있어요.", "망설이던 일에 또렷한 답이 보이는 하루예요.",
  "예상 밖의 칭찬이나 인정이 따르는 날입니다.", "당신의 친절이 곧 두 배로 되돌아옵니다.",
  "오늘 누군가가 당신을 마음에 떠올리고 있어요.", "묵은 오해가 스르르 풀릴 기회가 찾아옵니다.",
];
const MSG_COMFORT = [
  "지금처럼 버티고 있는 것만으로 충분히 잘하고 있어요.", "오늘 하루쯤 쉬어가도 괜찮아요. 운은 다시 채워져요.",
  "당신의 속도로 가도 늦지 않아요.", "잘 안 풀리는 날도 결국 지나가요. 오늘이 그래요.",
  "애쓰는 당신을 알아주는 사람이 분명 있어요.", "완벽하지 않아도 괜찮아요. 그게 당신다움이에요.",
  "작은 것에 감사하면 마음이 한결 가벼워져요.", "어제는 지났고 내일은 아직, 오늘만 살면 돼요.",
  "흔들려도 넘어지지 않으면 그게 단단해지는 중이에요.", "오늘 가장 힘들었다면 내일은 분명 나아요.",
];
const MSG_HUMOR = [
  "큰 변화가 다가옵니다… 저녁 먹은 뒤 바지처럼요.", "오늘 미스터리가 풀립니다. 냉장고 케첩 뒤에 있어요.",
  "이른 새가 벌레를 잡지만, 둘째 쥐가 치즈를 먹어요.", "현명한 사람은 운세를 믿어요. (방금 그래서 믿으셨죠?)",
  "당신의 미래엔 사랑과 성공, 그리고 어쩌면 떡볶이가 있어요.", "오늘은 비둘기가 아니라 동상인 날… 우산을 챙기세요.",
  "당신은 검색 기록보다 훨씬 현명한 사람이에요.", "행운이 옵니다. 단, 점심 먹고 나서요.",
  "자신을 믿으세요. 단, 배고프면 일단 먹고요.", "이 쿠키를 믿으세요. 다른 쿠키는 다 가짜예요.",
];
const MSG_CHEER = [
  "오늘 느끼는 고민이 내일의 힘이 됩니다.", "딱 한 번만 더, 그 한 번이 판을 바꿔요.",
  "준비될 때까지 기다리면 평생 못 시작해요. 지금이에요.", "당신이 할 수 있다고 믿으면, 정말 할 수 있어요.",
  "용기 내어 내디딘 한 걸음이 오늘의 정답이에요.", "두려운 그 일이, 사실 가장 해볼 만한 일이에요.",
  "포기만 안 하면 결국 닿습니다. 오늘도 한 걸음.", "당신의 시간은 한정돼 있으니, 당신답게 쓰세요.",
  "작은 한 방울도 모이면 바다가 돼요. 오늘을 보태요.", "성공은 끝이 아니고 실패도 끝이 아니에요. 계속이 답이에요.",
];
export const COOKIE_THEMES = [
  { key: "today", label: "오늘의 쿠키", emoji: "🥠", pool: MSG_PROPHECY },
  { key: "love", label: "연애 쿠키", emoji: "💗", pool: MSG_PROPHECY },
  { key: "money", label: "금전 쿠키", emoji: "💰", pool: MSG_CHEER },
  { key: "comfort", label: "위로 쿠키", emoji: "🫧", pool: MSG_COMFORT },
  { key: "challenge", label: "도전 쿠키", emoji: "🔥", pool: MSG_CHEER },
] as const;
export type CookieTheme = (typeof COOKIE_THEMES)[number]["key"];

/* ── 분야별 한 줄(점수 밴드) ── */
const FIELD_LINES: Record<string, [string, string, string]> = {
  애정: ["설레는 인연이 가까워지는 하루예요.", "잔잔하지만 따뜻한 마음이 오가는 날.", "표현을 조금만 더하면 마음이 통해요."],
  금전: ["뜻밖의 이득이 들어올 수 있는 날.", "들어오고 나감이 균형 잡힌 하루.", "충동구매만 참으면 알찬 하루예요."],
  직장: ["노력을 알아봐 주는 사람이 있는 날.", "맡은 일을 묵묵히 하면 무난한 하루.", "서두르기보다 차근차근이 유리해요."],
  건강: ["몸도 마음도 가뿐한 활기찬 하루.", "무리만 안 하면 컨디션이 좋아요.", "잘 쉬는 것도 오늘의 중요한 일이에요."],
};
/* ── 명언 풀 ── */
const QUOTES = [
  { t: "성공은 최종적이지 않고 실패는 치명적이지 않다. 중요한 건 계속하는 용기다.", a: "윈스턴 처칠" },
  { t: "당신의 시간은 한정돼 있다. 남의 인생을 살며 낭비하지 마라.", a: "스티브 잡스" },
  { t: "실패는 더 현명하게 다시 시작할 기회다.", a: "헨리 포드" },
  { t: "오늘 할 수 있는 일에 온 마음을 다하라.", a: "랄프 왈도 에머슨" },
  { t: "가장 큰 영광은 넘어지지 않는 것이 아니라 넘어질 때마다 일어서는 것이다.", a: "공자" },
  { t: "행복은 이미 당신에게로 오는 중이다.", a: "오늘의 포춘쿠키" },
  { t: "천 리 길도 한 걸음부터.", a: "노자" },
  { t: "어둠 속에서도 별은 항상 빛난다.", a: "에머슨" },
];
/* ── 매직8볼식 질문 답(예/아니오/유보) ── */
const EIGHTBALL = {
  yes: ["분명히 그래요.", "의심할 여지 없이 그래요.", "지금이 바로 좋은 때예요.", "믿고 나아가도 좋아요.", "징조가 좋아요, 그렇다고 봐요.", "거의 확실해요."],
  maybe: ["조금 더 기다렸다 다시 물어보세요.", "지금은 안갯속, 마음을 가다듬고 다시.", "아직은 알 수 없어요.", "성급하지 말고 한 박자 쉬어요."],
  no: ["지금은 때가 아니에요.", "조금 미루는 게 좋겠어요.", "신중하게, 다시 생각해 보세요.", "이번엔 돌아가는 길이 나아요."],
};
/* ── 행운요소(한국식 풍성 네이밍) ── */
const LUCKY_COLORS = ["상쾌한 민트블루", "포근한 버터크림", "싱그러운 포레스트그린", "따뜻한 망고옐로우", "맑은 스카이블루", "은은한 라벤더", "화사한 코랄핑크", "고급스러운 골드"];
const LUCKY_DIRS = ["동쪽", "서쪽", "남쪽", "북쪽", "동남쪽", "서북쪽"];
const LUCKY_ITEMS = ["반지·목걸이 같은 작은 액세서리", "손에 잡히는 다이어리·펜", "향이 좋은 핸드크림", "초록 식물 한 포기", "따뜻한 차 한 잔", "좋아하는 노래가 담긴 이어폰", "포근한 머플러", "행운의 동전 한 닢"];
const LUCKY_TIMES = ["이른 아침", "점심 무렵", "해 질 녘", "늦은 오후", "밤이 깊어갈 때"];
const MOOD = ["맑음 ☀️", "구름 조금 ⛅", "산들바람 🍃", "포근한 햇살 🌤️", "별이 총총 🌙"];

export interface CookieResult {
  message: string; tone: string;
  score: number; // 행운지수
  fields: { label: string; emoji: string; score: number; line: string }[];
  quote: { t: string; a: string };
  luckyNumbers: number[];
  lucky: { color: string; dir: string; item: string; time: string };
  action: string; avoid: string;
  funny: string;
  mood: string;
  origin: string;
}

const ACTIONS = [
  "미뤘던 연락 한 통 먼저 보내기", "고마운 사람에게 감사 인사 건네기", "평소 안 가던 길로 걸어보기",
  "작은 선물이나 커피 한 잔 사기", "미룬 일 딱 10분만 시작하기", "거울 보고 한 번 활짝 웃기",
  "행운의 색 소품을 곁에 두기", "물 한 잔 더 마시고 깊게 숨쉬기",
];
const AVOIDS = [
  "급한 마음에 내리는 충동 결정", "확인 없이 던지는 말 한마디", "오늘만큼은 큰 지출·보증",
  "괜한 비교로 마음 깎아내리기", "밤늦은 충동구매", "이불 속 끝없는 걱정",
];
const ORIGIN = "포춘쿠키는 사실 중국이 아니라 일본 교토의 '쓰지우라 센베이'에서 시작해, 20세기 초 미국에서 꽃핀 과자예요. 안에 든 종이 한 장에 담긴 오늘의 한마디 — 그 작은 설렘이 100년을 이어왔어요.";

function pick<T>(arr: readonly T[], r: () => number): T { return arr[Math.floor(r() * arr.length)]!; }
const band3 = (s: number) => (s >= 72 ? 0 : s >= 55 ? 1 : 2);

const TONE_POOLS = [
  { tone: "예언", pool: MSG_PROPHECY }, { tone: "격언", pool: MSG_PROVERB },
  { tone: "위로", pool: MSG_COMFORT }, { tone: "응원", pool: MSG_CHEER },
];

/** 오늘의 종합 포춘쿠키. dayKey='YYYY-MM-DD', name=프로필 이름(선택). */
export function buildCookie(dayKey: string, name: string): CookieResult {
  const seed = hashString(`cookie2|${dayKey}|${name}`);
  const r = mulberry32(seed);
  const tp = pick(TONE_POOLS, r);
  const score = 55 + Math.floor(r() * 44); // 55~98(긍정 편향)
  const fields = Object.entries(FIELD_LINES).map(([label, lines]) => {
    const sc = Math.max(40, Math.min(98, score + Math.floor(r() * 24 - 12)));
    return { label, emoji: ({ 애정: "💗", 금전: "💰", 직장: "💼", 건강: "🌿" } as Record<string, string>)[label]!, score: sc, line: lines[band3(sc)]! };
  });
  return {
    message: pick(tp.pool, r), tone: tp.tone,
    score,
    fields,
    quote: pick(QUOTES, r),
    luckyNumbers: pickUnique((seed ^ 0x1b873593) >>> 0, 6, 45).sort((a, b) => a - b),
    lucky: { color: pick(LUCKY_COLORS, r), dir: pick(LUCKY_DIRS, r), item: pick(LUCKY_ITEMS, r), time: pick(LUCKY_TIMES, r) },
    action: pick(ACTIONS, r), avoid: pick(AVOIDS, r),
    funny: pick(MSG_HUMOR, r),
    mood: pick(MOOD, r),
    origin: ORIGIN,
  };
}

/** 테마 쿠키 한 줄(날짜+이름+테마 고정). */
export function themeCookie(dayKey: string, name: string, theme: CookieTheme): string {
  const t = COOKIE_THEMES.find((x) => x.key === theme)!;
  const r = mulberry32(hashString(`cookietheme|${dayKey}|${name}|${theme}`));
  return pick(t.pool, r);
}

/** 매직8볼식 질문 답(같은 질문=같은 답). */
export function askCookie(question: string): { verdict: string; kind: "yes" | "maybe" | "no" } {
  const q = question.trim();
  const seed = hashString(`cookie8ball|${q}`);
  const r = mulberry32(seed);
  const roll = r();
  const kind = roll < 0.5 ? "yes" : roll < 0.78 ? "maybe" : "no";
  return { verdict: pick(EIGHTBALL[kind], r), kind };
}
