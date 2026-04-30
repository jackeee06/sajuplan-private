/**
 * 관리자 화면 전체에서 사용하는 raw 값 → 한글 라벨 매핑 통합 모듈.
 *
 * 원칙:
 *  - 코드 내부에서는 raw 값(영문 키)을 그대로 사용
 *  - 화면 출력 시에는 반드시 이 모듈의 helper(label*, *_OPTIONS, *_MAP)로 변환
 *  - 새 enum/상태가 생기면 이 파일에 먼저 추가
 *
 * 패턴:
 *  - *_MAP   : { [value]: { label, tone } } — value → 라벨/색상 빠른 조회용
 *  - *_OPTIONS: { value, label }[]          — <select>·드롭다운 렌더링용 (순서 보존)
 *  - label*  : 함수 — 모르는 값이 와도 기본 표시 보장 (raw 값 노출 안 함)
 */

// ────────────────────────────────────────────────
// 색상 토큰 (Tailwind 클래스 매핑)
// ────────────────────────────────────────────────
export type Tone = 'gray' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'indigo'

export const TONE_BADGE_CLS: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
}

interface LabeledTone {
  label: string
  tone: Tone
}

// ────────────────────────────────────────────────
// 결제 상태 (payment.status)
// ────────────────────────────────────────────────
export const PAYMENT_STATUS_MAP: Record<string, LabeledTone> = {
  pending: { label: '대기', tone: 'amber' },
  completed: { label: '완료', tone: 'emerald' },
  cancelled: { label: '취소', tone: 'rose' },
  failed: { label: '실패', tone: 'gray' },
}

export const PAYMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
  { value: 'failed', label: '실패' },
]

export function labelPaymentStatus(s: string | null | undefined): LabeledTone {
  if (!s) return { label: '-', tone: 'gray' }
  return PAYMENT_STATUS_MAP[s] ?? { label: s, tone: 'gray' }
}

// ────────────────────────────────────────────────
// 결제 수단 (payment.pay_method)
// ────────────────────────────────────────────────
export const PAY_METHOD_MAP: Record<string, string> = {
  card: '카드',
  vbank: '가상계좌',
  account: '계좌이체',
  hp: '휴대폰',
}

export const PAY_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'card', label: '카드' },
  { value: 'vbank', label: '가상계좌' },
  { value: 'account', label: '계좌이체' },
  { value: 'hp', label: '휴대폰' },
]

export function labelPayMethod(m: string | null | undefined): string {
  if (!m) return '-'
  return PAY_METHOD_MAP[m] ?? m
}

// ────────────────────────────────────────────────
// PG 응답 코드 (payment.req_result, payment_cancel_log.req_result)
// ────────────────────────────────────────────────
export const PG_REQ_RESULT_MAP: Record<string, string> = {
  '0000': '성공',
  '9999': 'PG 시스템 오류',
  '8888': '요청 형식 오류',
  '7777': '인증 실패',
  '6666': '거래 없음',
  '5555': '이미 취소된 거래',
  '4444': '취소 가능 기간 만료',
  '3333': '잔액 부족',
  '2222': '취소 한도 초과',
  '1111': '네트워크 오류',
}

export function labelPgReqResult(code: string | null | undefined): string {
  if (!code) return '-'
  return PG_REQ_RESULT_MAP[code] ?? `알 수 없는 응답 (${code})`
}

// ────────────────────────────────────────────────
// 취소 방식 (payment_cancel_log.cancel_method)
// ────────────────────────────────────────────────
export const CANCEL_METHOD_MAP: Record<string, string> = {
  full: '전액 취소',
  partial: '부분 취소',
  recharge: '재결제',
}

export function labelCancelMethod(m: string | null | undefined): string {
  if (!m) return '-'
  return CANCEL_METHOD_MAP[m] ?? m
}

// ────────────────────────────────────────────────
// 포인트 변동 출처 (point_history.actor_type)
// ────────────────────────────────────────────────
export const ACTOR_TYPE_MAP: Record<string, LabeledTone> = {
  admin: { label: '관리자', tone: 'blue' },
  consultation: { label: '상담', tone: 'purple' },
  payment: { label: '결제', tone: 'amber' },
  settlement: { label: '정산', tone: 'indigo' },
  system: { label: '시스템', tone: 'gray' },
  legacy: { label: '레거시', tone: 'gray' },
}

export const ACTOR_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'admin', label: '관리자 조정' },
  { value: 'consultation', label: '상담' },
  { value: 'payment', label: '결제' },
  { value: 'settlement', label: '정산' },
  { value: 'system', label: '시스템' },
  { value: 'legacy', label: '레거시' },
]

