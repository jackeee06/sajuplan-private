// 혈액형 궁합 v2 — 16조합 풍성 큐레이션 + 혈액형 4종 성격카드 + 분야별 + 실전팁 + 성별 뉘앙스 + 재미장치.
// ⚠️ 사주·생년월일 무관(만세엔진 재사용 불가) → 순수 데이터 lookup(결정론적, 같은 입력=같은 결과).
// ⚠️ 혈액형 성격설은 과학적 근거 없음(국제적 차별 논란도 존재). 100% 재미·참고 — UI에 명확 표기.
import { hashString, mulberry32, pickUnique } from "@portal/engine";

export type Blood = "A" | "B" | "O" | "AB";
export const BLOODS: Blood[] = ["A", "B", "O", "AB"];
export type Gender = "M" | "F";

export interface BloodProfile {
  emoji: string; animal: string; oneliner: string;
  personality: string; love: string; strength: string; weakness: string; stress: string;
}
export const BLOOD_PROFILE: Record<Blood, BloodProfile> = {
  A: {
    emoji: "🌿", animal: "사슴", oneliner: "섬세하고 배려 깊은 모범생형",
    personality: "신중하고 성실하며 남을 잘 배려해요. 원칙과 예의를 중시하고, 갈등을 피하려 속으로 삭이는 편이에요.",
    love: "한 사람에게 깊고 진중하게 빠지는 스타일이에요. 표현은 서툴러도 정성으로 보여주는, 은근하고 오래가는 사랑을 해요.",
    strength: "꼼꼼함·책임감·세심한 배려. 약속을 잘 지켜 신뢰가 두터워요.",
    weakness: "걱정이 많고 소심해질 때가 있어요. 마음을 잘 못 털어놔 혼자 끙끙 앓기도 해요.",
    stress: "스트레스를 받으면 말수가 줄고 혼자 있으려 해요. 예민해지고 속으로 곱씹어요.",
  },
  B: {
    emoji: "🔥", animal: "표범", oneliner: "자유롭고 솔직한 마이웨이형",
    personality: "자유분방하고 솔직하며 호기심이 많아요. 관심사에 푹 빠지고, 틀에 매이는 걸 답답해해요.",
    love: "끌리면 화끈하게 표현하는 스타일이에요. 솔직하고 다정하지만, 자기 시간과 자유도 꼭 지키고 싶어 해요.",
    strength: "창의력·추진력·솔직함. 분위기 메이커라 함께 있으면 즐거워요.",
    weakness: "기분파라 변덕스러워 보일 수 있어요. 관심이 식으면 티가 나요.",
    stress: "스트레스를 받으면 자기만의 세계로 숨거나, 새로운 자극으로 풀려 해요.",
  },
  O: {
    emoji: "☀️", animal: "골든리트리버", oneliner: "다정하고 리더십 있는 햇살형",
    personality: "활발하고 정이 많으며 리더십이 있어요. 목표 지향적이고, 사람들을 잘 챙기는 든든한 맏이 같은 성향이에요.",
    love: "적극적이고 헌신적으로 사랑해요. 좋아하면 먼저 다가가고 챙기는, 따뜻하고 듬직한 연애를 해요.",
    strength: "추진력·포용력·의리. 위기에 강하고 사람을 끌어모으는 힘이 있어요.",
    weakness: "지기 싫어하고 욕심이 날 때가 있어요. 직진하다 상대를 압도하기도 해요.",
    stress: "스트레스를 받으면 더 바빠지거나, 사람을 만나 풀려 해요. 가끔 욱하기도 해요.",
  },
  AB: {
    emoji: "🌙", animal: "고양이", oneliner: "독특하고 신비로운 4차원형",
    personality: "이성적이면서도 감성적인 양면을 지녀요. 독창적이고 쿨하며, 사람과 적당한 거리를 두는 신비주의예요.",
    love: "밀당의 고수처럼 보이지만 사실은 신중한 거예요. 마음을 열기까지 시간이 걸리지만, 열면 깊고 독특한 사랑을 해요.",
    strength: "냉철한 판단력·독창성·균형감. 상황을 객관적으로 보는 눈이 좋아요.",
    weakness: "속을 알기 어려워 변덕처럼 보여요. 거리감 때문에 오해를 사기도 해요.",
    stress: "스트레스를 받으면 혼자만의 동굴로 들어가 차단해요. 감정을 차갑게 정리하려 해요.",
  },
};

