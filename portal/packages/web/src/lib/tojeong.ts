// 토정비결 v2 "정통 144괘" — 검증된 정통 작괘법(태세수·월건수·일진수 선천수 체계)으로 진짜 괘(111~863)를
// 결정론 산출 + 만세엔진(세운/월운/십성)으로 풍성한 풀이. 만세엔진 0% 수정(단방향).
// ⚠️ 정직 원칙: 괘 번호는 정통 방식으로 진짜 산출(검증=1976음8/26·2005→212). 단 144괘 "원문 텍스트"는
//    공개 데이터가 없고 판본마다 달라 그대로 못 베끼므로, 괘상 한시·총운·월별 풀이는 8괘 상징+세운/월운으로
//    우리가 작성한다(가짜 이지함 원문 사칭 안 함). 깊은 풀이는 상담으로.
import { computeManse, monthLuck, yearLuck, solarToLunar, lunarToSolar, monthDayPillars } from "@manse/engine";
import { hashString, mulberry32 } from "@portal/engine";
import { yearTaboo } from "./taegilEngine.js";
import type { Profile } from "./profile.js";

/* ── 선천수 체계(검증된 정통 작괘 상수) ── */
const STEM_SUN = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5]; // 甲乙丙丁戊己庚辛壬癸 선천수
const JI_NUM = [11, 13, 10, 10, 13, 9, 9, 13, 12, 12, 13, 11]; // 子..亥 (태세·일진용 지지수)
const wolgeonJi = (b: number) => 18 - (b % 6); // 子18 丑17 寅16 卯15 辰14 巳13 / 午18 …亥13
const taesuOf = (s: number, b: number) => STEM_SUN[s]! + JI_NUM[b]!;
const iljinOf = (s: number, b: number) => taesuOf(s, b) - 2;
const wolgeonOf = (s: number, b: number) => STEM_SUN[s]! - 9 + wolgeonJi(b);
// 월두법(오호둔): 음력 정월(寅월) 천간 base by 음력년 천간
const JEONGWOL_STEM = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0]; // 甲→丙 乙→戊 丙→庚 丁→壬 戊→甲 …

const STEM_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const STEM_HJ = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BR_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const BR_HJ = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ZODIAC = ["쥐", "소", "범", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];

function yearGz(y: number) { return { s: ((y - 4) % 10 + 10) % 10, b: ((y - 4) % 12 + 12) % 12 }; }
function lunarMonthGz(lunarYear: number, lunarMonth: number) {
  const yStem = ((lunarYear - 4) % 10 + 10) % 10;
  const base = JEONGWOL_STEM[yStem]!;
  return { s: (base + (lunarMonth - 1)) % 10, b: (2 + (lunarMonth - 1)) % 12 };
}
// 음력 한 달 날수(29/30) — 다음 달 초하루 양력 − 이번 달 초하루 양력
function lunarMonthDays(ly: number, lm: number, leap: boolean): number {
  try {
    const a = lunarToSolar(ly, lm, 1, leap);
    const nm = lm === 12 ? 1 : lm + 1, ny = lm === 12 ? ly + 1 : ly;
    const b = lunarToSolar(ny, nm, 1, false);
    const da = new Date(a.year, a.month - 1, a.day).getTime();
    const db = new Date(b.year, b.month - 1, b.day).getTime();
    const diff = Math.round((db - da) / 86400000);
    return diff === 29 || diff === 30 ? diff : 30;
  } catch { return 30; }
}

