// 평생운 v2 — 만세 엔진(@manse/engine) 대운(10년)·십성·강약·격국으로 인생 큰 그림을.
//   타고난 기질 → 인생 대운 곡선(절정기·시련기·현재) → 인생 전환점 → 분야별 평생운5
//   → 시기별(초년·청년·중년·말년) → 인생 조언. 시드텍스트(사주 무관 랜덤) → 정확한 대운 기반.
//   ⚠️ 계산(대운·십성·강약)은 정확, 점수·문장은 룰 해석. 완결분석 X → 상담 CTA. 결정론적.
import { computeManse } from "@manse/engine";
import { hashString, mulberry32 } from "@portal/engine";
import type { Profile } from "./profile.js";

type El = "목" | "화" | "토" | "금" | "수";

// 십성 → 종합 인생운 기여도(대운 곡선·분야 점수용)
const TG_LIFE: Record<string, number> = {
  정관: 9, 정재: 8, 식신: 9, 정인: 7, 편재: 6, 편인: 3, 비견: 2, 상관: -1, 편관: -3, 겁재: -7,
};
// 십성 → 대운 테마
const TG_THEME: Record<string, string> = {
  정재: "안정·결실", 편재: "기회·확장", 정관: "성취·명예", 편관: "도전·시련", 식신: "여유·풍요",
  상관: "변화·재능", 정인: "학문·귀인", 편인: "준비·통찰", 비견: "독립·협력", 겁재: "경쟁·정리",
};
const TG_TURN: Record<string, string> = {
  정재: "성실히 쌓은 것이 결실로 돌아오는 안정의 운으로 들어서요.",
  편재: "활동 반경이 넓어지고 큰 기회가 들어오는 확장의 운이에요.",
  정관: "노력이 인정받고 사회적으로 한 단계 올라서는 성취의 운이에요.",
  편관: "압박과 변화 속에서 단련되는 도전의 운 — 넘어서면 크게 성장해요.",
  식신: "마음의 여유와 풍요가 도는 복된 운 — 즐기는 만큼 채워져요.",
  상관: "끼와 아이디어가 빛나 새 길로 전환하기 좋은 운이에요.",
  정인: "배움과 귀인의 도움이 받쳐주는 운 — 문서·자격에 운이 따라요.",
  편인: "한 발 앞을 내다보며 준비하는 운 — 속으로 단단해지는 시기예요.",
  비견: "사람으로 풀리는 운 — 동료·협력이 큰 힘이 돼요.",
  겁재: "들고 남이 잦아 정리가 필요한 운 — 지키는 데 집중하면 좋아요.",
};
// 십성 → 타고난 강점
const TG_STRENGTH: Record<string, string> = {
  정관: "책임감과 자기관리가 뛰어나 어디서든 신뢰를 얻어요",
  편관: "위기에 강하고 결단력·추진력이 남달라요",
  정재: "현실 감각과 꼼꼼한 관리 능력이 뛰어나요",
  편재: "수완이 좋고 기회를 포착하는 눈이 빨라요",
  식신: "표현력이 풍부하고 사람을 편안하게 해요",
  상관: "재능과 창의력이 넘쳐 아이디어가 마르지 않아요",
  정인: "배움이 깊고 인덕이 있어 귀인이 따라요",
  편인: "직관과 통찰이 예리하고 전문성이 깊어요",
  비견: "주관이 뚜렷하고 독립심·뚝심이 강해요",
  겁재: "사교적이고 승부 근성이 강해 추진력이 좋아요",
};
// 십성 그룹(0%) → 개발 포인트(약점)
const GROUP_WEAK: Record<string, string> = {
  재성: "현실·금전 감각을 의식적으로 챙기면 인생이 한결 수월해져요",
  관성: "체계·규율을 받아들이는 연습이 큰 도움이 돼요",
  식상: "표현과 여유를 늘리면 삶이 훨씬 풍요로워져요",
  인성: "배움과 휴식으로 나를 채우는 시간이 필요해요",
  비겁: "자기 주관과 추진력을 의식적으로 키우면 좋아요",
};
// 일간 오행 → 적성 직업군
const JOB_BY_EL: Record<El, string[]> = {
  목: ["교육·기획", "출판·언론", "의료·복지", "디자인", "환경·바이오"],
  화: ["방송·예술", "마케팅·홍보", "요리·뷰티", "IT·콘텐츠", "강연"],
  토: ["부동산·건축", "금융·중개", "행정·공무", "농업·유통", "컨설팅"],
  금: ["법률·행정", "군경·보안", "금융·회계", "기계·엔지니어", "스포츠·의료"],
  수: ["무역·유통", "연구·기획", "예술·문화", "서비스·관광", "IT·데이터"],
};
const JOB_BY_TG: Record<string, string[]> = {
  관성: ["공직·대기업", "관리·리더"],
  재성: ["사업·창업", "영업·금융"],
  식상: ["창작·강의", "프리랜스·자영"],
  인성: ["교육·연구", "전문자격"],
  비겁: ["전문직·독립", "동업·협력"],
};
// 십성 → 대운별 상세 풀이(한 단락)
const TG_DAEWOON: Record<string, string> = {
  정재: "성실히 쌓아온 것이 실속으로 돌아오는 안정의 시기예요. 무리한 확장보다 내실을 다질 때 가장 크게 거둡니다.",
  편재: "활동 반경이 넓어지고 큰 기회가 여러 갈래로 들어오는 확장의 시기예요. 분주하지만 그만큼 얻는 게 많습니다.",
  정관: "노력이 인정받고 사회적으로 한 단계 올라서는 성취의 시기예요. 책임이 커지는 만큼 자리와 신뢰가 따라옵니다.",
  편관: "압박과 변화 속에서 단련되는 도전의 시기예요. 힘들어도 이 고비를 넘기면 그릇이 부쩍 커집니다.",
  식신: "마음의 여유와 풍요가 도는 복된 시기예요. 표현·취미·먹을 복이 살아나고 사람과 기회가 모입니다.",
  상관: "끼와 아이디어가 빛나 새 길로 전환하기 좋은 시기예요. 다만 말과 감정은 한 번 다듬으면 더 좋습니다.",
  정인: "배움과 귀인의 도움이 받쳐주는 시기예요. 문서·자격·시험에 운이 따르고 마음도 안정됩니다.",
  편인: "한 발 앞을 내다보며 준비하기 좋은 시기예요. 겉으로 조용해도 속으로는 단단히 채워집니다.",
  비견: "사람으로 풀리는 시기예요. 동료·협력이 힘이 되고, 스스로 중심을 잡을수록 단단해집니다.",
  겁재: "들고 남이 잦아 정리가 필요한 시기예요. 큰 지출·보증은 단속하고 기존의 것을 지키는 데 집중하세요.",
};
// 인생 관점 신살 큐레이션(귀인·복)
const LIFE_SINSAL: Record<string, string> = {
  천을귀인: "최고의 길성 — 위기마다 귀인이 나타나 도와주는 평생의 복이에요",
  천덕귀인: "하늘의 덕 — 어려울 때 보이지 않는 도움을 받는 복이에요",
  월덕귀인: "사람의 덕 — 인복이 두터워 좋은 인연이 모여요",
  태극귀인: "전화위복 — 위기를 기회로 바꾸는 큰 복이에요",
  문창귀인: "학문의 별 — 공부·시험·자격에 운이 따라요",
  문곡귀인: "재주의 별 — 글·예술·기술 재능이 빛나요",
  학당귀인: "배움의 별 — 평생 배우고 가르치는 복이에요",
  금여: "금가마 — 안정과 귀티, 배우자 복이 따르는 길성이에요",
  암록: "숨은 녹 — 보이지 않는 후원·재물이 따라요",
  화개살: "예술·종교의 별 — 깊이와 전문성, 고독을 즐기는 재능이에요",
  역마살: "이동의 별 — 활동적이고 해외·이동에서 기회가 열려요",
  도화살: "매력의 별 — 인기와 사람을 끄는 힘이 있어요",
};