// 혈액형×성별 성향 한 줄(성별 뉘앙스)
const GENDER_NOTE: Record<string, string> = {
  "A-M": "A형 남자는 무뚝뚝해 보여도 속정이 깊고 책임감이 강해요.",
  "A-F": "A형 여자는 섬세하고 헌신적이라 챙김받을 때 마음을 열어요.",
  "B-M": "B형 남자는 자유롭고 화끈하지만 구속을 싫어해요.",
  "B-F": "B형 여자는 솔직하고 매력 넘치며 자기 세계가 분명해요.",
  "O-M": "O형 남자는 적극적이고 듬직하게 리드하는 걸 좋아해요.",
  "O-F": "O형 여자는 정 많고 활발하며 사랑받을 때 더 빛나요.",
  "AB-M": "AB형 남자는 쿨하고 신비로워 묘하게 끌리는 매력이 있어요.",
  "AB-F": "AB형 여자는 독특하고 영민해 알수록 빠져드는 매력이 있어요.",
};

// 16조합(me-you 비대칭) — 점수·유형·롱폼·잘맞을때·부딪힐때·해시태그
interface Pair { score: number; type: string; emoji: string; summary: string; goodWhen: string; clashWhen: string; tags: string[]; }
const PAIRS: Record<string, Pair> = {
  "A-A": { score: 80, type: "거울 같은 신중커플", emoji: "🪞", summary: "둘 다 섬세하고 배려 깊어 서로를 깊이 이해해요. 닮은 만큼 편안하지만, 둘 다 속을 잘 안 터놔 오해가 쌓일 수 있어요.", goodWhen: "조용한 데이트, 약속을 지키는 일상에서 깊은 신뢰가 쌓여요.", clashWhen: "둘 다 참기만 하다 서운함이 곪을 때 부딪혀요.", tags: ["#안정", "#깊은신뢰", "#표현필요"] },
  "A-B": { score: 64, type: "신중×자유 줄다리기", emoji: "🪢", summary: "신중한 A형과 자유로운 B형, 정반대라 끌리지만 부딪힘도 커요. A형이 B형의 자유를 인정하고 B형이 A형의 마음을 헤아리면 의외로 환상의 보완이 돼요.", goodWhen: "B형이 A형을 웃게 하고, A형이 B형을 챙겨줄 때 균형이 살아나요.", clashWhen: "A형은 서운하고 B형은 답답할 때, 표현 방식이 엇갈려요.", tags: ["#상극의매력", "#밀당", "#노력형"] },
  "A-O": { score: 90, type: "든든한 보호커플", emoji: "🛡️", summary: "섬세한 A형과 듬직한 O형의 만남은 예부터 최고 궁합으로 꼽혀요. O형이 든든하게 리드하고 A형이 세심하게 챙겨, 서로의 빈 곳을 자연스럽게 메워요.", goodWhen: "O형이 먼저 다가가고 A형이 정성으로 답할 때 안정감이 최고예요.", clashWhen: "O형의 직진이 A형에겐 부담이 될 때 잠깐 삐걱여요.", tags: ["#천생연분", "#안정케미", "#보완최고"] },
  "A-AB": { score: 74, type: "섬세한 신비커플", emoji: "🌙", summary: "둘 다 섬세하고 사려 깊어 정서적으로 잘 통해요. A형의 다정함과 AB형의 신비로움이 어우러져 깊이 있는 사이가 되지만, 둘 다 거리감이 있어 다가서는 데 시간이 걸려요.", goodWhen: "취향·감성을 나눌 때 말없이도 통하는 깊은 교감이 생겨요.", clashWhen: "둘 다 속을 안 보여 답답함이 쌓일 때 멀어져요.", tags: ["#감성교감", "#신비", "#천천히"] },
  "B-A": { score: 64, type: "자유×신중 줄다리기", emoji: "🪢", summary: "자유로운 B형과 신중한 A형. B형의 솔직함이 A형에겐 신선하지만 가끔 상처가 돼요. B형이 조금만 배려하고 A형이 조금만 너그러워지면 서로를 키워주는 사이가 돼요.", goodWhen: "B형이 A형의 페이스를 존중해줄 때 A형이 활짝 펴요.", clashWhen: "B형의 즉흥성에 A형이 불안해질 때 어긋나요.", tags: ["#신선함", "#배려필요", "#성장형"] },
  "B-B": { score: 76, type: "자유분방 동지커플", emoji: "🎡", summary: "둘 다 자유롭고 솔직해 죽이 척척 맞아요. 함께면 신나고 권태가 적지만, 둘 다 마이웨이라 양보가 없으면 평행선을 달릴 수 있어요.", goodWhen: "새로운 경험·즉흥 여행처럼 함께 노는 일에서 최고로 통해요.", clashWhen: "둘 다 고집부리고 자기 자유만 챙길 때 부딪혀요.", tags: ["#찐친케미", "#권태없음", "#양보필요"] },
  "B-O": { score: 72, type: "활기찬 짝꿍커플", emoji: "🎉", summary: "솔직한 B형과 정 많은 O형, 둘 다 활달해 함께 있으면 에너지가 넘쳐요. O형이 B형을 든든히 받쳐주고 B형이 O형을 즐겁게 해, 활기찬 케미가 살아나요.", goodWhen: "활동적인 데이트·모임에서 둘의 에너지가 시너지를 내요.", clashWhen: "O형의 챙김이 B형에겐 간섭으로 느껴질 때 삐걱여요.", tags: ["#활력케미", "#에너지", "#즐거움"] },
  "B-AB": { score: 86, type: "찰떡 케미커플", emoji: "🧲", summary: "자유로운 B형과 신비로운 AB형은 손꼽히는 좋은 궁합이에요. B형의 솔직함이 AB형의 마음을 열고, AB형의 독특함이 B형을 매료시켜 서로 지루할 틈이 없어요.", goodWhen: "엉뚱한 대화·새로운 시도에서 둘만의 케미가 폭발해요.", clashWhen: "B형의 변덕과 AB형의 거리두기가 겹칠 때 서로 헷갈려요.", tags: ["#환상케미", "#안지루함", "#묘한끌림"] },
  "O-A": { score: 90, type: "다정한 리더커플", emoji: "💗", summary: "듬직한 O형과 섬세한 A형, 예부터 최고 궁합이에요. O형이 앞장서 챙기고 A형이 그 마음을 세심히 알아줘, 함께 있으면 더없이 안정적이고 따뜻해요.", goodWhen: "O형이 리드하고 A형이 정성으로 답할 때 둘 다 편안해요.", clashWhen: "O형의 욕심·직진이 A형에겐 버거울 때 잠깐 삐걱여요.", tags: ["#천생연분", "#든든함", "#안정케미"] },
  "O-B": { score: 72, type: "리드하는 활력커플", emoji: "🎉", summary: "정 많은 O형과 자유로운 B형. O형이 든든하게 이끌고 B형이 활기를 더해, 함께면 즐겁고 생기가 돌아요. O형이 B형의 자유를 인정하면 더 오래가요.", goodWhen: "함께 활동하고 도전할 때 에너지가 잘 맞아요.", clashWhen: "O형이 B형을 통제하려 들 때 B형이 답답해해요.", tags: ["#활력", "#리더십", "#자유존중"] },
  "O-O": { score: 68, type: "화끈한 리더 대결", emoji: "⚔️", summary: "둘 다 정 많고 리더십이 강해 서로를 깊이 이해하지만, 둘 다 지기 싫어해 주도권 다툼이 생길 수 있어요. 역할을 나누면 누구보다 든든한 파워 커플이 돼요.", goodWhen: "공동의 목표를 향해 함께 달릴 때 폭발적인 추진력이 나와요.", clashWhen: "둘 다 양보 없이 주도하려 할 때 부딪혀요.", tags: ["#파워커플", "#의리", "#주도권"] },
  "O-AB": { score: 76, type: "포용하는 신비커플", emoji: "🌗", summary: "포용력 있는 O형과 독특한 AB형. O형이 AB형의 거리감을 너그럽게 품고, AB형이 O형에게 신선한 자극을 줘 묘하게 끌리는 보완 케미가 생겨요.", goodWhen: "O형이 AB형의 페이스를 존중할 때 AB형이 마음을 열어요.", clashWhen: "O형의 직진을 AB형이 부담스러워할 때 거리가 생겨요.", tags: ["#보완케미", "#묘한끌림", "#포용"] },
  "AB-A": { score: 74, type: "신비한 섬세커플", emoji: "🌙", summary: "신비로운 AB형과 섬세한 A형. 둘 다 사려 깊어 정서적으로 깊이 통해요. AB형의 독창성과 A형의 다정함이 어우러지지만, 둘 다 신중해 다가서는 데 시간이 걸려요.", goodWhen: "감성·취향을 나눌 때 조용히 깊게 통해요.", clashWhen: "둘 다 속을 감출 때 답답함이 쌓여요.", tags: ["#감성교감", "#깊이", "#천천히"] },
  "AB-B": { score: 86, type: "환상의 케미커플", emoji: "🧲", summary: "신비로운 AB형과 자유로운 B형은 최고로 통하는 조합이에요. AB형의 독특함이 B형을 사로잡고, B형의 솔직함이 AB형의 마음을 열어 늘 새롭고 짜릿해요.", goodWhen: "엉뚱한 대화·즉흥 모험에서 둘만의 케미가 터져요.", clashWhen: "둘 다 자기 세계로 숨을 때 연결이 끊겨요.", tags: ["#환상케미", "#짜릿함", "#안지루함"] },
  "AB-O": { score: 76, type: "끌리는 보완커플", emoji: "🌗", summary: "독특한 AB형과 듬직한 O형. AB형이 O형에게 신선함을 주고 O형이 AB형을 너그럽게 품어, 서로 다른 매력에 끌리는 보완 케미예요. 통념상 상극이라지만 거리만 잘 맞추면 오히려 깊어져요.", goodWhen: "O형이 AB형의 공간을 존중할 때 AB형이 편안해해요.", clashWhen: "O형의 직진과 AB형의 거리두기가 부딪힐 때 어긋나요.", tags: ["#보완케미", "#반전궁합", "#거리조절"] },
  "AB-AB": { score: 80, type: "텔레파시 신비커플", emoji: "🔮", summary: "둘 다 독특하고 신비로워 말 안 해도 통하는 텔레파시 케미예요. 닮은 감성으로 깊이 이해하지만, 둘 다 거리를 둬서 한 발 더 다가서는 용기가 필요해요.", goodWhen: "독창적인 취미·깊은 대화에서 둘만의 세계가 통해요.", clashWhen: "둘 다 동굴로 숨을 때 서로 차갑게 멀어져요.", tags: ["#텔레파시", "#독특함", "#용기필요"] },
};

