// 이름 궁합 — 두 이름의 케미(연인·친구·동료 두루). 사주무관·이름 시드 결정론, 100% 재미용.
//   전통 성명학의 한글 초성 오행(목화토금수)을 재미 요소로 활용 + 이름쌍 고정 시드.
//   순서 무관(정렬) → 누가 먼저 넣어도 같은 결과. 꽃잎점(짝사랑)과 달리 관계 일반.
import { hashString, mulberry32, pickUnique } from "@portal/engine";

const pickOne = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

export interface NameCompat {
  me: string; you: string; score: number; grade: string; gradeLabel: string;
  headline: string; summary: string;
  axes: { label: string; score: number }[]; // 호감·소통·신뢰·설렘·지속
  elements: { name: string; el: string; elEmoji: string }[]; // 두 이름의 오행
  elementRelation: string; // 오행 상생/상극 한줄
  good: string; caution: string; nickname: string;
  lucky: { day: string; color: string; item: string }; luckyNumbers: number[];
  longStory: string[]; // 롱폼 서사(두 이름의 인연 이야기)
  dims: { love: number; friend: number; work: number }; // 연애·우정·사업 궁합
  strokes: { name: string; num: number; yinyang: string }[]; // 이름 수리·음양
  totalNumber: number; numberMeaning: string; // 두 이름 합산 수리
  timeline: { phase: string; emoji: string; text: string }[]; // 관계 흐름
  callname: string; idealDate: string; poem: string;
}

// 한글 초성 → 오행 (전통 성명학)
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const CHO_EL: Record<string, string> = {
  ㄱ: "목", ㄲ: "목", ㅋ: "목",
  ㄴ: "화", ㄷ: "화", ㄸ: "화", ㄹ: "화", ㅌ: "화",
  ㅇ: "토", ㅎ: "토",
  ㅅ: "금", ㅆ: "금", ㅈ: "금", ㅉ: "금", ㅊ: "금",
  ㅁ: "수", ㅂ: "수", ㅃ: "수", ㅍ: "수",
};
const EL_EMOJI: Record<string, string> = { 목: "🌳", 화: "🔥", 토: "⛰️", 금: "⚙️", 수: "💧" };

function firstElement(name: string): string {
  for (const ch of name) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const cho = CHO[Math.floor((code - 0xac00) / 588)]!;
      return CHO_EL[cho] ?? "토";
    }
  }
  return "토";
}

// 오행 상생(낳음) / 상극(이김)
const SAENG: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const GEUK: Record<string, string> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };
function elementRel(a: string, b: string): { bonus: number; text: string } {
  if (a === b) return { bonus: 6, text: `두 이름 모두 ${a}(${EL_EMOJI[a]}) 기운 — 닮은 결이라 편안하고 익숙한 사이예요.` };
  if (SAENG[a] === b || SAENG[b] === a) return { bonus: 12, text: `${a}와 ${b}는 서로를 살리는 상생(相生) 관계 — 함께할수록 기운이 차오르는 찰떡 조합이에요.` };
  if (GEUK[a] === b || GEUK[b] === a) return { bonus: -6, text: `${a}와 ${b}는 부딪히는 상극(相剋) 기운 — 처음엔 티격태격해도, 맞추면 누구보다 단단해져요.` };
  return { bonus: 4, text: `${a}와 ${b}는 무난히 어우러지는 기운이에요.` };
}

const NICK = ["천생연분 콤비", "티키타카 단짝", "은근한 케미", "정반대 끌림", "오래 가는 인연", "찰떡 짝꿍", "운명의 듀오"];
const LUCK_COLOR = ["코랄핑크", "라벤더", "민트", "아이보리", "선셋오렌지", "스카이블루", "로즈", "에메랄드"];
const LUCK_ITEM = ["커플링", "함께 찍은 사진", "같은 향수", "공유 플레이리스트", "커플 키링", "손편지"];
const LUCK_DAY = ["토요일", "보름달 뜨는 날", "비 오는 날", "첫눈 오는 날", "주말 오후", "노을 지는 저녁"];

