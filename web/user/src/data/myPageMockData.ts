/**
 * 06마이페이지(비회원) 영역 mock 데이터 — Figma 06마이페이지(비회원)
 * - 이벤트 / 공지사항 / 이용안내 FAQ
 * 백엔드 연동 시 fetch 결과로 교체.
 */

/* ─────────── 이벤트 ─────────── */

export type EventStatus = '진행중' | '종료'

export interface EventItem {
  id: number
  title: string
  /** "2026.04.20 ~ 2026.04.26" */
  period: string
  status: EventStatus
  /** 배너 이미지 (Figma에서 다운로드한 실제 시안 이미지) */
  imgUrl: string
}

export const MOCK_EVENTS: EventItem[] = [
  {
    id: 1,
    title: 'Hello Spring! 봄맞이 이벤트',
    period: '2026.04.20 ~ 2026.04.26',
    status: '진행중',
    imgUrl: '/img/event_hello_spring.png',
  },
  {
    id: 2,
    title: '봄날의 혜택 이벤트',
    period: '2026.04.10 ~ 2026.04.30',
    status: '진행중',
    imgUrl: '/img/event_spring_benefit.png',
  },
  {
    id: 3,
    title: 'SUMMER FESTA! 여름기념 할인',
    period: '2025.07.01 ~ 2025.07.10',
    status: '종료',
    imgUrl: '/img/event_summer_festa.png',
  },
]

/* ─────────── 공지사항 ─────────── */

export interface NoticeItem {
  id: number
  title: string
  /** 작성자 (예: "사주문") */
  author: string
  /** 리스트 카드용 짧은 날짜 (예: "2026.04.23") */
  date: string
  /** 상세 페이지 풀 시각 (예: "2026.04.23 15:00") */
  postedAt: string
  /** 상단 고정 공지 여부 — 연보라 배경 + "공지" 칩 노출 */
  pinned?: boolean
  /** 신규 표시 — 빨간 "New" 뱃지 */
  isNew?: boolean
  /** 본문 (개행은 \n) */
  content: string
  /** 본문 이미지 (옵션) */
  bodyImg?: string
}

export const MOCK_NOTICES: NoticeItem[] = [
  {
    id: 1,
    title: '사주문 공지사항입니다.',
    author: '사주문',
    date: '2026.04.23',
    postedAt: '2026.04.23 15:00',
    pinned: true,
    isNew: true,
    content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.',
    bodyImg: '/img/sample_img04.jpg',
  },
  { id: 2, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 14:00', pinned: true, content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 3, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 13:00', pinned: true, content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 4, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 12:00', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 5, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 11:30', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 6, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 11:00', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 7, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 10:30', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 8, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 10:00', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 9, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 09:30', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
  { id: 10, title: '사주문 공지사항입니다.', author: '사주문', date: '2026.04.23', postedAt: '2026.04.23 09:00', content: '사주문에서 작성한 공지사항의 내용이 이곳에 들어갑니다.' },
]

export const NOTICE_CATEGORIES = ['전체', '공지', '이벤트', '업데이트'] as const
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number]

/* ─────────── 이용안내 FAQ ─────────── */

export const FAQ_CATEGORIES = ['전체', '회원', '결제', '상담', '후기', '기타'] as const
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]

export interface FaqItem {
  id: number
  category: Exclude<FaqCategory, '전체'>
  question: string
  answer: string
}

/* ─────────── 상담사 신청 게시판 ─────────── */

export interface CounselorApplyPost {
  id: number
  title: string
  /** 상단 고정 공지 — 연보라 배경 + "공지" 칩 */
  pinned?: boolean
  /** "New" 빨간 뱃지 */
  isNew?: boolean
  /** 작성자 마스킹 이름 (예: "오**") */
  customerName: string
  date: string
  /** 비밀글 자물쇠 */
  locked?: boolean
}

export const MOCK_APPLY_POSTS: CounselorApplyPost[] = [
  { id: 101, title: '사주문 공지사항입니다.', pinned: true, isNew: true, customerName: '사주문', date: '2026.04.23' },
  { id: 102, title: '사주문 공지사항입니다.', pinned: true, customerName: '사주문', date: '2026.04.23' },
  { id: 103, title: '사주문 공지사항입니다.', pinned: true, customerName: '사주문', date: '2026.04.23' },
  { id: 1, title: '타로상담사 지원합니다', isNew: true, customerName: '오**', date: '2026.04.23', locked: true },
  { id: 2, title: '타로상담사 지원합니다', customerName: '오**', date: '2026.04.23', locked: true },
  { id: 3, title: '타로상담사 지원합니다', customerName: '오**', date: '2026.04.23', locked: true },
  { id: 4, title: '타로상담사 지원합니다', customerName: '오**', date: '2026.04.23', locked: true },
  { id: 5, title: '타로상담사 지원합니다', customerName: '오**', date: '2026.04.23', locked: true },
  { id: 6, title: '타로상담사 지원합니다', customerName: '오**', date: '2026.04.23', locked: true },
  { id: 7, title: '타로상담사 지원합니다', customerName: '오**', date: '2026.04.23', locked: true },
]