// 상대 혈액형별 실전 팁(데이트·대화·선물·갈등)
const TIPS_BY_YOU: Record<Blood, { date: string; talk: string; gift: string; conflict: string }> = {
  A: { date: "미리 계획된 차분한 데이트(전시·조용한 카페)를 좋아해요.", talk: "갑작스러운 직설보다 부드럽고 배려 있는 말투가 통해요.", gift: "실용적이면서 정성이 느껴지는 선물(손편지·세심한 디테일).", conflict: "다그치지 말고 시간을 주세요. 진심을 차분히 전하면 풀려요." },
  B: { date: "즉흥적이고 새로운 데이트(여행·이색 체험)에 신나해요.", talk: "솔직하고 가볍게, 잔소리 없이 대화하면 마음을 열어요.", gift: "취향 저격 독특한 선물, 예측 못 한 깜짝 이벤트.", conflict: "구속하지 말고 자유를 인정해 주면 금세 풀려요." },
  O: { date: "활동적이고 함께 즐기는 데이트(운동·맛집 탐방)를 좋아해요.", talk: "솔직하고 시원시원하게, 리액션을 잘 해주면 좋아해요.", gift: "센스 있고 든든한 선물, 함께하는 경험 선물.", conflict: "감정이 격할 땐 한 박자 쉬고, 진심으로 인정해 주면 풀려요." },
  AB: { date: "둘만의 특별하고 조용한 데이트(전시·심야 드라이브)를 좋아해요.", talk: "지적이고 흥미로운 주제로, 거리감을 존중하며 대화해요.", gift: "독창적이고 의미 있는 선물, 흔하지 않은 아이템.", conflict: "몰아붙이지 말고 혼자만의 시간을 주면 스스로 정리해요." },
};