/* ── 8괘(선천수 1~8) — 상괘 매핑(건1…곤8) ── */
interface Gua8 { name: string; hj: string; sym: string; nature: string; el: string; tone: number; verse: string; trait: string; }
const GUA8: Record<number, Gua8> = {
  1: { name: "건", hj: "乾", sym: "☰", nature: "하늘", el: "금", tone: 8, verse: "하늘이 높고 푸르니 큰 뜻을 마음껏 펼치리라.", trait: "강건하고 주도적인 기운이 한 해를 이끌어요. 큰일을 도모하기 좋은 굳센 괘예요." },
  2: { name: "태", hj: "兌", sym: "☱", nature: "못", el: "금", tone: 10, verse: "맑은 못에 달이 비치니 기쁜 소식이 거듭 오리라.", trait: "기쁨과 소통의 기운이에요. 사람을 통해 즐거운 일·반가운 인연이 따르는 화사한 괘예요." },
  3: { name: "리", hj: "離", sym: "☲", nature: "불", el: "화", tone: 9, verse: "밝은 불이 어둠을 밝히니 마침내 이름을 드날리리라.", trait: "밝게 드러나고 인정받는 기운이에요. 묻혀 있던 실력이 빛을 보는 화려한 괘예요." },
  4: { name: "진", hj: "震", sym: "☳", nature: "우레", el: "목", tone: 5, verse: "봄 우레가 만물을 깨우니 막혔던 일이 비로소 움직이리라.", trait: "움직임과 시작의 기운이에요. 정체됐던 일이 활기를 띠나, 놀랄 일도 함께 오는 역동적 괘예요." },
  5: { name: "손", hj: "巽", sym: "☴", nature: "바람", el: "목", tone: 7, verse: "순한 바람이 멀리 부니 가는 곳마다 두루 통하리라.", trait: "순응과 확산의 기운이에요. 부드럽게 파고들어 뜻이 두루 퍼지는 유연한 괘예요." },
  6: { name: "감", hj: "坎", sym: "☵", nature: "물", el: "수", tone: -6, verse: "깊은 물을 건너야 하니 매사 신중히 돌다리를 두드리라.", trait: "험난함을 헤쳐가는 기운이에요. 굴곡이 있으나 지혜로 넘기면 오히려 단단해지는 괘예요." },
  7: { name: "간", hj: "艮", sym: "☶", nature: "산", el: "토", tone: 1, verse: "산이 우뚝 멈추어 서니 때를 기다려 나아가라.", trait: "멈춤과 인내의 기운이에요. 서두르기보다 내실을 다지며 때를 기다리면 좋은 괘예요." },
  8: { name: "곤", hj: "坤", sym: "☷", nature: "땅", el: "토", tone: 9, verse: "두터운 땅이 만물을 품으니 쌓을수록 크게 이루리라.", trait: "포용과 축적의 기운이에요. 조급함 없이 차곡차곡 쌓으면 끝에 가서 크게 이루는 넉넉한 괘예요." },
};

/* ── 중괘(1~6) 전개 양상 / 하괘(1~3) 결말 ── */
const JUNG6: Record<number, { label: string; text: string; delta: number }> = {
  1: { label: "시작(始)", text: "씨를 뿌리는 출발의 흐름이라, 올해 벌인 일이 내년의 바탕이 돼요.", delta: 2 },
  2: { label: "성장(長)", text: "뿌린 것이 자라나는 흐름이라, 꾸준히 밀고 가면 눈에 띄게 자라요.", delta: 4 },
  3: { label: "절정(盛)", text: "기운이 한껏 무르익는 흐름이라, 과감히 움직여 결실을 거두기 좋아요.", delta: 6 },
  4: { label: "전환(變)", text: "흐름이 한 번 바뀌는 변곡점이라, 변화를 두려워 말고 올라타면 길이 열려요.", delta: 0 },
  5: { label: "정리(收)", text: "거두고 추스르는 흐름이라, 새로 벌이기보다 마무리·관리에 힘쓰면 실속이 커요.", delta: 1 },
  6: { label: "결실(實)", text: "열매를 맺는 흐름이라, 그동안의 노력이 손에 잡히는 결과로 돌아와요.", delta: 5 },
};
const HA3: Record<number, { label: string; text: string; delta: number }> = {
  1: { label: "유종의 미(吉)", text: "끝이 좋은 결말이라, 과정이 다소 더뎌도 마무리가 깔끔해요.", delta: 5 },
  2: { label: "선난후길(中)", text: "처음은 굴곡이 있으나 뒤로 갈수록 풀리는 결말이라, 초반을 잘 버티는 게 관건이에요.", delta: 0 },
  3: { label: "유두무미 주의(注)", text: "시작은 좋으나 끝이 흐려지기 쉬운 결말이라, 막판 방심과 마무리를 특히 챙기세요.", delta: -5 },
};