/** 신청 작성 폼 — 신청 상태 옵션 */
export const APPLY_STATUS_OPTIONS = ['상담사 지원', '상담사 문의', '기타 문의'] as const
/**
 * 지역 옵션 — 17개 시·도 풀세트.
 * 출처: sample/theme/basic/mobile/skin/board/apply/write.skin.php (라이브 그대로).
 */
export const APPLY_REGION_OPTIONS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종특별자치시',
  '경기도',
  '강원도',
  '충청북도',
  '충청남도',
  '전라북도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
] as const
/** 상담분야 옵션 */
export const APPLY_FIELD_OPTIONS = ['사주', '타로', '신점'] as const
/** 전문 상담분야 칩 (다중 선택, 2026-05-15 운영 정책 갱신 — 12개) */
export const APPLY_SPECIALTY_OPTIONS = [
  '재회',
  '속마음/궁합',
  '연애/짝사랑',
  '운세/총운',
  '금전/재물',
  '취업/합격',
  '사업/직장',
  '건강',
  '이사/부동산',
  '택일',
  '작명/개명',
  '가족/고민상담',
] as const

/* ─────────── 상담사 신청 상세 ─────────── */

export interface CounselorApplyDetailData {
  id: number
  title: string
  customerName: string
  postedAt: string
  /** 정보 테이블 */
  realName: string
  penName: string
  region: string
  phone: string
  email: string
  field: string
  specialties: string[]
  /** 본인 소개 본문 */
  intro: string
  /** 본인 사진 */
  photoUrl: string
}

/** 상세 mock — 작성자 본인 글로 가정(휴지통/연필 액션 노출). id 키는 string */
export const MOCK_APPLY_DETAILS: Record<string, CounselorApplyDetailData> = {
  '1': {
    id: 1,
    title: '상담 신청합니다.',
    customerName: '콩나물',
    postedAt: '2026.04.23 13:12',
    realName: '콩나물',
    penName: '제제',
    region: '서울',
    phone: '010-1234-5678',
    email: 'name@email.com',
    field: '타로',
    specialties: ['속마음', '재회', '사업'],
    intro: '사주 상담 자신있습니다!!',
    photoUrl: '/img/sample_img04.jpg',
  },
}

export const MOCK_FAQS: FaqItem[] = [
  {
    id: 1,
    category: '후기',
    question: '상담후기 운영정책',
    answer:
      "상담문의 작성 시 해당 상담사와 작성자 본인만 볼 수 있는 '비밀글'로 작성됩니다. 상담문의 작성 시 자동 비밀글로 작성되는 점 참고 부탁드립니다.\n\n상담문의 쓰기\n상담 문의는 한 선생님께 하루 5회 / 1회당 15자 이내의 글만 작성이 가능합니다.\n\n상담문의 관리 규정\n더사주는 고객님께서 작성해 주신 소중한 문의를 등록하신 그대로 게시하는 것을 기본 운영 원칙으로 삼고 있습니다.",
  },
  { id: 2, category: '후기', question: '상담후기 운영정책', answer: '상담후기 운영정책 답변 본문이 들어갑니다.' },
  { id: 3, category: '후기', question: '상담후기 운영정책', answer: '상담후기 운영정책 답변 본문이 들어갑니다.' },
  { id: 4, category: '후기', question: '상담후기 운영정책', answer: '상담후기 운영정책 답변 본문이 들어갑니다.' },
  { id: 5, category: '결제', question: '결제 수단은 어떤 것이 있나요?', answer: '신용카드, 카카오페이, 무통장 입금 등이 가능합니다.' },
  { id: 6, category: '결제', question: '환불은 어떻게 신청하나요?', answer: '고객센터로 1:1 문의 부탁드립니다.' },
  { id: 7, category: '회원', question: '회원 탈퇴는 어떻게 하나요?', answer: '마이페이지 > 설정 > 회원탈퇴에서 진행할 수 있습니다.' },
  { id: 8, category: '상담', question: '상담 예약이 가능한가요?', answer: '현재는 실시간 상담만 제공됩니다.' },
  { id: 9, category: '기타', question: '문의 답변은 언제 받을 수 있나요?', answer: '영업일 기준 1~2일 이내에 답변드립니다.' },
  { id: 10, category: '회원', question: '비밀번호를 잊어버렸어요', answer: '로그인 페이지의 "비밀번호 찾기"에서 재설정할 수 있습니다.' },
]
