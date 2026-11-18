// 포털 "운세 바다" 타일 카탈로그.
// kind: "lotto"=포털 네이티브 첫 타일 / "fortune"=포털 네이티브 운세 / "embed"=기존 독립 사이트(만세·타로) iframe / "soon"=증축 예정.
// 순서 = 인기·사용빈도순(기획서 §4.1 TOP14 기반). 로또는 신규 전략상품이라 featured로 맨 위.
//   ⚠️ 신년운세는 연간 검색 최상위지만 6월=비수기라 아래로(겨울엔 위로 올리는 계절정렬은 추후 옵션).
// 새 콘텐츠는 여기에 한 줄 추가 = 타일 한 장 증축(엔진 재사용).

export type TopicKind = "lotto" | "fortune" | "embed" | "soon";

export interface Topic {
  id: string;
  name: string;
  emoji: string;
  teaser: string;
  kind: TopicKind;
  /** lotto/fortune/embed 전용 — 해시 라우트(예 "lotto", "manse", "tarot") */
  route?: string;
  /** embed 전용 — 포털 안 iframe으로 띄울 기존 독립 사이트 주소 */
  href?: string;
  /** 강조 타일(크게) 여부 */
  featured?: boolean;
  /** 타일 배경 강조 톤 (accent=핑크 계열, primary=보라 계열, plain=흰색) */
  tone?: "accent" | "primary" | "plain";
}

export const TOPICS: Topic[] = [
  {
    id: "lotto",
    name: "오늘의 행운번호",
    emoji: "🍀",
    teaser: "사주로 점지받는 나의 운명번호",
    kind: "lotto",
    route: "lotto",
    featured: true,
    tone: "accent",
  },
  {
    id: "today",
    name: "오늘의 운세",
    emoji: "🌅",
    teaser: "오늘 하루의 흐름",
    kind: "fortune",
    route: "today",
    tone: "plain",
  },
  {
    id: "couple",
    name: "궁합",
    emoji: "💞",
    teaser: "두 사람의 인연 보기",
    kind: "fortune",
    route: "couple",
    tone: "plain",
  },
  {
    id: "mbti",
    name: "MBTI 운세",
    emoji: "🧬",
    teaser: "내 유형의 오늘 + 궁합",
    kind: "fortune",
    route: "mbti",
    tone: "plain",
  },
  {
    id: "wealth",
    name: "재물운",
    emoji: "💰",
    teaser: "돈이 들어오는 시기",
    kind: "fortune",
    route: "wealth",
    tone: "plain",
  },
  {
    id: "manse",
    name: "만세력",
    emoji: "🔮",
    teaser: "무료 사주 명식",
    kind: "embed",
    route: "manse",
    href: "https://manse.sajuplan.com",
    tone: "plain",
  },
  {
    id: "dream",
    name: "꿈해몽",
    emoji: "🐷",
    teaser: "그 꿈, 무슨 의미일까",
    kind: "fortune",
    route: "dream",
    tone: "plain",
  },
  {
    id: "tarot",
    name: "타로",
    emoji: "🃏",
    teaser: "오늘의 타로",
    kind: "embed",
    route: "tarot",
    href: "https://tarot.sajuplan.com",
    tone: "plain",
  },
  {
    id: "monthly",
    name: "월간 운세",
    emoji: "🗓️",
    teaser: "이번 달의 흐름",
    kind: "fortune",
    route: "monthly",
    tone: "plain",
  },
  {
    id: "zodiac",
    name: "띠별 운세",
    emoji: "🐯",
    teaser: "내 띠의 오늘 운세",
    kind: "fortune",
    route: "zodiac",
    tone: "plain",
  },
  {
    id: "star",
    name: "별자리 운세",
    emoji: "✨",
    teaser: "이번주 별자리 운세",
    kind: "fortune",
    route: "star",
    tone: "plain",
  },
  {
    id: "life",
    name: "평생운세",
    emoji: "🧭",
    teaser: "인생의 큰 흐름",
    kind: "fortune",
    route: "life",
    tone: "plain",
  },
  {
    id: "taegil",
    name: "택일",
    emoji: "📅",
    teaser: "이사·결혼 좋은 날",
    kind: "fortune",
    route: "taegil",
    tone: "plain",
  },
  {
    id: "newyear",
    name: "신년운세",
    emoji: "🎊",
    teaser: "올해 한 해의 운",
    kind: "fortune",
    route: "newyear",
    tone: "plain",
  },
  {
    id: "tojeong",
    name: "토정비결",
    emoji: "📜",
    teaser: "올해 신수 + 달별 풀이",
    kind: "fortune",
    route: "tojeong",
    tone: "plain",
  },
  {
    id: "celeb",
    name: "연예인 궁합",
    emoji: "💞",
    teaser: "스타와 나의 케미",
    kind: "fortune",
    route: "celeb",
    tone: "plain",
  },
  {
    id: "blood",
    name: "혈액형 궁합",
    emoji: "🩸",
    teaser: "A·B·O·AB 궁합",
    kind: "fortune",
    route: "blood",
    tone: "plain",
  },
  {
    id: "namecompat",
    name: "이름 궁합",
    emoji: "💌",
    teaser: "두 이름의 케미",
    kind: "fortune",
    route: "namecompat",
    tone: "plain",
  },
  {
    id: "pastlife",
    name: "전생 이야기",
    emoji: "🏮",
    teaser: "나의 전생은 누구였을까",
    kind: "fortune",
    route: "pastlife",
    tone: "plain",
  },
  {
    id: "petal",
    name: "꽃잎점",
    emoji: "🌸",
    teaser: "그 사람의 마음은",
    kind: "fortune",
    route: "petal",
    tone: "plain",
  },
  {
    id: "cookie",
    name: "포춘쿠키",
    emoji: "🥠",
    teaser: "오늘의 한 줄 행운",
    kind: "fortune",
    route: "cookie",
    tone: "plain",
  },
];