// 혈액형 × MBTI 교차(요즘 트렌드 결합 — 재미)
const BLOOD_MBTI: Record<Blood, string> = {
  A: "꼼꼼한 ISFJ·INFP 느낌 — 배려와 책임의 아이콘",
  B: "자유로운 ENFP·ESTP 느낌 — 어디로 튈지 모르는 매력",
  O: "리더형 ENFJ·ESTJ 느낌 — 사람을 끌어모으는 햇살",
  AB: "신비한 INTP·INFJ 느낌 — 4차원 천재의 향기",
};
// 16조합 전생 인연 드립(바이럴 미끼)
const PAST_LIFE: Record<string, string> = {
  "A-A": "전생에 같은 서당을 다닌 단짝 선비였어요. 말없이도 통하던 그 인연이 이어졌어요.",
  "A-B": "전생에 둘은 라이벌이었어요. 못다 푼 승부를 이번 생엔 사랑으로 마저 풀러 왔어요.",
  "A-O": "전생에 장군(O)과 책사(A)였어요. 함께 큰일을 이루던 환상의 콤비가 다시 만났어요.",
  "A-AB": "전생에 같은 화방을 쓰던 예인이었어요. 말보다 그림으로 통하던 깊은 인연이에요.",
  "B-A": "전생에 둘은 티격태격하던 동문이었어요. 그 미운 정이 이번 생엔 끌림으로 왔어요.",
  "B-B": "전생에 함께 천하를 떠돌던 방랑 길동무였어요. 자유로운 영혼끼리 다시 만났어요.",
  "B-O": "전생에 의기투합한 의병 동지였어요. 신나게 큰일을 도모하던 인연이 이어졌어요.",
  "B-AB": "전생에 비밀결사를 함께한 괴짜 동료였어요. 남들은 몰라도 둘만은 통했어요.",
  "O-A": "전생에 책사(A)를 곁에 둔 장군(O)이었어요. 든든히 챙기던 그 인연이 다시 왔어요.",
  "O-B": "전생에 함께 깃발을 든 의병 대장과 용사였어요. 활기 넘치던 한 팀이에요.",
  "O-O": "전생에 어깨를 나란히 한 두 장수였어요. 서로를 인정하던 라이벌이자 동지예요.",
  "O-AB": "전생에 왕(O)과 신비한 책사(AB)였어요. 알 수 없어 더 끌리던 인연이에요.",
  "AB-A": "전생에 같은 화방의 두 예인이었어요. 섬세함으로 깊이 통하던 사이예요.",
  "AB-B": "전생에 함께 모험을 떠난 괴짜 콤비였어요. 늘 새롭고 짜릿하던 인연이에요.",
  "AB-O": "전생에 신비한 책사(AB)와 너른 왕(O)이었어요. 학계도 논쟁하는 미스터리 인연이에요.",
  "AB-AB": "전생에 같은 별을 보던 두 점성가였어요. 말 안 해도 통하던 텔레파시 인연이에요.",
};

