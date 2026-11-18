// 연예인(스타) 궁합 v2 — 진짜 사주 궁합엔진(buildCoupleFortune·만세 결합)을 재사용하고,
// 그 위에 연예인 전용 "덕질·재미" 레이어(케미 등급·이상형 판정·가상 데이트 시나리오·커플 별명·호칭·공유)를 얹음.
// ⚠️ 법적 안전: 실존 연예인 사진·실명·생일DB 절대 미사용. 전부 "가상 유형 스타"(캐릭터)라 초상권·성명권·부정경쟁방지법 무관.
//   계산은 만세 궁합엔진(정확), 점수·문장·시나리오는 해석·재미(과장 OK). 결정론적. 깊은 풀이는 상담.
import { buildCoupleFortune, type CoupleFortune } from "./coupleEngine.js";
import { hashString, mulberry32 } from "@portal/engine";
import type { Profile } from "./profile.js";

export interface Star {
  id: string; name: string; emoji: string; tag: string; birth: string; // 가상 생일(결정론용)
  animal: string;        // 동물상 느낌
  idealKeyword: string;  // 이 스타가 끌리는 이상형
  callname: string;      // 팬이 부르는 호칭(덕질)
  firstPlace: string;    // 데이트 시나리오 — 첫 만남 장소
  someActivity: string;  // 썸 단계 활동
  fandom: string;        // 응원·덕질 코드 한 줄
}

