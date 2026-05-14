/**
 * 07마이페이지(회원) 07-B — 내 상담 내역 / 내가 쓴 후기·문의 mock 데이터.
 * Figma 노드:
 *  - 전화상담 내역 109:10816 / 채팅상담 내역 147:12434
 *  - 나의 상담후기 147:12682 / 상세 147:13357 / 작성 147:12530
 *  - 나의 상담문의 147:13466 / 상세 147:13518
 *
 * 백엔드 연동 시 fetch 결과로 교체.
 */

import type { Badge } from './counselorDetails'

/* ─────────── 공통 ─────────── */

export type ConsultType = '전화상담' | '채팅상담'

/** 후기 작성 상태 — 카드 하단 버튼 분기 */
export type ReviewWriteStatus =
  | 'unwritten' // "후기 작성하기" 버튼
  | 'written' // "작성한 후기 보기" 버튼
  | 'noaction' // 버튼 없음 (짧은 통화 등)

/** 상담사 요약 (내역 카드 상단) */
export interface CounselorBrief {
  id: number
  name: string
  code: string
  badge: Badge
  avatar: string
}

/* ─────────── 전화/채팅 상담 내역 ─────────── */

export interface ConsultHistoryItem {
  id: number
  counselor: CounselorBrief
  /** "2026.04.23 19:50:17" */
  startedAt: string
  /** "2026.04.23 19:51:47" */
  endedAt: string
  /** "00시간17분30초" */
  duration: string
  /** 사용 포인트 */
  point: number
  reviewStatus: ReviewWriteStatus
  /** 작성한 후기 ID — reviewStatus='written'일 때 상세 진입 */
  reviewId?: number
  /**
   * 채팅상담 전용 — chat_room.status ('STAY' | 'CNCH' | 'DISCONNECT' | null).
   * STAY(상담사 대기) 또는 CNCH(진행 중) 이면 카드 액션이 "채팅방 입장" 으로 바뀐다.
   * DISCONNECT(종료) 또는 null 이면 "채팅 내역 보기" + 후기 흐름.
   */
  chatStatus?: string | null
  /** 후기 작성 라우팅(/mypage/my-reviews/new?consultation_id=N&counselor_id=M)에 필요. */
  consultationId?: number
  counselorId?: number
}

export const MOCK_CALL_HISTORY: ConsultHistoryItem[] = [
  {
    id: 1,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:50:17', endedAt: '2026.04.23 19:51:47', duration: '00시간17분30초',
    point: 80, reviewStatus: 'noaction',
  },
  {
    id: 2,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', duration: '00시간17분30초',
    point: 1000, reviewStatus: 'unwritten',
  },
  {
    id: 3,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', duration: '00시간17분30초',
    point: 1000, reviewStatus: 'written', reviewId: 2,
  },
  {
    id: 4,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.04 19:50:17', endedAt: '2026.04.04 20:51:17', duration: '00시간17분30초',
    point: 80, reviewStatus: 'unwritten',
  },
]

export const MOCK_CHAT_HISTORY: ConsultHistoryItem[] = [
  {
    id: 11,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', duration: '00시간17분30초',
    point: 1000, reviewStatus: 'unwritten',
  },
  {
    id: 12,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:50:17', endedAt: '2026.04.23 19:51:47', duration: '00시간17분30초',
    point: 1000, reviewStatus: 'noaction',
  },
  {
    id: 13,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:49:17', endedAt: '2026.04.23 20:06:47', duration: '00시간17분30초',
    point: 1000, reviewStatus: 'written', reviewId: 1,
  },
  {
    id: 14,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    startedAt: '2026.04.23 19:50:17', endedAt: '2026.04.23 19:51:47', duration: '00시간17분30초',
    point: 1000, reviewStatus: 'noaction',
  },
]

/* ─────────── 나의 상담 후기 ─────────── */

export interface MyReview {
  id: number
  counselor: CounselorBrief
  consultType: ConsultType
  /** 상담일시 — "2026.04.23" */
  date: string
  /** 상담 시간 — "00시간17분30초" */
  duration: string
  customerName: string
  title: string
  content: string
  /** 첨부 사진 — 없으면 사진 후기 아님 */
  imgUrl?: string
  /** 상담사 답변 (답변 없는 케이스도 있음) */
  reply?: { name: string; text: string }
}