const EL_LUCK_COLOR: Record<Blood, string> = { A: "초록", B: "빨강", O: "주황", AB: "보라" };

export interface BloodField { label: string; emoji: string; score: number; text: string }
export interface BloodResult {
  me: Blood; you: Blood;
  meProfile: BloodProfile; youProfile: BloodProfile;
  score: number; grade: string; gradeLabel: string;
  type: string; typeEmoji: string;
  summary: string; goodWhen: string; clashWhen: string;
  tags: string[];
  fields: BloodField[];
  tips: { date: string; talk: string; gift: string; conflict: string };
  genderNote: string | null;
  coupleNickname: string;
  pastLife: string;
  mbtiMe: string; mbtiYou: string;
  bestMatch: Blood; worstMatch: Blood;
  luckyNumbers: number[];
}

function gradeOf(s: number) {
  if (s >= 86) return { grade: "S", label: "환상의 케미 ✨" };
  if (s >= 76) return { grade: "A", label: "찰떡 케미 🧲" };
  if (s >= 68) return { grade: "B", label: "좋은 케미 💕" };
  if (s >= 60) return { grade: "C", label: "알아가는 케미 🌱" };
  return { grade: "D", label: "노력하면 빛나는 💪" };
}

const FIELD_POOL = {
  연애: { hi: "끌림이 강하고 표현도 잘 통해 설렘이 오래가요.", mid: "은은하게 정이 드는 연애예요. 표현을 더하면 깊어져요.", lo: "표현이 엇갈리기 쉬워요. 자주 마음을 확인해요." },
  결혼: { hi: "생활 리듬이 잘 맞아 안정적인 가정을 꾸려요.", mid: "맞춰가는 시간이 필요하지만 충분히 단단해져요.", lo: "생활 습관 차이가 있어요. 작은 규칙이 큰 도움이 돼요." },
  우정: { hi: "연인이 아니어도 평생 갈 단짝이 될 사이예요.", mid: "편하게 오래 보는 친구가 될 수 있어요.", lo: "결이 달라도 서로 배울 게 많은 친구예요." },
  직장: { hi: "역할이 잘 나뉘어 함께 일하면 시너지가 커요.", mid: "스타일이 다르지만 협업하면 보완이 돼요.", lo: "업무 방식 차이가 있어 역할 분담이 중요해요." },
};
const fb = (s: number) => (s >= 76 ? "hi" : s >= 64 ? "mid" : "lo") as "hi" | "mid" | "lo";