// 가상 스타 12종 — 실존 인물 아님(재미·안전)
export const STARS: Star[] = [
  { id: "idol", name: "청량 아이돌", emoji: "🎤", tag: "상큼발랄 에너지", birth: "1999-04-12", animal: "강아지상", idealKeyword: "함께 웃어주는 밝은 사람", callname: "우리 최애", firstPlace: "한강 벚꽃길 팬사인회", someActivity: "야외 무대 뒤풀이에서 같이 폭소", fandom: "응원봉 흔들며 '청량미 폭발!' 외쳐주기" },
  { id: "actor", name: "다정한 배우", emoji: "🎬", tag: "다정다감 분위기", birth: "1992-10-03", animal: "사슴상", idealKeyword: "속 깊고 따뜻한 사람", callname: "다정 배우님", firstPlace: "가을 영화제 레드카펫", someActivity: "심야 영화 함께 보고 긴 대화", fandom: "'당신의 연기에 위로받아요' 손편지 보내기" },
  { id: "artist", name: "감성 아티스트", emoji: "🎨", tag: "예민하고 깊은", birth: "1995-07-22", animal: "고양이상", idealKeyword: "취향이 통하는 섬세한 사람", callname: "아티님", firstPlace: "한밤 작업실 듣기 모임", someActivity: "새 곡 먼저 들려주며 감상 나누기", fandom: "신곡 스밍 1만 회 채워주기" },
  { id: "charisma", name: "카리스마 스타", emoji: "🔥", tag: "강렬한 존재감", birth: "1990-01-18", animal: "늑대상", idealKeyword: "흔들림 없는 단단한 사람", callname: "보스님", firstPlace: "콘서트 백스테이지", someActivity: "리허설 끝나고 단둘이 야식", fandom: "'무대 위 카리스마 1위' 투표 몰표" },
  { id: "smart", name: "지적인 셀럽", emoji: "📚", tag: "차분하고 똑똑한", birth: "1994-11-09", animal: "여우상", idealKeyword: "대화가 깊어지는 사람", callname: "셀럽님", firstPlace: "북토크 사인회", someActivity: "서점 데이트하며 책 추천 배틀", fandom: "'말 잘하는 셀럽' 클립 공유 폭격" },
  { id: "dancer", name: "열정 댄서", emoji: "💃", tag: "자유롭고 화끈한", birth: "1997-06-27", animal: "표범상", idealKeyword: "에너지가 잘 맞는 사람", callname: "댄서님", firstPlace: "댄스 챌린지 무대 뒤", someActivity: "함께 안무 따라 추며 깔깔", fandom: "챌린지 영상 따라 찍어 멘션하기" },
  { id: "tsundere", name: "츤데레 아이돌", emoji: "🐱", tag: "시크한데 다정한", birth: "1998-09-15", animal: "고양이상", idealKeyword: "느긋하게 기다려주는 사람", callname: "츤데레님", firstPlace: "비 오는 날 우산 씬 촬영장", someActivity: "무심한 척 챙겨주는 텍스트", fandom: "'사실 다정한 거 다 안다' 짤 모으기" },
  { id: "athlete", name: "듬직한 운동스타", emoji: "🏆", tag: "든든하고 성실한", birth: "1991-03-08", animal: "곰상", idealKeyword: "곁을 지켜주는 사람", callname: "챔프님", firstPlace: "경기 끝난 시상식장", someActivity: "새벽 러닝 함께하고 아침밥", fandom: "직관 가서 이름 적힌 플래카드 흔들기" },
  { id: "pure", name: "청순 미소 스타", emoji: "🌸", tag: "맑고 청순한", birth: "2000-05-30", animal: "토끼상", idealKeyword: "순수하게 아껴주는 사람", callname: "청순님", firstPlace: "봄 피크닉 화보 현장", someActivity: "꽃집 들러 같이 꽃다발 고르기", fandom: "'미소 천사' 데뷔일 축전 보내기" },
  { id: "genius", name: "4차원 천재", emoji: "🛸", tag: "독특하고 기발한", birth: "1996-12-21", animal: "공룡상", idealKeyword: "엉뚱함을 받아주는 사람", callname: "천재님", firstPlace: "심야 라디오 공개방송", someActivity: "밤새 4차원 수다 떨기", fandom: "'역시 천재' 명장면 모음 제작" },
  { id: "chic", name: "시크 카리스마", emoji: "😎", tag: "도시적이고 쿨한", birth: "1993-08-14", animal: "말상", idealKeyword: "자기 세계가 분명한 사람", callname: "시크님", firstPlace: "화보 촬영 스튜디오", someActivity: "야경 드라이브하며 플레이리스트 공유", fandom: "'분위기 깡패' 화보 굿즈 풀구매" },
  { id: "maknae", name: "귀여운 막내", emoji: "🍼", tag: "애교 넘치는", birth: "2001-02-19", animal: "강아지상", idealKeyword: "다 받아주는 너른 사람", callname: "막내님", firstPlace: "데뷔 첫 팬미팅", someActivity: "인형뽑기 데이트하며 애교 폭격", fandom: "'우리 막내 잘한다' 칭찬 댓글 달기" },
];

const SAENG: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };
const GEUK: Record<string, string> = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };

export interface DateScene { label: string; emoji: string; text: string }
export interface CelebResult {
  base: CoupleFortune;
  star: Star;
  grade: string;        // S/A/B/C/D
  gradeLabel: string;
  idealVerdict: string; // 이상형 판정 헤드라인
  idealText: string;
  coupleNickname: string;
  dateScenario: DateScene[];
  callname: string;
  fandom: string;
}

function gradeOf(score: number): { grade: string; label: string } {
  if (score >= 88) return { grade: "S", label: "천생연분급 케미 ✨" };
  if (score >= 78) return { grade: "A", label: "찰떡 케미 🧲" };
  if (score >= 68) return { grade: "B", label: "좋은 케미 💕" };
  if (score >= 58) return { grade: "C", label: "알아가는 케미 🌱" };
  return { grade: "D", label: "노력하면 빛나는 케미 💪" };
}

