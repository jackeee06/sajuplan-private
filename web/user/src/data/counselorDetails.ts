/**
 * 상담사 상세 페이지 mock 데이터 — Figma 92:7307 (04상담사상세)
 * 3개 탭(소개/후기/문의)이 같은 상담사 정보를 공유하기 때문에 한 곳에 모아둠.
 * 백엔드 연동 시 fetch 결과로 교체.
 */

export type Badge = '타로' | '신점' | '사주'

export const BADGE_BG: Record<Badge, string> = {
  타로: '#8259F5',
  신점: '#00BBA7',
  사주: '#FF6467',
}

export interface CounselorDetailData {
  id: number
  badge: Badge
  name: string
  code: string
  tagline: string
  hashtags: string[]
  pricePerHalfMin: number
  likeCount: string
  liked: boolean
  heroImg: string
  fields: string[]
  styles: string[]
  career: string[]
  noticeDate: string
  noticeContent: string
  /** 상담사 소개 본문 (탭=intro) */
  introText: string
  /** 현재 같은 페이지를 보고 있는 사용자 수 */
  liveViewers: number
  /** 후기 총 건수 (포맷된 문자열) */
  reviewTotal: string
  /** 문의 총 건수 */
  qnaTotal: string
}

/* ─────────── 상담사 mock ─────────── */

export const MOCK_DETAILS: Record<string, CounselorDetailData> = {
  '3': {
    id: 3,
    badge: '사주',
    name: '사주선녀',
    code: '165791',
    tagline: '속 시원하게 풀어드립니다',
    hashtags: ['#신년운세', '#금전운'],
    pricePerHalfMin: 1500,
    likeCount: '999+',
    liked: false,
    heroImg: '/img/counselor_detail_hero_3.png',
    fields: ['운세', '연애', '금전', '건강'],
    styles: ['경청하는', '소통하는', '긍정적인', '조곤조곤'],
    career: [
      '대한역학학회(KAA) 인증 명리상담사 1급',
      '성균관대학교 유학대학원 동양사상 전문가 과정 이수',
      '청람 명리학 연구소 수석 연구원 및 상담 실장',
      '현(現) 도해 사주 전략 컨설팅 대표',
    ],
    noticeDate: '2026.04.20',
    noticeContent:
      '안녕하세요, 정통 명리학의 깊이로 당신의 인생 운로(運路)를 밝혀드리는 사주선녀입니다.\n\n우리는 살아가며 수많은 선택의 기로에서 묻게 됩니다.\n"이 사람과 인연이 맞을까요?", "사업을 시작해도 될 시기일까요?", "왜 자꾸 몸과 마음이 지칠까요?"\n\n저는 단순히 \'좋다, 나쁘다\'라는 단정적인 결과만을 말씀드리지 않습니다. 대한역학학회 인증 상담사로서 쌓아온 학문적 근거를 바탕으로, 지금 당신에게 닥친 시련의 \'원인\'을 분석하고, 가장 유리하게 움직일 수 있는 \'최적의 타이밍\'을 구체적으로 짚어드립니다.',
    introText:
      '사주선녀 선생님은 정통 명리학의 깊은 식견을 바탕으로 삶의 길을 제시하는 인생 컨설팅 전문가입니다.\n\n대한역학학회(KAA) 인증 명리상담사 1급 자격을 바탕으로 학문적 기틀을 다졌으며, 성균관대학교 유학대학원 동양사상 전문가 과정과 청람 명리학 연구소의 수석 연구 과정을 거치며 명리학의 현대적 해석과 전문성을 완성하였습니다.\n\n현재 도해 사주 전략 컨설팅의 대표로서, 개인의 애정운과 금전운은 물론 기업의 경영 흐름 및 중요한 의사결정을 돕는 전략적 상담을 폭넓게 진행하고 있습니다. 또한 월간 \'운세와 삶\'에 칼럼을 연재하며 대중과 깊이 있게 소통해 오고 있습니다.\n\n단순히 운명을 예견하는 것에 그치지 않고, 내담자의 고민을 깊이 있게 경청하며 삶의 파동을 함께 분석하는 세심한 상담을 지향합니다. 사주선녀 선생님의 따뜻하고 명확한 조언은 당신이 마주한 혼란 속에서 가장 지혜로운 선택을 할 수 있는 든든한 이정표가 되어줄 것입니다.',
    liveViewers: 15,
    reviewTotal: '9,999',
    qnaTotal: '9,999',
  },
}