export function buildBloodCompat(me: Blood, you: Blood, meGender?: Gender | null, youGender?: Gender | null): BloodResult {
  const pair = PAIRS[`${me}-${you}`]!;
  const score = pair.score;
  const { grade, label } = gradeOf(score);
  const seed = hashString(`blood2|${me}|${you}`);
  const rnd = mulberry32(seed);
  const jitter = () => Math.round((rnd() * 8 - 4));
  const c = (n: number) => Math.max(20, Math.min(98, n));

  const fields: BloodField[] = [
    { label: "연애 케미", emoji: "💗", score: c(score + jitter()), text: FIELD_POOL.연애[fb(score)] },
    { label: "결혼 케미", emoji: "🏠", score: c(score - 4 + jitter()), text: FIELD_POOL.결혼[fb(score - 4)] },
    { label: "우정 케미", emoji: "🤝", score: c(score + 4 + jitter()), text: FIELD_POOL.우정[fb(score + 4)] },
    { label: "직장 케미", emoji: "💼", score: c(score - 2 + jitter()), text: FIELD_POOL.직장[fb(score - 2)] },
  ];

  const notes: string[] = [];
  if (meGender) notes.push(GENDER_NOTE[`${me}-${meGender}`]!);
  if (youGender) notes.push(GENDER_NOTE[`${you}-${youGender}`]!);
  const genderNote = notes.length ? notes.join(" ") : null;

  // 내 혈액형 기준 운명/조심 상대 랭킹
  const ranked = [...BLOODS].sort((x, y) => PAIRS[`${me}-${y}`]!.score - PAIRS[`${me}-${x}`]!.score);
  const bestMatch = ranked[0]!;
  const worstMatch = ranked[ranked.length - 1]!;

  return {
    me, you,
    meProfile: BLOOD_PROFILE[me], youProfile: BLOOD_PROFILE[you],
    score, grade, gradeLabel: label,
    type: pair.type, typeEmoji: pair.emoji,
    summary: pair.summary, goodWhen: pair.goodWhen, clashWhen: pair.clashWhen,
    tags: pair.tags,
    fields,
    tips: TIPS_BY_YOU[you],
    genderNote,
    coupleNickname: `${me}${you} ${pair.type}`,
    pastLife: PAST_LIFE[`${me}-${you}`]!,
    mbtiMe: BLOOD_MBTI[me], mbtiYou: BLOOD_MBTI[you],
    bestMatch, worstMatch,
    luckyNumbers: pickUnique((seed ^ 0x9e3779b9) >>> 0, 3, 45),
  };
}

export { EL_LUCK_COLOR };
