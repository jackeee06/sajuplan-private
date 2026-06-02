/**
 * 사주플랜 푸시 알림 종합 카탈로그
 *
 * 운영자가 "어떤 푸시가 언제 / 누구에게 / 어떻게 가는지" 한눈에 보기 위한 참조 자료.
 * 새 푸시 추가 시 이 파일에 함께 등록 — 코드와 가이드가 항상 동기화되도록.
 *
 * 출처:
 *  - _SESSION_HANDOFF_2026_05_25.md (FCM 인프라 빌드 합의)
 *  - web/user/public/소스/fcm.md (개발자 명세)
 *  - api/src/shared/push/push.service.ts (백엔드 인프라)
 */

export type PushStatus = 'done' | 'wait_build' | 'planned'
export type PushCategory = 'consult' | 'payment' | 'counselor' | 'marketing' | 'system'
export type PushAudience = '회원' | '상담사' | '회원 + 상담사' | '전체 사용자' | '특정 회원' | '특정 상담사'

export interface PushCatalogItem {
  id: string                  // payload.data.type 와 동일 (앱이 분기하는 코드)
  icon: string                // 이모지
  name: string                // 한글 이름
  category: PushCategory
  status: PushStatus
  oneLine: string             // 한 줄 요약 (카드 헤더 아래)
  trigger: string             // 언제 발송되나 (사람 언어)
  audience: PushAudience      // 누구에게
  audienceDetail?: string     // 누구에게 — 조건 보강
  title: string               // 실제 알림 제목 예시
  body: string                // 실제 알림 본문 예시
  experience: string          // 알림 누르면 어떤 경험
  link?: string               // 알림 누름 → 이동 URL
  adminNote: string           // 관리자 참고 (발송량, 비용, 주의사항)
  codeHint?: string           // 구현/참고 파일 위치 (있으면)
}

export const CATEGORY_META: Record<PushCategory, { label: string; color: string; bg: string }> = {
  consult:   { label: '상담',       color: '#9333ea', bg: '#f3e8ff' },  // 보라
  payment:   { label: '결제/코인',  color: '#0891b2', bg: '#cffafe' },  // 청록
  counselor: { label: '상담사',     color: '#db2777', bg: '#fce7f3' },  // 핑크
  marketing: { label: '마케팅',     color: '#ea580c', bg: '#ffedd5' },  // 주황
  system:    { label: '시스템',     color: '#4b5563', bg: '#f3f4f6' },  // 회색
}

export const STATUS_META: Record<PushStatus, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  done:       { label: '구현 완료',      icon: '✅', color: '#15803d', bg: '#dcfce7', desc: '현재 발송되고 있음' },
  wait_build: { label: '빌드 후 1줄 추가', icon: '⏳', color: '#a16207', bg: '#fef9c3', desc: '다음 앱 빌드 후 백엔드 코드 한 줄로 즉시 활성화' },
  planned:    { label: '설계만',          icon: '📝', color: '#6b7280', bg: '#f3f4f6', desc: '아직 구현 안 됨. 설계만 합의' },
}