const DAY_TRAIT: Record<El, string> = {
  목: "곧고 인정 많은 성장의 기질이에요. 위로 뻗는 나무처럼 명예와 성장을 추구하고, 베풀며 키우는 데서 보람을 느껴요.",
  화: "밝고 열정적인 표현의 기질이에요. 타오르는 불처럼 솔직하고 화끈하며, 사람을 끌어당기는 빛이 있어요.",
  토: "믿음직하고 포용하는 중재의 기질이에요. 대지처럼 한결같고 신의가 있어, 사람들이 기대고 싶어 하는 사람이에요.",
  금: "단단하고 의리 있는 결단의 기질이에요. 쇠처럼 명확하고 추진력이 강해, 한번 정하면 끝까지 밀어붙여요.",
  수: "지혜롭고 유연한 적응의 기질이에요. 물처럼 흐르며 어디서든 잘 어울리고, 상황을 읽는 눈이 빨라요.",
};

export interface LifeFlowPhase {
  age: number;
  ageLabel: string;
  ganzhiKo: string;
  element: El;
  tenGod: string;
  theme: string;
  score: number;
  desc: string; // 대운별 상세 풀이(한 단락)
  isCurrent: boolean;
  isPeak: boolean;
  isLow: boolean;
}
export interface LifeType {
  name: string;
  emoji: string;
  desc: string;
}
export interface LifeBlessing {
  key: string;
  label: string;
  emoji: string;
  score: number;
  text: string;
}
export interface LifeSinsal {
  name: string;
  meaning: string;
}
export interface LifeElement {
  element: El;
  percent: number;
}
export interface LifeField {
  key: string;
  label: string;
  emoji: string;
  score: number;
  text: string;
}
export interface LifePeriod {
  label: string; // 초년/청년/중년/말년
  ageRange: string;
  score: number;
  text: string;
}
export interface LifeTurning {
  age: number;
  tenGod: string;
  text: string;
}
export interface LifeFortuneV2 {
  dayLabel: string;
  gyeokguk: string;
  strengthLabel: string;
  character: string;
  lifeType: LifeType;
  hashtags: string[];
  summaryParas: string[];
  strengths: string[];
  weaknesses: string[];
  aptitudeJobs: string[];
  aptitudeText: string;
  blessings: LifeBlessing[];
  elements: LifeElement[];
  yongsin: string;
  elementTip: string;
  lifeSinsal: LifeSinsal[];
  flow: LifeFlowPhase[];
  goldenAge: string;
  hardAge: string;
  turningPoints: LifeTurning[];
  fields: LifeField[];
  periods: LifePeriod[];
  advice: string;
  motto: string;
  tldr: string;
}

