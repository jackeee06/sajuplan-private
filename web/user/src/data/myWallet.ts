/**
 * 07마이페이지(회원) 07-C — 쿠폰 / 결제내역 / 포인트 내역 mock 데이터.
 * Figma 노드:
 *  - 쿠폰함 118:7460 / 쿠폰함 변형 120:6640 / 쿠폰 사용 모달 128:15813 / 쿠폰 등록 모달 128:15905
 *  - 결제내역 120:6697 / 포인트 내역 147:10616
 *
 * 백엔드 연동 시 fetch 결과로 교체.
 */

/* ─────────── 쿠폰 ─────────── */

export interface Coupon {
  id: number
  /** 쿠폰명 — "신규회원가입 쿠폰" 또는 코드 형태 "ABCD-1234-EFGH-5678" */
  title: string
  /** 적립 포인트 */
  point: number
  /** 만료일 (예: "2026.04.30") — 미사용 쿠폰 카드의 "YYYY.MM.DD까지" */
  expiredAt: string
  /** 사용 여부 — true면 사용내역 탭에 노출 (사용일 = usedAt) */
  used: boolean
  /** 사용일 (사용 완료 쿠폰만) — "2026.04.30" */
  usedAt?: string
}

export const MOCK_COUPONS: Coupon[] = [
  {
    id: 1, title: '신규회원가입 쿠폰', point: 10000,
    expiredAt: '2026.04.30', used: true, usedAt: '2026.04.30',
  },
  {
    id: 2, title: '신규회원가입 쿠폰', point: 10000,
    expiredAt: '2026.04.30', used: true, usedAt: '2026.04.30',
  },
  {
    id: 3, title: 'ABCD-1234-EFGH-5678', point: 10000,
    expiredAt: '2026.04.30', used: true, usedAt: '2026.04.30',
  },
  {
    id: 4, title: '신규회원가입 쿠폰', point: 10000,
    expiredAt: '2026.04.30', used: false,
  },
  {
    id: 5, title: '신규회원가입 쿠폰', point: 10000,
    expiredAt: '2026.04.30', used: false,
  },
]

/* ─────────── 결제 내역 ─────────── */

export type PaymentMethod =
  | '카드결제'
  | '카카오결제'
  | '가상계좌'
  | '네이버결제'
  | '페이코결제'
  | '자동충전 카드결제'

export type PaymentStatus = '결제완료' | '취소완료'

export interface PaymentLog {
  id: number
  /** "2026.04.30 결제" — 좌측 상단 메타 */
  paidAt: string
  method: PaymentMethod
  amount: number
  status: PaymentStatus
}

export const MOCK_PAYMENTS: PaymentLog[] = [
  { id: 1, paidAt: '2026.04.30 결제', method: '카드결제',         amount: 100000, status: '결제완료' },
  { id: 2, paidAt: '2026.04.30 결제', method: '카카오결제',       amount: 100000, status: '취소완료' },
  { id: 3, paidAt: '2026.04.30 결제', method: '가상계좌',         amount: 100000, status: '결제완료' },
  { id: 4, paidAt: '2026.04.30 결제', method: '네이버결제',       amount: 100000, status: '결제완료' },
  { id: 5, paidAt: '2026.04.30 결제', method: '페이코결제',       amount: 100000, status: '결제완료' },
  { id: 6, paidAt: '2026.04.30 결제', method: '자동충전 카드결제', amount: 100000, status: '결제완료' },
]

/* ─────────── 포인트 내역 ─────────── */

/**
 * direction:
 *  - 'in': 적립 (→ 보라 화살표, +금액 보라)
 *  - 'out': 차감 (← 회색 화살표, -금액 검정)
 */
export type PointDirection = 'in' | 'out'

export interface PointLog {
  id: number
  /** 트랜잭션 제목 (예: "포인트 충전", "채팅상담 포인트 차감", "상담후기 작성", "ABCD-1234-EFGH-5678 쿠폰 사용") */
  title: string
  /** "2026.04.30 19:22" */
  occurredAt: string
  direction: PointDirection
  /** 변동 절댓값 (양수) */
  amount: number
  /** 트랜잭션 후 잔액 */
  balance: number
}

