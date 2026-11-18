// 재물운 v3 — 만세 엔진(@manse/engine)으로 경쟁사(점신·사주아이·네이트) 상위호환.
//   타고난 재물 그릇(5유형) + 재물 4능력(버는/불리는/모으는/지키는) + 돈 버는 방법(분야·수단)
//   + ⭐평생 재물 흐름(대운 10년 곡선) + 재물 5분야(월급·사업·횡재·부동산·관리)
//   + 돈 들어오는 시기(세운 9년·월운 12개월) + 지출 주의 + 개운 + 롱폼 총평.
//   ⚠️ 계산(십성·강약·대운·세운·월운)은 정확, 점수·문장은 룰 해석(과장 OK). 완결분석 X → 상담 CTA.
//   결정론적. 포털→만세엔진 단방향.
import { computeManse, yearLuck, monthLuck } from "@manse/engine";
import { hashString, mulberry32, pickUnique } from "@portal/engine";
import type { Profile } from "./profile.js";

type El = "목" | "화" | "토" | "금" | "수";

const SIKSANG = new Set(["식신", "상관"]);
// 오행 상극(일간이 극하는 것 = 재성)
const GEUK: Record<string, El> = { 목: "토", 화: "금", 토: "수", 금: "목", 수: "화" };
// 재성 오행의 묘고(墓庫) 지지 — 재고귀인 판정용 (土는 火와 함께 戌)
const MYO_BRANCH: Record<string, string> = { 목: "未", 화: "戌", 토: "戌", 금: "丑", 수: "辰" };
// 재물 관점에서 의미 있는 신살(길성/주의) — 만세 엔진 신살 20종 중 큐레이션
const WEALTH_SINSAL: Record<string, { meaning: string; good: boolean }> = {
  금여: { meaning: "금가마 — 부귀·안정된 재물복을 타고난 길성", good: true },
  암록: { meaning: "숨은 녹 — 뜻밖의 후원·보이지 않는 재물이 따라요", good: true },
  천을귀인: { meaning: "최고 길성 — 위기 때 돈과 귀인의 도움을 받아요", good: true },
  태극귀인: { meaning: "전화위복 — 큰 복과 반전의 재물운", good: true },
  월덕귀인: { meaning: "덕 — 사람과 복이 모여 재물로 이어져요", good: true },
  천덕귀인: { meaning: "하늘의 덕 — 어려울 때 도움이 재물을 지켜줘요", good: true },
  화개살: { meaning: "예술·전문성 — 재능으로 버는 힘이 있어요", good: true },
  역마살: { meaning: "이동·유통 — 해외·무역·움직임에서 재물이 열려요", good: true },
  도화살: { meaning: "인기·매력 — 사람을 끄는 힘이 곧 돈이 돼요", good: true },
  문곡귀인: { meaning: "재주 — 학문·기술이 재물로 이어지는 길성", good: true },
  양인살: { meaning: "강한 추진력 — 과욕·투기는 한 번 점검이 필요해요", good: false },
  백호살: { meaning: "변동성 — 재물의 들고남이 커 관리가 중요해요", good: false },
};
// 십성별 재물 기여도(대운·세운 곡선 점수용)
const TG_WEALTH: Record<string, number> = {
  정재: 18, 편재: 16, 식신: 11, 상관: 5, 정관: 7, 편관: -5, 정인: 4, 편인: 2, 비견: -2, 겁재: -13,
};
const LUCK_COLOR: Record<El, string> = { 목: "초록·연두", 화: "빨강·분홍", 토: "노랑·골드", 금: "흰색·은색", 수: "파랑·검정" };
const LUCK_DIR: Record<El, string> = { 목: "동쪽", 화: "남쪽", 토: "중앙·남서", 금: "서쪽", 수: "북쪽" };
const LUCK_NUM: Record<El, number[]> = { 수: [1, 6], 화: [2, 7], 목: [3, 8], 금: [4, 9], 토: [5, 10] };

export type WealthGrade = "신왕재왕" | "재다신약" | "식상생재" | "재성부족" | "재물균형";

