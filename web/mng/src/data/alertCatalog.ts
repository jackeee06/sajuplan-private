/**
 * 사주플랜 통합 알림 가이드 — 푸시 / 인앱 / 알림톡 3채널 통합 매트릭스
 *
 * 한 이벤트가 어떤 채널로 발송되는지 한눈에. 중복 발견 + 정리 청사진 용도.
 *
 * 출처:
 *  - api/src 하위 sendAlimtalkByCode 호출처 grep (알림톡)
 *  - mobile/App.tsx + web/user 코드 (인앱)
 *  - api/src/shared/push (푸시)
 */

export type ChannelStatus =
  | 'active'    // ✅ 현재 실제 발송됨
  | 'planned'   // 📝 빌드/배포 후 활성화 예정
  | 'rejected'  // ❌ 검토 후 안 쓰기로 결정 (결정완료 — 다음에 다시 고민할 필요 X)
  | 'none'      // ➖ 처음부터 부적합 (해당 없음)
  | 'unknown'   // ❓ 확인 필요 (사장님이 보고 수정 요청)

export type Category = 'consult' | 'payment' | 'counselor' | 'marketing' | 'system'

export interface ChannelDetail {
  status: ChannelStatus
  note?: string  // 짧은 비고 ("BizM 템플릿", "FCM", "시스템 메시지" 등)
}

export interface AlertCatalogItem {
  id: string
  icon: string
  name: string
  category: Category
  oneLine: string
  trigger: string
  audience: string
  audienceDetail?: string
  title: string                // 알림 제목 예시
  body: string                 // 알림 본문 예시
  experience: string           // 알림 누름 → 어디로
  link?: string

  push: ChannelDetail
  inApp: ChannelDetail
  alimtalk: ChannelDetail

  recommend: string            // 권장 채널 + 중복 경고
  adminNote: string            // 관리자 참고
  techType?: string            // payload.data.type (코드)
}

export const CATEGORY_META: Record<Category, { label: string; color: string; bg: string }> = {
  consult:   { label: '상담',       color: '#9333ea', bg: '#f3e8ff' },
  payment:   { label: '결제/코인',  color: '#0891b2', bg: '#cffafe' },
  counselor: { label: '상담사',     color: '#db2777', bg: '#fce7f3' },
  marketing: { label: '마케팅',     color: '#ea580c', bg: '#ffedd5' },
  system:    { label: '시스템',     color: '#4b5563', bg: '#f3f4f6' },
}

export const CHANNEL_STATUS_META: Record<ChannelStatus, { label: string; icon: string; color: string; bg: string }> = {
  active:   { label: '사용중',  icon: '✅', color: '#15803d', bg: '#dcfce7' },
  planned:  { label: '예정',    icon: '📝', color: '#a16207', bg: '#fef9c3' },
  rejected: { label: '안 함',   icon: '❌', color: '#b91c1c', bg: '#fee2e2' },
  none:     { label: '미사용',  icon: '➖', color: '#6b7280', bg: '#f3f4f6' },
  unknown:  { label: '확인필요', icon: '❓', color: '#a855f7', bg: '#f3e8ff' },
}

/** 활성 채널 개수 (active + planned). 중복 위험 판정용. */
export function activeChannelCount(item: AlertCatalogItem): number {
  let n = 0
  if (item.push.status === 'active' || item.push.status === 'planned') n += 1
  if (item.inApp.status === 'active' || item.inApp.status === 'planned') n += 1
  if (item.alimtalk.status === 'active' || item.alimtalk.status === 'planned') n += 1
  return n
}

/** 결정 완료 여부 — 3채널 모두 결정됨 (active/rejected/none) = 결정완료. */
export function isDecisionFinalized(item: AlertCatalogItem): boolean {
  const isFinal = (s: ChannelStatus) => s === 'active' || s === 'rejected' || s === 'none'
  return isFinal(item.push.status) && isFinal(item.inApp.status) && isFinal(item.alimtalk.status)
}

// ── 데이터(이벤트 × 3채널 매트릭스)는 단일출처(SSOT) _HANDBOOK/alert/_matrix.json 으로 이전됨 (2026-06-18).
//    /alert-guide 페이지가 GET /api/admin/handbook/alert-matrix 로 fetch 한다.
//    이 파일에는 타입 / 표시 META / 헬퍼(코드)만 유지 — 사실(facts)은 _HANDBOOK 이 진실원천.
