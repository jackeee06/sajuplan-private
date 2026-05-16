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
 * sample/include/counselor_board_state_btn.php 와 1:1 동등 매핑.
 *
 *  활성 state set: { IDLE, RDCH, RDVC, CONN, CNCH }
 *  그 외 (ABSE / RESV / CRDY 등) → 양쪽 모두 'offline' ("부재중").
 *
 *  use_phone × use_chat 매트릭스:
 *    Y,N (전화만):
 *      IDLE → phone:available, chat:offline
 *      CONN → phone:busy,      chat:offline
 *      그 외 → offline
 *
 *    N,Y (채팅만):
 *      RDCH → chat:available,  phone:offline
 *      CNCH → chat:busy,       phone:offline
 *      그 외 → offline
 *
 *    Y,Y (둘 다):
 *      RDVC → 양쪽 available
 *      그 외 활성 state(CONN/CNCH/IDLE/RDCH) → 양쪽 모두 busy ("상담중" 표시)
 *      활성 set 밖 → 양쪽 offline
 */
const ACTIVE_STATES = new Set(['IDLE', 'RDCH', 'RDVC', 'CONN', 'CNCH'])

export function derivePhoneState(c: PublicCounselor): Counselor['phoneState'] {
  if (!ACTIVE_STATES.has(c.state)) return 'offline'

  // use_phone 단독 (Y,N)
  if (c.use_phone && !c.use_chat) {
    if (c.state === 'IDLE') return 'available'
    if (c.state === 'CONN') return 'busy'
    return 'offline'
  }
  // use_chat 단독 (N,Y) → 전화 비활성
  if (!c.use_phone && c.use_chat) return 'offline'
  // 둘 다 (Y,Y)
  if (c.use_phone && c.use_chat) {
    if (c.state === 'RDVC') return 'available'
    return 'busy' // CONN/CNCH/IDLE/RDCH — sample 은 양쪽 모두 "상담중" 표시
  }
  // 둘 다 N
  return 'offline'
}

export function deriveChatState(c: PublicCounselor): Counselor['chatState'] {
  if (!ACTIVE_STATES.has(c.state)) return 'offline'

  // use_chat 단독 (N,Y)
  if (!c.use_phone && c.use_chat) {
    if (c.state === 'RDCH') return 'available'
    if (c.state === 'CNCH') return 'busy'
    return 'offline'
  }
  // use_phone 단독 (Y,N) → 채팅 비활성
  if (c.use_phone && !c.use_chat) return 'offline'
  // 둘 다 (Y,Y)
  if (c.use_phone && c.use_chat) {
    if (c.state === 'RDVC') return 'available'
    return 'busy' // sample 은 양쪽 모두 "상담중" 표시
  }
  // 둘 다 N
  return 'offline'
}

export function mapPublicCounselorToCard(c: PublicCounselor): Counselor {
  return {
    id: c.id,
    name: c.nickname || c.name,
    // 회원에게 노출되는 "상담사 번호" 는 dtmfno (ARS 연결번호) — csrid 는 내부 식별자라 노출 X
    code: c.dtmfno || c.csrid || String(c.id).padStart(6, '0'),
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
  }
}