function birthStr(p: Profile): { birth: string; unknownHour: boolean; gender: "M" | "F"; lon: number } {
  const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
  return { birth: `${p.birth}T${time ?? "12:00"}`, unknownHour: !time, gender: p.gender ?? "M", lon: p.lon ?? 127.5 };
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const bandIdx = (s: number) => (s >= 70 ? 0 : s >= 52 ? 1 : 2);

const FIELD_TXT: Record<string, [string, string, string]> = {
  career: ["직업·사회운이 좋아요. 능력을 인정받고 자리를 잡아 크게 성취하는 인생이에요.", "직업운은 무난해요. 한 분야에서 꾸준히 쌓으면 안정적으로 자리 잡아요.", "조직보다 내 방식이 맞는 편이에요. 전문성·기술로 홀로서기 할 때 빛나요."],
  wealth: ["재물운이 좋아요. 벌고 모으는 힘이 받쳐줘 풍요로운 인생이에요.", "재물운은 무난해요. 큰 욕심 없이 꾸준히 모으면 부족함 없이 살아요.", "재물은 시기를 잘 타는 편이에요. 운이 좋은 대운에 집중하면 도약해요."],
  love: ["애정·결혼운이 따뜻해요. 좋은 인연을 만나 안정된 가정을 이루는 복이 있어요.", "애정운은 무난해요. 진심을 표현할수록 인연이 깊어져요.", "인연은 늦게 무르익는 편이에요. 서두르지 않으면 더 좋은 짝을 만나요."],
  health: ["건강운이 좋아요. 타고난 기운이 균형 잡혀 활력이 오래가는 편이에요.", "건강운은 무난해요. 규칙적인 리듬만 지키면 큰 탈이 없어요.", "기운의 균형을 챙기면 좋아요. 무리·과로를 줄이는 게 평생 건강의 열쇠예요."],
  relation: ["인복이 많아요. 사람으로 풀리고 귀인의 도움을 받는 인생이에요.", "인간관계는 무난해요. 진실하게 대하면 좋은 사람이 곁에 남아요.", "넓게보다 깊게 사귀는 편이에요. 소수의 진짜 인연이 큰 힘이 돼요."],
};
function fld(key: keyof typeof FIELD_TXT, sc: number, emoji: string, label: string): LifeField {
  const s = clamp(sc, 20, 97);
  return { key, label, emoji, score: s, text: FIELD_TXT[key]![bandIdx(s)]! };
}

/** 평생운 v2 — 프로필 + 기준 연도(현재 나이 계산용, 엔진은 Date 미사용). */
export function buildLifeFortune(p: Profile, thisYear: number): LifeFortuneV2 | null {
  if (!p?.birth) return null;
  const { birth, unknownHour, gender, lon } = birthStr(p);
  let chart;
  try {
    chart = computeManse({ birth, gender, unknownHour, longitude: lon, calendar: "solar" });
  } catch {
    return null;
  }
  const tg = chart.analysis.tenGods;
  const pctOf = (n: string) => tg.find((t) => t.tenGod === n)?.percent ?? 0;
  const jae = pctOf("정재") + pctOf("편재");
  const gwan = pctOf("정관") + pctOf("편관");
  const sik = pctOf("식신") + pctOf("상관");
  const sikshin = pctOf("식신");
  const bigyeon = pctOf("비견");
  const geopjae = pctOf("겁재");
  const pyeongwan = pctOf("편관");
  const sanggwan = pctOf("상관");
  const st = chart.analysis.strength;
  const dayEl = chart.pillars.day.stem.element as El;
  const dayLabel = chart.pillars.day.stem.ko;
  const gyeokguk = chart.analysis.gyeokguk;

  const seed = hashString(`lifev2|${p.birth}|${p.gender ?? ""}`);
  const rnd = mulberry32(seed);
  const jit = () => Math.round(rnd() * 6 - 3);

  // ── 대운 곡선 ───────────────────────────────────────
  const currentAge = Math.max(0, thisYear - chart.birthYear);
  const dlist = chart.daewoon.list;
  const raw = dlist.map((d) => ({
    age: d.age,
    score: clamp(50 + (TG_LIFE[d.stemTenGod] ?? 0) + (TG_LIFE[d.branchTenGod] ?? 0) * 0.5, 22, 96),
    ganzhiKo: d.ganzhiKo,
    element: d.element as El,
    tenGod: d.stemTenGod,
  }));
  const peakScore = Math.max(...raw.map((r) => r.score));
  const lowScore = Math.min(...raw.map((r) => r.score));
  let peakAge = raw[0]?.age ?? 0;
  let lowAge = raw[0]?.age ?? 0;
  const flow: LifeFlowPhase[] = raw.map((r, i) => {
    const next = dlist[i + 1]?.age ?? 200;
    const isCurrent = currentAge >= r.age && currentAge < next;
    const isPeak = r.score === peakScore;
    const isLow = r.score === lowScore;
    if (isPeak) peakAge = r.age;
    if (isLow) lowAge = r.age;
    const tail = r.score >= 70 ? " 운이 활짝 열리니 과감히 도전하기 좋아요." : r.score < 45 ? " 욕심을 줄이고 기본을 챙기며 다음을 준비하세요." : "";
    const desc = (TG_DAEWOON[r.tenGod] ?? `${r.element} 기운이 흐르는 전환의 시기예요.`) + tail;
    return { age: r.age, ageLabel: `${r.age}세`, ganzhiKo: r.ganzhiKo, element: r.element, tenGod: r.tenGod, theme: TG_THEME[r.tenGod] ?? "전환", score: r.score, desc, isCurrent, isPeak, isLow };
  });
  const decade = (a: number) => `${Math.floor(a / 10) * 10}대`;
  const goldenAge = `${decade(peakAge)} (${peakAge}~${peakAge + 9}세)`;
  const hardAge = `${decade(lowAge)} (${lowAge}~${lowAge + 9}세)`;

  // ── 인생 전환점 (대운 시작 나이, 청년~노년 위주) ──────
  const turningPoints: LifeTurning[] = flow
    .filter((f) => f.age >= 10 && f.age <= 70)
    .slice(0, 6)
    .map((f) => ({ age: f.age, tenGod: f.tenGod, text: TG_TURN[f.tenGod] ?? `${f.element} 기운이 인생을 이끄는 시기로 전환해요.` }));

  // ── 분야별 평생운 5 ─────────────────────────────────
  const loveBias = gender === "M" ? jae : gwan; // 남=재성(배우자)·여=관성(배우자)
  const healthBase = 55 + (1 - Math.abs(st.ratio - 0.5) * 2) * 14 + sikshin * 0.4 - (pyeongwan + sanggwan) * 0.3;
  const fields: LifeField[] = [
    fld("career", 50 + gwan * 1.4 + sik * 0.5 + jit(), "💼", "직업·성공운"),
    fld("wealth", 50 + jae * 1.6 + sik * 0.4 + jit(), "💰", "재물운"),
    fld("love", 50 + loveBias * 1.3 + jit(), "💕", "애정·결혼운"),
    fld("health", healthBase + jit(), "🩺", "건강운"),
    fld("relation", 50 + (bigyeon + sik) * 0.7 - geopjae * 0.6 + jit(), "🤝", "인간관계운"),
  ];

  // ── 시기별(초년·청년·중년·말년) ─────────────────────
  function periodScore(lo: number, hi: number): number {
    const ph = flow.filter((f) => f.age >= lo && f.age < hi);
    if (!ph.length) {
      // 가장 가까운 대운으로 대체
      const near = flow.reduce((a, b) => (Math.abs(b.age - lo) < Math.abs(a.age - lo) ? b : a), flow[0]!);
      return near.score;
    }
    return Math.round(ph.reduce((s, f) => s + f.score, 0) / ph.length);
  }
  const PERIOD_TXT: Record<string, [string, string, string]> = {
    초년: ["일찍부터 두각을 드러내고 복이 따르는 시기예요.", "큰 굴곡 없이 자라며 기반을 다지는 시기예요.", "다소 더디지만 내공을 쌓는 준비의 시기예요."],
    청년: ["기회가 활짝 열려 크게 도약하는 황금의 시기예요.", "차근차근 자리를 잡아가는 순조로운 시기예요.", "시행착오로 단련되며 방향을 찾는 시기예요."],
    중년: ["인생의 결실을 거두고 가장 빛나는 전성기예요.", "안정 속에 꾸준히 성취를 쌓는 시기예요.", "한 번 정비하고 재도약을 준비하는 시기예요."],
    말년: ["여유와 존경 속에 풍요로운 노년을 누리는 시기예요.", "큰 부족함 없이 편안하게 흐르는 시기예요.", "건강과 마음을 챙기며 천천히 가는 시기예요."],
  };
  const periodDefs: [string, number, number, string][] = [
    ["초년", 0, 20, "0~10대"],
    ["청년", 20, 40, "20~30대"],
    ["중년", 40, 60, "40~50대"],
    ["말년", 60, 200, "60대 이후"],
  ];
  const periods: LifePeriod[] = periodDefs.map(([label, lo, hi, range]) => {
    const sc = periodScore(lo, hi);
    return { label, ageRange: range, score: sc, text: PERIOD_TXT[label]![bandIdx(sc)]! };
  });

  // ── 타고난 기질 + 총평 ──────────────────────────────
  const strongClause =
    st.ratio >= 0.5
      ? "기운이 단단해 스스로 길을 개척하는 힘이 강하고"
      : st.ratio < 0.45
        ? "주변과 어울리며 도움 속에 풀려가는 힘이 있고"
        : "강약이 균형 잡혀 안과 밖을 두루 살피는 힘이 있고";
  const character = `${DAY_TRAIT[dayEl]} 사주로 보면 '${gyeokguk}'의 격으로, ${strongClause} 일간 ${dayLabel}(${dayEl})의 색이 인생 전반에 흐릅니다.`;

  const overallAvg = Math.round(flow.reduce((s, f) => s + f.score, 0) / flow.length);
  const summaryParas: string[] = [
    `인생 전체를 하나의 긴 강물로 본다면, 당신의 삶은 '${gyeokguk}'이라는 큰 물줄기를 따라 흘러가요. 격(格)은 타고난 삶의 틀이자 그릇으로, 당신이 어떤 방식으로 세상을 살아가고 무엇을 이룰 사람인지를 보여줘요.`,
    `당신의 본바탕은 일간 ${dayLabel}(${dayEl})에 담겨 있어요. 이 한 글자가 평생 당신의 성정과 선택, 인생의 색깔을 물들이죠. 같은 일을 겪어도 사람마다 다르게 반응하는 건, 바로 이 본바탕이 저마다 다르기 때문이에요.`,
    `사주를 지탱하는 힘의 균형, 즉 일간의 강약도 인생을 크게 좌우해요. 당신은 ${st.ratio >= 0.5 ? "스스로 밀고 나가는 힘이 강한 쪽이에요. 주관이 뚜렷하고 추진력이 좋아, 자기 길을 개척하는 데 강하죠." : st.ratio < 0.45 ? "주변과 어울리며 도움 속에 풀려가는 쪽이에요. 혼자보다 함께일 때, 좋은 인연을 만났을 때 더 큰 힘을 내요." : "강약이 균형 잡혀, 안과 밖을 두루 살피는 힘이 있어요. 상황에 따라 나설 때와 물러설 때를 아는 유연함이 강점이에요."}`,
    `인생은 평탄한 직선이 아니라 오르내리는 굴곡의 연속이에요. 사주는 그 굴곡의 큰 지도를 미리 펼쳐 보여줘요. ${overallAvg >= 62 ? "당신의 인생 지도는 굴곡이 완만하고 복이 끊이지 않는 안정형이에요. 큰 욕심만 다스리면 평생 무탈하게 풀려가요." : "당신의 인생 지도는 굴곡이 제법 있지만, 그 굽이굽이가 당신을 단련시켜 후반으로 갈수록 단단해지는 대기만성형이에요."}`,
    `인생에는 누구에게나 가장 빛나는 '황금기'가 있어요. 운의 바람이 등 뒤에서 밀어주는, 무엇을 해도 잘 풀리는 시기죠. 같은 노력이라도 이때 하면 몇 배의 결실로 돌아와요.`,
    `당신의 황금기는 ${goldenAge}예요. 이 시기엔 미뤄둔 도전, 큰 결정, 새로운 시작을 과감히 해볼 만해요. 인생의 가장 큰 열매가 이때 맺힐 가능성이 높거든요.`,
    `반대로 ${hardAge}는 운의 바람이 잠시 거슬러 부는 시기예요. 하지만 이때는 '실패의 시기'가 아니라 '내실을 다지는 시기'예요. 무리하게 벌이기보다 배우고 준비하면, 오히려 다음 도약의 든든한 발판이 돼요.`,
    `사주에서 10년마다 바뀌는 '대운(大運)'은 인생의 계절과 같아요. 봄에 씨 뿌리고 여름에 가꾸고 가을에 거두듯, 각 계절에 맞는 일을 하면 힘은 덜 들고 결실은 커져요. 자신의 흐름을 알면 '언제 나아가고 언제 멈출지'를 지혜롭게 정할 수 있어요.`,
    st.ratio >= 0.5
      ? `당신은 스스로 밀고 나가는 추진력이 강한 사람이에요. 그 힘이 큰일을 이루게 하지만, 한 번씩 주변의 조언을 듣고 속도를 조절하면 더 멀리, 더 오래 갈 수 있어요.`
      : `당신은 사람들과 어울리며 도움 속에 풀려가는 힘이 있어요. 혼자 다 짊어지기보다 좋은 인연의 도움을 잘 받을 때, 인생이 한결 가벼워지고 크게 열려요.`,
    `결국 사주는 정해진 운명이 아니라, 당신이라는 사람의 '사용설명서'에 가까워요. 타고난 성정을 이해하고, 황금기를 미리 준비하고, 시련기를 지혜롭게 넘긴다면 — 당신은 사주가 그린 가장 좋은 그림을 현실로 만들 수 있어요. 인생의 붓은 결국 당신 손에 쥐어져 있으니까요.`,
  ];

  const advice =
    st.ratio >= 0.5
      ? "추진력이 강한 만큼, 한 번씩 주변의 조언을 듣고 속도를 조절하면 더 멀리 갑니다."
      : "혼자 다 짊어지기보다 사람의 도움을 잘 받을 때 인생이 한결 가벼워지고 크게 풀려요.";
  const tldr =
    overallAvg >= 68 ? "한마디로, 복이 끊이지 않는 든든한 인생이에요 🍀"
      : overallAvg >= 55 ? "한마디로, 갈수록 단단해지는 대기만성 인생이에요 🌳"
        : "한마디로, 시기를 잘 타면 크게 빛나는 인생이에요 ✨";

  // ── v3: 강점/약점 ───────────────────────────────────
  const tgSorted = [...tg].filter((t) => t.percent > 0).sort((a, b) => b.percent - a.percent);
  const strengths = tgSorted.slice(0, 3).map((t) => TG_STRENGTH[t.tenGod]).filter((x): x is string => !!x);
  if (strengths.length === 0) strengths.push("균형 잡힌 사주라 어느 한쪽에 치우치지 않는 게 강점이에요");
  const groupPct: Record<string, number> = {
    재성: jae, 관성: gwan, 식상: sik, 인성: pctOf("정인") + pctOf("편인"), 비겁: bigyeon + geopjae,
  };
  const weaknesses = Object.entries(groupPct).filter(([, v]) => v === 0).map(([k]) => GROUP_WEAK[k]).filter((x): x is string => !!x).slice(0, 2);
  if (weaknesses.length === 0) weaknesses.push("큰 약점은 없지만, 강한 기운이 과하지 않도록 균형을 살피면 좋아요");

  // ── v3: 인생 캐릭터 유형 + 해시태그 ──────────────────
  const topTg = tgSorted[0]?.tenGod ?? "비견";
  const TYPE_BY_TG: Record<string, LifeType> = {
    정관: { name: "신뢰받는 리더형", emoji: "🎖️", desc: "책임감과 원칙으로 사람을 이끄는, 어디서든 인정받는 인생이에요." },
    편관: { name: "난세의 영웅형", emoji: "⚔️", desc: "위기에 강하고 판을 뒤집는 추진력으로 크게 이루는 인생이에요." },
    정재: { name: "착실한 자산가형", emoji: "🏦", desc: "성실과 관리로 차곡차곡 쌓아 안정과 풍요를 이루는 인생이에요." },
    편재: { name: "기회를 잡는 승부사형", emoji: "🎯", desc: "수완과 배포로 큰 기회를 잡아 스케일 있게 사는 인생이에요." },
    식신: { name: "복 많은 미식가형", emoji: "🍀", desc: "여유와 표현으로 사람과 복을 끌어모으는 풍요로운 인생이에요." },
    상관: { name: "재능 폭발 아티스트형", emoji: "🎨", desc: "끼와 창의로 자기 세계를 만드는, 빛나는 재능의 인생이에요." },
    정인: { name: "귀인이 따르는 현자형", emoji: "📚", desc: "배움과 인덕으로 귀인의 도움 속에 풀려가는 인생이에요." },
    편인: { name: "통찰의 전문가형", emoji: "🔮", desc: "예리한 직관과 깊은 전문성으로 한 분야를 통달하는 인생이에요." },
    비견: { name: "뚝심의 독립가형", emoji: "🧗", desc: "주관과 뚝심으로 스스로 길을 개척하는 단단한 인생이에요." },
    겁재: { name: "열정의 승부사형", emoji: "🔥", desc: "승부 근성과 사교성으로 부딪히며 키워가는 다이내믹한 인생이에요." },
  };
  const lifeType = TYPE_BY_TG[topTg] ?? { name: "균형의 조화형", emoji: "⚖️", desc: "치우침 없이 두루 갖춘, 안정적으로 흘러가는 인생이에요." };
  const TAG_BY_TG: Record<string, string> = { 정관: "#책임감甲", 편관: "#위기에강함", 정재: "#알뜰살뜰", 편재: "#기회포착", 식신: "#복덩이", 상관: "#재능만렙", 정인: "#귀인복", 편인: "#통찰력", 비견: "#뚝심", 겁재: "#승부사" };
  const tagSet = new Set<string>();
  if (overallAvg >= 62) tagSet.add("#복많은사주"); else tagSet.add("#대기만성");
  tgSorted.slice(0, 2).forEach((t) => TAG_BY_TG[t.tenGod] && tagSet.add(TAG_BY_TG[t.tenGod]!));
  tagSet.add(`#${gyeokguk}`);
  if (st.ratio >= 0.5) tagSet.add("#자기주도"); else tagSet.add("#인복형");
  const hashtags = [...tagSet].slice(0, 5);

  // ── v3: 천직·적성 ───────────────────────────────────
  const topGroup = (Object.entries(groupPct).sort((a, b) => b[1] - a[1])[0] ?? ["재성", 0])[0];
  const aptitudeJobs = [...new Set([...(JOB_BY_EL[dayEl] ?? []), ...(JOB_BY_TG[topGroup] ?? [])])].slice(0, 6);
  const aptitudeText = `일간 ${dayLabel}(${dayEl})의 기질에 ${topGroup}이 발달해, ${aptitudeJobs.slice(0, 3).join("·")} 같은 분야에서 특히 빛나요. 타고난 능력을 살릴 수 있는 일을 택할수록 성취가 커집니다.`;

  // ── v3: 타고난 복 5 ─────────────────────────────────
  const cheoneul = chart.analysis.sinsal.some((s) => s.name === "천을귀인");
  const blessText = (key: string, sc: number): string => {
    const i = bandIdx(sc);
    const M: Record<string, [string, string, string]> = {
      재복: ["타고난 재복이 두터워 돈이 따르는 인생이에요.", "재복은 무난해요. 성실히 모으면 부족함이 없어요.", "재물은 운의 시기를 잘 타는 편이에요."],
      관복: ["명예·관운이 좋아 사회적으로 인정받는 복이 있어요.", "관운은 무난해요. 꾸준함으로 자리를 잡아요.", "조직보다 내 길을 갈 때 더 빛나요."],
      인복: ["귀인이 끊이지 않는, 사람 복이 큰 인생이에요.", "인복은 무난해요. 진심을 다하면 좋은 인연이 남아요.", "넓게보다 깊게 사귈 때 진짜 인복이 와요."],
      식복: ["의식주·표현의 복이 풍성한 여유로운 인생이에요.", "식복은 무난해요. 누리는 만큼 채워져요.", "여유와 표현을 늘리면 복이 커져요."],
      건강복: ["기운이 균형 잡혀 건강 복이 좋은 편이에요.", "건강은 무난해요. 규칙만 지키면 탈이 없어요.", "기운의 균형을 챙기는 게 건강의 열쇠예요."],
    };
    return M[key]![i]!;
  };
  const inseongPct = pctOf("정인") + pctOf("편인");
  const blessings: LifeBlessing[] = [
    { key: "재복", label: "재복", emoji: "💰", score: clamp(48 + jae * 1.6, 20, 97), text: "" },
    { key: "관복", label: "관복·명예", emoji: "🎖️", score: clamp(48 + gwan * 1.6, 20, 97), text: "" },
    { key: "인복", label: "인복·귀인", emoji: "🤝", score: clamp(48 + inseongPct * 1.4 + (cheoneul ? 10 : 0), 20, 97), text: "" },
    { key: "식복", label: "식복·여유", emoji: "🍀", score: clamp(48 + sik * 1.4 + sikshin * 0.5, 20, 97), text: "" },
    { key: "건강복", label: "건강복", emoji: "🩺", score: clamp(healthBase, 20, 97), text: "" },
  ].map((b) => ({ ...b, text: blessText(b.key, b.score) }));

  // ── v3: 오행 분포 + 개운 ────────────────────────────
  const elements: LifeElement[] = (["목", "화", "토", "금", "수"] as El[]).map((el) => ({
    element: el,
    percent: chart.analysis.elements.find((e) => e.element === el)?.percent ?? 0,
  }));
  const yongsin = st.yongsin;
  const lack = [...elements].sort((a, b) => a.percent - b.percent)[0]!;
  const elementTip = `타고난 기운 중 ${lack.element}이(가) 가장 약하고, 필요한 기운(용신)은 ${yongsin}이에요. ${yongsin} 기운을 더하는 색·방향·활동을 가까이하면 인생이 한결 순조로워져요.`;

  // ── v3: 귀인·복 신살 ────────────────────────────────
  const seenS = new Set<string>();
  const lifeSinsal: LifeSinsal[] = [];
  for (const s of chart.analysis.sinsal) {
    const m = LIFE_SINSAL[s.name];
    if (m && !seenS.has(s.name)) { seenS.add(s.name); lifeSinsal.push({ name: s.name, meaning: m }); }
  }

  // ── v3: 인생 명언 ───────────────────────────────────
  const MOTTO = [
    "급할수록 돌아가라 — 당신의 운은 길게 봐야 빛나요.",
    "사람이 곧 재산이에요 — 인연을 귀히 여기세요.",
    "타고난 그릇보다 그것을 쓰는 법이 인생을 만들어요.",
    "흐름을 거스르지 말고, 좋은 때를 기다려 올라타세요.",
  ];
  const motto = MOTTO[Math.floor(rnd() * MOTTO.length)]!;

  return {
    dayLabel,
    gyeokguk,
    strengthLabel: st.label,
    character,
    lifeType,
    hashtags,
    summaryParas,
    strengths,
    weaknesses,
    aptitudeJobs,
    aptitudeText,
    blessings,
    elements,
    yongsin,
    elementTip,
    lifeSinsal,
    flow,
    goldenAge,
    hardAge,
    turningPoints,
    fields,
    periods,
    advice,
    motto,
    tldr,
  };
}