const SCENE_BAND = {
  hi: {
    first: "눈이 마주친 순간 둘 다 멈칫 — 첫인상부터 강하게 끌렸어요.",
    some: "연락이 끊길 틈이 없어요. 하루 종일 메시지가 오가며 설렘이 차올라요.",
    love: "함께일수록 합이 잘 맞아 다툼은 적고 웃음은 많은, 보기만 해도 알콩달콩한 커플이 돼요.",
  },
  mid: {
    first: "처음엔 서로 살짝 어색했지만, 대화가 시작되자 묘하게 편안해졌어요.",
    some: "밀당 아닌 진심이 통하는 단계예요. 한 걸음씩 다가가며 마음이 깊어져요.",
    love: "속도를 맞춰가는 연애예요. 솔직한 표현을 더할수록 관계가 단단해져요.",
  },
  lo: {
    first: "첫 만남은 조심스러웠어요. 서로를 탐색하는 거리감이 오히려 궁금증을 키워요.",
    some: "작은 오해도 생기지만, 그때그때 풀면 의외의 케미가 살아나요.",
    love: "다른 점이 많아 배울 게 많은 연애예요. 맞춰갈수록 정이 깊게 드는 사이예요.",
  },
};

export function buildCelebFortune(profile: Profile, star: Star): CelebResult | null {
  const base = buildCoupleFortune(profile, star.birth);
  if (!base) return null;
  const score = base.score;
  const { grade, label } = gradeOf(score);
  const meEl = base.a.pillars.day.stem.element;
  const starEl = base.b.pillars.day.stem.element;

  // 이상형 판정 — 내 일간 오행이 스타 일간을 생/합/동일이면 '이상형', 점수도 반영
  let idealVerdict: string, idealText: string;
  const boost = SAENG[meEl] === starEl || meEl === starEl; // 내가 스타를 북돋움
  const received = SAENG[starEl] === meEl; // 스타가 나를 북돋움
  const clash = GEUK[meEl] === starEl || GEUK[starEl] === meEl;
  if (boost || score >= 80) {
    idealVerdict = "💘 당신은 이 스타의 이상형!";
    idealText = `${star.name}이(가) 끌리는 '${star.idealKeyword}'에 당신이 딱 맞아요. 당신의 ${meEl} 기운이 ${star.name}의 ${starEl} 기운을 살려줘, 곁에 있으면 빛이 나는 사이예요.`;
  } else if (received || score >= 62) {
    idealVerdict = "💗 이상형 가능성 충분!";
    idealText = `${star.name}이(가) 당신을 알아갈수록 빠져들 타입이에요. ${star.name}의 ${starEl} 기운이 당신의 ${meEl} 기운을 북돋아, 서로에게 힘이 되는 케미예요.`;
  } else if (clash) {
    idealVerdict = "💪 지금은 '밀당형' 이상형";
    idealText = `처음엔 정반대라 튕길 수 있지만, 그 다름이 오히려 강하게 끌리는 포인트예요. 알아갈수록 '없으면 허전한' 사이가 될 수 있어요.`;
  } else {
    idealVerdict = "🌱 천천히 스며드는 이상형";
    idealText = `한눈에 반하는 타입은 아니지만, ${star.name}은(는) 두고두고 곁에 두고 싶은 사람에게 약해요. 진심을 꾸준히 보이면 마음이 열려요.`;
  }

  // 가상 데이트 시나리오 (점수 밴드 × 스타 페르소나)
  const b = score >= 74 ? "hi" : score >= 58 ? "mid" : "lo";
  const sb = SCENE_BAND[b];
  const dateScenario: DateScene[] = [
    { label: "첫 만남", emoji: "✨", text: `${star.firstPlace}에서 마주쳤어요. ${sb.first}` },
    { label: "썸 타는 중", emoji: "💓", text: `${star.someActivity}. ${sb.some}` },
    { label: "연애 시작", emoji: "💞", text: sb.love },
  ];

  // 커플 별명 (내 이름 + 스타명 합성, 결정론)
  const myName = profile.name?.trim() || "나";
  const starCore = star.name.replace(/\s/g, "").slice(-2, -1) || star.name.slice(0, 1);
  const coupleNickname = `${myName.slice(0, 1)}${starCore} 커플`;

  return {
    base, star, grade, gradeLabel: label,
    idealVerdict, idealText,
    coupleNickname,
    dateScenario,
    callname: star.callname,
    fandom: star.fandom,
  };
}