/* ── 세운 십성 테마·점수 ── */
const TG_THEME: Record<string, string> = {
  정재: "재물과 실속", 편재: "기회와 확장", 정관: "명예와 도약", 편관: "도전과 변화",
  식신: "여유와 복록", 상관: "재능과 전환", 정인: "문서와 귀인", 편인: "준비와 통찰",
  비견: "협력과 자립", 겁재: "수성과 정리",
};
const TG_SCORE: Record<string, number> = { 비견: 3, 겁재: -5, 식신: 9, 상관: -1, 정재: 11, 편재: 7, 정관: 11, 편관: -2, 정인: 8, 편인: 3 };

/* ── 행운요소(상괘 오행) ── */
const EL_LUCK: Record<string, { colors: string[]; dir: string }> = {
  목: { colors: ["초록", "파랑"], dir: "동쪽" }, 화: { colors: ["빨강", "분홍"], dir: "남쪽" },
  토: { colors: ["노랑", "황금"], dir: "중앙" }, 금: { colors: ["흰색", "은색"], dir: "서쪽" }, 수: { colors: ["검정", "남색"], dir: "북쪽" },
};

/* ── 월별 토정비결체 시구(점수대별 풀, 달마다 고유 선택) ── */
const VERSE_BY_BAND: Record<"high" | "mid" | "low", string[]> = {
  high: [
    "꽃이 봄을 만나니 그 빛이 찬란하도다.", "용이 여의주를 얻으니 조화가 무궁하도다.",
    "마른 나무가 봄을 만나니 다시 꽃이 피리라.", "가뭄에 단비를 만나니 만물이 소생하도다.",
    "고기가 큰 물을 얻으니 그 뜻이 활달하도다.", "구름이 흩어지고 달이 밝으니 천지가 환하도다.",
  ],
  mid: [
    "순풍에 돛을 다니 가는 길이 순탄하도다.", "구름이 걷히고 달이 나오니 앞길이 밝도다.",
    "강을 건너려 하니 마침 배가 와 닿는도다.", "분수를 지키면 작은 것이 모여 이루어지리라.",
    "느리게 가는 소걸음이나 천 리를 가는도다.", "돌 가운데 옥이 있으니 갈고닦으면 빛나리라.",
  ],
  low: [
    "돌다리도 두드려 건너니 탈이 없으리라.", "구슬을 깊이 감추니 도둑이 엿보지 못하도다.",
    "바람이 차니 옷깃을 여미고 때를 기다리라.", "급히 가면 넘어지니 한 걸음 늦추어 가라.",
    "얕은 물에 배를 띄우니 무리하면 좌초하리라.", "구름이 해를 가리니 잠시 빛을 감추고 쉬어가라.",
  ],
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const band = (s: number): "high" | "mid" | "low" => (s >= 68 ? "high" : s >= 50 ? "mid" : "low");
function pickVerse(s: number, seed: number): string {
  const pool = VERSE_BY_BAND[band(s)];
  return pool[Math.floor(mulberry32(seed)() * pool.length)]!;
}

export interface TojeongMonth { month: number; ganzhi: string; tenGod: string; score: number; verse: string; gloss: string; }
export interface TojeongField { label: string; emoji: string; text: string; }
export interface Tojeong {
  year: number; yearGanzhi: string; yearZodiac: string;
  guaNumber: string;            // 진짜 3자리 괘(예 "212")
  sang: number; jung: number; ha: number;
  gua8: Gua8;                   // 상괘 8괘
  jungInfo: { label: string; text: string };
  haInfo: { label: string; text: string };
  subjectLabel: string;
  yearTenGod: string; theme: string;
  overall: number; grade: string;
  topVerse: string;
  summary: string[];
  fields: TojeongField[];
  months: TojeongMonth[];
  lucky: { colors: string[]; dir: string; numbers: number[] };
  samjae: boolean;
  basis: string;
}

const GRADE = (s: number) => (s >= 80 ? "대길" : s >= 65 ? "길" : s >= 50 ? "평" : "주의");

export function buildTojeong(p: Profile, thisYear: number): Tojeong {
  const time = p.time && /^\d{2}:\d{2}$/.test(p.time) ? p.time : null;
  const birth = `${p.birth}T${time ?? "12:00"}`;
  const chart = computeManse({ birth, gender: p.gender ?? "M", unknownHour: !time, longitude: p.lon ?? 127.5, calendar: "solar" });
  const ds = chart.dayStemIndex;
  const dayKo = chart.pillars.day.stem.ko;
  const dayEl = chart.pillars.day.stem.element;

  // ── 정통 작괘 ──
  const sy = Number(p.birth.slice(0, 4)), sm = Number(p.birth.slice(5, 7)), sd = Number(p.birth.slice(8, 10));
  const lunar = solarToLunar(sy, sm, sd);
  const age = thisYear - sy + 1; // 세는나이
  const yGz = yearGz(thisYear);
  const taesu = taesuOf(yGz.s, yGz.b);
  const mGz = lunarMonthGz(lunar.year, lunar.month);
  const wolgeon = wolgeonOf(mGz.s, mGz.b);
  const monDays = lunarMonthDays(lunar.year, lunar.month, lunar.leap);
  const dayCell = monthDayPillars(sy, sm)[sd - 1]!;
  const iljin = iljinOf(dayCell.stem, dayCell.branch);

  const sang = ((age + taesu) % 8) || 8;
  const jung = ((monDays + wolgeon) % 6) || 6;
  const ha = ((lunar.day + iljin) % 3) || 3;
  const guaNumber = `${sang}${jung}${ha}`;
  const g8 = GUA8[sang]!;

  // ── 세운/월운 ──
  const yl = yearLuck(ds, thisYear, 1)[0]!;
  const yTg = yl.stemTenGod;
  const overall = clamp(Math.round(54 + g8.tone + (TG_SCORE[yTg] ?? 0) + JUNG6[jung]!.delta + HA3[ha]!.delta), 18, 97);

  const ml = monthLuck(ds, thisYear);
  const months: TojeongMonth[] = ml.map((m, i) => {
    const seed = hashString(`toj2|${p.birth}|${thisYear}|${i + 1}`);
    const sc = clamp(Math.round(52 + (TG_SCORE[m.stemTenGod] ?? 0) + Math.floor(g8.tone / 2) + ((seed % 9) - 4)), 20, 96);
    return { month: i + 1, ganzhi: m.ganzhi, tenGod: m.stemTenGod, score: sc, verse: pickVerse(sc, seed), gloss: glossOf(sc) };
  });

  const luckEl = EL_LUCK[g8.el]!;
  const lucky = { colors: luckEl.colors, dir: luckEl.dir, numbers: luckyNums(hashString(`tojluck|${p.birth}|${thisYear}`)) };

  const taboo = yearTaboo(thisYear);
  const birthZodiac = ZODIAC[((sy - 4) % 12 + 12) % 12]!;
  const samjae = taboo.samjae.includes(birthZodiac);

  return {
    year: thisYear, yearGanzhi: STEM_HJ[yGz.s]! + BR_HJ[yGz.b]!, yearZodiac: ZODIAC[yGz.b]!,
    guaNumber, sang, jung, ha, gua8: g8,
    jungInfo: { label: JUNG6[jung]!.label, text: JUNG6[jung]!.text },
    haInfo: { label: HA3[ha]!.label, text: HA3[ha]!.text },
    subjectLabel: `${dayKo}(${dayEl}) 일간`,
    yearTenGod: yTg, theme: TG_THEME[yTg] ?? "전환",
    overall, grade: GRADE(overall),
    topVerse: g8.verse,
    summary: buildSummary(thisYear, dayKo, yl.ganzhi, yTg, g8, jung, ha, overall),
    fields: buildFields(g8, yTg, overall),
    months,
    lucky, samjae,
    basis: `정통 작괘(태세수 ${taesu}·월건수 ${wolgeon}·일진수 ${iljin}, 세는나이 ${age}·음력 ${lunar.month}.${lunar.day})로 괘 ${guaNumber} 산출. 풀이는 8괘 상징과 ${thisYear}년 세운·월운(일간 ${dayKo}${dayEl}) 결합. 재미·참고용.`,
  };
}

function glossOf(s: number): string {
  return s >= 68 ? "기운이 트여 도모하는 일이 순조로워요." : s >= 50 ? "큰 굴곡 없이 무난한 달이에요." : "한 박자 늦추고 기본을 지키면 탈이 없어요.";
}
function luckyNums(seed: number): number[] {
  const rnd = mulberry32(seed); const set = new Set<number>();
  while (set.size < 3) set.add(1 + Math.floor(rnd() * 45));
  return [...set];
}

function buildSummary(year: number, dayKo: string, yGanzhi: string, yTg: string, g8: Gua8, jung: number, ha: number, overall: number): string[] {
  return [
    `${year}년 당신의 신수는 상괘 '${g8.name}(${g8.hj}·${g8.nature})'에 자리합니다. ${g8.trait}`,
    `${g8.name}괘는 자연의 ${g8.nature}을(를) 상징하는 괘예요. ${g8.tone >= 0 ? "올 한 해 이 기운은 당신에게 안정과 성장의 든든한 바탕이 되어줘요. 큰 흐름이 당신 편이니, 자신감을 가져도 좋아요." : "올 한 해 이 기운은 신중함과 인내가 필요한 시기임을 일러줘요. 무리하지 않고 때를 기다리면, 흐림 뒤에 맑음이 찾아와요."}`,
    `토정비결은 사주처럼 평생을 보는 것이 아니라, '딱 올 한 해'를 집중해서 보는 정초의 세시풍속이에요. 태어난 해·달·날로 144괘 중 하나를 뽑아, 그 한 해의 길흉화복을 미리 살피는 우리 선조들의 지혜죠.`,
    `올 한 해의 큰 배경색은 세운 ${yGanzhi}, 즉 '${yTg}(${TG_THEME[yTg] ?? "전환"})'의 기운이에요. 이 기운이 한 해 동안 당신이 마주할 일들의 결과 분위기를 정해요. 같은 일도 어떤 해에 만나느냐에 따라 다르게 풀리는 건 그 때문이에요.`,
    `한 해를 셋으로 나눠 들여다볼게요. 먼저 중괘는 ${JUNG6[jung]!.label}의 흐름이에요. ${JUNG6[jung]!.text} 이는 한 해의 전개, 봄과 여름에 해당하는 기운을 말해줘요.`,
    `그리고 하괘는 ${HA3[ha]!.label}이에요. ${HA3[ha]!.text} 이는 한 해의 마무리, 가을과 겨울에 거둘 결실을 보여줘요. 시작이 더뎌도 끝이 좋을 수 있고, 그 반대일 수도 있으니 한 해 전체의 리듬을 함께 봐야 해요.`,
    overall >= 65
      ? `상반기에는 기운이 차차 열리며 시작한 일에 탄력이 붙어요. 망설이던 일이 있다면 이때 시동을 거는 게 좋아요. 운의 바람이 등을 밀어줄 때 한 걸음 더 나아가 보세요.`
      : `상반기에는 기초를 다지는 데 집중하면 좋아요. 서두르기보다 준비에 충실하면, 그 단단한 토대가 후반의 결실로 이어져요. 급할수록 돌아가는 지혜가 필요한 때예요.`,
    overall >= 65
      ? `하반기로 갈수록 거둔 것을 갈무리하고 실속을 챙기는 흐름이에요. 벌여둔 일을 마무리 짓고, 결실을 차곡차곡 거두기 좋은 시기예요. 끝까지 방심하지 않으면 한 해를 알차게 마무리해요.`
      : `하반기로 갈수록 막혔던 흐름이 한결 풀려가요. 상반기에 다진 것이 빛을 보기 시작하니, 끝까지 꾸준함을 잃지 마세요. 인내한 만큼 보답이 따르는 시기예요.`,
    overall >= 80
      ? "종합하면 기운이 활짝 트인 해입니다. 미뤄두었던 큰일을 도모해도 좋되, 좋은 때일수록 겸손과 베풂이 복을 더 키운다는 걸 잊지 마세요."
      : overall >= 65
        ? "종합하면 무난히 좋은 흐름의 해입니다. 한 발씩 꾸준히 나아가면 끝에 가서 실속을 단단히 거두는, 노력이 배신하지 않는 해예요."
        : overall >= 50
          ? "종합하면 큰 굴곡 없는 평탄한 해입니다. 분수를 지키며 내실을 다지면, 올해의 차분함이 다음 도약의 든든한 바탕이 됩니다."
          : "종합하면 다소 조심스러운 해입니다. 서두르지 말고 기본을 지키면, 지금의 어려움이 오히려 더 단단한 발판이 되어줄 거예요.",
    `토정비결의 괘는 정해진 운명이 아니라 '올해의 날씨 예보' 같은 거예요. 맑은 날엔 부지런히 움직이고 흐린 날엔 우산을 챙기듯, 한 해의 흐름을 미리 알고 대비하면 — 좋은 해는 더 좋게, 어려운 해는 무탈하게 보낼 수 있어요. 결국 한 해를 빚어가는 건 당신의 마음가짐이랍니다.`,
  ];
}

function buildFields(g8: Gua8, yTg: string, overall: number): TojeongField[] {
  const hi = overall >= 65, mid = overall >= 50;
  const money = ["정재", "편재", "식신", "상관"].includes(yTg);
  const fame = ["정관", "편관", "정인"].includes(yTg);
  return [
    { label: "재물운", emoji: "💰", text: money ? "재물의 길이 넓게 열립니다. 들어오는 기운이 강하니 기회를 알아보면 실속을 챙겨요." : hi ? "큰 욕심 없이도 차곡차곡 모이는 흐름이에요. 새는 돈만 막아도 이득이에요." : "지키는 데 무게를 두세요. 큰 지출·보증은 한 박자 미루는 게 좋아요." },
    { label: "애정운", emoji: "💕", text: g8.el === "화" || g8.el === "금" ? "인연의 기운이 화사해요. 마음을 표현하면 좋은 사람·반가운 소식이 따라요." : mid ? "잔잔하지만 따뜻한 흐름이에요. 곁의 사람에게 정성을 들이면 사이가 깊어져요." : "조급함은 금물이에요. 한 박자 천천히, 진심으로 다가가면 오해가 풀려요." },
    { label: "건강운", emoji: "🌿", text: g8.tone < 0 ? "무리한 일정과 과로를 조심하세요. 잘 쉬는 것도 올해의 중요한 복이에요." : "대체로 안정적이에요. 규칙적인 생활을 지키면 큰 탈 없이 한 해를 보내요." },
    { label: "직장운", emoji: "💼", text: fame ? "명예와 인정의 기운이 따라요. 맡은 일을 성실히 하면 윗사람의 눈에 들어요." : hi ? "맡은 자리에서 능력을 인정받는 흐름이에요. 새 도전도 해볼 만해요." : "튀기보다 맡은 일을 묵묵히 하는 게 유리해요. 구설을 조심하세요." },
    { label: "대인운", emoji: "🤝", text: g8.name === "태" || g8.name === "곤" ? "사람 복이 좋은 해예요. 인연을 통해 뜻밖의 도움과 기회가 들어와요." : mid ? "넓히기보다 곁의 사람을 챙기는 게 복이 돼요. 신뢰가 곧 자산이에요." : "말을 아끼고 거리를 지키면 구설이 줄어요. 베푼 만큼 돌아와요." },
  ];
}