const AXIS_NAMES = ["호감도", "소통", "신뢰", "설렘", "지속력"];
const CALLNAMES = ["서로 애칭으로 부르는 사이", "이름 끝에 '야'를 붙여 다정하게", "별명으로 통하는 찰떡 사이", "풀네임으로 정중히, 속은 따뜻하게", "줄임말 애칭이 어울리는 사이"];
const DATES = ["노을 지는 강변 산책", "분위기 좋은 카페에서 긴 수다", "함께 만드는 쿠킹 클래스", "벚꽃·단풍 명소 나들이", "놀이공원에서 신나는 하루", "조용한 전시·미술관 데이트", "야경 좋은 루프탑"];
const POEMS = [
  "두 이름이 만나 한 줄의 시가 되네 — 같은 곳을 보면 길은 하나가 된다.",
  "다른 결의 두 마음, 비빔밥처럼 섞여 더 깊은 맛을 내네.",
  "강과 산이 만나듯, 닮지 않아 더 든든한 사이.",
  "한 글자씩 부르면 어느새 익숙해지는, 오래 갈 이름의 인연.",
  "봄볕과 그늘처럼, 서로가 있어 완성되는 두 사람.",
];
const NUM_MEANING: Record<number, string> = {
  0: "안정과 조화의 기운 — 함께 있으면 마음이 편안해지는 궁합이에요.",
  1: "시작과 추진의 기운 — 함께 새로운 일을 벌이면 시너지가 커요.",
  2: "소통과 균형의 기운 — 대화로 풀어가면 무엇이든 통하는 사이.",
  3: "활기와 표현의 기운 — 함께 있으면 웃음이 끊이지 않아요.",
  4: "신뢰와 끈기의 기운 — 천천히 쌓아 오래 가는 단단한 인연.",
};

// 이름 수리(간이) — 글자 유니코드 합 기반. 음양=홀짝. 전통 성명 수리를 재미로 차용.
function nameStroke(name: string): { num: number; yinyang: string } {
  let sum = 0;
  for (const ch of name) sum += ((ch.charCodeAt(0) - 0xac00) % 30) + 3;
  const num = (sum % 27) + 1;
  return { num, yinyang: num % 2 === 1 ? "양(陽)" : "음(陰)" };
}

