// 신년·월간 운세 = 만세 엔진의 세운(년)·월운(월) + 일간 십성 관계로 산출. 결정론적.
// ⚠️ AI 아님(규칙기반 풍성 맛보기). 깊은 풀이는 상담으로([[project_no_ai_saju_analysis]]).
import { computeManse, yearLuck, monthLuck } from "@manse/engine";
import type { Profile } from "./profile.js";

type El = "목" | "화" | "토" | "금" | "수";

// 십성 → 점수 보정(일일 엔진과 동일 기조)
const TG_SCORE: Record<string, number> = {
  비견: 4, 겁재: -5, 식신: 9, 상관: -2, 정재: 12, 편재: 7, 정관: 12, 편관: -3, 정인: 9, 편인: 3,
};
const TG_THEME: Record<string, string> = {
  정재: "안정과 결실", 편재: "기회와 확장", 정관: "인정과 도약", 편관: "도전과 변화",
  식신: "여유와 표현", 상관: "재능과 전환", 정인: "배움과 귀인", 편인: "통찰과 준비",
  비견: "협력과 자립", 겁재: "정리와 경쟁",
};
const TG_LONG: Record<string, string> = {
  정재: "꾸준히 쌓아온 것이 실속으로 돌아오는 흐름입니다. 무리한 확장보다 내실을 다질 때 가장 크게 거둡니다.",
  편재: "활동 반경을 넓힐수록 기회가 따라오는 흐름입니다. 여러 갈래의 일이 동시에 들어와 분주하지만 그만큼 얻습니다.",
  정관: "노력이 인정받고 한 단계 올라서는 흐름입니다. 책임이 커지는 만큼 신뢰와 자리가 함께 따라옵니다.",
  편관: "강한 압박과 변화의 기운 속에서 정면돌파가 통하는 흐름입니다. 두려움보다 결단이 길을 엽니다.",
  식신: "마음의 여유가 생기고 표현·취미·먹을 복이 살아나는 흐름입니다. 즐기는 만큼 사람과 기회가 모입니다.",
  상관: "끼와 아이디어가 빛나 새로운 길로 전환하기 좋은 흐름입니다. 다만 말과 감정은 한 번 다듬는 게 이롭습니다.",
  정인: "배움과 귀인의 도움이 받쳐주는 흐름입니다. 문서·계약·시험에 운이 따르고 마음도 안정됩니다.",
  편인: "한 발 앞을 내다보며 준비하기 좋은 흐름입니다. 겉으로 조용해도 속으로는 단단히 채워지는 시기입니다.",
  비견: "사람으로 풀리는 흐름입니다. 동료·동업·협력이 힘이 되며 스스로 중심을 잡을수록 단단해집니다.",
  겁재: "들고 남이 잦아 정리가 필요한 흐름입니다. 큰 지출·보증·충동은 단속하고 기존의 것을 지키는 데 집중하세요.",
};
const LUCK_COLOR: Record<El, string> = { 목: "초록·연두", 화: "빨강·분홍", 토: "노랑·베이지", 금: "흰색·은색", 수: "파랑·검정" };
const LUCK_DIR: Record<El, string> = { 목: "동쪽", 화: "남쪽", 토: "중앙·남서", 금: "서쪽", 수: "북쪽" };
const LUCK_NUM: Record<El, number[]> = { 수: [1, 6], 화: [2, 7], 목: [3, 8], 금: [4, 9], 토: [5, 10] };
const LUCK_ITEM: Record<El, string> = { 목: "화분·책", 화: "향초·붉은 소품", 토: "도자기·다이어리", 금: "시계·금속 소품", 수: "텀블러·유리 소품" };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function bandLine(score: number): string {
  if (score >= 75) return "전반적으로 기운이 활짝 열려 있어, 미뤄둔 일을 과감히 밀어붙여도 좋은 시기입니다.";
  if (score >= 60) return "큰 굴곡 없이 순조롭게 흘러가니, 평소의 리듬을 지키며 기회를 살피면 충분합니다.";
  if (score >= 45) return "잔잔하게 다지는 시기입니다. 욕심보다 마무리에 집중하면 만족스러운 결과로 이어집니다.";
  return "한 박자 쉬어가는 시기입니다. 서두르지 말고 컨디션과 기본을 챙기면 다음 흐름이 가벼워집니다.";
}