export interface WealthTiming {
  when: string;
  ganzhi: string;
  tenGod: string;
  kind: "정재" | "편재" | "식상" | "주의" | "협력";
  text: string;
}
export interface WealthPower {
  key: string;
  label: string;
  emoji: string;
  score: number;
  desc: string;
}
export interface LifetimeFlow {
  age: number;
  ageLabel: string; // "33세"
  ganzhiKo: string;
  tenGod: string;
  element: El;
  score: number;
  isCurrent: boolean;
  isPeak: boolean;
}
export interface WealthField {
  key: string;
  label: string;
  emoji: string;
  score: number;
  text: string;
}
export interface WealthSinsal {
  name: string;
  meaning: string;
  good: boolean;
}
export interface PillarWealth {
  period: string; // "청년 (직업·사회)"
  has: boolean;
  tenGod: string | null;
}
export interface RichType {
  name: string; // "곳간형 부자"
  emoji: string;
  desc: string;
}
export interface Gauge {
  label: string; // "낭비형" | "절약형" ...
  value: number; // 0~100 (왼쪽 성향 비율)
  leftLabel: string;
  rightLabel: string;
  text: string;
}
export interface WealthFortuneV2 {
  score: number;
  level: string;
  tldr: string;
  grade: WealthGrade;
  gradeTitle: string;
  gradeDesc: string;
  richType: RichType;
  summaryParas: string[];
  // 재성 분포
  jeongjaePct: number;
  pyeonjaePct: number;
  jaePct: number;
  siksangPct: number;
  strengthLabel: string;
  tendency: string;
  tendencyText: string;
  siksangText: string | null;
  // v3 확장
  fourPowers: WealthPower[];
  earningMethods: string[];
  earningText: string;
  wealthFields: WealthField[];
  lifetimeFlow: LifetimeFlow[];
  goldenAge: string;
  // v4 확장
  wealthSinsal: WealthSinsal[];
  hasJaego: boolean;
  pillarWealth: PillarWealth[];
  pillarWealthText: string;
  spending: Gauge;
  investing: Gauge;
  gunGyeop: boolean;
  gunGyeopText: string | null;
  // 시기
  incomeYears: WealthTiming[];
  incomeMonths: WealthTiming[];
  cautionYears: WealthTiming[];
  thisYear: number;
  // 개운
  lucky: { color: string; direction: string; numbers: number[] };
  gaewoonTip: string;
  luckyNumbers: number[];
}

