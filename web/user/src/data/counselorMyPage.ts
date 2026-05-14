/**
 * 08마이페이지(상담사) mock 데이터.
 * 백엔드 연동 시 fetch 결과로 교체.
 *
 * Figma 노드:
 *  - 메인(상담사):       109:10423
 *  - 알짜 정보:          153:10223
 *  - 알짜 정보 상세:     173:13694
 *  - 상담사 공지사항:    179:18155
 *  - 공지사항 상세:      179:18181
 *  - 문의하기:           179:15834
 *  - 문의하기 작성:      179:18451
 *  - 문의하기 상세:      179:15850
 */

/* ─────────── 상담사 프로필 + 정산 (메인) ─────────── */

export interface CounselorMyProfile {
  name: string
  userid: string
  profileImg: string
  /** 상담 가능 여부 (마스터 토글) */
  available: boolean
  /** 전화 상담 토글 */
  callEnabled: boolean
  /** 채팅 상담 토글 */
  chatEnabled: boolean
}

export const MOCK_COUNSELOR_MY_PROFILE: CounselorMyProfile = {
  name: '사주선녀',
  userid: 'saju_1234',
  profileImg: '/img/sample_img03.jpg',
  available: true,
  callEnabled: true,
  chatEnabled: false,
}

export interface CounselorBalance {
  /** 보유 금액 (원) */
  current: number
  /** 전월 정산 금액 */
  prevMonth: number
  /** 당월 누적 정산 금액 */
  thisMonth: number
}

export const MOCK_COUNSELOR_BALANCE: CounselorBalance = {
  current: 10000,
  prevMonth: 10000,
  thisMonth: 0,
}

/** 메인 메뉴 — 상담사 전용 */
export interface CounselorMenuItem {
  key: string
  label: string
  icon: string
  to: string
}

export const COUNSELOR_MAIN_MENU: CounselorMenuItem[] = [
  { key: 'customer-qnas', label: '고객 문의 관리', icon: '/img/ic_my_inquiry.svg', to: '/counselor/mypage/customer-qnas' },
  { key: 'calls',         label: '전화상담내역',   icon: '/img/ic_my_phone.svg',   to: '/counselor/mypage/calls' },
  { key: 'chats',         label: '채팅상담내역',   icon: '/img/ic_my_chat.svg',    to: '/counselor/mypage/chats' },
  { key: 'reviews',       label: '후기 관리',      icon: '/img/ic_my_review.svg',  to: '/counselor/mypage/reviews' },
  // 서비스 상품 — 일시 비노출 (운영 요청). 라우트는 그대로 두고 메뉴에서만 제외.
  // { key: 'products',      label: '서비스 상품',    icon: '/img/ic_my_book.svg',    to: '/counselor/mypage/products' },
  { key: 'notices',       label: '상담사 공지사항', icon: '/img/ic_my_notice.svg',  to: '/counselor/mypage/notices' },
  // 알짜 정보 — 일시 비노출 (운영 요청, 추후 오픈). 라우트/페이지는 그대로 두고 메뉴에서만 제외.
  // { key: 'tips',          label: '알짜 정보',      icon: '/img/ic_my_light_bulb.svg', to: '/counselor/mypage/tips' },
  { key: 'qnas',          label: '문의하기',       icon: '/img/ic_my_headset.svg', to: '/counselor/mypage/qnas' },
]

/* ─────────── 알짜 정보 ─────────── */

export interface CounselorTip {
  id: number
  title: string
  /** 풀폭 배너 이미지 */
  imgUrl: string
  /** 노출 일자 */
  date: string
  /** 작성 출처 — 항상 "사주문" */
  source: string
  /** 상세에만 — 노출 기간 (예: "2025.07.01 ~ 2025.07.10") */
  period?: string
}

export const MOCK_COUNSELOR_TIPS: CounselorTip[] = [
  {
    id: 1,
    title: '장기상담 꿀팁 대방출',
    imgUrl: '/img/tip_banner_honey.png',
    date: '2026.04.23',
    source: '사주문',
    period: '2025.07.01 ~ 2025.07.10',
  },
  {
    id: 2,
    title: '장기상담 꿀팁 대방출',
    imgUrl: '/img/tip_banner_mentoring.png',
    date: '2026.04.23',
    source: '사주문',
    period: '2025.07.01 ~ 2025.07.10',
  },
]

/* ─────────── 상담사 공지사항 ─────────── */