/* ─────────── 상담사별 후기 mock (탭=reviews) ─────────── */

export interface CounselorReview {
  id: number
  reviewType: '전화상담' | '채팅상담'
  date: string
  duration: string
  customerName: string
  reviewTitle: string
  reviewContent: string
  /** 작성자가 첨부한 후기 사진 (썸네일 60×60) — 없으면 미노출 */
  imgUrl?: string
  showLock?: boolean
  reply?: { name: string; text: string }
}

/**
 * 주의: Figma 후기 카드는 작성자 프로필 아바타가 없다.
 *       imgUrl 은 후기 첨부 사진 전용이며 작성자 프로필과 다른 파일이어야 mock 검증 시 혼동 없음.
 *       (sample_img0X 는 후기 사진 샘플로만 사용)
 */
export const MOCK_COUNSELOR_REVIEWS: Record<string, CounselorReview[]> = {
  '3': [
    {
      id: 1, reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
      customerName: '김*객',
      reviewTitle: '정말 많은 도움 되었습니다.',
      reviewContent: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
      imgUrl: '/img/sample_img01.jpg',
    },
    {
      id: 2, reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
      customerName: '콩*물',
      reviewTitle: '너무 용하셔서 신기합니다.',
      reviewContent: '제가 말씀드리지 않은 것까지 맞추셔서 너무 신기했습니다.\n다음에 또 이용하고 싶네요.',
      imgUrl: '/img/sample_img02.jpg',
      reply: {
        name: '사주선녀',
        text: '안녕하세요. 상담이 만족스러우셨다니 다행입니다. 더 궁금한 점이 있으시면 언제든지 상담해주세요. 정성스러운 후기 감사합니다. :)',
      },
    },
    {
      id: 3, reviewType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
      customerName: '김*선',
      reviewTitle: '비밀 후기글입니다.',
      reviewContent: '비밀 후기글입니다.',
      showLock: true,
    },
  ],
}

/* ─────────── 상담사별 문의 mock (탭=qna) ─────────── */

export type QnaStatus = '답변완료' | '답변대기'

export interface QnaReply {
  /** 상담사 이름 */
  name: string
  /** 답변 본문 */
  text: string
  /** 답변 작성 시각 (예: "2026.04.23 20:10") */
  postedAt: string
  /** 상담사 프로필 이미지 (작은 28×28 아바타) */
  profileImg: string
}

export interface CounselorQna {
  id: number
  status: QnaStatus
  title: string
  content: string
  customerName: string
  /** 작성 시각 (예: "2026.04.23 15:00") — 상세 페이지에서 풀 노출 */
  postedAt: string
  /** 리스트 카드용 짧은 날짜 (예: "2026.04.23") */
  date: string
  showLock?: boolean
  /** 상담사 답변 — status==='답변완료'일 때만 노출 */
  reply?: QnaReply
}

export const MOCK_COUNSELOR_QNAS: Record<string, CounselorQna[]> = {
  '3': [
    {
      id: 1, status: '답변완료',
      title: '비밀 문의글입니다.',
      content: '비밀 문의글입니다.',
      customerName: '감*객', date: '2026.04.23', postedAt: '2026.04.23 14:20',
      showLock: true,
      reply: {
        name: '사주선녀',
        text: '안녕하세요. 비밀 문의로 답변드립니다. 감사합니다.',
        postedAt: '2026.04.23 19:30',
        profileImg: '/img/sample_img03.jpg',
      },
    },
    {
      id: 2, status: '답변완료',
      title: '상담 가격 관련해서 문의드립니다.',
      content: '상담 가격이 실제로 어느 정도 되는지 자세히 알고 싶습니다.',
      customerName: '콩*물', date: '2026.04.23', postedAt: '2026.04.23 13:00',
      reply: {
        name: '사주선녀',
        text: '안녕하세요. 30초당 1,500원이며 30분 기준 90,000원입니다. 자세한 안내가 필요하시면 채팅으로 문의 부탁드립니다.',
        postedAt: '2026.04.23 18:45',
        profileImg: '/img/sample_img03.jpg',
      },
    },
    {
      id: 3, status: '답변대기',
      title: '상담 예약도 되나요?',
      content: '제가 원하는 일자에 상담을 꼭 받고 싶은데 혹시 상담 예약이 되나요?',
      customerName: '콩나물', date: '2026.04.23', postedAt: '2026.04.23 15:00',
    },
  ],
}