export function buildNameCompat(meRaw: string, youRaw: string): NameCompat {
  const me = meRaw.trim(), you = youRaw.trim();
  const key = [me, you].sort().join("|");
  const rng = mulberry32(hashString(`namecompat|${key}`));
  const elA = firstElement(me), elB = firstElement(you);
  const rel = elementRel(elA, elB);
  const base = 50 + Math.floor(rng() * 36); // 50~85
  let score = Math.max(45, Math.min(99, base + rel.bonus + Math.floor(rng() * 6)));
  const GRADES: { min: number; g: string; label: string }[] = [
    { min: 90, g: "S", label: "천생연분" }, { min: 80, g: "A", label: "환상의 케미" },
    { min: 68, g: "B", label: "잘 맞는 사이" }, { min: 55, g: "C", label: "노력하면 좋은 사이" },
    { min: 0, g: "D", label: "서로 배우는 사이" },
  ];
  const gr = GRADES.find((x) => score >= x.min)!;
  const axes = AXIS_NAMES.map((label, i) => ({ label, score: Math.max(40, Math.min(99, score - 12 + Math.floor(mulberry32(hashString(`${key}|ax${i}`))() * 28))) }));
  const headline = score >= 80 ? `${me} 💞 ${you}, 보기 드문 천생 케미!` : score >= 65 ? `${me} 💞 ${you}, 다른 듯 통하는 사이` : `${me} 💞 ${you}, 알아갈수록 깊어지는 사이`;
  const summary = `${me}님과 ${you}님은 ${gr.label} 케미예요. ${rel.text} 첫인상보다 함께한 시간이 쌓일수록 진가가 드러나는 관계라, 서로의 속도를 존중하면 오래도록 좋은 인연이 됩니다.`;
  const good = score >= 70 ? "말이 잘 통하고 함께 있으면 편안해요. 작은 농담에도 같이 웃는 사이예요." : "겉으론 달라 보여도, 한 가지 가치관이 통하면 급속도로 가까워져요.";
  const caution = rel.bonus < 0 ? "서로 표현 방식이 달라 오해가 생기기 쉬워요. 돌려 말하기보다 솔직하게 전해보세요." : "너무 편한 나머지 표현을 아끼기 쉬워요. 고마움은 그때그때 말로 해주세요.";
  const nickname = pickOne(rng, NICK);
  const luckyNumbers = pickUnique(hashString(`${key}|num`) >>> 0, 3, 45).sort((a, b) => a - b);
  const sA = nameStroke(me), sB = nameStroke(you);
  const totalNumber = sA.num + sB.num;
  const numberMeaning = NUM_MEANING[totalNumber % 5]!;
  const clamp = (n: number) => Math.max(40, Math.min(99, n));
  const dims = {
    love: clamp(score + (rel.bonus >= 12 ? 5 : 0) + Math.floor(mulberry32(hashString(`${key}|dl`))() * 10) - 4),
    friend: clamp(score - 2 + Math.floor(mulberry32(hashString(`${key}|df`))() * 12) - 4),
    work: clamp(score - 4 + (elA !== elB ? 5 : 0) + Math.floor(mulberry32(hashString(`${key}|dw`))() * 10) - 3),
  };
  const TIMELINE_POOLS = [
    { phase: "첫 만남", emoji: "👀", lo: "서로 탐색하느라 어색함이 흘러요. 한 명이 먼저 다가가면 빨리 풀려요.", hi: "이상하게 처음부터 편안해요. 대화가 술술 통해요." },
    { phase: "100일 무렵", emoji: "💗", lo: "사소한 습관 차이가 보이기 시작해요. 솔직한 대화가 약이에요.", hi: "콩깍지 제대로! 같이 있는 시간이 제일 즐거운 때예요." },
    { phase: "위기의 순간", emoji: "⚡", lo: "표현 방식이 달라 오해가 생겨요. 돌려 말하지 말고 직진하세요.", hi: "다툼이 와도 금방 화해해요. 오히려 더 가까워지는 계기가 돼요." },
    { phase: "오래된 사이", emoji: "🌳", lo: "편해진 만큼 표현이 줄어요. 고마움을 자주 말로 해주세요.", hi: "둘도 없는 단짝으로 안착해요. 함께 나이 들고 싶은 사이." },
  ];
  const timeline = TIMELINE_POOLS.map((t, i) => ({ phase: t.phase, emoji: t.emoji, text: (score + (i % 2 === 0 ? 4 : -4)) >= 65 ? t.hi : t.lo }));

  // 롱폼 서사 — 오행 관계 × 점수대 조합으로 한 편의 이야기를 동적 생성.
  const relType = rel.bonus >= 12 ? "saeng" : rel.bonus < 0 ? "geuk" : "same";
  const tier = score >= 75 ? "hi" : score >= 60 ? "mid" : "lo";
  const OPEN: Record<string, string> = {
    saeng: `${me}님과 ${you}님, 두 이름이 만나는 순간 서로를 살리는 상생(相生)의 기운이 흘러요. ${elA}(${EL_EMOJI[elA]})와 ${elB}(${EL_EMOJI[elB]})는 한쪽이 다른 쪽을 키워주는 관계라, 함께 있으면 서로의 부족한 부분이 자연스럽게 채워져요. 처음엔 그저 편안하다고 느낄 뿐이지만, 시간이 지날수록 '이 사람과 함께라서 내가 더 나아진다'는 걸 깨닫게 되는 인연이에요.`,
    geuk: `${me}님과 ${you}님은 ${elA}(${EL_EMOJI[elA]})와 ${elB}(${EL_EMOJI[elB]}), 서로 다른 결의 기운을 지녔어요. 전통 오행으로 보면 부딪히는 상극(相剋)의 자리에 있죠. 하지만 상극은 '나쁜 궁합'이 아니라 '강하게 다듬어지는 궁합'이에요. 무쇠가 불과 망치를 만나 명검이 되듯, 처음의 티격태격을 넘어서면 누구보다 단단하고 깊은 사이가 될 수 있어요.`,
    same: `${me}님과 ${you}님은 둘 다 ${elA}(${EL_EMOJI[elA]})의 기운을 품은, 결이 닮은 사이예요. 비슷한 곳을 바라보고 비슷한 속도로 움직이기에, 함께 있으면 마치 오래 알고 지낸 사람처럼 편안해요. 말하지 않아도 통하는 그 익숙함이 두 사람의 가장 큰 자산이에요.`,
  };
  const STRENGTH: Record<string, string> = {
    hi: `두 사람의 궁합 점수는 ${score}점, '${gr.label}'이에요. 좀처럼 보기 드문 높은 케미죠. 대화의 결이 잘 맞고, 함께 있을 때 자연스럽게 웃음이 나며, 서로의 작은 변화도 금세 알아채요. 이런 사이는 억지로 노력하지 않아도 관계가 물 흐르듯 이어져, 오래도록 곁에 두고 싶은 인연이 돼요.`,
    mid: `두 사람의 궁합 점수는 ${score}점, '${gr.label}'이에요. 처음부터 완벽하게 통하는 사이는 아닐 수 있지만, 그래서 더 알아가는 재미가 있는 관계예요. 닮은 점에서 편안함을, 다른 점에서 새로움을 느끼며 균형을 맞춰가요. 서로의 속도를 존중하면 시간이 갈수록 점점 더 깊어지는 인연이에요.`,
    lo: `두 사람의 궁합 점수는 ${score}점, '${gr.label}'이에요. 첫인상이나 초반엔 서로 낯설고 어렵게 느껴질 수 있어요. 하지만 점수가 낮다고 인연이 아닌 건 절대 아니에요. 오히려 서로 다르기에 배울 게 많고, 한 가지 가치관만 통하면 급속도로 가까워지는 '반전 케미'의 가능성을 품고 있어요.`,
  };
  const CHALLENGE: Record<string, string> = {
    saeng: `굳이 조심할 점을 꼽자면, 너무 잘 맞고 편한 나머지 서로에게 표현을 아끼게 되는 거예요. 상생의 관계일수록 '당연히 알겠지' 하며 고마움을 말로 안 하기 쉬워요. 좋은 기운도 표현하지 않으면 옅어지니, 작은 감사를 자주 건네는 게 이 인연을 오래 지키는 비결이에요.`,
    geuk: `다만 서로의 표현 방식이 달라 오해가 생기기 쉬워요. 한 사람이 직설적이면 다른 사람은 돌려 말하고, 한 사람이 빠르면 다른 사람은 신중하죠. 이 차이를 '틀림'이 아니라 '다름'으로 받아들이고, 솔직하게 마음을 전하는 연습을 하면 상극의 기운은 오히려 둘을 더 단단하게 묶어줘요.`,
    same: `비슷한 만큼 같은 약점을 공유한다는 게 함정이에요. 둘 다 미루는 성향이면 중요한 일이 자꾸 뒤로 밀리고, 둘 다 고집이 세면 한번 부딪히면 좀처럼 안 풀려요. 닮은 사이일수록 한 사람이 의식적으로 양보하거나 키를 잡아주면 관계가 훨씬 매끄러워져요.`,
  };
  const FUTURE: Record<string, string> = {
    hi: `시간이 흐를수록 두 사람의 인연은 더 깊어질 거예요. 첫 설렘이 신뢰로, 신뢰가 다시 단단한 동반자의 정으로 익어가죠. 함께 나이 들어가고 싶은, 그런 귀한 사이예요.`,
    mid: `함께한 시간이 쌓일수록 두 사람은 서로의 진가를 알아보게 될 거예요. 빠르게 타오르기보다 천천히 데워지는 관계라, 조급해하지 않고 꾸준히 마음을 나누면 오래도록 좋은 인연으로 남아요.`,
    lo: `지금은 서로 알아가는 중이라 어색해도, 한 번의 진솔한 대화가 관계를 완전히 바꿀 수 있어요. 다른 점을 이해하려는 작은 노력이 쌓이면, 의외로 가장 오래 가는 인연이 되기도 해요.`,
  };
  const FIRST: Record<string, string> = {
    hi: `${me}님과 ${you}님이 처음 만나는 장면을 떠올려 볼까요. 두 사람은 아마 첫 대화부터 '어, 이 사람 뭔가 통하는데?'를 느꼈을 거예요. 어색한 침묵보다 자연스러운 웃음이 먼저 터지고, 헤어질 때 '또 보고 싶다'는 여운이 남는 그런 첫 만남이었을 거예요.`,
    mid: `${me}님과 ${you}님의 첫 만남은 아마 잔잔했을 거예요. 불꽃 튀는 첫눈에 반함은 아니어도, 함께 시간을 보낼수록 '생각보다 괜찮은 사람'이라는 호감이 스며들죠. 이런 관계는 천천히 데워지는 만큼 오래가요.`,
    lo: `${me}님과 ${you}님의 첫 만남은 서로 조금 낯설었을 수 있어요. 결이 달라 처음엔 '나와 안 맞나?' 싶었을지도요. 하지만 그 다름이 오히려 호기심이 되어, 알아갈수록 의외의 매력을 발견하게 되는 관계예요.`,
  };
  const COMM: Record<string, string> = {
    saeng: `두 사람의 대화는 물 흐르듯 자연스러워요. 한 사람이 말을 꺼내면 다른 사람이 자연스레 받아주고, 서로의 말에 기운을 북돋아 주죠. 상생의 오행답게, 함께 이야기할수록 둘 다 기분이 좋아지는 신기한 케미예요.`,
    geuk: `두 사람의 대화 방식은 사뭇 달라요. 한 사람이 결론부터 말하면 다른 사람은 과정을 중시하고, 한 사람이 직설적이면 다른 사람은 에둘러 말하죠. 이 차이를 알고 맞춰가면, 오히려 서로의 부족한 표현을 채워주는 풍부한 대화가 돼요.`,
    same: `두 사람은 비슷한 화법을 가졌어요. 같은 지점에서 웃고 같은 것에 공감해, 대화가 편안하죠. 다만 둘 다 비슷하게 표현을 아끼는 편이라면, 정작 중요한 말은 못 하고 넘어갈 수 있으니 솔직함을 의식적으로 더해보세요.`,
  };
  const TOGETHER: Record<string, string> = {
    hi: `함께 있을 때 두 사람은 가장 자기다워져요. 꾸미지 않아도 편안하고, 같이 있는 것만으로 충전이 되는 사이죠. 특별한 걸 안 해도 그냥 함께 걷고, 함께 밥 먹는 평범한 시간이 가장 행복한 그런 관계예요.`,
    mid: `함께 있을 때 두 사람은 서로에게 좋은 자극이 돼요. 닮은 점에서 편안함을, 다른 점에서 새로움을 느끼며 지루할 틈이 없죠. 가끔 삐걱대도 그만큼 서로를 더 알아가는 과정이라 생각하면 돼요.`,
    lo: `함께 있을 때 두 사람은 아직 서로의 리듬을 맞춰가는 중이에요. 처음엔 박자가 어긋나도, 한 사람이 한 발 맞춰주면 금세 호흡이 살아나죠. 서로의 속도를 존중하는 게 이 관계의 열쇠예요.`,
  };
  const RESOLVE: Record<string, string> = {
    saeng: `다툼이 생겨도 두 사람은 오래 가지 않아요. 서로를 살리는 기운이라, 한 사람이 먼저 손 내밀면 다른 사람이 금세 받아주죠. 화해의 기술이 따로 필요 없는, 복받은 궁합이에요.`,
    geuk: `갈등이 생기면 두 사람은 한동안 평행선을 달릴 수 있어요. 하지만 이 관계의 묘미는 바로 거기 있어요. 끝까지 대화해 접점을 찾았을 때, 두 사람은 다투기 전보다 훨씬 단단해지거든요. 피하지 말고 부딪혀 푸는 게 정답이에요.`,
    same: `비슷한 두 사람이라 갈등의 포인트도 비슷해요. 둘 다 고집을 부리면 좀처럼 안 풀리니, 화가 났을 때 한 사람이 '내가 먼저 미안해'라고 말해주면 신기하게 술술 풀려요.`,
  };
  const SECRET: Record<string, string> = {
    hi: `이렇게 좋은 케미도 그냥 두면 옅어져요. 두 사람이 오래 가는 비결은 '당연하게 여기지 않는 것'이에요. 좋은 날에 "고마워", "네가 있어 좋아"를 자주 말해주면, 이 귀한 인연이 평생 가요.`,
    mid: `두 사람이 더 가까워지는 비결은 '꾸준함'이에요. 한 번에 폭발하는 사이가 아니라 차곡차곡 쌓이는 사이라, 작은 약속을 지키고 자주 안부를 묻는 그 정성이 관계를 단단하게 만들어요.`,
    lo: `두 사람이 가까워지는 비결은 '다름을 인정하는 것'이에요. 상대를 내 방식대로 바꾸려 하지 말고, '저렇게 생각할 수도 있구나' 받아들이는 순간 관계가 확 부드러워져요. 다른 만큼 배울 게 많은 사이거든요.`,
  };
  const longStory = [
    OPEN[relType]!, FIRST[tier]!, STRENGTH[tier]!, COMM[relType]!, TOGETHER[tier]!,
    CHALLENGE[relType]!, RESOLVE[relType]!, SECRET[tier]!, FUTURE[tier]!,
    `정리하면, ${me}님과 ${you}님은 ${gr.label}의 케미를 지닌 사이예요. ${rel.bonus >= 12 ? "서로를 살리는 상생의 기운으로 묶인 만큼" : rel.bonus < 0 ? "부딪히며 더 단단해지는 상극의 묘미를 지닌 만큼" : "결이 닮아 편안한 사이인 만큼"}, 서로의 마음을 자주 표현하고 다름을 존중한다면 오래도록 좋은 인연으로 남을 거예요. 이름은 거들 뿐, 결국 두 사람의 마음이 인연을 만들어가는 거니까요. 😊`,
  ];
  return {
    me, you, score, grade: gr.g, gradeLabel: gr.label, headline, summary, axes,
    elements: [{ name: me, el: elA, elEmoji: EL_EMOJI[elA]! }, { name: you, el: elB, elEmoji: EL_EMOJI[elB]! }],
    elementRelation: rel.text, good, caution, nickname,
    lucky: { day: pickOne(rng, LUCK_DAY), color: pickOne(rng, LUCK_COLOR), item: pickOne(rng, LUCK_ITEM) },
    luckyNumbers, dims, longStory,
    strokes: [{ name: me, num: sA.num, yinyang: sA.yinyang }, { name: you, num: sB.num, yinyang: sB.yinyang }],
    totalNumber, numberMeaning,
    timeline, callname: pickOne(rng, CALLNAMES), idealDate: pickOne(rng, DATES), poem: pickOne(rng, POEMS),
  };
}