export function labelActorType(t: string | null | undefined): LabeledTone {
  if (!t) return { label: '-', tone: 'gray' }
  return ACTOR_TYPE_MAP[t] ?? { label: t, tone: 'gray' }
}

// ────────────────────────────────────────────────
// 포인트 종류 (is_paid)
// ────────────────────────────────────────────────
export const POINT_KIND_MAP: Record<'paid' | 'free', LabeledTone> = {
  paid: { label: '유료', tone: 'amber' },
  free: { label: '무료', tone: 'gray' },
}

export function labelPointKind(isPaid: boolean): LabeledTone {
  return POINT_KIND_MAP[isPaid ? 'paid' : 'free']
}

// ────────────────────────────────────────────────
// 상담 유형 (전화 vs 채팅 — consultation.roomid 유무로 결정)
// ────────────────────────────────────────────────
export const CONSULTATION_TYPE_MAP: Record<'phone' | 'chat', LabeledTone> = {
  phone: { label: '전화', tone: 'blue' },
  chat: { label: '채팅', tone: 'purple' },
}

export const CONSULTATION_TYPE_OPTIONS: { value: 'phone' | 'chat'; label: string }[] = [
  { value: 'phone', label: '전화' },
  { value: 'chat', label: '채팅' },
]

export function labelConsultationType(roomid: string | null | undefined): LabeledTone {
  return CONSULTATION_TYPE_MAP[roomid ? 'chat' : 'phone']
}

// ────────────────────────────────────────────────
// 상담 채널 (060 / 070 / 채팅 — callee_phone prefix와 roomid 유무로 분리)
// ────────────────────────────────────────────────
export type ConsultationChannel = '060' | '070' | 'chat'

export const CONSULTATION_CHANNEL_MAP: Record<ConsultationChannel, LabeledTone> = {
  '060': { label: '060', tone: 'rose' },
  '070': { label: '070', tone: 'blue' },
  chat: { label: '채팅', tone: 'purple' },
}

export const CONSULTATION_CHANNEL_OPTIONS: { value: ConsultationChannel; label: string }[] = [
  { value: '060', label: '060' },
  { value: '070', label: '070' },
  { value: 'chat', label: '채팅' },
]

/** roomid 있으면 채팅, 그 외에는 callee_phone 앞 3자리로 060/070 분류. 매칭 없으면 070으로 디폴트 */
export function detectConsultationChannel(
  roomid: string | null | undefined,
  calleePhone: string | null | undefined,
): ConsultationChannel {
  if (roomid) return 'chat'
  const digits = (calleePhone ?? '').replace(/[^0-9]/g, '')
  if (digits.startsWith('060')) return '060'
  return '070'
}

// ────────────────────────────────────────────────
// 상담 선/후불 (consultation.preflag — 'Y'=선불 / 'N' 또는 NULL=후불)
// ────────────────────────────────────────────────
export const PREFLAG_MAP: Record<'pre' | 'post', LabeledTone> = {
  pre: { label: '선불', tone: 'amber' },
  post: { label: '후불', tone: 'gray' },
}

export function labelPreflag(preflag: string | null | undefined): LabeledTone {
  return PREFLAG_MAP[preflag === 'Y' ? 'pre' : 'post']
}

// ────────────────────────────────────────────────
// 정산 상태 (consultation.is_settled, point_history.is_settled)
// ────────────────────────────────────────────────
export const SETTLEMENT_STATUS_MAP: Record<'settled' | 'unsettled', LabeledTone> = {
  settled: { label: '정산완료', tone: 'emerald' },
  unsettled: { label: '미정산', tone: 'gray' },
}

export function labelSettlementStatus(isSettled: boolean): LabeledTone {
  return SETTLEMENT_STATUS_MAP[isSettled ? 'settled' : 'unsettled']
}

// ────────────────────────────────────────────────
// 회원 상태 (member: leftAt + interceptUntil 조합)
// ────────────────────────────────────────────────
export const MEMBER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활동중' },
  { value: 'left', label: '탈퇴' },
  { value: 'blocked', label: '차단중' },
]

// ────────────────────────────────────────────────
// 성별
// ────────────────────────────────────────────────
export const GENDER_MAP: Record<string, string> = {
  M: '남',
  F: '여',
}

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '미지정' },
  { value: 'M', label: '남' },
  { value: 'F', label: '여' },
]

export function labelGender(g: string | null | undefined): string {
  if (!g) return '미지정'
  return GENDER_MAP[g] ?? g
}