function birthStr(p: Profile): { birth: string; unknownHour: boolean; gender: "M" | "F"; lon: number } {
  const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
  return { birth: `${p.birth}T${time ?? "12:00"}`, unknownHour: !time, gender: p.gender ?? "M", lon: p.lon ?? 127.5 };
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const bandIdx = (s: number) => (s >= 70 ? 0 : s >= 52 ? 1 : 2);

function judgeGrade(jaePct: number, ratio: number, siksangPct: number): { grade: WealthGrade; title: string; desc: string } {
  const sinGang = ratio >= 0.5;
  const sinYak = ratio < 0.45;
  if (jaePct < 8) {
    return {
      grade: "재성부족",
      title: "꾸준함이 재산인 그릇",
      desc:
        "타고난 재성(財星)이 강하진 않아요. 큰돈을 한 번에 쥐기보다, 한 우물을 길게 파고 차곡차곡 모을 때 가장 단단해지는 흐름이에요. " +
        "조급한 투자나 한탕은 잘 맞지 않고, 자동 저축·연금처럼 '새지 않게 가두는' 구조를 만들면 시간이 당신 편이 됩니다. " +
        "재물운은 타고난 양보다 '운(대운·세운)에서 재성이 들어올 때'를 잘 잡는 게 핵심이에요.",
    };
  }
  if (sinYak && jaePct >= 20) {
    return {
      grade: "재다신약",
      title: "돈이 크게 오가는 그릇 (관리가 핵심)",
      desc:
        "재물이 많이 들고 나는, 스케일이 큰 사주예요. 다만 재성이 일간(나)보다 강해 '버는 힘'보다 '감당·관리하는 힘'을 받쳐주는 게 핵심이에요. " +
        "혼자 다 안으려 하기보다 믿을 만한 사람과 나누고 분산하면 오히려 그릇이 커집니다. " +
        "동업·인맥·전문가의 도움이 곧 재물을 지키는 안전벨트예요.",
    };
  }
  if (siksangPct >= 15 && jaePct >= 8) {
    return {
      grade: "식상생재",
      title: "재능으로 돈을 만드는 그릇",
      desc:
        "재능·표현·노력이 곧바로 돈이 되는 식상생재(食傷生財)의 흐름이에요. 내 기술과 콘텐츠, 손재주로 버는 힘이 강해 '일할수록 재물이 따라오는' 구조입니다. " +
        "남이 시켜서 버는 돈보다 내가 만들어 파는 돈에서 크게 터지고, 배움·기술 투자에 쓴 돈은 반드시 회수돼요. " +
        "나만의 무기를 콘텐츠·자격·브랜드로 남길수록 재물 그릇이 커집니다.",
    };
  }
  if (sinGang && jaePct >= 14) {
    return {
      grade: "신왕재왕",
      title: "타고난 부자 그릇",
      desc:
        "돈을 버는 힘과 지키는 힘이 모두 단단한 신왕재왕(身旺財旺) 구조예요. 기회가 왔을 때 과감히 잡아도 충분히 감당하는, 재물복이 좋은 그릇입니다. " +
        "리스크를 적절히 지는 결단이 오히려 약이 되고, 큰 판을 벌일수록 결과도 큽니다. " +
        "다만 자신감이 과욕이 되지 않게 한 번씩 점검만 해주면 평생 재물이 끊기지 않아요.",
    };
  }
  return {
    grade: "재물균형",
    title: "안정적으로 모으는 그릇",
    desc:
      "큰 굴곡 없이 꾸준히 재물이 쌓이는 균형형이에요. 들어온 돈을 지키며 차근차근 불려가면 만족스러운 결실로 이어집니다. " +
      "한 방보다 복리, 무리한 확장보다 내실을 택할 때 가장 빛나요. " +
      "본업을 단단히 하고 여윳돈으로만 기회를 살피면 흔들림 없이 자산이 늘어납니다.",
  };
}

const POWER_DESC: Record<string, [string, string, string]> = {
  earn: [
    "돈을 끌어오는 힘이 강해요. 기회를 만들고 수입원을 늘리는 데 타고났어요.",
    "버는 힘은 무난해요. 익숙한 분야에서 꾸준히 벌어들이는 스타일이에요.",
    "버는 힘보다 지키는 데 강점이 있어요. 한 곳에 집중할 때 효율이 올라가요.",
  ],
  grow: [
    "불리는 힘이 좋아요. 투자·확장에서 성과를 내는 공격형 자산가 기질이에요.",
    "불리는 힘은 보통이에요. 검증된 방식으로 천천히 키우는 게 잘 맞아요.",
    "불리기보다 지키기예요. 원금 보존형·안전자산이 마음 편하고 결과도 좋아요.",
  ],
  save: [
    "모으는 힘이 탁월해요. 새는 돈 없이 차곡차곡 쌓는 저축형 부자예요.",
    "모으는 힘은 무난해요. 목표를 정해두면 잘 모이는 편이에요.",
    "모으기가 약점이에요. 자동이체·강제저축으로 '먼저 떼는' 습관이 약이에요.",
  ],
  keep: [
    "지키는 힘이 강해요. 한 번 쥔 재물을 놓치지 않는 단단한 관리력이 있어요.",
    "지키는 힘은 보통이에요. 큰 지출·보증만 조심하면 충분해요.",
    "지키는 힘이 약해요. 충동지출·빌려주기·보증은 특히 단속이 필요해요.",
  ],
};

const EARN_METHODS: Record<string, string[]> = {
  사업: ["사업·창업", "유통·무역", "투자·재테크", "부동산"],
  직장: ["전문직·자격", "안정적 직장", "조직·관리직"],
  기술: ["기술·기능", "창작·콘텐츠", "강의·교육", "프리랜스·자영업"],
  학문: ["자격·전문지식", "교육·연구", "문서·기획"],
  성실: ["꾸준한 본업", "성실한 저축", "전문성 키우기"],
};

export function buildWealthFortune(p: Profile, thisYear: number): WealthFortuneV2 | null {
  if (!p?.birth) return null;
  const { birth, unknownHour, gender, lon } = birthStr(p);
  let chart;
  try {
    chart = computeManse({ birth, gender, unknownHour, longitude: lon, calendar: "solar" });
  } catch {
    return null;
  }
  const dayStem = chart.dayStemIndex;
  const tg = chart.analysis.tenGods;
  const pctOf = (name: string) => tg.find((t) => t.tenGod === name)?.percent ?? 0;
  const jeongjaePct = pctOf("정재");
  const pyeonjaePct = pctOf("편재");
  const jaePct = jeongjaePct + pyeonjaePct;
  const siksangPct = pctOf("식신") + pctOf("상관");
  const inseongPct = pctOf("정인") + pctOf("편인");
  const gwanseongPct = pctOf("정관") + pctOf("편관");
  const bigyeonPct = pctOf("비견");
  const geopjaePct = pctOf("겁재");
  const toPct = chart.analysis.elements.find((e) => e.element === "토")?.percent ?? 0;
  const st = chart.analysis.strength;
  const yong = (st.yongsin as El) ?? "토";

  const { grade, title, desc } = judgeGrade(jaePct, st.ratio, siksangPct);

  const seed = hashString(`wealthv3|${p.birth}|${p.gender ?? ""}`);
  const rnd = mulberry32(seed);
  const jitter = Math.round(rnd() * 6 - 3);
  let score = 50 + Math.min(18, jaePct * 0.7) + (st.ratio >= 0.5 ? 8 : st.ratio < 0.45 ? -4 : 2) + (siksangPct >= 12 ? 6 : 0) + jitter;
  if (grade === "신왕재왕") score += 6;
  if (grade === "재다신약") score -= 2;
  score = clamp(score, 32, 97);
  const level = score >= 80 ? "재물운 최강" : score >= 65 ? "재물운 좋음" : score >= 50 ? "무난한 재물운" : "노력형 재물운";

  // 성향(정재 vs 편재)
  let tendency: string;
  let tendencyText: string;
  if (jeongjaePct === 0 && pyeonjaePct === 0) {
    tendency = "노력형";
    tendencyText = "월급·사업 어느 쪽이든, 꾸준한 노력이 가장 확실한 수입원이에요. 운에서 재성이 들어올 때 기회를 잡으면 크게 도약해요.";
  } else if (jeongjaePct >= pyeonjaePct * 1.3) {
    tendency = "안정형 (정재)";
    tendencyText = "월급·저축·꾸준한 수입에 강해요. 한 곳에 길게 쌓을수록 빛나는 안정형 재물이에요. 한탕보다 복리가 답이에요.";
  } else if (pyeonjaePct >= jeongjaePct * 1.3) {
    tendency = "확장형 (편재)";
    tendencyText = "사업·투자·여러 수입원에 강해요. 활동 반경을 넓힐수록 큰돈의 기회가 따라오는 확장형이에요. 단, 벌인 만큼 관리도 함께 챙기세요.";
  } else {
    tendency = "균형형 (정재+편재)";
    tendencyText = "안정 수입과 기회 수입을 함께 누리는 균형형이에요. 본업을 지키며 기회를 살피면 둘 다 잡는 이상적인 구조예요.";
  }
  const siksangText =
    siksangPct >= 12 && jaePct >= 8
      ? "식상생재 — 재능·표현·노력이 곧 돈이 되는 힘이 발달했어요. 내 기술로 버는 길이 잘 풀려요."
      : null;

  // ── 재물 4능력 ──────────────────────────────────────
  const earnSc = clamp(40 + jaePct * 1.6 + siksangPct * 0.7, 15, 98);
  const growSc = clamp(40 + pyeonjaePct * 2 + siksangPct * 0.9 + (st.ratio >= 0.5 ? 10 : 0), 15, 98);
  const saveSc = clamp(40 + jeongjaePct * 1.8 + inseongPct * 0.9 + (st.ratio >= 0.45 ? 8 : 0), 15, 98);
  const keepSc = clamp(40 + st.ratio * 38 + bigyeonPct * 0.4 - geopjaePct * 1.3 + jeongjaePct * 0.5, 15, 98);
  const fourPowers: WealthPower[] = [
    { key: "earn", label: "버는 힘", emoji: "💪", score: earnSc, desc: POWER_DESC.earn![bandIdx(earnSc)]! },
    { key: "grow", label: "불리는 힘", emoji: "📈", score: growSc, desc: POWER_DESC.grow![bandIdx(growSc)]! },
    { key: "save", label: "모으는 힘", emoji: "🏦", score: saveSc, desc: POWER_DESC.save![bandIdx(saveSc)]! },
    { key: "keep", label: "지키는 힘", emoji: "🛡️", score: keepSc, desc: POWER_DESC.keep![bandIdx(keepSc)]! },
  ];

  // ── 돈 버는 방법(분야·수단) ─────────────────────────
  const cat: [string, number][] = [
    ["사업", pyeonjaePct * 2 + siksangPct * 0.5],
    ["직장", jeongjaePct * 2 + gwanseongPct * 1.5],
    ["기술", siksangPct * 2],
    ["학문", inseongPct * 1.8],
  ];
  cat.sort((a, b) => b[1] - a[1]);
  const topCat = cat[0]![1] >= 12 ? cat[0]![0] : "성실";
  const secondCat = cat[1] && cat[1][1] >= 14 && cat[1][0] !== topCat ? cat[1][0] : null;
  const earningMethods = [...EARN_METHODS[topCat]!, ...(secondCat ? EARN_METHODS[secondCat]!.slice(0, 2) : [])].slice(0, 5);
  const EARN_TXT: Record<string, string> = {
    사업: "스스로 판을 벌여 버는 돈에서 크게 터지는 사주예요. 사업·유통·투자처럼 '내 결정으로 굴리는' 수단이 잘 맞고, 여러 수입원을 동시에 두면 시너지가 납니다.",
    직장: "조직 안에서 인정받아 안정적으로 버는 힘이 강해요. 전문직·자격·관리직처럼 '신뢰가 쌓일수록 보상이 커지는' 길에서 재물이 단단해집니다.",
    기술: "내 재능과 손끝에서 돈이 나오는 사주예요. 기술·창작·강의·콘텐츠처럼 '나를 파는' 수단에서 크게 벌고, 배움에 쓴 돈은 반드시 회수됩니다.",
    학문: "전문지식·자격·문서에서 재물이 열리는 사주예요. 깊이 파고든 한 분야의 전문성이 곧 돈이 되니, 자격·연구·기획 쪽이 유리합니다.",
    성실: "특정 분야보다 성실함과 꾸준함이 가장 확실한 수입원이에요. 본업을 단단히 하고 운에서 재성이 들어올 때를 잡으면 도약합니다.",
  };
  const earningText = EARN_TXT[topCat]!;

  // ── 재물 5분야 ──────────────────────────────────────
  const FIELD_TXT: Record<string, [string, string, string]> = {
    salary: ["월급·고정수입이 탄탄해요. 꾸준한 자리에서 안정적으로 벌어들여요.", "고정수입은 무난해요. 본업을 지키면 흔들림이 적어요.", "고정수입보다 변동수입형이에요. 한 곳에 매이기보다 유연하게 벌어요."],
    biz: ["사업·투자운이 좋아요. 벌인 일이 돈으로 잘 이어져요.", "사업·투자는 신중히 가면 무난해요. 작게 시작해 키우세요.", "큰 사업·투자는 조심스러워요. 검증된 것 위주로 가세요."],
    luck: ["뜻밖의 기회·횡재수가 종종 따라요. 기회를 알아보는 눈이 있어요.", "횡재수는 보통이에요. 운보다 실력으로 버는 게 안정적이에요.", "한탕·요행은 잘 안 맞아요. 꾸준함이 가장 큰 재물이에요."],
    estate: ["부동산·자산을 모으는 힘이 좋아요. 실물자산이 잘 맞아요.", "자산운은 무난해요. 장기 보유형으로 가면 좋아요.", "부동산보다 현금·금융자산이 편한 흐름이에요."],
    manage: ["지출 관리력이 뛰어나요. 새는 돈이 적어 잘 지켜요.", "관리력은 무난해요. 큰 지출만 점검하면 충분해요.", "지출·손재 관리에 신경 쓰세요. 충동구매·보증을 단속해요."],
  };
  function fld(key: keyof typeof FIELD_TXT, sc: number, emoji: string, label: string): WealthField {
    const s = clamp(sc, 18, 97);
    return { key, label, emoji, score: s, text: FIELD_TXT[key]![bandIdx(s)]! };
  }
  const wealthFields: WealthField[] = [
    fld("salary", 42 + jeongjaePct * 2 + gwanseongPct * 0.8, "💼", "월급·고정수입운"),
    fld("biz", 42 + pyeonjaePct * 2 + siksangPct * 0.8 + (st.ratio >= 0.5 ? 8 : 0), "🏢", "사업·투자운"),
    fld("luck", 42 + pyeonjaePct * 1.8 + siksangPct * 0.3, "🍀", "횡재·기회운"),
    fld("estate", 42 + toPct * 1.4 + jeongjaePct * 1.2, "🏠", "부동산·자산운"),
    fld("manage", 42 + st.ratio * 30 - geopjaePct * 1.4 + jeongjaePct, "🔒", "지출·관리력"),
  ];

  // ── ⭐평생 재물 흐름(대운 곡선) ──────────────────────
  const currentAge = Math.max(0, thisYear - chart.birthYear);
  const dlist = chart.daewoon.list;
  const flowRaw = dlist.map((d) => ({
    age: d.age,
    score: clamp(50 + (TG_WEALTH[d.stemTenGod] ?? 0) + (TG_WEALTH[d.branchTenGod] ?? 0) * 0.6, 22, 96),
    ganzhiKo: d.ganzhiKo,
    tenGod: d.stemTenGod,
    element: d.element as El,
  }));
  const peakScore = Math.max(...flowRaw.map((f) => f.score));
  let peakAge = flowRaw[0]?.age ?? 0;
  const lifetimeFlow: LifetimeFlow[] = flowRaw.map((f, i) => {
    const next = dlist[i + 1]?.age ?? 200;
    const isCurrent = currentAge >= f.age && currentAge < next;
    const isPeak = f.score === peakScore;
    if (isPeak) peakAge = f.age;
    return { age: f.age, ageLabel: `${f.age}세`, ganzhiKo: f.ganzhiKo, tenGod: f.tenGod, element: f.element, score: f.score, isCurrent, isPeak };
  });
  const goldenAge = `${Math.floor(peakAge / 10) * 10}대 (${peakAge}~${peakAge + 9}세)`;

  // ── v4: 재고귀인 + 재물 신살 큐레이션 ────────────────
  const dayEl = chart.pillars.day.stem.element;
  const jaeEl = GEUK[dayEl];
  const myo = jaeEl ? MYO_BRANCH[jaeEl] : null;
  const pillarBranches = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour]
    .filter(Boolean)
    .map((p) => p!.branch.hanja);
  const hasJaego = !!myo && pillarBranches.includes(myo);
  const wealthSinsal: WealthSinsal[] = [];
  if (hasJaego) wealthSinsal.push({ name: "재고귀인", meaning: "땅에 돈을 묻어두는 재물 저장고 — 한 번 쥔 재물을 단단히 지키는 최강 재물 길성", good: true });
  const seenS = new Set<string>();
  for (const s of chart.analysis.sinsal) {
    const m = WEALTH_SINSAL[s.name];
    if (m && !seenS.has(s.name)) {
      seenS.add(s.name);
      wealthSinsal.push({ name: s.name, meaning: m.meaning, good: m.good });
    }
  }

  // ── v4: 기둥별 재물 위치(시기) ───────────────────────
  const pillarMeta: { p: typeof chart.pillars.year; period: string }[] = [
    { p: chart.pillars.year, period: "초년 (조상·부모덕)" },
    { p: chart.pillars.month, period: "청년 (직업·사회)" },
    { p: chart.pillars.day, period: "중년 (배우자·내실)" },
    ...(chart.pillars.hour ? [{ p: chart.pillars.hour, period: "말년 (노후·자식)" }] : []),
  ];
  const isJae = (t: string) => t === "정재" || t === "편재";
  const pillarWealth: PillarWealth[] = pillarMeta.map(({ p, period }) => {
    const tg = isJae(p.stemTenGod) ? p.stemTenGod : isJae(p.branchTenGod) ? p.branchTenGod : null;
    return { period, has: !!tg, tenGod: tg };
  });
  const richPeriods = pillarWealth.filter((x) => x.has).map((x) => x.period.split(" ")[0]);
  // 시상편재격 — 시주 천간에만 편재, 다른 기둥 천간엔 재성 없음(말년 대기만성)
  const sisangPyeonjae =
    !!chart.pillars.hour &&
    chart.pillars.hour.stemTenGod === "편재" &&
    [chart.pillars.year, chart.pillars.month, chart.pillars.day].every((p) => !isJae(p.stemTenGod));
  const pillarWealthText = richPeriods.length
    ? `당신의 재물은 ${richPeriods.join("·")} 시기에 특히 강해요.` + (sisangPyeonjae ? " 특히 말년에 크게 이루는 대기만성(시상편재) 구조예요." : "")
    : "특정 시기보다 운(대운·세운)에서 재성이 들어올 때 재물이 열리는 흐름이에요.";

  // ── v4: 소비/투자 성향 ──────────────────────────────
  const spendAggr = siksangPct + geopjaePct;
  const saveTend = inseongPct + jeongjaePct;
  const spendVal = clamp(50 + (spendAggr - saveTend) * 1.2, 8, 92); // 높을수록 낭비(쓰는)
  const spending: Gauge = {
    label: spendVal >= 60 ? "쓰며 누리는형" : spendVal <= 40 ? "아껴 모으는형" : "균형 소비형",
    value: spendVal,
    leftLabel: "절약",
    rightLabel: "소비",
    text:
      spendVal >= 60
        ? "버는 만큼 쓰며 삶을 누리는 편이에요. 즐기는 건 좋지만, 버는 돈의 일부는 먼저 떼어 가두면 완벽해요."
        : spendVal <= 40
          ? "새는 돈 없이 알뜰하게 모으는 절약형이에요. 가끔은 나를 위해 쓰는 것도 재물운엔 약이 돼요."
          : "쓸 땐 쓰고 모을 땐 모으는 균형 잡힌 소비 감각이에요.",
  };
  const investAggr = pyeonjaePct + siksangPct * 0.5;
  const investSafe = jeongjaePct + inseongPct;
  const investVal = clamp(50 + (investAggr - investSafe) * 1.3, 8, 92); // 높을수록 공격
  const investing: Gauge = {
    label: investVal >= 60 ? "공격 투자형" : investVal <= 40 ? "안정 보존형" : "균형 투자형",
    value: investVal,
    leftLabel: "안정",
    rightLabel: "공격",
    text:
      investVal >= 60
        ? "고위험·고수익에 끌리는 공격형이에요. 기회를 잘 잡지만, 분산과 손절 원칙을 정해두면 그릇이 커져요."
        : investVal <= 40
          ? "원금 보존이 우선인 안정형이에요. 예적금·우량자산·장기투자가 마음 편하고 결과도 좋아요."
          : "기회와 안전을 함께 보는 균형 투자형이에요. 여윳돈으로만 공격하면 흔들림이 적어요.",
  };

  // ── v4: 군겁쟁재(겁재 과다) 손재 경고 ────────────────
  const gunGyeop = geopjaePct >= 20;
  const gunGyeopText = gunGyeop
    ? "겁재가 강한 군겁쟁재(群劫爭財) 기운이 있어요. 동업·보증·금전 거래에서 재물이 새기 쉬우니, 돈 문제는 반드시 문서로 남기고 보증은 피하세요. 혼자보다 신뢰할 수 있는 한 명과 명확히 나누는 게 안전해요."
    : null;

  // ── v4: 부자 유형 캐릭터(가장 두드러진 1개) ──────────
  let richType: RichType;
  if (hasJaego) richType = { name: "곳간형 부자", emoji: "🏯", desc: "땅에 돈을 묻어두는 재고귀인을 지녔어요. 한 번 쌓은 재물을 좀처럼 잃지 않는, 지키고 불리는 데 강한 저장형이에요." };
  else if (sisangPyeonjae) richType = { name: "대기만성형 부자", emoji: "🌅", desc: "젊을 땐 차곡차곡 다지고 말년에 크게 이루는 시상편재 구조예요. 늦게 필수록 더 크게 피는 타입이에요." };
  else if (grade === "식상생재") richType = { name: "자수성가 재능형", emoji: "🎨", desc: "내 재능·기술·콘텐츠로 스스로 돈을 만드는 자수성가형이에요. 나를 갈고닦을수록 재물이 따라와요." };
  else if (grade === "신왕재왕") richType = { name: "타고난 큰그릇형", emoji: "👑", desc: "벌고 지키는 힘이 모두 강한 큰 그릇이에요. 과감히 판을 벌여도 감당하는 타고난 부자 기질이에요." };
  else if (gunGyeop) richType = { name: "협력·경쟁형 (분탈 주의)", emoji: "🤝", desc: "사람과 함께 벌어 크게 키우지만, 동업·돈거래에서 새기 쉬운 양면형이에요. 관리만 잡으면 큰돈을 만져요." };
  else if (grade === "재다신약") richType = { name: "스케일 큰 관리필요형", emoji: "🎢", desc: "돈이 크게 들고 나는 다이내믹한 타입이에요. 감당·관리하는 힘을 받쳐주면 그릇이 폭발적으로 커져요." };
  else if (grade === "재성부족") richType = { name: "꾸준 적립형", emoji: "🐢", desc: "타고난 재성은 약하지만, 성실과 복리로 천천히 단단해지는 거북이형이에요. 시간이 가장 강한 무기예요." };
  else richType = { name: "안정 균형형", emoji: "⚖️", desc: "큰 굴곡 없이 꾸준히 자산을 쌓는 균형형이에요. 본업을 지키며 기회를 살피면 흔들림이 없어요." };

  // ── 시기(세운·월운) ─────────────────────────────────
  function classifyYear(stemTG: string, branchTG: string, year: number, ganzhi: string): WealthTiming | null {
    if (stemTG === "정재" || branchTG === "정재") return { when: `${year}년`, ganzhi, tenGod: "정재", kind: "정재", text: "안정 수입·결실이 늘어나는 해" };
    if (stemTG === "편재" || branchTG === "편재") return { when: `${year}년`, ganzhi, tenGod: "편재", kind: "편재", text: "목돈·사업·투자 기회가 열리는 해" };
    const sik = SIKSANG.has(stemTG) ? stemTG : SIKSANG.has(branchTG) ? branchTG : null;
    if (sik) return { when: `${year}년`, ganzhi, tenGod: sik, kind: "식상", text: "재능·활동으로 수입 기회가 느는 해" };
    return null;
  }
  const years = yearLuck(dayStem, thisYear, 9);
  const incomeYears: WealthTiming[] = [];
  const cautionYears: WealthTiming[] = [];
  for (const y of years) {
    const inc = classifyYear(y.stemTenGod, y.branchTenGod, y.year, y.ganzhi);
    if (inc) incomeYears.push(inc);
    else if (y.stemTenGod === "겁재" || y.branchTenGod === "겁재")
      cautionYears.push({ when: `${y.year}년`, ganzhi: y.ganzhi, tenGod: "겁재", kind: "주의", text: "지출·보증·충동구매를 단속할 해" });
  }
  const months = monthLuck(dayStem, thisYear);
  const incomeMonths: WealthTiming[] = [];
  months.forEach((m, i) => {
    const inc = classifyYear(m.stemTenGod, m.branchTenGod, thisYear, m.ganzhi);
    if (inc) incomeMonths.push({ ...inc, when: `${i + 1}월` });
  });

  // ── 롱폼 총평 (10문단) — 사주 데이터를 흐르는 이야기로. 개별 섹션은 항목별 상세, 여긴 큰 그림·통찰.
  const summaryParas: string[] = [
    `당신의 재물 그릇은 '${title}'(${grade})이에요. 사주 명식에 그려진 '돈을 담는 그릇'의 모양으로, 얼마나 벌 수 있느냐보다 '어떻게 벌고 지키는 사람인가'를 먼저 보여줘요.`,
    `사주에서 재물을 다루는 힘은 '일간의 강약'에서 나와요. 당신의 일간은 '${st.label}'이라, ${st.ratio >= 0.5 ? "재물이라는 무거운 짐을 거뜬히 짊어지고 더 키워낼 체력을 타고났어요. 큰돈을 굴려도 휘둘리지 않는 뚝심이 있죠." : st.ratio < 0.45 ? "재물 자체는 잘 들어오지만, 그것을 지키고 관리하는 데 더 신경 써야 해요. 버는 것보다 '새지 않게 지키는 것'이 당신의 진짜 관건이에요." : "벌어들이는 힘과 지키는 힘이 균형을 이뤄요. 무리만 하지 않으면 안정적으로 재산을 쌓아갈 수 있는 든든한 구조예요."}`,
    `돈에도 저마다의 '결'이 있어요. 누군가는 한 푼 두 푼 차곡차곡 모으는 데서, 누군가는 크게 벌이고 굴리는 데서 재물복이 열리죠. 당신의 사주는 그중 어느 쪽이 더 잘 맞는지를 분명히 보여줘요.`,
    tendencyText,
    siksangText
      ? siksangText
      : `재물은 결국 당신의 능력과 노력이 세상과 만나는 지점에서 생겨나요. 가진 재능을 갈고닦아 세상에 내놓을수록, 돈은 자연스럽게 그 뒤를 따라오게 돼 있어요. 당신만의 무기를 키우는 것이 가장 확실한 재테크예요.`,
    `재물운은 평생 일정하게 흐르지 않아요. 강물처럼 들고 나는 큰 물결이 있고, 그 물결의 정점이 바로 '재물 황금기'예요. 같은 노력이라도 황금기에 하면 몇 배의 결실로 돌아오죠.`,
    incomeYears.length
      ? `당신의 재물 황금기는 ${goldenAge}예요. 가까이는 ${incomeYears[0]!.when}부터 재성·재능의 기운이 들어와 수입의 문이 넓어집니다. 이 시기엔 망설이던 도전이나 확장을 과감히 시도해볼 만해요.`
      : `당신의 재물 황금기는 ${goldenAge}예요. 그전까지는 새는 돈을 막고 그릇을 키우는 '준비기'로 삼으면, 정작 황금기가 왔을 때 훨씬 크게 거둘 수 있어요.`,
    score >= 65
      ? `다만 재물운이 좋을수록 욕심과 과신을 경계해야 해요. 잘 벌릴 때일수록 한 박자 신중하게, 분산하고 점검하는 습관이 큰돈을 끝까지 지켜줘요. 화무십일홍이라, 좋은 흐름일 때 다음을 준비하는 게 지혜예요.`
      : `지금은 크게 벌이기보다 '지키고 다지는' 데 집중할 시기예요. 무리한 투자나 보증은 피하고, 안전하게 모으는 것이 곧 재산을 늘리는 길이에요. 씨앗을 잘 보관해야 봄에 뿌릴 수 있으니까요.`,
    `재물운을 살리는 첫걸음은 의외로 '나가는 돈'에 민감해지는 거예요. 크게 들어오는 돈보다, 무심코 새는 작은 돈이 그릇을 비우거든요. 작은 자동 저축 하나, 지출을 한눈에 보는 습관 하나가 흩어진 재물 기운을 모아줘요.`,
    `결국 재물은 '버는 힘, 불리는 힘, 지키는 힘'의 균형이에요. 당신의 그릇(${title})을 정확히 알고, 황금기를 미리 준비하며, 강점은 키우고 약점은 보완한다면 — 사주가 약속한 재물복을 온전히 누릴 수 있어요. 사주는 그릇의 모양을 보여줄 뿐, 그 그릇을 무엇으로 채울지는 결국 당신의 선택이랍니다.`,
  ];

  const gaewoonTip =
    grade === "재다신약"
      ? "큰돈이 들어올 땐 혼자 안고 가지 말고, 믿을 만한 사람과 나누거나 분산하면 그릇이 커져요."
      : grade === "재성부족"
        ? "작게라도 자동 저축을 걸어두세요. 모으는 습관이 곧 재성을 키우는 개운법이에요."
        : grade === "식상생재"
          ? "내 재능을 콘텐츠·기술로 남기면 돈이 따라와요. 배움에 쓰는 돈은 아끼지 마세요."
          : `${yong} 기운(${LUCK_COLOR[yong]})을 가까이하면 재물운이 살아나요. 지갑·소품을 ${LUCK_COLOR[yong]} 계열로 바꿔보세요.`;

  const tldr =
    score >= 80 ? "한마디로, 벌고 지키는 힘이 모두 좋은 재물복이에요 💰"
      : score >= 65 ? "한마디로, 기회를 잡으면 잘 불어나는 재물운이에요 📈"
        : score >= 50 ? "한마디로, 꾸준히 모으면 단단해지는 흐름이에요 🌱"
          : "한마디로, 관리 습관이 재산을 지켜주는 시기예요 🔒";

  return {
    score, level, tldr,
    grade, gradeTitle: title, gradeDesc: desc, richType, summaryParas,
    jeongjaePct, pyeonjaePct, jaePct, siksangPct, strengthLabel: st.label, tendency, tendencyText, siksangText,
    fourPowers, earningMethods, earningText, wealthFields, lifetimeFlow, goldenAge,
    wealthSinsal, hasJaego, pillarWealth, pillarWealthText, spending, investing, gunGyeop, gunGyeopText,
    incomeYears: incomeYears.slice(0, 5), incomeMonths, cautionYears: cautionYears.slice(0, 3), thisYear,
    lucky: { color: LUCK_COLOR[yong], direction: LUCK_DIR[yong], numbers: LUCK_NUM[yong] },
    gaewoonTip,
    luckyNumbers: pickUnique((seed ^ 0x9e3779b9) >>> 0, 3, 45),
  };
}