export interface CounselorNotice {
  id: number
  title: string
  /** 상단 고정 강조 (보라 배경) */
  isPinned: boolean
  /** "New" 빨간 칩 */
  isNew: boolean
  /** 출처 (항상 "사주문") */
  source: string
  date: string
  /** 상세에만 — 정확한 작성 시각 */
  postedAt?: string
  /** 상세 본문 텍스트 */
  description?: string
  /** 상세 본문 이미지 */
  imgUrl?: string
}

export const MOCK_COUNSELOR_NOTICES: CounselorNotice[] = [
  {
    id: 1, title: '사주문 공지사항입니다.', isPinned: true, isNew: true,
    source: '사주문', date: '2026.04.23', postedAt: '2026.04.23 15:00',
    description: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.',
    imgUrl: '/img/counselor_notice_thumb.png',
  },
  { id: 2, title: '사주문 공지사항입니다.', isPinned: true, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 3, title: '사주문 공지사항입니다.', isPinned: true, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 4, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 5, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 6, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 7, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 8, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 9, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
  { id: 10, title: '사주문 공지사항입니다.', isPinned: false, isNew: false, source: '사주문', date: '2026.04.23' },
]

/* ─────────── 문의하기 (상담사 → 사주문) ─────────── */

export type CounselorMyQnaCategory = '이용안내' | '상담' | '정산' | '서비스상품'
export const COUNSELOR_MY_QNA_CATEGORIES: CounselorMyQnaCategory[] = [
  '이용안내', '상담', '정산', '서비스상품',
]

export type CounselorMyQnaStatus = '답변완료' | '답변대기'

export interface CounselorMyQnaReply {
  /** 답변자 — 상담사 본인 또는 사주문 운영팀 */
  author: string
  text: string
  postedAt: string
}

export interface CounselorMyQna {
  id: number
  status: CounselorMyQnaStatus
  category: CounselorMyQnaCategory
  title: string
  content: string
  /** 작성자 이름 (상세에서 풀, 목록에서 마스킹) */
  authorName: string
  /** 목록용 짧은 날짜 */
  date: string
  /** 상세용 풀 시각 */
  postedAt: string
  replies?: CounselorMyQnaReply[]
}

export const MOCK_COUNSELOR_MY_QNAS: CounselorMyQna[] = [
  {
    id: 1, status: '답변완료', category: '정산',
    title: '문의드립니다.',
    content: '안녕하세요. 문의드립니다.',
    authorName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 14:20',
  },
  {
    id: 2, status: '답변완료', category: '정산',
    title: '상담 가격 관련해서 문의드립니다.',
    content: '상담 가격 관련해서 문의드릴게 있습니다.',
    authorName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 13:00',
  },
  {
    id: 3, status: '답변대기', category: '상담',
    title: '상담 예약도 되나요?',
    content:
      '제가 원하는 일자에 상담을 꼭 받고 싶은데 혹시 상담 예약이 되나요?',
    authorName: '콩나물', date: '2026.04.23', postedAt: '2026.04.23 15:00',
    replies: [
      {
        author: '사주문',
        text:
          '안녕하세요.\n안타깝게도 상담 예약은 불가능한 점 양해부탁드립니다.\n상담을 원하시는 일시에 직접 상담 신청 부탁드립니다.\n감사합니다. :)',
        postedAt: '2026.04.23 20:10',
      },
      {
        author: '사주문',
        text: '상담을 원하시는 일시를 다시 문의 남겨주시면 해당 시간에 상담 가능하도록 열어두겠습니다. :)',
        postedAt: '2026.04.23 20:10',
      },
    ],
  },
]

/* ─────────── 08-B 고객 문의 관리 (상담사가 받은 1:1 문의) ─────────── */

export interface CustomerQnaReply {
  author: string
  /** 답변자 작은 아바타 (28×28) */
  profileImg: string
  text: string
  postedAt: string
}

export interface CustomerQna {
  id: number
  status: '답변완료' | '답변대기'
  /** 자물쇠 아이콘 노출 여부 (비밀 문의) */
  isPrivate: boolean
  title: string
  content: string
  customerName: string
  date: string
  postedAt: string
  replies?: CustomerQnaReply[]
}

export const MOCK_CUSTOMER_QNAS: CustomerQna[] = [
  {
    id: 1, status: '답변완료', isPrivate: true,
    title: '문의드립니다.',
    content: '안녕하세요. 문의드립니다.',
    customerName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 14:20',
    replies: [
      {
        author: '사주선녀', profileImg: '/img/sample_img03.jpg',
        text: '안녕하세요. 비밀 문의로 답변드립니다. 감사합니다.',
        postedAt: '2026.04.23 19:30',
      },
    ],
  },
  {
    id: 2, status: '답변완료', isPrivate: false,
    title: '상담 가격 관련해서 문의드립니다.',
    content: '상담 가격 관련해서 문의드릴게 있습니다.',
    customerName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 13:00',
    replies: [
      {
        author: '사주선녀', profileImg: '/img/sample_img03.jpg',
        text: '안녕하세요. 30초당 1,500원이며 30분 기준 90,000원입니다.',
        postedAt: '2026.04.23 18:45',
      },
    ],
  },
  {
    id: 3, status: '답변대기', isPrivate: false,
    title: '상담 예약도 되나요?',
    content:
      '제가 원하는 일자에 상담을 꼭 받고 싶은데 혹시 상담 예약이 되나요?',
    customerName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 15:00',
  },
  // ─── 상세 시안 v2 (답변 있음) — 시안 풀 텍스트 그대로
  {
    id: 4, status: '답변완료', isPrivate: false,
    title: '2026년 하반기 전체적인 운의 흐름과 조심할 점이 궁금합니다.',
    content:
      '안녕하세요, 선생님. 요즘 유독 일이 뜻대로 풀리지 않고 정체된 느낌이 들어 답답한 마음에 문의드립니다. 제 사주의 전반적인 기운이 어떤지, 특히 올해 남은 기간 동안 제가 붙잡아야 할 기회나 특별히 조심해야 할 액운이 있는지 궁금합니다. 전반적인 인생의 흐름을 짚어주시면 감사하겠습니다.',
    customerName: '옥수수', date: '2026.04.30', postedAt: '2026.04.30 20:00',
    replies: [
      {
        author: '사주선녀', profileImg: '/img/sample_img03.jpg',
        text:
          '안녕하세요. 사주선녀입니다.\n문의주신 부분은 고객님의 성함, 생년월일 등 확인해야 할 정보가 있기 때문에, 전화상담으로 신청해주시면 자세하게 봐드리겠습니다^^',
        postedAt: '2026.04.23 20:10',
      },
    ],
  },
  // ─── 상세 시안 v3 (답변 없음) — 같은 옥수수 본문, 답변만 없음
  {
    id: 5, status: '답변대기', isPrivate: false,
    title: '2026년 하반기 전체적인 운의 흐름과 조심할 점이 궁금합니다.',
    content:
      '안녕하세요, 선생님. 요즘 유독 일이 뜻대로 풀리지 않고 정체된 느낌이 들어 답답한 마음에 문의드립니다. 제 사주의 전반적인 기운이 어떤지, 특히 올해 남은 기간 동안 제가 붙잡아야 할 기회나 특별히 조심해야 할 액운이 있는지 궁금합니다. 전반적인 인생의 흐름을 짚어주시면 감사하겠습니다.',
    customerName: '옥수수', date: '2026.04.30', postedAt: '2026.04.30 20:00',
  },
]

/* ─────────── 08-B 후기 관리 ─────────── */

export interface CounselorReviewItem {
  id: number
  customerName: string
  isPrivate: boolean
  title: string
  content: string
  /** 첨부 사진 (없으면 미노출, 후기 카드 우측 60×60 썸네일) */
  imgUrl?: string
  consultType: '전화상담' | '채팅상담'
  date: string
  duration: string
  /** 작성된 답변 — 없으면 "답변 작성하기" 버튼 노출 */
  reply?: { author: string; text: string }
}

export const MOCK_COUNSELOR_REVIEWS: CounselorReviewItem[] = [
  {
    id: 1, customerName: '김*객', isPrivate: false,
    title: '정말 많은 도움 되었습니다.',
    content: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    imgUrl: '/img/counselor_notice_thumb.png',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
  },
  {
    id: 2, customerName: '김*객', isPrivate: false,
    title: '너무 용하셔서 신기합니다.',
    content: '제가 말씀드리지 않은 것까지 맞추셔서 너무 신기했습니다....',
    imgUrl: '/img/counselor_notice_thumb.png',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    reply: {
      author: '김선녀',
      text:
        '안녕하세요. 상담이 만족스러우셨다니 다행입니다. 더 궁금한 점이 있으시면 언제든지 상담해주세요. 정성스러운...',
    },
  },
  {
    id: 3, customerName: '김*객', isPrivate: false,
    title: '올해는 조심해야겠어요',
    content: '걱정많고 고민도 많았는데 어느정도 안심이 되네요. 정말 감사합니다.',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
  },
  {
    id: 4, customerName: '김*객', isPrivate: true,
    title: '정말 감사합니다.',
    content: '정말 감사합니다.',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
  },
]

/** 후기 상세 — 답변 풀세트 (목록 카드 reply는 미리보기만) */
export const MOCK_COUNSELOR_REVIEW_REPLIES: Record<number, { author: string; profileImg: string; text: string; postedAt: string }> = {
  2: {
    author: '사주선녀',
    profileImg: '/img/sample_img03.jpg',
    text:
      '안녕하세요. 사주선녀입니다.\n문의주신 부분은 고객님의 성함, 생년월일 등 확인해야 할 정보가 있기 때문에, 전화상담으로 신청해주시면 자세하게 봐드리겠습니다^^',
    postedAt: '2026.04.23 20:10',
  },
}

/* ─────────── 08-B 상담 내역 (전화/채팅) ─────────── */

export type ConsultType = 'phone' | 'chat'
export type ReviewStatus = '대기' | '완료'

export interface ConsultLog {
  id: number
  type: ConsultType
  customerName: string
  /** 일자(헤더용 짧은 형식) — "2026.04.23" */
  date: string
  /** 상담 시간 길이 — "00시간17분30초" */
  duration: string
  /** 시작/완료 시각 풀 — "2026.04.23 19:49:17" */
  startedAt: string
  endedAt: string
  /** 채팅만 사용 — 과금 포인트 */
  pointPaid?: number
  reviewStatus: ReviewStatus
  /** 후기 답변을 이미 작성했는지 — true면 "작성한 후기 답변 보기" */
  hasReply?: boolean
  /** 회원이 작성한 후기 id (있으면 상담사 답변 라우팅의 키). */
  reviewId?: number | null
  /**
   * 채팅상담 전용 — chat_room.status. 'STAY'/'CNCH' 면 "채팅방 입장" 보라 채움 버튼.
   * DISCONNECT 또는 null 이면 "채팅 내역 보기" + 후기 답변 흐름.
   */
  chatStatus?: string | null
  /** consultation row id — 메모 라우팅 키 (없으면 chat_room.id 사용) */
  consultationId?: number | null
}

export const MOCK_COUNSELOR_CALLS: ConsultLog[] = [
  { id: 1, type: 'phone', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', reviewStatus: '대기' },
  { id: 2, type: 'phone', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', reviewStatus: '대기' },
  { id: 3, type: 'phone', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', reviewStatus: '완료' },
  { id: 4, type: 'phone', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', reviewStatus: '완료' },
]

export const MOCK_COUNSELOR_CHATS: ConsultLog[] = [
  { id: 1, type: 'chat', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', pointPaid: 10000, reviewStatus: '완료' },
  { id: 2, type: 'chat', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:50:17', endedAt: '2026.04.23 19:51:47', pointPaid: 10000, reviewStatus: '대기' },
  { id: 3, type: 'chat', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', pointPaid: 10000, reviewStatus: '완료', hasReply: true },
  { id: 4, type: 'chat', customerName: '김고객', date: '2026.04.23', duration: '00시간17분30초', startedAt: '2026.04.23 19:50:17', endedAt: '2026.04.23 19:51:47', pointPaid: 10000, reviewStatus: '대기' },
]

/** 상담 메모 분류·주제 셀렉트 옵션 (시안엔 placeholder만 — 임의 옵션) */
export const CONSULT_MEMO_CATEGORIES = ['운세', '연애', '결혼', '재물', '직장', '건강'] as const
export const CONSULT_MEMO_TOPICS = ['궁합', '이별', '재회', '취업', '이직', '사업'] as const

/** 상담사 본인 이름 (메모 페이지 상담사 표기) */
export const COUNSELOR_DISPLAY_NAME = '김상담'

/* ─────────── 08-C 서비스 상품 ─────────── */

export interface ServiceProduct {
  id: number
  /** 풀폭 배너 이미지 */
  bannerImg: string
  /** 한줄 소개 (배너 아래 작은 문구) */
  tagline: string
  /** 상품명 */
  title: string
  /** 상담사 이름 (상세 헤더) */
  counselorName: string
  /** 가격 (원) */
  price: number
  /** 후기 카운트 (상세 헤더) */
  reviewCount: number
  /** 문의 카운트 (상세 헤더) */
  qnaCount: number
  /** 메인 카드의 댓글수 표기 (작은 말풍선 + 326) */
  commentBadge: number
  /** 정보 탭 본문 텍스트 */
  introText: string
  /** 정보 탭 본문에 들어가는 추가 이미지 */
  introImg?: string
}

export const MOCK_SERVICE_PRODUCTS: ServiceProduct[] = [
  {
    id: 1,
    bannerImg: '/img/product_banner_lucky.png',
    tagline: '내 인생이 어떻게 될지 궁금하다면?',
    title: '사주문 - 대운풀이/ 패키지',
    counselorName: '사주선녀',
    price: 1200,
    reviewCount: 237,
    qnaCount: 20,
    commentBadge: 326,
    introText:
      '사주선녀 선생님은 정통 명리학의 깊은 식견을 바탕으로 삶의 길을 제시하는 인생 컨설팅 전문가입니다.\n\n대한역학학회(KAA) 인증 명리상담사 1급 자격을 바탕으로 학문 기틀을 다졌으며, 성균관대학교 유학대학원 동양사상 전문가 과정과 청람 명리학 연구소의 수석 연구 과정을 거치며 명리학의 현대적 해석과 전문성을 완성하였습니다.\n\n현재 도해 사주 전략 컨설팅의 대표로서, 개인의 애정운과 금전운은 물론 기업의 경영 흐름 및 중요한 의사결정을 돕는 전략적 상담을 폭넓게 진행하고 있습니다. 또한 월간 \'운세와 삶\'에 칼럼을 연재하며 대중과 깊이 있게 소통해 오고 있습니다.\n\n단순히 운명을 예견하는 것에 그치지 않고, 내담자의 고민을 깊이 있게 경청하며 삶의 파동을 함께 분석하는 세심한 상담을 지향합니다. 사주선녀 선생님의 따뜻하고 명확한 조언은 당신이 마주한 혼란 속에서 가장 지혜로운 선택을 할 수 있는 든든한 이정표가 되어줄 것입니다.',
    introImg: '/img/product_banner_newyear.png',
  },
  {
    id: 2,
    bannerImg: '/img/product_banner_newyear.png',
    tagline: '내 인생이 어떻게 될지 궁금하다면?',
    title: '운수대통 신년사주 풀이 모음',
    counselorName: '사주선녀',
    price: 1500,
    reviewCount: 237,
    qnaCount: 20,
    commentBadge: 326,
    introText:
      '속 시원하게 풀어드립니다.\n\n대한역학회(KAA) 인증 명리상담사 1급 자격을 바탕으로 학문 기틀을 다졌으며, 성균관대학교 유학대학원 동양사상 전문가 과정과 청람 명리학 연구소의 수석 연구 과정을 거치며 명리학의 현대적 해석과 전문성을 완성하였습니다.\n\n현재 도해 사주 전략 컨설팅의 대표로서, 개인의 애정운과 금전운은 물론 기업의 경영 흐름 및 중요한 의사결정을 돕는 전략적 상담을 폭넓게 진행하고 있습니다. 또한 월간 \'운세와 삶\'에 칼럼을 연재하며 대중과 깊이 있게 소통해 오고 있습니다.\n\n단순히 운명을 예견하는 것에 그치지 않고, 내담자의 고민을 깊이 있게 경청하며 삶의 파동을 함께 분석하는 세심한 상담을 지향합니다. 사주선녀 선생님의 따뜻하고 명확한 조언은 당신이 마주한 혼란 속에서 가장 지혜로운 선택을 할 수 있는 든든한 이정표가 되어줄 것입니다.',
    introImg: '/img/product_banner_newyear.png',
  },
]

/** 서비스 상품 후기 — 후기 탭 카드 (CounselorReviewItem 재사용 가능하나 분리) */
export interface ProductReviewItem {
  id: number
  customerName: string
  isPrivate: boolean
  title: string
  content: string
  imgUrl?: string
  consultType: '전화상담' | '채팅상담'
  date: string
  duration: string
  reply?: { author: string; text: string }
}

export const MOCK_PRODUCT_REVIEWS: ProductReviewItem[] = [
  {
    id: 1, customerName: '김*객', isPrivate: false,
    title: '정말 많은 도움 되었습니다.',
    content: '선생님께서 정말 친절하고 자세하게 봐주십니다. 돈이 아깝지 않은 상담이었어요. 감사합니다.',
    imgUrl: '/img/counselor_notice_thumb.png',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
  },
  {
    id: 2, customerName: '콩*물', isPrivate: false,
    title: '너무 용하셔서 신기합니다.',
    content: '제가 말씀드리지 않은 것까지 맞추셔서 너무 신기했습니다....',
    imgUrl: '/img/counselor_notice_thumb.png',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
    reply: {
      author: '김선녀',
      text:
        '안녕하세요. 상담이 만족스러우셨다니 다행입니다. 더 궁금한 점이 있으시면 언제든지 상담해주세요. 정성스러운...',
    },
  },
  {
    id: 3, customerName: '옥*수', isPrivate: true,
    title: '비밀 후기글입니다.',
    content: '비밀 후기글입니다.',
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분20초',
  },
]

/** 서비스 상품 문의 — 문의 탭 카드 */
export interface ProductQnaItem {
  id: number
  status: '답변완료' | '답변대기'
  isPrivate: boolean
  title: string
  content: string
  authorName: string
  date: string
}

export const MOCK_PRODUCT_QNAS: ProductQnaItem[] = [
  {
    id: 1, status: '답변완료', isPrivate: true,
    title: '비밀 문의글입니다.',
    content: '비밀 문의글입니다.',
    authorName: '김*객', date: '2026.04.23',
  },
  {
    id: 2, status: '답변완료', isPrivate: false,
    title: '상담 가격 관련해서 문의드립니다.',
    content: '상담 가격 관련해서 문의드릴게 있습니다.',
    authorName: '콩*물', date: '2026.04.23',
  },
  {
    id: 3, status: '답변대기', isPrivate: false,
    title: '상담 예약도 되나요?',
    content: '제가 원하는 일자에 상담을 꼭 받고 싶은데 혹시 상담 예약이 되나요?',
    authorName: '옥*수', date: '2026.04.23',
  },
]

/** 서비스 상품 안내 탭 — 배송정보 + 교환반품 (시안 풀텍스트) */
export const PRODUCT_GUIDE_SHIPPING = [
  '배송 방법: 택배',
  '배송 지역: 전국지역',
  '배송 비용: 3,000원',
  '배송 기간: 3일 ~ 7일',
  '배송 안내: 시·공휴일 제외 영업일 기준 발송됩니다.',
  '고객님께서 주문하신 상품은 당일 확인 후 배송해 드립니다. 다만, 상품종류에 따라서 상품의 배송이 다소 지연될 수 있습니다.',
]

export const PRODUCT_GUIDE_RETURN_OK = [
  '계약내용에 관한 서면을 받은 날부터 7일. 단, 그 서면을 받은 때보다 재화등의 공급이 늦게 이루어진 경우에는 재화등을 공급받거나 재화등의 공급이 시작된 날부터 7일 이내',
  '공급받으신 상품 및 용역의 내용이 표시·광고 내용과 다르거나 계약내용과 다르게 이행된 때에는 당해 재화 등을 공급받은 날부터 3월이내, 그사실을 알게 된 날 또는 알 수 있었던 날부터 30일이내',
]

export const PRODUCT_GUIDE_RETURN_NG = [
  '이용자에게 책임 있는 사유로 재화 등이 멸실 또는 훼손된 경우(단, 재화 등의 내용을 확인하기 위하여 포장 등을 훼손한 경우 제외)',
  '이용자의 사용 또는 일부 소비에 의하여 재화 등의 가치가 현저히 감소한 경우',
  '시간의 경과에 의하여 재판매가 곤란할 정도로 재화등의 가치가 현저히 감소한 경우',
  '복제가 가능한 재화등의 포장을 훼손한 경우',
  '개별 주문 생산되는 재화 등 청약철회시 판매자에게 회복할 수 없는 피해가 예상되어 소비자의 사전 동의를 얻은 경우',
  '디지털 콘텐츠의 제공이 개시된 경우. (단, 가분적 용역 또는 가분적 디지털콘텐츠로 구성된 계약의 경우 제공이 개시되지 아니한 부분에 정의됩니다.)',
]

export const PRODUCT_GUIDE_FOOTNOTE =
  '※ 고객님의 마음이 바뀌어 교환, 반품을 하실 경우 상품반송 비용은 고객님께서 부담하셔야 합니다.\n(색상 교환, 사이즈 교환 등 포함)'