export interface PeriodField { key: string; label: string; emoji: string; score: number; text: string }
export interface PeriodFlow { label: string; ganzhiKo: string; element: El; tenGod: string; score: number }
export interface PeriodFortune {
  kind: "year" | "month";
  label: string;
  ganzhi: string; ganzhiKo: string; element: El; tenGod: string; theme: string;
  overall: number; headline: string;
  summaryParas: string[];
  fields: PeriodField[];
  flow: PeriodFlow[];
  lucky: { color: string; numbers: number[]; direction: string; item: string };
  advice: string;
  subjectLabel: string;
  basis: string;
}

function birthStr(p: Profile): { birth: string; unknownHour: boolean; gender: "M" | "F"; lon: number } {
  const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
  return { birth: `${p.birth}T${time ?? "12:00"}`, unknownHour: !time, gender: p.gender ?? "M", lon: p.lon ?? 127.5 };
}

function scoreOf(tenGod: string, seed: number): number {
  const base = 52 + (TG_SCORE[tenGod] ?? 0);
  const jitter = ((seed % 9) - 4); // -4~+4 결정론적 변주
  return clamp(Math.round(base + jitter), 18, 96);
}

function fieldsOf(overall: number, tenGod: string): PeriodField[] {
  const has = (s: string[]) => s.includes(tenGod);
  const bias: Record<string, number> = {
    love: has(["정관", "편관", "정재", "편재"]) ? 8 : has(["비견", "겁재"]) ? -5 : 0,
    money: has(["정재", "편재"]) ? 11 : tenGod === "겁재" ? -8 : 0,
    work: has(["정관", "정인"]) ? 9 : tenGod === "상관" ? -7 : 0,
    health: has(["식신", "정인"]) ? 6 : has(["편관", "상관", "겁재"]) ? -6 : 0,
    relation: has(["식신", "상관", "비견"]) ? 7 : tenGod === "편관" ? -4 : 0,
  };
  const META: [string, string, string][] = [
    ["love", "애정운", "💕"], ["money", "재물운", "💰"], ["work", "직장·학업운", "💼"],
    ["health", "건강운", "🩺"], ["relation", "인간관계운", "🤝"],
  ];
  const TXT: Record<string, [string, string, string]> = {
    love: ["인연과 마음이 활짝 열리는 시기. 표현할수록 가까워져요.", "잔잔하게 따뜻한 흐름, 자연스럽게 다가가면 좋아요.", "오해가 생기기 쉬우니 말은 한 번 더 고르세요."],
    money: ["재물의 문이 열려 들어오는 돈이 늘어요.", "수입·지출이 균형을 이루는 무난한 흐름.", "충동지출·큰 약속은 잠시 미루는 게 안전해요."],
    work: ["인정받고 한 단계 올라설 기회가 와요.", "맡은 일을 차근차근 다지기 좋은 흐름.", "마무리 점검을 한 번 더, 욕심은 내려놓으세요."],
    health: ["활력이 도는 시기, 새 운동을 시작하기 좋아요.", "규칙적인 리듬만 지키면 무난해요.", "피로가 쌓이기 쉬우니 충분히 쉬어가세요."],
    relation: ["사람 복이 따르는 시기, 좋은 인연이 들어와요.", "무난한 교류, 평소대로면 충분해요.", "구설·말다툼에 휘말리지 않게 조심하세요."],
  };
  return META.map(([key, label, emoji]) => {
    const sc = clamp(overall + (bias[key] ?? 0), 12, 97);
    const i = sc >= 67 ? 0 : sc >= 50 ? 1 : 2;
    return { key, label, emoji, score: sc, text: TXT[key]![i] };
  });
}

