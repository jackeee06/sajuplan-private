/**
 * 07마이페이지(회원) — 로그인된 사용자 프로필 mock
 * Figma 회원 메인(128:16774) / 회원 정보 수정(137:9729) 기준.
 * 백엔드 연동 시 fetch 결과로 교체.
 */

export type Calendar = '양력' | '음력'
export type Gender = '남자' | '여자'

export interface MemberProfile {
  /** 로그인 아이디 (read-only) */
  userId: string
  /** 실명 (read-only) */
  name: string
  /** 화면 표시명 — 회원 메인 + 헤더 표시 */
  nickname: string
  email: string
  phone: string
  gender: Gender
  /** 생년월일 — Figma 시안 그대로 'YYYY. MM. DD' */
  birth: string
  calendar: Calendar
  zipcode: string
  /** 도로명/지번 주소 (검색 결과) */
  address: string
  addressDetail: string
  /** 유입경로 (예: "지인 추천") */
  source: string
  /** 보유 포인트 — 회원 메인 보유 포인트 박스에 노출 */
  point: number
  /** 인증 뱃지 (보라 체크) — 회원 메인 닉네임 옆 */
  verified: boolean
  /** 카카오 / 네이버 소셜 연결 여부 — 회원 정보 수정 페이지 버튼 */
  kakaoLinked: boolean
  naverLinked: boolean
  /** 마케팅 수신 동의 */
  emailMarketing: boolean
  smsMarketing: boolean
  /** 푸시알림 설정 — 앱 설정 페이지 토글 */
  pushEnabled: boolean
}

export const MOCK_MEMBER: MemberProfile = {
  userId: 'userid_1234',
  name: '김고객',
  nickname: '김고객',
  email: 'user_email@domain.com',
  phone: '01000000000',
  gender: '남자',
  birth: '1998. 01. 30',
  calendar: '양력',
  zipcode: '00000',
  address: '서울특별시 강남구 강남대로 1234',
  addressDetail: '1층',
  source: '지인 추천',
  point: 10000,
  verified: true,
  kakaoLinked: false,
  naverLinked: false,
  emailMarketing: false,
  smsMarketing: false,
  pushEnabled: true,
}

/** 회원 메인 메뉴 — 마이페이지 섹션 */
export interface MemberMenuItem {
  to: string
  label: string
  icon: string
}

export const MEMBER_MAIN_MENU: MemberMenuItem[] = [
  { to: '/mypage/coupons', label: '쿠폰', icon: '/img/ic_my_coupon.svg' },
  { to: '/mypage/points', label: '포인트 내역', icon: '/img/ic_my_history.svg' },
  { to: '/mypage/history', label: '상담 내역', icon: '/img/ic_my_phone.svg' },
  { to: '/mypage/my-reviews', label: '나의 상담후기', icon: '/img/ic_my_review.svg' },
  { to: '/mypage/my-qnas', label: '나의 상담문의', icon: '/img/ic_my_inquiry.svg' },
]

/** 회원 메인 추가메뉴 — 비회원과 동일 5개 */
export const MEMBER_EXTRA_MENU: MemberMenuItem[] = [
  { to: '/mypage/events', label: '이벤트', icon: '/img/ic_my_event.svg' },
  { to: '/mypage/help', label: '이용안내', icon: '/img/ic_my_book.svg' },
  { to: '/mypage/notices', label: '공지사항', icon: '/img/ic_my_notice.svg' },
  { to: '/mypage/new-counselors', label: '신규상담사', icon: '/img/ic_my_headset.svg' },
  { to: '/mypage/counselor-apply', label: '상담사 신청', icon: '/img/ic_my_user_plus.svg' },
]