export const MOCK_MY_REVIEWS: MyReview[] = [
  {
    id: 1,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    consultType: '채팅상담', date: '2026.04.23', duration: '00시간17분30초',
    customerName: '김*객',
    title: '정말 많은 도움 되었습니다.',
    content: '선생님께서 정말 친절하고 자세하게 봐주십니다.\n돈이 아깝지 않은 상담이었어요. 감사합니다.',
    imgUrl: '/img/sample_img01.jpg',
  },
  {
    id: 2,
    counselor: { id: 32, name: '김선녀', code: '224587', badge: '신점', avatar: '/img/sample_img04.jpg' },
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분30초',
    customerName: '김*객',
    title: '너무 용하셔서 신기합니다.',
    content: '제가 말씀드리지 않은 것까지 맞추셔서 너무 신기했습니다.\n다음에 또 이용하고 싶네요.',
    imgUrl: '/img/sample_img02.jpg',
    reply: {
      name: '김선녀',
      text: '안녕하세요. 상담이 만족스러우셨다니 다행입니다. 더 궁금한 점이 있으시면 언제든지 상담해주세요. 정성스러운 후기 감사합니다. :)',
    },
  },
  {
    id: 3,
    counselor: { id: 33, name: '사주선녀', code: '165791', badge: '사주', avatar: '/img/sample_img02.jpg' },
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분30초',
    customerName: '김*객',
    title: '풀해도 조심해야겠어요',
    content: '안내와 고민도 많이 했는데 어느정도 안심이 되네요. 정말 감사합니다.',
  },
  {
    id: 4,
    counselor: { id: 34, name: '신비', code: '863143', badge: '신점', avatar: '/img/sample_img01.jpg' },
    consultType: '전화상담', date: '2026.04.23', duration: '00시간17분30초',
    customerName: '김*객',
    title: '정말 감사합니다.',
    content: '정말 감사합니다.',
  },
]

/* ─────────── 나의 상담 문의 ─────────── */

export type MyQnaStatus = '답변완료' | '답변대기'

export interface MyQnaReply {
  /** 상담사 이름 */
  name: string
  /** 답변 본문 */
  text: string
  /** "2026.04.23 20:10" */
  postedAt: string
  /** 상담사 28×28 아바타 */
  profileImg: string
}

export interface MyQna {
  id: number
  counselor: CounselorBrief
  status: MyQnaStatus
  title: string
  /** 리스트 카드용 한 줄 미리보기 */
  preview: string
  /** 상세 본문 */
  content: string
  customerName: string
  /** 리스트 카드용 짧은 날짜 */
  date: string
  /** 상세 페이지 풀 시각 */
  postedAt: string
  /** 비밀글 자물쇠 */
  showLock?: boolean
  /** 상담사 답변 (여러 개 가능) */
  replies?: MyQnaReply[]
}

export const MOCK_MY_QNAS: MyQna[] = [
  {
    id: 1,
    counselor: { id: 31, name: '강타로', code: '335912', badge: '타로', avatar: '/img/sample_img03.jpg' },
    status: '답변완료',
    title: '문의드립니다.',
    preview: '안녕하세요. 문의드립니다.',
    content: '안녕하세요. 문의드립니다.',
    customerName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 14:20',
    showLock: true,
    replies: [
      {
        name: '강타로',
        text: '안녕하세요. 비밀 문의로 답변드립니다. 감사합니다.',
        postedAt: '2026.04.23 19:30',
        profileImg: '/img/sample_img03.jpg',
      },
    ],
  },
  {
    id: 2,
    counselor: { id: 32, name: '김선녀', code: '224587', badge: '신점', avatar: '/img/sample_img04.jpg' },
    status: '답변완료',
    title: '상담 가격 관련해서 문의드립니다.',
    preview: '상담 가격 관련해서 문의드릴게 있습니다.',
    content: '상담 가격이 실제로 어느 정도 되는지 자세히 알고 싶습니다.',
    customerName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 13:00',
    replies: [
      {
        name: '김선녀',
        text: '안녕하세요. 30초당 1,500원이며 30분 기준 90,000원입니다. 자세한 안내가 필요하시면 채팅으로 문의 부탁드립니다.',
        postedAt: '2026.04.23 18:45',
        profileImg: '/img/sample_img04.jpg',
      },
    ],
  },
  {
    id: 3,
    counselor: { id: 33, name: '사주선녀', code: '165791', badge: '사주', avatar: '/img/sample_img02.jpg' },
    status: '답변완료',
    title: '상담 예약도 되나요?',
    preview: '제가 원하는 일자에 상담을 꼭 받고 싶은데 혹시 상담 예약이 되나요?',
    content: '제가 원하는 일자에 상담을 꼭 받고 싶은데 혹시 상담 예약이 되나요?',
    customerName: '콩나물', date: '2026.04.23', postedAt: '2026.04.23 15:00',
    replies: [
      {
        name: '사주선녀',
        text: '안녕하세요.\n안타깝게도 상담 예약은 불가능한 점 양해부탁드립니다.\n상담을 원하시는 일시에 직접 상담 신청 부탁드립니다.\n감사합니다. :)',
        postedAt: '2026.04.23 20:10',
        profileImg: '/img/sample_img02.jpg',
      },
      {
        name: '사주선녀',
        text: '상담을 원하시는 일시를 다시 문의 남겨주시면 해당 시간에 상담 가능하도록 열어두겠습니다. :)',
        postedAt: '2026.04.23 20:10',
        profileImg: '/img/sample_img02.jpg',
      },
    ],
  },
  {
    id: 4,
    counselor: { id: 34, name: '신비', code: '863143', badge: '신점', avatar: '/img/sample_img01.jpg' },
    status: '답변대기',
    title: '상담 시간 문의드립니다.',
    preview: '평일 저녁 늦은 시간에도 상담 가능한가요?',
    content: '평일 저녁 늦은 시간에도 상담 가능한가요?',
    customerName: '김*객', date: '2026.04.23', postedAt: '2026.04.23 16:00',
  },
]