/** 신년/월간 운세 — kind에 따라 세운(년) 또는 월운(월). */
export function buildPeriodFortune(p: Profile, kind: "year" | "month", thisYear: number, thisMonth: number): PeriodFortune {
  const { birth, unknownHour, gender, lon } = birthStr(p);
  const chart = computeManse({ birth, gender, unknownHour, longitude: lon, calendar: "solar" });
  const dayStem = chart.dayStemIndex;
  const dayLabelKo = chart.pillars.day.stem.ko;
  const dayEl = chart.pillars.day.stem.element;
  const subjectLabel = `${dayLabelKo}(${dayEl}) 일간`;

  if (kind === "year") {
    const yl = yearLuck(dayStem, thisYear, 1)[0]!;
    const tenGod = yl.stemTenGod;
    const el = yl.element as El;
    const seed = thisYear + dayStem * 13;
    const overall = scoreOf(tenGod, seed);
    const months = monthLuck(dayStem, thisYear);
    const flow: PeriodFlow[] = months.map((m, i) => ({
      label: `${i + 1}월`, ganzhiKo: m.ganzhiKo, element: m.element as El, tenGod: m.stemTenGod, score: scoreOf(m.stemTenGod, seed + i * 7),
    }));
    return {
      kind, label: `${thisYear}년`, ganzhi: yl.ganzhi, ganzhiKo: yl.ganzhiKo, element: el, tenGod, theme: TG_THEME[tenGod] ?? "전환",
      overall, headline: `올해는 '${TG_THEME[tenGod] ?? "전환"}'의 해`,
      summaryParas: [
        `${thisYear}년 세운(歲運)은 ${yl.ganzhi}(${yl.ganzhiKo})로, 당신의 일간 ${dayLabelKo}에게 '${tenGod}'의 기운으로 들어옵니다. 세운은 한 해 전체에 흐르는 큰 바람과 같아서, 올 한 해 당신이 마주할 일들의 결과 분위기를 정해요.`,
        TG_LONG[tenGod] ?? `${el} 기운이 한 해를 이끄는 흐름입니다.`,
        `올 한 해의 큰 테마는 '${TG_THEME[tenGod] ?? "전환"}'이에요. 같은 일도 어떤 해에 만나느냐에 따라 다르게 풀리는데, 올해는 이 기운에 올라타는 게 가장 지혜로워요. 흐름을 거스르기보다 함께 가면 힘은 덜 들고 결실은 커져요.`,
        overall >= 60
          ? `전반적으로 흐름이 좋은 해라, 미뤄둔 일에 시동을 걸기 좋아요. 특히 상반기에 중요한 일을 배치하면 운의 바람이 등을 밀어줘요. 자신감을 갖되, 좋을 때일수록 겸손을 잃지 않으면 복이 오래갑니다.`
          : `올해는 크게 벌이기보다 기초를 다지는 데 무게를 두면 좋아요. 상반기엔 준비와 배움에 충실하고 욕심을 내려놓으면, 하반기로 갈수록 막혔던 흐름이 한결 풀려가요. 급할수록 돌아가는 지혜가 필요한 해예요.`,
        `세운은 한 해의 큰 날씨일 뿐, 매달의 월운(月運)에 따라 작은 등락이 있어요. 좋은 달엔 적극적으로 움직이고, 조심스러운 달엔 한 박자 쉬어가며 리듬을 타면, 같은 한 해라도 훨씬 알차게 보낼 수 있어요. 아래 달별 흐름을 함께 참고하세요.`,
        bandLine(overall),
        `${thisYear}년이 어떤 해가 될지는 결국 당신이 어떻게 맞이하느냐에 달려 있어요. 좋은 기운은 노력으로 키우고 어려운 기운은 대비로 줄이면 — 사주가 그린 흐름보다 한 뼘 더 좋은 한 해를 만들 수 있어요. 운은 준비된 사람의 편이니까요.`,
      ],
      fields: fieldsOf(overall, tenGod),
      flow,
      lucky: { color: LUCK_COLOR[el], numbers: LUCK_NUM[el], direction: LUCK_DIR[el], item: LUCK_ITEM[el] },
      advice: overall >= 60 ? "흐름이 좋은 상반기에 중요한 일을 배치하면 효과가 큽니다." : "조급함을 내려놓고 하반기를 길게 보고 준비하세요.",
      subjectLabel,
      basis: `일간 ${dayLabelKo}(${dayEl}) 기준, ${thisYear}년 세운 ${yl.ganzhi}와의 십성 관계로 산출`,
    };
  }

  // month
  const months = monthLuck(dayStem, thisYear);
  const ml = months[clamp(thisMonth - 1, 0, 11)]!;
  const tenGod = ml.stemTenGod;
  const el = ml.element as El;
  const seed = thisYear * 12 + thisMonth + dayStem * 5;
  const overall = scoreOf(tenGod, seed);
  const SEG = ["상순 (1~10일)", "중순 (11~20일)", "하순 (21일~)"];
  const flow: PeriodFlow[] = SEG.map((label, i) => ({
    label, ganzhiKo: ml.ganzhiKo, element: el, tenGod, score: scoreOf(tenGod, seed + (i + 1) * 11),
  }));
  return {
    kind, label: `${thisYear}년 ${thisMonth}월`, ganzhi: ml.ganzhi, ganzhiKo: ml.ganzhiKo, element: el, tenGod, theme: TG_THEME[tenGod] ?? "전환",
    overall, headline: `이번 달은 '${TG_THEME[tenGod] ?? "전환"}'의 달`,
    summaryParas: [
      `${thisYear}년 ${thisMonth}월 월운(月運)은 ${ml.ganzhi}(${ml.ganzhiKo})로, 당신의 일간 ${dayLabelKo}에게 '${tenGod}'의 기운으로 들어옵니다. 월운은 그달 한 달에 흐르는 바람이라, 이번 달 당신이 겪을 일들의 결을 미리 보여줘요.`,
      TG_LONG[tenGod] ?? `${el} 기운이 이번 달을 이끄는 흐름입니다.`,
      `이번 달의 키워드는 '${TG_THEME[tenGod] ?? "전환"}'이에요. 이 기운을 알고 움직이면, 같은 노력으로도 더 좋은 결과를 얻을 수 있어요. 흐름에 맞는 일을 하면 일이 술술 풀리고, 거스르면 괜히 힘만 빠지거든요.`,
      overall >= 60
        ? `흐름이 좋은 달이라, 중요한 약속이나 결정·시작을 이달에 배치하면 효과가 커요. 특히 상순(월초)에 운의 기운이 강하니, 미뤄둔 일이 있다면 이때 움직여 보세요.`
        : `이번 달은 무리하게 벌이기보다 차분히 관리하는 데 집중하면 좋아요. 큰 결정은 한 박자 미루고, 작은 일들을 야무지게 마무리하면 다음 달이 한결 가벼워져요.`,
      `한 달 안에서도 상순·중순·하순의 결이 조금씩 달라요. 아래 흐름을 참고해 좋은 때엔 적극적으로, 조심스러운 때엔 한 발 물러서며 페이스를 조절하면 이달을 알차게 보낼 수 있어요.`,
      bandLine(overall),
      `이번 달이 어떤 한 달이 될지는 결국 당신의 선택에 달려 있어요. 좋은 기운은 적극 활용하고 조심할 기운은 미리 대비하면 — 사주가 그린 흐름보다 한결 나은 한 달을 보낼 수 있어요.`,
    ],
    fields: fieldsOf(overall, tenGod),
    flow,
    lucky: { color: LUCK_COLOR[el], numbers: LUCK_NUM[el], direction: LUCK_DIR[el], item: LUCK_ITEM[el] },
    advice: overall >= 60 ? "기운이 받쳐주는 달이니 미뤄둔 일을 실행에 옮기기 좋아요." : "큰 결정은 다음 달로 미루고 이번 달은 다지기에 집중하세요.",
    subjectLabel,
    basis: `일간 ${dayLabelKo}(${dayEl}) 기준, ${thisYear}년 ${thisMonth}월 월운 ${ml.ganzhi}와의 십성 관계로 산출`,
  };
}