export const PUSH_CATALOG: PushCatalogItem[] = [
  // ─────────────────────── 상담 ───────────────────────
  {
    id: 'consult_request_arrived',
    icon: '📞',
    name: '상담 요청 도착',
    category: 'consult',
    status: 'done',
    oneLine: '회원이 상담을 요청하면 상담사에게 즉시 알림',
    trigger: '회원이 상담사 상세 페이지에서 "전화상담" 또는 "채팅상담" 버튼을 눌러 요청을 보낸 시점',
    audience: '특정 상담사',
    audienceDetail: '요청을 받은 상담사 1명에게만',
    title: '🔔 상담 요청이 도착했어요',
    body: '○○○ 회원님이 채팅 상담을 요청했습니다',
    experience: '알림 탭 → 상담 요청 화면으로 이동 → 수락/거절 선택',
    link: '/counselor/mypage/chats',
    adminNote: '상담사가 응답해야 매출 발생. 응답률이 낮으면 회원 이탈로 직결. 부재중 자동 전환 cron 과 같이 모니터링.',
    codeHint: 'api/src/user/counselors/counselors.service.ts (sendToTokens 호출)',
  },
  {
    id: 'counselor_entered',
    icon: '👋',
    name: '상담사 입장',
    category: 'consult',
    status: 'wait_build',
    oneLine: '요청한 상담사가 채팅방에 들어왔을 때 회원에게 안내',
    trigger: '회원이 채팅 요청 → 상담사가 수락하고 채팅방에 입장한 시점',
    audience: '특정 회원',
    audienceDetail: '요청자 회원 1명',
    title: '💬 상담사가 입장했어요',
    body: '○○○선생님과의 상담이 시작됩니다',
    experience: '알림 탭 → 채팅방 자동 진입',
    link: '/chat/{room_id}',
    adminNote: '회원이 다른 화면에 가 있을 때 즉시 채팅방으로 복귀시켜 응답률을 높임. 응답 지연 = 환불 위험.',
  },
  {
    id: 'chat_message_arrived',
    icon: '💬',
    name: '채팅 메시지 도착',
    category: 'consult',
    status: 'wait_build',
    oneLine: '채팅 중 사용자가 앱 백그라운드일 때 새 메시지 안내',
    trigger: '채팅방 안에서 상대방이 메시지를 보냈고, 받는 쪽이 다른 화면 또는 앱 백그라운드에 있을 때',
    audience: '회원 + 상담사',
    audienceDetail: '받는 쪽 (회원이 보내면 상담사에게, 상담사가 보내면 회원에게)',
    title: '○○○선생님',
    body: '말씀해주신 사주 보면, ...',
    experience: '알림 탭 → 진행 중이던 채팅방으로 복귀',
    link: '/chat/{room_id}',
    adminNote: '채팅 polling 은 채팅 화면에서만 동작. 다른 페이지 가면 알림 못 받는 한계를 FCM 으로 보완. 메시지 1개당 1알림 (스팸 방지 위해 디바운싱 검토).',
  },
  {
    id: 'consult_5min_warning',
    icon: '⏰',
    name: '상담 5분 잔량 알림',
    category: 'consult',
    status: 'wait_build',
    oneLine: '잔여 시간 5분 도달 시 자동 안내 (앱 백그라운드 보완)',
    trigger: '채팅·전화 상담 중 회원의 잔여 코인이 5분 분량으로 떨어진 시점 자동 감지',
    audience: '회원 + 상담사',
    audienceDetail: '회원에게는 충전 유도, 상담사에게는 사전 마무리 안내',
    title: '⏰ 5분 남았어요',
    body: '충전하시면 끊김 없이 계속 상담 가능합니다',
    experience: '알림 탭 → 충전 페이지 자동 이동 → 결제 후 상담방 복귀',
    link: '/mypage/charge?consult_id={id}',
    adminNote: '자체 구현 (채팅 시스템 메시지 + TTS + 진동) 은 이미 완료. FCM 은 앱 백그라운드/잠금 화면 사용자 보완용. 매출 직결 — 코인 부족 → 끊김 → 환불 요구 패턴 차단.',
    codeHint: 'api/src/shared/alerts/alerts.service.ts (자체 알림은 이미 동작)',
  },
  {
    id: 'consult_ended',
    icon: '🏁',
    name: '상담 종료 알림',
    category: 'consult',
    status: 'planned',
    oneLine: '상담 종료 시 양쪽 모두에게 요약 안내',
    trigger: '채팅·전화 상담이 종료된 직후 (자연 종료 또는 일방 종료)',
    audience: '회원 + 상담사',
    title: '상담이 종료되었어요',
    body: '○○○선생님과 12분 23초 상담했습니다. 후기를 남겨보세요.',
    experience: '알림 탭 → 회원은 후기 작성, 상담사는 상담 통계 화면',
    link: '/mypage/reviews/new?consult_id={id}',
    adminNote: '후기 작성률을 높이는 핵심 트리거. 종료 후 30분 이내 작성 비율이 가장 높음. 너무 자주 보내면 피로감 — 1상담 1회만.',
  },
  {
    id: 'favorite_counselor_online',
    icon: '⭐',
    name: '단골 상담사 접속',
    category: 'consult',
    status: 'wait_build',
    oneLine: '단골 등록한 상담사가 접속하면 회원에게 안내',
    trigger: '회원이 ⭐ 단골 등록한 상담사가 부재중 → 접속중으로 상태 전환한 시점',
    audience: '특정 회원',
    audienceDetail: '해당 상담사를 단골 등록한 모든 회원 (다수 가능)',
    title: '⭐ ○○○선생님이 접속했어요',
    body: '지금 바로 상담받을 수 있습니다',
    experience: '알림 탭 → 상담사 상세 페이지 → 즉시 상담 요청 가능',
    link: '/counselors/{id}',
    adminNote: '단골 상담사 재방문 매출의 핵심. 단 상담사가 자주 on/off 토글하면 스팸이 되니 디바운싱 (1시간 1회) 필요. 야간(22~08시) 발송 차단 검토.',
  },

  // ─────────────────────── 결제 / 코인 ───────────────────────
  {
    id: 'payment_complete',
    icon: '💳',
    name: '결제 완료',
    category: 'payment',
    status: 'wait_build',
    oneLine: '카드 결제 성공 시 즉시 확인 안내',
    trigger: 'PG사 (m2net) 결제 승인 응답이 정상으로 떨어진 직후',
    audience: '특정 회원',
    audienceDetail: '결제 본인',
    title: '✅ 결제가 완료되었어요',
    body: '30,000 코인이 충전되었습니다',
    experience: '알림 탭 → 코인 내역 또는 직전에 보던 상담사 페이지로 복귀',
    link: '/mypage/points',
    adminNote: '카드 결제는 PG 응답이 즉시 도착하므로 푸시도 즉시. 의심 결제 시 같은 알림으로 사용자에게 확인 받는 패턴도 가능.',
  },
  {
    id: 'vbank_received',
    icon: '🏦',
    name: '가상계좌 입금 확인',
    category: 'payment',
    status: 'wait_build',
    oneLine: '무통장 입금 확인 시 안내 (실시간 입금 통보)',
    trigger: '회원이 가상계좌(무통장)로 입금 → 은행/PG 입금통보 webhook 도착 시점',
    audience: '특정 회원',
    audienceDetail: '입금자 본인',
    title: '🏦 입금이 확인되었어요',
    body: '50,000원이 입금되어 50,000 코인이 충전됐습니다',
    experience: '알림 탭 → 코인 내역 페이지',
    link: '/mypage/points',
    adminNote: '무통장 입금 사용자는 일반적으로 카드 결제 못 하거나 안 하는 충성 회원. 입금 후 빠른 푸시가 만족도에 직결. PG 입금통보 안 오면 푸시도 안 감 — PG 모니터링과 같이.',
  },
  {
    id: 'auto_charge',
    icon: '🔄',
    name: '자동충전 실행',
    category: 'payment',
    status: 'wait_build',
    oneLine: '자동충전이 실행되었음을 사용자에게 사후 안내',
    trigger: '상담 중 잔액 부족 → 등록된 자동충전 카드로 자동 결제 실행 직후',
    audience: '특정 회원',
    audienceDetail: '자동충전 등록 회원',
    title: '🔄 자동충전이 실행됐어요',
    body: '잔액 부족으로 30,000 코인이 자동 충전됐습니다',
    experience: '알림 탭 → 코인 내역 (자동충전 표시)',
    link: '/mypage/points',
    adminNote: '사용자가 모르고 결제되면 컴플레인 → 환불 요구. 반드시 즉시 푸시로 사실 통보. 사용자가 끄고 싶으면 마이페이지에서 해제 가능함도 본문에 안내 검토.',
  },
  {
    id: 'refund_complete',
    icon: '💸',
    name: '환불 처리 완료',
    category: 'payment',
    status: 'wait_build',
    oneLine: '환불 신청 → 처리 완료 시 안내',
    trigger: '관리자가 환불 승인 → PG사에 환불 요청 → PG 응답 정상',
    audience: '특정 회원',
    audienceDetail: '환불 신청자',
    title: '💸 환불이 완료됐어요',
    body: '10,000원이 결제하신 카드로 환불됐습니다 (영업일 3~5일 소요)',
    experience: '알림 탭 → 환불 내역 페이지',
    link: '/mypage/refunds',
    adminNote: '환불 처리 자체는 즉시지만 카드사 입금은 3~5일 소요됨을 본문에 안내. 사용자가 "환불 안 됐어요" 컴플레인 차단 효과.',
  },
  {
    id: 'coin_low_warning',
    icon: '⚠️',
    name: '코인 부족 경고',
    category: 'payment',
    status: 'planned',
    oneLine: '잔여 코인이 임계점 이하로 떨어지면 사전 안내',
    trigger: '회원의 보유 코인이 5,000 이하로 떨어진 직후 (1회만, 충전 후 리셋)',
    audience: '특정 회원',
    title: '⚠️ 코인이 부족해요',
    body: '남은 코인: 3,000. 상담 전 미리 충전하세요',
    experience: '알림 탭 → 충전 페이지',
    link: '/mypage/charge',
    adminNote: '5분 잔량 알림보다 사전적. 회원의 평균 1회 상담 단가를 따져 임계값 조정 (현재 5,000 가정). 너무 자주 보내면 스팸 — 1일 1회 제한.',
  },
  {
    id: 'payment_failed',
    icon: '❌',
    name: '결제 실패',
    category: 'payment',
    status: 'planned',
    oneLine: '카드 한도/오류 등으로 결제 실패 시 안내',
    trigger: 'PG 결제 시도 → 거절/오류 응답 (카드 한도 초과, 정보 불일치 등)',
    audience: '특정 회원',
    title: '❌ 결제에 실패했어요',
    body: '카드사 한도 또는 정보를 확인해주세요',
    experience: '알림 탭 → 결제 페이지로 복귀',
    link: '/mypage/charge',
    adminNote: '자동충전 실패가 가장 흔함 (카드 만료/한도). 자동충전 카드 재등록 유도. 연속 3회 실패 시 자동충전 일시 정지하는 정책 검토.',
  },

  // ─────────────────────── 상담사 영역 ───────────────────────
  {
    id: 'new_review',
    icon: '⭐',
    name: '새 후기 등록',
    category: 'counselor',
    status: 'wait_build',
    oneLine: '회원이 후기를 남기면 상담사에게 즉시 안내',
    trigger: '회원이 상담 후 후기를 작성·등록한 시점',
    audience: '특정 상담사',
    title: '⭐ 새 후기가 등록됐어요',
    body: '○○○ 회원님이 5점 후기를 남겼어요',
    experience: '알림 탭 → 후기 상세 페이지 → 상담사가 답글 작성 가능',
    link: '/counselor/mypage/reviews',
    adminNote: '상담사 만족도 + 답글 작성률에 영향. 평균 별점이 낮은 후기 (1~2점) 는 본문 표현을 부드럽게 조정해 상담사 멘탈 케어.',
  },
  {
    id: 'new_qna',
    icon: '❓',
    name: '새 Q&A 등록',
    category: 'counselor',
    status: 'wait_build',
    oneLine: '회원이 상담사에게 문의를 남기면 즉시 안내',
    trigger: '회원이 상담사 상세 페이지의 "문의" 탭에서 질문을 등록한 시점',
    audience: '특정 상담사',
    title: '❓ 새 문의가 도착했어요',
    body: '○○○ 회원님이 질문을 남겼습니다',
    experience: '알림 탭 → 문의 상세 → 답변 작성',
    link: '/counselor/mypage/qnas',
    adminNote: '답변 속도가 회원 신뢰도에 직결. 24시간 미답변 Q&A 는 운영자 알림(OpsAlert)도 함께 발송 검토.',
  },
  {
    id: 'settlement_complete',
    icon: '💰',
    name: '월 정산 완료',
    category: 'counselor',
    status: 'wait_build',
    oneLine: '매월 1일 정산이 처리되면 상담사에게 결과 안내',
    trigger: '매월 1일 정산 cron 실행 → 상담사별 정산 row 생성 시점',
    audience: '특정 상담사',
    audienceDetail: '해당 월에 매출이 있던 상담사 전원',
    title: '💰 5월 정산이 완료됐어요',
    body: '정산 금액: 1,250,000원 (영업일 7일 이내 입금)',
    experience: '알림 탭 → 정산 내역 페이지',
    link: '/counselor/mypage/settlement/history',
    adminNote: '상담사 최대 관심사. 정산일이 지났는데 푸시 안 가면 즉시 컴플레인. 양수/원천징수 후 실지급 금액으로 표기 (현재 백엔드 정책 그대로).',
  },
  {
    id: 'payout_processed',
    icon: '⚡',
    name: '선지급 처리됨',
    category: 'counselor',
    status: 'wait_build',
    oneLine: '상담사 선지급 신청이 처리되면 즉시 안내',
    trigger: '상담사가 마이페이지에서 선지급 신청 → 관리자 승인 → 처리 완료 시점',
    audience: '특정 상담사',
    title: '⚡ 선지급이 처리됐어요',
    body: '350,000원이 입금 예정입니다 (수수료 5%, 원천 3.3% 차감 후)',
    experience: '알림 탭 → 선지급 내역',
    link: '/counselor/mypage/payout',
    adminNote: '선지급은 일 1회 제한, 가용 70% 한도 정책. 신청 후 처리까지 시간 차가 크면 상담사 불만 — 처리 직후 즉시 푸시 필수.',
  },
  {
    id: 'grade_changed',
    icon: '🏅',
    name: '등급 변경',
    category: 'counselor',
    status: 'planned',
    oneLine: '상담사 등급이 승급/강등되면 안내',
    trigger: '등급 산정 cron (월 1회 또는 분기) → 등급 변경 시점',
    audience: '특정 상담사',
    title: '🏅 등급이 변경됐어요',
    body: '브론즈 → 실버 등급으로 승급됐습니다',
    experience: '알림 탭 → 등급 정책 페이지',
    link: '/counselor/mypage/grade',
    adminNote: '등급 → 단가 / 노출 우선순위에 영향. 승급은 격려, 강등은 톤 조정 (강등 시 더 부드러운 본문 + 회복 방법 안내).',
  },

  // ─────────────────────── 마케팅 ───────────────────────
  {
    id: 'attendance_reminder',
    icon: '📅',
    name: '출석 체크 알림',
    category: 'marketing',
    status: 'planned',
    oneLine: '오늘 출석 안 한 회원에게 출석 유도',
    trigger: '매일 정해진 시각 (예: 오후 7시) cron → 당일 미출석 회원 대상',
    audience: '회원',
    audienceDetail: '당일 출석 안 한 활성 회원',
    title: '📅 오늘의 출석 보상이 기다려요',
    body: '출석 체크하고 500 코인을 받아가세요',
    experience: '알림 탭 → 홈 → 출석 체크 모달',
    link: '/',
    adminNote: '재방문 핵심 도구. 단 매일 보내면 피로감 → 사용자별 푸시 끄기 옵션 필수. 출석 보상은 마케팅 비용 — ROI 모니터링.',
  },
  {
    id: 'referral_reward',
    icon: '🎁',
    name: '추천인 보상 지급',
    category: 'marketing',
    status: 'planned',
    oneLine: '추천한 사람이 가입하면 추천인에게 보상 안내',
    trigger: '신규 회원 가입 시 추천인 코드 입력 → 가입 완료 시점',
    audience: '특정 회원',
    audienceDetail: '추천한 사람 (추천받은 신규 회원은 가입 환영 푸시 별도)',
    title: '🎁 추천 보상이 도착했어요',
    body: '○○○ 회원님이 가입했습니다. 3,000 코인을 받았어요',
    experience: '알림 탭 → 추천인 내역 페이지',
    link: '/mypage/referrals',
    adminNote: '추천 동기를 강화. 본문에 "또 추천하면 더 받아요" 같은 유인 문구 검토. 보상 코인/수익금 정책은 별도 합의 필요.',
  },
  {
    id: 'birthday',
    icon: '🎂',
    name: '생일 축하',
    category: 'marketing',
    status: 'planned',
    oneLine: '회원 생일에 축하 메시지 + 쿠폰',
    trigger: '매일 0시 cron → 당일이 생일인 회원 조회',
    audience: '특정 회원',
    audienceDetail: '생일 등록한 회원만',
    title: '🎂 ○○○님, 생일 축하드려요',
    body: '축하 선물로 5,000 코인 쿠폰을 드려요',
    experience: '알림 탭 → 쿠폰 페이지',
    link: '/mypage/coupons',
    adminNote: '감성 마케팅 → 충성도 향상. 비용 부담 적고 효과 좋음. 단 생일을 등록 안 한 회원에게는 안 가니 가입 시 생일 입력 유도.',
  },
  {
    id: 'coupon_expiry_soon',
    icon: '🎟️',
    name: '쿠폰 만료 임박',
    category: 'marketing',
    status: 'planned',
    oneLine: '쿠폰 만료 D-3 시점에 사용 유도',
    trigger: '매일 정해진 시각 cron → 3일 후 만료 예정인 쿠폰 보유 회원',
    audience: '특정 회원',
    title: '🎟️ 쿠폰이 곧 만료돼요',
    body: '5,000 코인 쿠폰이 3일 후 사라집니다',
    experience: '알림 탭 → 쿠폰 페이지',
    link: '/mypage/coupons',
    adminNote: '사용률 향상. D-3, D-1 두 번 발송 검토. 쿠폰 발급량 ↔ 사용량 갭이 클 때 효과 큼.',
  },
  {
    id: 'dormant_recovery',
    icon: '👋',
    name: '휴면 복귀 유도',
    category: 'marketing',
    status: 'planned',
    oneLine: '30일 미접속 회원에게 복귀 유도',
    trigger: '매주 cron → 마지막 접속 30일 경과한 회원',
    audience: '특정 회원',
    title: '👋 오랜만이에요',
    body: '복귀 선물 10,000 코인을 받아보세요',
    experience: '알림 탭 → 홈 → 복귀 보상 모달',
    link: '/',
    adminNote: '효과가 회원군별로 천차만별. 보상 코스트 부담 큼 — 충성 등급 회원만 대상 검토. 푸시 받고 즉시 앱 열면 자동 보상 지급 흐름.',
  },

  // ─────────────────────── 시스템 ───────────────────────
  {
    id: 'signup_welcome',
    icon: '🎉',
    name: '가입 환영',
    category: 'system',
    status: 'planned',
    oneLine: '신규 가입 직후 첫 안내 + 가입 보상',
    trigger: '회원 가입 완료 + 첫 로그인 시점 (가입 직후 즉시)',
    audience: '특정 회원',
    audienceDetail: '신규 가입자',
    title: '🎉 사주플랜에 오신 것을 환영해요',
    body: '가입 축하 5,000 코인을 드려요',
    experience: '알림 탭 → 홈 → 가입 환영 모달',
    link: '/',
    adminNote: '첫인상 결정. 알림톡(BizM)으로도 동시 발송 중 — 중복 발송 주의. 푸시 권한 거부 회원도 있으니 알림톡과 병행이 안전.',
  },
  {
    id: 'new_device_login',
    icon: '🔐',
    name: '새 디바이스 로그인',
    category: 'system',
    status: 'planned',
    oneLine: '평소와 다른 디바이스에서 로그인 시 보안 알림',
    trigger: '회원이 기존에 사용 안 한 디바이스/IP 에서 로그인 성공한 시점',
    audience: '특정 회원',
    title: '🔐 새 디바이스 로그인 감지',
    body: '본인이 아니면 즉시 비밀번호를 변경하세요',
    experience: '알림 탭 → 보안 설정 페이지',
    link: '/mypage/security',
    adminNote: '계정 탈취 방지. 단 false positive 많을 수 있음 (와이파이 변경, 새 폰 등). 너무 민감하게 잡으면 사용자 피로. IP 대역 + UserAgent 변화 임계점 조정.',
  },
  {
    id: 'terms_changed',
    icon: '📜',
    name: '약관 변경 안내',
    category: 'system',
    status: 'planned',
    oneLine: '이용약관/개인정보처리방침 변경 시 전체 안내',
    trigger: '관리자가 약관 개정 → 발효일 30일 전 전체 발송',
    audience: '전체 사용자',
    audienceDetail: '활성 회원 + 상담사 전원',
    title: '📜 이용약관이 변경됩니다',
    body: '○월 ○일부터 적용됩니다. 자세히 보기',
    experience: '알림 탭 → 약관 변경 안내 페이지 (변경 내역 비교)',
    link: '/policy/terms',
    adminNote: '법적 의무. 발효일 30일 전 + 7일 전 + 발효 당일 3회 발송 권장. 알림톡과 병행.',
  },
  {
    id: 'maintenance',
    icon: '🔧',
    name: '점검 안내',
    category: 'system',
    status: 'planned',
    oneLine: '정기/긴급 점검 사전 안내',
    trigger: '관리자가 점검 일정 등록 → 점검 1일 전, 1시간 전 자동 발송',
    audience: '전체 사용자',
    title: '🔧 점검 안내',
    body: '○월 ○일 새벽 2~4시 서비스 점검이 예정되어 있어요',
    experience: '알림 탭 → 공지사항 페이지',
    link: '/notices',
    adminNote: '예고 없는 점검은 컴플레인 직결. 새벽 시간 점검은 사용자 영향 적지만 알림은 낮 시간 발송이 더 잘 보임.',
  },
  {
    id: 'password_changed',
    icon: '🔑',
    name: '비밀번호 변경 알림',
    category: 'system',
    status: 'planned',
    oneLine: '비밀번호 변경 직후 본인 확인 알림',
    trigger: '회원이 마이페이지에서 비밀번호를 변경한 시점',
    audience: '특정 회원',
    title: '🔑 비밀번호가 변경됐어요',
    body: '본인이 아니면 즉시 고객센터로 연락주세요',
    experience: '알림 탭 → 보안 설정 페이지',
    link: '/mypage/security',
    adminNote: '계정 탈취 후 비밀번호 변경 시 본인이 인지하도록. 발송 실패 시 이메일 백업도 검토.',
  },
  {
    id: 'price_policy_changed',
    icon: '💱',
    name: '충전 금액/가격 정책 변경',
    category: 'system',
    status: 'planned',
    oneLine: '충전 패키지 가격이나 코인 단가 변경 시 사전 안내',
    trigger: '관리자가 충전 패키지 또는 단가 정책 변경 → 발효 7일 전',
    audience: '전체 사용자',
    title: '💱 가격 정책이 변경됩니다',
    body: '○월 ○일부터 적용됩니다',
    experience: '알림 탭 → 가격 변경 안내 공지',
    link: '/notices',
    adminNote: '인상 시 컴플레인 가능. 인하 시 마케팅 효과. 알림톡 병행 권장. 변경 전 충전 유도 (kg 인상 전 사재기 패턴) 도 가능.',
  },
  {
    id: 'qna_answered',
    icon: '💡',
    name: '문의 답변 도착',
    category: 'system',
    status: 'planned',
    oneLine: '내가 남긴 Q&A 에 상담사가 답변하면 즉시 안내',
    trigger: '상담사가 Q&A 에 답변 등록한 시점',
    audience: '특정 회원',
    audienceDetail: '질문 작성자',
    title: '💡 문의에 답변이 도착했어요',
    body: '○○○선생님이 답변을 남기셨습니다',
    experience: '알림 탭 → Q&A 상세 페이지',
    link: '/counselors/{counselor_id}/qna/{qna_id}',
    adminNote: '답변 확인율을 높여 대화형 인게이지먼트 증가. 상담사 → 상담 전환의 출발점.',
  },
  {
    id: 'review_replied',
    icon: '💬',
    name: '후기 답변 알림',
    category: 'system',
    status: 'planned',
    oneLine: '내가 쓴 후기에 상담사가 답글을 달면 안내',
    trigger: '상담사가 후기에 답글 등록한 시점',
    audience: '특정 회원',
    title: '💬 후기에 답변이 달렸어요',
    body: '○○○선생님이 답글을 남기셨습니다',
    experience: '알림 탭 → 후기 상세 페이지',
    link: '/mypage/reviews',
    adminNote: '상담사 응대 만족도 향상. 답글률 낮으면 발송량도 낮아 무해.',
  },
]

/** 상태별 개수 */
export function countByStatus(): Record<PushStatus, number> {
  return PUSH_CATALOG.reduce(
    (acc, item) => {
      acc[item.status] += 1
      return acc
    },
    { done: 0, wait_build: 0, planned: 0 } as Record<PushStatus, number>,
  )
}

/** 카테고리별 개수 */
export function countByCategory(): Record<PushCategory, number> {
  return PUSH_CATALOG.reduce(
    (acc, item) => {
      acc[item.category] += 1
      return acc
    },
    { consult: 0, payment: 0, counselor: 0, marketing: 0, system: 0 } as Record<PushCategory, number>,
  )
}

/** 카테고리별 그룹핑 */
export function groupByCategory(): Record<PushCategory, PushCatalogItem[]> {
  const out: Record<PushCategory, PushCatalogItem[]> = {
    consult: [], payment: [], counselor: [], marketing: [], system: [],
  }
  for (const item of PUSH_CATALOG) out[item.category].push(item)
  return out
}
