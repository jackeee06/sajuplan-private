import type { Counselor } from '../components/CounselorCard'
import type { PublicCounselor } from './api'

/**
 * PublicCounselor (백엔드 응답) → CounselorCard 가 받는 Counselor 로 변환.
 * 모든 리스트 페이지(메인/검색결과/단골/상담사목록/신규)에서 동일하게 사용해야 일관된 카드 노출 + 좋아요 통합.
 *
 * - state → phoneState/chatState 도출 (sample latest.lib.php itab 분기 반영)
 * - rating: 백엔드 평균 미제공이므로 후기 0건이면 0, 있으면 임시 4.5 (추후 AVG 컬럼 추가 시 교체)
 * - liked: 응답의 is_liked (로그인된 경우만 true 가능)
 */

/**
 * 상담사 카드의 전화/채팅 버튼 상태 결정 — state 별로 정확히 분기.
 *
 * 2026-05-21 정정: 옛 sample 정책은 "use_phone+use_chat 양쪽 활성 + state≠RDVC = 양쪽 모두 busy"
 * 였는데, 이 단순 규칙이 사용자에게 잘못된 "상담중" 표시를 야기함 (예: 라온 IDLE 케이스).
 * → state 별로 채널(전화/채팅)별 정확한 상태를 반환하도록 변경.
 *
 *  활성 state set: { IDLE, RDCH, RDVC, CONN, CNCH }
 *  그 외 (ABSE/RESV/CRDY 등) → 양쪽 모두 offline.
 *
 *  state 별 의미:
 *    IDLE  = 전화 대기 (채팅 비활성)
 *    RDCH  = 채팅 대기 (전화 비활성)
 *    RDVC  = 양쪽 모두 대기 (Ready Voice+Chat)
 *    CONN  = 전화 통화 중
 *    CNCH  = 채팅 중
 *
 *  채널별 매핑 (use_phone/use_chat 으로 채널 활성화 1차 필터):
 *    전화 버튼: use_phone=false → offline / 그 외엔 state 기반
 *    채팅 버튼: use_chat=false  → offline / 그 외엔 state 기반
 */
const ACTIVE_STATES = new Set(['IDLE', 'RDCH', 'RDVC', 'CONN', 'CNCH'])

export function derivePhoneState(c: PublicCounselor): Counselor['phoneState'] {
  if (!c.use_phone) return 'offline'
  if (!ACTIVE_STATES.has(c.state)) return 'offline'
  switch (c.state) {
    case 'IDLE': return 'available' // 전화 대기 — 사용자가 전화 걸 수 있음
    case 'RDVC': return 'available' // 양쪽 대기 — 전화도 가능
    case 'CONN': return 'busy'      // 전화 통화 중 — 다른 사용자가 통화 중
    case 'RDCH': return 'offline'   // 채팅 대기 모드 — 전화는 못 받음
    case 'CNCH': return 'offline'   // 채팅 중 — 전화는 못 받음
    default:     return 'offline'
  }
}

export function deriveChatState(c: PublicCounselor): Counselor['chatState'] {
  if (!c.use_chat) return 'offline'
  if (!ACTIVE_STATES.has(c.state)) return 'offline'
  switch (c.state) {
    case 'RDCH': return 'available' // 채팅 대기 — 사용자가 채팅 시작 가능
    case 'RDVC': return 'available' // 양쪽 대기 — 채팅도 가능
    case 'CNCH': return 'busy'      // 채팅 중 — 다른 사용자와 채팅 중
    case 'IDLE': return 'offline'   // 전화 대기 모드 — 채팅은 못 받음
    case 'CONN': return 'offline'   // 전화 통화 중 — 채팅은 못 받음
    default:     return 'offline'
  }
}

/**
 * 회원 노출용 상담사 번호 — m2net 자동번호(dtmfno) + 150 (자동번호가 너무 작아 보기 좋게 가산).
 * 원본 1~999(정상 순번)만 표시, 그 외(90001~ 더미·미등록, csrid, padded id)는 null → 미표시.
 *
 * ⚠️ 표시 전용 규칙. 전화/채팅 연동(code 필드)은 원본 dtmfno 를 쓰므로 연결엔 영향 없음.
 * 모든 화면이 이 함수 하나로 번호를 표기해야 "리스트 154 / 상세 4" 같은 불일치가 안 생긴다.
 * (백엔드 내역·후기·문의 쿼리는 SQL 에서 동일 규칙으로 +150 포맷 — counselor_code)
 */
export function formatCounselorNo(dtmfno: string | number | null | undefined): number | null {
  const n = dtmfno == null ? NaN : Number(dtmfno)
  return Number.isFinite(n) && n > 0 && n < 1000 ? n + 150 : null
}

export function mapPublicCounselorToCard(c: PublicCounselor): Counselor {
  const counselorNo = formatCounselorNo(c.dtmfno)
  return {
    id: c.id,
    name: c.nickname || c.name,
    // 회원에게 노출되는 "상담사 번호" 는 dtmfno (ARS 연결번호) — csrid 는 내부 식별자라 노출 X
    code: c.dtmfno || c.csrid || String(c.id).padStart(6, '0'),
    counselorNo,
    badge: c.category === '기타' ? undefined : c.category,
    tagline: c.headline ?? c.title ?? '',
    pricePerSec: c.unit_cost ?? 0,
    phoneState: derivePhoneState(c),
    chatState: deriveChatState(c),
    hashtags: [c.hashtag1, c.hashtag2].filter((t): t is string => !!t && t.trim() !== ''),
    rating: c.rating_avg ?? 0,
    reviewCount: c.review_count,
    liked: c.is_liked,
    isNew: c.is_new,
    imgUrl: c.profile_image ?? '/img/sample_img01.jpg',
    imgUrlWebp: c.profile_image_webp,
    // 2026-05-22: 부재(ABSE/RESV) 카드 식별 + 24h 내 "상담요청하기" 신청 여부
    isOffline: c.state === 'ABSE' || c.state === 'RESV',
    isRequested: !!c.is_requested,
  }
}