export const MOCK_POINT_LOGS: PointLog[] = [
  { id: 1, title: '포인트 충전',          occurredAt: '2026.04.30 19:22', direction: 'in',  amount: 101000, balance: 101000 },
  { id: 2, title: '채팅상담 포인트 차감', occurredAt: '2026.04.30 19:10', direction: 'out', amount: 1000,   balance: 0 },
  { id: 3, title: '상담후기 작성',        occurredAt: '2026.04.30 19:00', direction: 'in',  amount: 1000,   balance: 1000 },
  { id: 4, title: '채팅상담 포인트 차감', occurredAt: '2026.04.30 16:42', direction: 'out', amount: 8000,   balance: 0 },
  { id: 5, title: '채팅상담 포인트 차감', occurredAt: '2026.04.30 15:40', direction: 'out', amount: 2000,   balance: 80000 },
  { id: 6, title: 'ABCD-1234-EFGH-5678 쿠폰 사용', occurredAt: '2026.04.30 15:50', direction: 'in', amount: 10000, balance: 10000 },
]

/** 포인트 내역 상단 보유 포인트 카드의 잔액 (점프 가능 — 별도 mock) */
export const MOCK_POINT_BALANCE = 101000

/* ─────────── 07-D 포인트 충전 ─────────── */

/**
 * 결제요금 패키지 — 5종.
 * Figma 노드: 128:19235(카드 없음) / 137:10991, 147:9265(카드 있음) / 137:10718(일반결제) / 147:9474(자동충전)
 */
export interface ChargePackage {
  id: number
  /** 충전될 포인트 (보너스 포함) */
  point: number
  /** 보너스 비율 (%) — 0이면 칩에 +0% */
  bonusRate: number
  /** 결제 금액 (원, VAT 별도) */
  price: number
}

export const MOCK_CHARGE_PACKAGES: ChargePackage[] = [
  { id: 1, point: 315000, bonusRate: 5, price: 300000 },
  { id: 2, point: 206000, bonusRate: 3, price: 200000 },
  { id: 3, point: 101000, bonusRate: 1, price: 100000 },
  { id: 4, point: 50000,  bonusRate: 0, price: 50000 },
  { id: 5, point: 30000,  bonusRate: 0, price: 30000 },
]

/** 일반결제 하위 결제수단 */
export const GENERAL_PAY_OPTIONS = [
  '신용카드',
  '가상계좌',
  '페이코',
  '카카오페이',
  '네이버페이',
] as const
export type GeneralPayOption = (typeof GENERAL_PAY_OPTIONS)[number]

/**
 * 사주플랜페이 등록 카드.
 * 카드사 브랜드 컬러는 시안에서 추출:
 *  - BC카드: 빨강 배경 + 흰색 텍스트
 *  - KB 국민카드: 노랑 배경 + 검정 텍스트
 */
export interface RegisteredCard {
  id: number
  brand: string
  /** "0000-****-****-0000" 마스킹 */
  numberMasked: string
  /** 카드 배경 컬러 */
  bgColor: string
  /** 카드 위 텍스트 컬러 — 배경 명도에 맞춰 흑/백 */
  textColor: string
  /** 휴지통 아이콘 — bgColor 명도에 맞춰 검정/흰색 svg */
  trashIcon: string
}

export const MOCK_REGISTERED_CARDS: RegisteredCard[] = [
  {
    id: 1,
    brand: 'KB 국민카드',
    numberMasked: '0000-****-****-0000',
    bgColor: '#FFB901',
    textColor: '#1E2939',
    trashIcon: '/img/ic_trash_b.svg',
  },
]

/** 충전 페이지 보유 포인트 (시안 기준) */
export const MOCK_CHARGE_BALANCE = 10000

/** 자동충전 기본 기준 잔액 */
export const MOCK_AUTO_THRESHOLD = 10000

/** 충전 페이지 주의사항 4줄 */
export const CHARGE_NOTICES = [
  "충전 불편 및 신청은 카카오톡 '사주플랜고객센터'로 문의 바랍니다.",
  '상담 종료 후 남은 시간은 부분 환불이 되지 않습니다.',
  '충전·사용 내역은 마이페이지에서 보실 수 있습니다.',
  '제시된 금액은 부가세(VAT) 미포함 가격입니다.',
]
