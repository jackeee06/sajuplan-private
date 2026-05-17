/**
 * 사용자 프론트 → API 통신 래퍼.
 * — 모든 요청에 credentials:'include' (쿠키 기반 인증, 크로스도메인).
 * — 4xx/5xx 응답은 ApiError 로 throw.
 *
 * 도메인은 단일 플래그 VITE_SAJUMOON_ENV(test|prod) 로 runtime-env.ts 가 결정.
 */
import { API_BASE as BASE } from './runtime-env'

export class ApiError extends Error {
  status: number
  payload: unknown
  constructor(status: number, message: string, payload: unknown) {
    super(message)
    this.status = status
    this.payload = payload
    this.name = 'ApiError'
  }
}

interface ApiOptions extends RequestInit {
  json?: unknown
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options
  const init: RequestInit = {
    credentials: 'include',
    // 앱 WebView/모바일 브라우저가 GET 응답을 캐시해 옛 잔액·이력이 노출되는 문제 방지.
    // 매 호출 항상 서버 최신 응답을 받도록 명시.
    cache: 'no-store',
    ...rest,
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  }

  const res = await fetch(`${BASE}${path}`, init)
  const ct = res.headers.get('content-type') || ''
  const body: unknown = ct.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null)

  if (!res.ok) {
    const message = extractMessage(body) ?? `요청에 실패했습니다. (${res.status})`
    throw new ApiError(res.status, message, body)
  }
  return body as T
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  if (typeof obj.message === 'string') return obj.message
  if (Array.isArray(obj.message) && typeof obj.message[0] === 'string') {
    return obj.message[0]
  }
  return null
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T,>(path: string, json?: unknown) => request<T>(path, { method: 'POST', json }),
  put: <T,>(path: string, json?: unknown) => request<T>(path, { method: 'PUT', json }),
  patch: <T,>(path: string, json?: unknown) => request<T>(path, { method: 'PATCH', json }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  deleteWithBody: <T,>(path: string, json?: unknown) =>
    request<T>(path, { method: 'DELETE', json }),
}

// ─────────────────────────────────────────────
// 도메인별 호출 (auth)
// ─────────────────────────────────────────────

export interface UserMember {
  id: number
  mb_id: string
  name: string
  nickname: string
  email: string | null
  role: string
  level: number
  point: number
  /** 푸시알림 전체 수신 ON/OFF (앱 설정 토글) */
  push_all: boolean
  /** 프로필 사진 URL — 미등록 시 null */
  profile_image: string | null
  /** 프로필 사진 WebP — 있으면 picture/source 우선 사용 */
  profile_image_webp: string | null
}

export interface SocialPending {
  provider: 'kakao' | 'naver' | 'apple'
  email: string | null
  name: string | null
  nickname: string | null
  phone: string | null
}

export interface SignupPayload {
  name: string
  nickname: string
  agree_terms: boolean
  agree_privacy: boolean
  /** 가입 경로 명시 — 'kakao'/'naver' 면 백엔드가 pending 쿠키 검증, 만료/누락 시 명확한 에러 반환 */
  social?: 'kakao' | 'naver' | 'apple'
  /** 로컬 가입에서만 필수 — 소셜 가입은 sjm_social_pending 쿠키로 본인확인 */
  mb_id?: string
  password?: string
  /** 로컬 가입 시 휴대폰 인증번호 (sms_auth 5분 내 매칭) */
  phone_code?: string
  /** 로컬 가입 시 캡차 토큰 + 입력값 */
  captcha_token?: string
  captcha_input?: string
  email?: string
  phone?: string
  birth_date?: string // YYYY-MM-DD
  birth_time?: string // HH:mm
  gender?: 'M' | 'F'
  calendar_type?: 'SOLAR' | 'LUNAR'
  zip?: string
  addr1?: string
  addr2?: string
  acquisition_source?: string
  agree_email?: boolean
  agree_sms?: boolean
}

// ─────────────────────────────────────────────
// 출석체크 (2026-05-16)
// ─────────────────────────────────────────────

export interface AttendanceCheckinResult {
  attended_now: boolean
  skip_reason: string | null
  consecutive_days: number
  base_coin: number
  bonus_coin: number
  coupon_amount: number
  total_added: number
}

export const attendanceApi = {
  /** 출석 처리 (1일 1회). 로그인 직후 자동 호출. 이미 출석한 경우 attended_now=false. */
  checkin: () => api.post<AttendanceCheckinResult>('/user/attendance/checkin', {}),
  /** 오늘 출석 상태 + 연속일 (마이페이지 위젯용) */
  today: () =>
    api.get<{
      attended_today: boolean
      consecutive_days: number
      today_total_added: number
      last_attended_date: string | null
    }>('/user/attendance/today'),
  /** 최근 출석 이력 */
  history: (limit = 30) =>
    api.get<{
      items: {
        attended_date: string
        base_coin: number
        bonus_coin: number
        consecutive_days: number
      }[]
    }>(`/user/attendance/history?limit=${limit}`),
}

export const authApi = {
  login: (mb_id: string, password: string, keep_login: boolean) =>
    api.post<{ ok: true; member: UserMember }>('/user/auth/login', {
      mb_id,
      password,
      keep_login,
    }),
  // me() 는 라우트 변경마다 호출되므로 cache-buster query 로 모바일 webview/CDN 캐시 우회.
  me: () => api.get<UserMember>(`/user/auth/me?_t=${Date.now()}`),
  /**
   * 사주문 측 보유 포인트를 m2net 측 잔액으로 강제 동기화 (overwrite).
   * - 일반 회원(role='user')만 대상. 상담사는 ok=false 반환.
   * - 호출 시점: 로그인 직후, 메인페이지 진입 시.
   */
  syncM2netBalance: () =>
    api.post<{
      ok: boolean
      sajumoonPoint: number
      m2netMembid: string | null
      error?: string
    }>('/user/auth/sync-m2net-balance'),
  logout: () => api.post<void>('/user/auth/logout'),
  /** 클라이언트 접속 IP 조회 (특정 IP 라우팅/안내 처리용) */
  whoami: () => api.get<{ ip: string }>('/user/auth/whoami'),
  /**
   * 푸시알림 전체 수신 ON/OFF 저장.
   * NOTE: 추후 모바일 앱 연동 시 OFF→FCM/APNs 토픽 unsubscribe, ON→재구독 처리 필요.
   */
  updatePush: (on: boolean) =>
    api.patch<{ push_all: boolean }>('/user/auth/me/push', { on }),
  /**
   * 모바일 앱 디바이스 FCM 토큰 등록 / 갱신. 비로그인이어도 호출 가능
   * (그 경우 member_id NULL 로 row 만 만들고 다음 로그인 시 자동 매핑).
   */
  registerPushToken: (body: {
    token: string
    platform: 'android' | 'ios'
    mb_id?: string
    device_phone?: string
  }) => api.post<{ ok: true }>('/user/auth/push-token', body),
  /** 토큰 비활성화 — 로그아웃이나 권한 해제 시. */
  deletePushToken: (token: string) =>
    api.deleteWithBody<{ ok: true }>('/user/auth/push-token', { token }),
  socialConfig: () =>
    api.get<{ use: boolean; providers: ('kakao' | 'naver' | 'apple')[] }>(
      '/user/auth/social/config',
    ),
  /**
   * 카카오/네이버/애플 인가 페이지로 시작하는 URL.
   * window.location.href 로 사용 — 백엔드가 302 로 provider 인가 페이지로 리다이렉트한다.
   * 반드시 BASE(절대) 를 붙여야 SPA fallback 에 걸려 메인으로 떨어지지 않는다.
   * apple: response_mode=form_post 라 POST callback. 그래도 시작은 동일하게 /start 사용.
   */
  socialStartUrl: (provider: 'kakao' | 'naver' | 'apple', redirect?: string) => {
    const q = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
    return `${BASE}/user/auth/social/${provider}/start${q}`
  },
  /** 소셜 콜백에서 발급된 단기 가입 대기 토큰을 읽어 prefill 용 프로필 반환 */
  socialPending: () =>
    api.get<{ pending: SocialPending | null }>('/user/auth/social/pending'),
  /**
   * RN 네이티브 SDK 흐름: 카카오 access_token 직접 전송.
   * 응답:
   *  - 기존 회원 → { ok:true, needs_signup:false, member }  (sjm_user 쿠키 발급)
   *  - 신규     → { ok:true, needs_signup:true,  pending } (sjm_social_pending 쿠키 발급, /signup?social=kakao 로 보내야 함)
   */
  socialKakaoNative: (accessToken: string) =>
    api.post<
      | { ok: true; needs_signup: false; member: UserMember }
      | { ok: true; needs_signup: true; pending: SocialPending }
    >('/user/auth/social/kakao/native', { access_token: accessToken }),
  /**
   * RN 네이티브 SDK 흐름: 애플 identityToken 직접 전송 (iOS only).
   * 응답은 socialKakaoNative와 동일.
   * name/email 은 최초 동의 직후에만 SDK 가 반환하므로 같이 보내면 백필됨.
   */
  socialAppleNative: (
    identityToken: string,
    extra?: { name?: string; email?: string },
  ) =>
    api.post<
      | { ok: true; needs_signup: false; member: UserMember }
      | { ok: true; needs_signup: true; pending: SocialPending }
    >('/user/auth/social/apple/native', {
      identity_token: identityToken,
      name: extra?.name,
      email: extra?.email,
    }),
  signup: (payload: SignupPayload) =>
    api.post<{ ok: true; member: UserMember }>('/user/auth/signup', payload),
  /** 아이디 중복확인 — 서버가 형식 검증 + 사용 가능 여부 반환 */
  checkMbId: (mbId: string) =>
    api.get<{ available: boolean; mb_id: string }>(
      `/user/auth/check-mb-id?mb_id=${encodeURIComponent(mbId)}`,
    ),
  /** 휴대폰으로 아이디/비밀번호 찾기 — SMS 인증 통과한 폰번호로 임시비밀번호 발송(알림톡) */
  findByPhone: (phone: string, code: string) =>
    api.post<{ ok: true }>('/user/auth/find/phone', { phone, code }),
  /** 이메일로 아이디/비밀번호 찾기 — 임시비밀번호 발송(메일) */
  findByEmail: (email: string) =>
    api.post<{ ok: true }>('/user/auth/find/email', { email }),
  /** 마이페이지 회원정보 수정 폼 prefill — 풀 프로필 (휴대폰/주소/생년월일 등) */
  meProfile: () => api.get<MeProfile>('/user/auth/me/profile'),
  updateMeProfile: (body: UpdateMeBody) =>
    api.patch<MeProfile>('/user/auth/me/profile', body),
  changePassword: (current_password: string, new_password: string) =>
    api.post<{ ok: true }>('/user/auth/me/password', { current_password, new_password }),
  /** 회원탈퇴 — left_at 마킹 + 쿠키 정리 */
  withdrawMe: () => api.delete<{ ok: true }>('/user/auth/me'),
  /** 프로필 사진 업로드 (multipart/form-data, field name 'file') */
  uploadProfileImage: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/user/auth/me/profile-image`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const ct = res.headers.get('content-type') || ''
    const body: unknown = ct.includes('application/json') ? await res.json() : await res.text()
    if (!res.ok) {
      const message =
        (body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string'
          ? String((body as { message: string }).message)
          : null) ?? `업로드에 실패했습니다. (${res.status})`
      throw new ApiError(res.status, message, body)
    }
    return body as { profile_image: string; profile_image_webp: string | null }
  },
  /** 프로필 사진 삭제 */
  deleteProfileImage: () => api.delete<{ ok: true }>('/user/auth/me/profile-image'),
}

// ─────────────────────────────────────────────
// 마이페이지 쿠폰
// ─────────────────────────────────────────────

export interface PublicCoupon {
  id: number
  title: string
  point: number
  /** 'YYYY.MM.DD' (없으면 빈 문자열) */
  expired_at: string
  /** 'YYYY.MM.DD' (사용 전이면 빈 문자열) */
  used_at: string
  used: boolean
}

export const couponsApi = {
  list: (status: 'available' | 'used') =>
    api.get<{ items: PublicCoupon[] }>(`/user/coupons?status=${status}`),
  use: (id: number) =>
    api.post<{ point: number; new_balance: number }>(`/user/coupons/${id}/use`),
  redeem: (code: string) =>
    api.post<{ point: number; new_balance: number }>(`/user/coupons/redeem`, { code }),
  hide: (id: number) =>
    api.delete<{ ok: true }>(`/user/coupons/${id}`),
}

// ─────────────────────────────────────────────
// 상담 시작 (전화/채팅)
// ─────────────────────────────────────────────

export interface PhoneConsultResult {
  /** 사용자가 dial 할 대표번호 (선불=070-..., 후불=060-...) */
  phone_number: string
  /** 통화 연결 후 입력할 상담사 번호 */
  counselor_code: string
  variant: 'prepaid' | 'postpaid'
}

export interface ChatConsultResult {
  chat_room_id: number
  /** m2net 측 방 토큰 (wss 식별자) */
  roomid: string
  /** 회원이 wss 접속 시 사용할 토큰 — `${wss_url}/${member_token}` */
  member_token: string
  /** wss 베이스 URL — env 미설정 시 `wss://passcall.co.kr:28729/wscp` */
  wss_url: string
  /** 재입장 여부 */
  is_rejoin: boolean
}

export const consultApi = {
  /**
   * 전화상담 시작 — m2net 에 발신자 휴대폰 + 상담사 csrid 등록 후 dial 할 대표번호 반환.
   *  성공 시 클라이언트가 phone_number 로 tel: 링크 이동.
   */
  phone: (counselor_id: number | string, variant: 'prepaid' | 'postpaid') =>
    api.post<PhoneConsultResult>(`/user/consult/phone`, { counselor_id, variant }),
  /**
   * 채팅상담 시작 — chat_room 생성/재입장 + m2net 토큰 발급.
   *  성공 시 클라이언트가 /chat/{chat_room_id} 로 이동, useChatSocket 이 wss 접속.
   */
  chat: (counselor_id: number | string) =>
    api.post<ChatConsultResult>(`/user/consult/chat`, { counselor_id }),

  /** 상담 메모 조회 (상담사 전용) */
  getMemo: (consultationId: number) =>
    api.get<{
      consultation: {
        id: number
        member_name: string
        started_at: string | null
        ended_at: string | null
        amt: number
        reason: string
        is_chat: boolean
      } | null
      memo: { category: string | null; topic: string | null; memo: string | null } | null
    }>(`/user/consult/memo/${consultationId}`),

  /** 상담 메모 저장 (UPSERT, 상담사 전용) */
  saveMemo: (
    consultationId: number,
    body: { category?: string | null; topic?: string | null; memo?: string | null },
  ) => api.post<{ ok: true }>(`/user/consult/memo/${consultationId}`, body),

  /** 상담사 본인 기간별 상담 통계 + 리스트 (상담사 전용) */
  myStats: (params: {
    from: string
    to: string
    type?: 'all' | 'call' | 'chat'
    page?: number
    limit?: number
  }) => {
    const q = new URLSearchParams()
    q.set('from', params.from)
    q.set('to', params.to)
    if (params.type) q.set('type', params.type)
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    return api.get<ConsultMyStats>(`/user/consult/my-stats?${q.toString()}`)
  },
}

export interface ConsultStatsItem {
  id: number
  consult_type: 'call' | 'chat'
  started_at: string | null
  ended_at: string | null
  created_at: string
  is_missed: boolean
  usetm_seconds: number
  usetm_label: string
  customer_no: string
}

export interface ConsultMyStats {
  total_count: number
  missed_count: number
  total_seconds: number
  avg_seconds: number
  daily_avg: number
  missed_rate_pct: number
  days: number
  page: number
  limit: number
  items: ConsultStatsItem[]
  has_more: boolean
}

// ─────────────────────────────────────────────
// 도메인별 호출 (chat — 채팅 데이터 조회/저장/종료)
// ─────────────────────────────────────────────

export interface ChatRoomListItem {
  id: number
  roomid: string | null
  status: string | null
  peer_id: number | null
  peer_name: string | null
  peer_nickname: string | null
  peer_profile_image: string | null
  message_count: number
  last_message: string | null
  last_message_at: string | null
  started_at: string | null
  ended_at: string | null
}

export interface ChatRoomDetail {
  id: number
  roomid: string | null
  status: string | null
  member_id: number | null
  counselor_id: number | null
  member_name: string | null
  member_nickname: string | null
  member_profile_image: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  counselor_profile_image: string | null
  started_at: string | null
  ended_at: string | null
  /** 단가 단위(초) — 카운트다운 계산용 */
  unit_seconds: number | null
  /** 단가(포인트) */
  unit_cost: number | null
  /** 시작 시점 회원 잔액 (snapshot) */
  snapshot_member_point: number | null
}

export interface ChatMessage {
  id: number
  sender_id: number | null
  message: string | null
  message_type: number
  created_at: string
  is_mine?: boolean
}

export const chatApi = {
  /** 본인 채팅 목록. role 미지정 시 토큰의 role 사용. */
  listRooms: (params?: { role?: 'member' | 'counselor'; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.role) q.set('role', params.role)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return api.get<{
      items: ChatRoomListItem[]
      total: number
      page: number
      limit: number
    }>(`/user/chat/rooms${qs ? `?${qs}` : ''}`)
  },
  getRoom: (id: number) =>
    api.get<{
      room: ChatRoomDetail
      messages: ChatMessage[]
      /** 활성 방인 경우 본인 역할(member|counselor)에 맞는 wss 토큰 */
      wss?: { url: string; token: string; role: 'member' | 'counselor' }
    }>(`/user/chat/rooms/${id}`),
  /**
   * 채팅 내역 다시보기 (읽기 전용).
   * id 는 consultation.id 또는 chat_room.id 중 어느 쪽이든 가능.
   * 활성 채팅 흐름(rejoin/tick/wss) 과 분리된 안전 경로.
   */
  getChatLog: (id: number) =>
    api.get<{ room: ChatRoomDetail; messages: ChatMessage[] }>(
      `/user/chat/log/${id}`,
    ),
  listMessagesSince: (id: number, since?: string) => {
    const q = new URLSearchParams()
    if (since) q.set('since', since)
    const qs = q.toString()
    return api.get<{ items: ChatMessage[] }>(`/user/chat/rooms/${id}/messages${qs ? `?${qs}` : ''}`)
  },
  sendMessage: (id: number, message: string, message_type?: number) =>
    api.post<{ id: number; created_at: string }>(`/user/chat/rooms/${id}/messages`, {
      message,
      message_type,
    }),
  leave: (id: number, mode: 'soft' | 'close' = 'soft') =>
    api.post<{ ok: true; mode: 'soft' | 'close' }>(`/user/chat/rooms/${id}/leave`, { mode }),
  rejoin: (id: number) =>
    api.post<{ ok: true }>(`/user/chat/rooms/${id}/rejoin`, {}),
  /**
   * wss 측 room_in_noti / room_out_noti 수신 시 backend 동기화 트리거.
   * actor 의 try_out 마킹 + 시스템 메시지 INSERT + leave 시 30초 자동 종료 평가.
   */
  peerEvent: (id: number, event: 'leave' | 'rejoin', actor: 'counselor' | 'member') =>
    api.post<{ ok: true }>(`/user/chat/rooms/${id}/peer-event`, { event, actor }),
  /**
   * 시스템 메시지 영구 저장 — 입퇴장/재입장 안내.
   * 같은 dedup_key 가 5분 내에 이미 저장됐으면 backend 가 skip.
   */
  insertSystemMessage: (id: number, message: string, dedupKey?: string) =>
    api.post<{ id: number | null; created_at: string | null }>(
      `/user/chat/rooms/${id}/system-message`,
      { message, dedup_key: dedupKey },
    ),
  /** 폴링용 — 잔여시간/상태/상담사 입장 여부 반환 + 충전 동기화 */
  getStatus: (id: number) =>
    api.get<{
      success: true
      status: string
      started_at: string | null
      use_seconds: number
      alloc_seconds: number
      remain_seconds: number
      counselor_joined: boolean
      member_try_out: boolean
      counselor_try_out: boolean
      unit_seconds: number
      unit_cost: number
      /** 마지막 재입장 시각 — 변경 감지 시 클라이언트는 wss 재연결을 트리거. */
      rejoin_last_at: string | null
    }>(`/user/chat/rooms/${id}/status`),
  /** 사용시간 +10초. 잔여 부족 시 success=false + status=DISCONNECT */
  tick: (id: number) =>
    api.post<{ success: boolean; used: number; remain: number; reason?: string }>(
      `/user/chat/rooms/${id}/tick`,
    ),
}

export interface MeProfile {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  email: string | null
  phone: string | null
  gender: 'M' | 'F' | null
  /** YYYY-MM-DD */
  birth_date: string | null
  birth_time: string | null
  calendar_type: 'SOLAR' | 'LUNAR' | null
  zip: string | null
  addr1: string | null
  addr2: string | null
  acquisition_source: string | null
  social_provider: string | null
  agree_email: boolean
  agree_sms: boolean
  /** 프로필 사진 URL — 미등록 시 null */
  profile_image: string | null
  /** 프로필 사진 WebP — picture/source 로 우선 사용 */
  profile_image_webp: string | null
}

export interface UpdateMeBody {
  nickname?: string
  email?: string | null
  phone?: string
  /** 휴대폰 변경 시 필수 — sms_auth 5분 내 매칭 검증 */
  phone_code?: string
  gender?: 'M' | 'F'
  birth_date?: string | null
  calendar_type?: 'SOLAR' | 'LUNAR'
  zip?: string
  addr1?: string
  addr2?: string
  acquisition_source?: string
  agree_email?: boolean
  agree_sms?: boolean
  captcha_token?: string
  captcha_input?: string
}

// ─────────────────────────────────────────────
// 휴대폰 인증번호 (회원가입용)
// ─────────────────────────────────────────────

export const smsApi = {
  /** 인증번호 발송 — 알림톡(bizm) 우선, SMS(알리고) 폴백 */
  send: (phone: string) =>
    api.post<{ ok: true }>('/user/sms/send', { phone }),
  /** 인증번호 검증 */
  verify: (phone: string, code: string) =>
    api.post<{ ok: true }>('/user/sms/verify', { phone, code }),
}

// ─────────────────────────────────────────────
// 자동등록방지 (캡차)
// ─────────────────────────────────────────────

export const captchaApi = {
  /** 새 캡차 발급 — 5분 유효한 token + SVG 이미지 (텍스트는 평문으로 노출 안 함) */
  issue: () => api.get<{ token: string; svg: string }>('/user/captcha'),
}

// ─────────────────────────────────────────────
// 배너 (어드민에서 등록한 위치별 배너 — 공개 조회)
// ─────────────────────────────────────────────

export interface PublicBanner {
  id: number
  position: string | null
  title: string | null
  link_url: string | null
  image_url: string | null
  /** WebP 변환본 — 있으면 <picture> source 로 우선 사용 */
  image_url_webp: string | null
  display_order: number
}

export const bannersApi = {
  /** 위치별 활성 배너 — 진행 기간 내 + is_active=true 만 반환. 정렬: display_order ASC */
  listByPosition: (position: string) =>
    api.get<{ items: PublicBanner[] }>(
      `/user/banners?position=${encodeURIComponent(position)}`,
    ),
}

// ─────────────────────────────────────────────
// 이벤트 상담사
// ─────────────────────────────────────────────

export interface PublicEventCounselor {
  id: number
  nickname: string
  headline: string | null
  hashtag1: string | null
  hashtag2: string | null
  unit_seconds: number | null
  unit_cost: number | null
  state: string
  use_phone: boolean
  use_chat: boolean
  event_starts_at: string
  event_ends_at: string | null
  event_banner_image_url: string | null
  profile_image: string | null
  profile_image_webp: string | null
  hero_image: string | null
  hero_image_webp: string | null
  wide_headline: string | null
  wide_subcaption: string | null
}

export const eventCounselorsApi = {
  /** 현재 활성 이벤트 상담사 (최대 3명) */
  list: () => api.get<{ items: PublicEventCounselor[] }>('/user/counselors/event'),
}

// ─────────────────────────────────────────────
// 메인 페이지 공개 통계 (최근 상담 건수 / 접속중 상담사)
// ─────────────────────────────────────────────

export const statsApi = {
  main: () =>
    api.get<{ recent_consultations: number; online_counselors: number }>(
      '/user/stats/main',
    ),
}

// ─────────────────────────────────────────────
// 상담사 마이페이지 — 토글 (use_phone / use_chat / available)
// ─────────────────────────────────────────────

export interface CounselorAvailability {
  use_phone: boolean
  use_chat: boolean
  available: boolean
  state: string
}

export const counselorMypageApi = {
  getAvailability: () =>
    api.get<CounselorAvailability>('/user/counselors/me/availability'),
  setAvailability: (body: { use_phone?: boolean; use_chat?: boolean; available?: boolean }) =>
    api.patch<CounselorAvailability>('/user/counselors/me/availability', body),
  /** 본인 소개(post_counselor.intro) — HTML 본문 */
  getIntro: () => api.get<{ intro: string }>('/user/counselors/me/intro'),
  setIntro: (intro: string) =>
    api.patch<{ intro: string }>('/user/counselors/me/intro', { intro }),
}

// ─────────────────────────────────────────────
// 상담사 마이페이지 — 등급/단가 (Phase 4)
// ─────────────────────────────────────────────

export type CounselorGrade =
  | 'preliminary' | 'partner1' | 'partner2' | 'partner3' | 'partner4' | 'partner5'

export interface MyGradeInfo {
  grade: CounselorGrade
  grade_label: string
  last_month_seconds: number
  current_unit_cost: number
  available_options: number[]
  changeable_at: string | null
  next_change_date_kst: string | null
  can_change_now: boolean
  days_until_unlock: number | null
}

export interface UnitCostChangeResult {
  ok: true
  new_unit_cost: number
  next_changeable_at: string
}

export const counselorGradeApi = {
  /** 내 등급/단가/락 상태 */
  getMine: () => api.get<MyGradeInfo>('/user/counselor-mypage/grade'),
  /** 단가 변경 — body.unit_cost: 30초당 원 (정책 옵션 중 하나) */
  changeUnitCost: (unitCost: number, reason?: string) =>
    api.post<UnitCostChangeResult>('/user/counselor-mypage/grade/unit-cost', {
      unit_cost: unitCost,
      reason,
    }),
}

// ─────────────────────────────────────────────
// 상담사 마이페이지 — 후기 관리
// ─────────────────────────────────────────────

export interface CounselorReviewListItem {
  id: number
  customer_name: string
  is_private: boolean
  /** 베스트 후기 여부 (2026-05-15 신설) */
  is_best: boolean
  best_at: string | null
  title: string
  content: string
  rating: number | null
  img_url: string | null
  consult_type: '전화상담' | '채팅상담' | ''
  date: string
  duration: string
  created_at: string
  reply: { author: string; text: string } | null
}

export interface CounselorReviewDetail {
  id: number
  customer_name: string
  is_private: boolean
  title: string
  content: string
  rating: number | null
  img_url: string | null
  consult_type: '전화상담' | '채팅상담' | ''
  date: string
  duration: string
  created_at: string
  reply: {
    id: number
    author: string
    profile_img: string | null
    profile_img_webp: string | null
    text: string
    posted_at: string
  } | null
}

export const counselorMyReviewsApi = {
  list: (params: {
    page?: number
    limit?: number
    unansweredOnly?: boolean
    photoOnly?: boolean
  }) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.unansweredOnly) qs.set('unanswered_only', 'true')
    if (params.photoOnly) qs.set('photo_only', 'true')
    const s = qs.toString()
    return api.get<{
      items: CounselorReviewListItem[]
      total: number
      page: number
      limit: number
    }>(`/user/counselor-mypage/reviews${s ? `?${s}` : ''}`)
  },
  detail: (id: number | string) =>
    api.get<CounselorReviewDetail>(`/user/counselor-mypage/reviews/${id}`),
  createReply: (id: number | string, content: string) =>
    api.post<CounselorReviewDetail>(
      `/user/counselor-mypage/reviews/${id}/reply`,
      { content },
    ),
  updateReply: (id: number | string, content: string) =>
    api.patch<CounselorReviewDetail>(
      `/user/counselor-mypage/reviews/${id}/reply`,
      { content },
    ),
  deleteReply: (id: number | string) =>
    api.delete<{ ok: true }>(`/user/counselor-mypage/reviews/${id}/reply`),
}

// ─────────────────────────────────────────────
// 공개 setting (footer.* + site.kakao_channel_url 등)
// ─────────────────────────────────────────────

export type PublicSettings = Record<string, string>

export const settingsApi = {
  /** 푸터 회사정보 + 카카오 채널 URL 등 — `footer.company_name`, `site.kakao_channel_url` 형태 키 */
  public: () => api.get<PublicSettings>('/user/settings/public'),
}

// ─────────────────────────────────────────────
// FAQ (공개) — /mypage/help 이용안내
// ─────────────────────────────────────────────

export interface PublicFaqCategory {
  id: number
  title: string
  display_order: number
  faq_count: number
}

export interface PublicFaqItem {
  id: number
  category_id: number
  category_title: string
  question: string
  answer: string
  display_order: number
}

export const faqsApi = {
  /** 활성 카테고리 — display_order 오름차순. 빈 카테고리도 포함되므로 필요 시 호출처에서 faq_count > 0 필터 */
  categories: () =>
    api.get<{ items: PublicFaqCategory[] }>('/user/faqs/categories'),
  /** 활성 FAQ 항목 — categoryId 미지정 시 전체 */
  list: (categoryId?: number) =>
    api.get<{ items: PublicFaqItem[] }>(
      categoryId ? `/user/faqs?category_id=${categoryId}` : '/user/faqs',
    ),
}

// ─────────────────────────────────────────────
// 메인 상담사 리스트 (전체/인기/채팅 탭)
// ─────────────────────────────────────────────

export interface PublicCounselor {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  csrid: string | null
  /** 회원이 ARS에서 누르는 상담사 연결번호 — 카드/상세에 노출되는 "상담사 번호" */
  dtmfno: string | null
  /** 'IDLE' | 'RDCH' | 'RDVC' | 'CRDY' | 'CONN' | 'ABSE' 등 — 카드 상태 도출 */
  state: string
  use_phone: boolean
  use_chat: boolean
  is_rising: boolean
  is_recommended: boolean
  title: string | null
  headline: string | null
  specialty: string | null
  hashtag1: string | null
  hashtag2: string | null
  unit_seconds: number | null
  unit_cost: number | null
  review_count: number
  fan_count: number
  /** member_file kind='profile' 의 stored_name (상대경로 또는 파일명) */
  profile_image: string | null
  /** WebP 변환본 — 있으면 우선 사용 */
  profile_image_webp: string | null
  category: '사주' | '타로' | '신점' | '기타'
  /** 요청자가 단골 등록했는지 (비로그인이면 false) */
  is_liked: boolean
  /** 신규 상담사 — 가입 후 90일 이내 (2026-05-15 신설). NEW 뱃지 노출용. */
  is_new: boolean
  /** 후기 평균 별점 (1~5, 후기 없거나 별점 미부여면 0) */
  rating_avg: number
}

/** 상담사 상세 (단건 조회 응답) */
export interface PublicCounselorDetail {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  csrid: string | null
  /** 회원이 ARS에서 누르는 상담사 연결번호 — 상세에 노출되는 "상담사 번호" */
  dtmfno: string | null
  state: string
  use_phone: boolean
  use_chat: boolean
  is_rising: boolean
  is_recommended: boolean
  headline: string | null
  /** 전문분야 배열 (specialty '|' / ',' 분리됨) */
  fields: string[]
  /** 스타일 키워드 배열 */
  traits: string[]
  bio: string | null
  /** 약력을 줄바꿈 분리한 배열 (UI 에서 ul 로 노출) */
  career: string[]
  notice_content: string | null
  /** 공지 마지막 갱신일 ISO */
  notice_date: string
  intro: string | null
  hashtags: string[]
  unit_seconds: number | null
  unit_cost: number | null
  review_count: number
  fan_count: number
  profile_image: string | null
  profile_image_webp: string | null
  hero_image: string | null
  hero_image_webp: string | null
  /** 와이드 이미지 위 오버레이 캡션 — 빈값이면 미노출 */
  wide_headline: string | null
  wide_subcaption: string | null
  category: '사주' | '타로' | '신점' | '기타'
  /** "현재 N명이 같은 페이지를 보고 있습니다" — 의사값 (상담사 ID + 시간버킷 해시) */
  live_viewers: number
  /** 해당 상담사의 문의 총 건수 */
  qna_count: number
  /** 요청자가 이 상담사를 단골 등록했는지 (비로그인이면 false) */
  is_liked: boolean
}

export const counselorsApi = {
  /**
   * 메인 페이지 상담사 리스트.
   * @param tab    'all' | 'popular' | 'chat' | 'new' (생략 시 'all'). 'new' 는 마이페이지 신규상담사 목록 — 가입 최근순.
   * @param category '사주' | '타로' | '신점' (생략 또는 '전체' 시 필터 없음)
   * @param limit  1~50, 기본 13
   */
  list: (params: { tab?: string; category?: string; limit?: number; event?: boolean }) => {
    const qs = new URLSearchParams()
    if (params.tab) qs.set('tab', params.tab)
    if (params.category) qs.set('category', params.category)
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.event) qs.set('event', '1')
    const q = qs.toString()
    return api.get<{ items: PublicCounselor[] }>(
      `/user/counselors${q ? `?${q}` : ''}`,
    )
  },
  /** 상담사 단건 — 상세 페이지용. 404 시 ApiError throw. */
  detail: (id: number | string) =>
    api.get<PublicCounselorDetail>(`/user/counselors/${id}`),
  /** 로그인 회원의 단골 상담사 리스트 (member_favorite_counselor 기반). 401 시 ApiError. */
  favorites: (params?: { category?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.category) qs.set('category', params.category)
    if (params?.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return api.get<{ items: PublicCounselor[] }>(
      `/user/counselors/favorites${q ? `?${q}` : ''}`,
    )
  },
  /** 특정 상담사의 후기 목록 — 상담사 상세 후기 탭. */
  reviews: (id: number | string, params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return api.get<{ items: PublicCounselorReview[]; total: number }>(
      `/user/counselors/${id}/reviews${q ? `?${q}` : ''}`,
    )
  },
  /** 분야(해시태그) 동적 옵션 */
  filterOptions: () =>
    api.get<{ fields: string[] }>(`/user/counselors/filter-options`),
  /**
   * 상담사 검색 — 이름/닉네임/해시태그/전문분야/헤드라인/소개/약력 부분 일치.
   * @param q 검색어 (빈 문자열이면 서버가 빈 결과 반환)
   * @param limit 1~50, 기본 30
   */
  search: (q: string, limit = 30) => {
    const qs = new URLSearchParams({ q, limit: String(limit) })
    return api.get<{ items: PublicCounselor[]; total: number; q: string }>(
      `/user/counselors/search?${qs.toString()}`,
    )
  },
  /** 인기 검색어 (v1: 활성 상담사들의 hashtag 빈도 상위 N) */
  popularKeywords: (limit = 6) =>
    api.get<{ items: { rank: number; keyword: string; isNew: boolean }[] }>(
      `/user/counselors/popular-keywords?limit=${limit}`,
    ),
  /** 단골 등록 — 회원 인증 필요. 401 시 ApiError throw. */
  addLike: (id: number | string) =>
    api.post<{ is_liked: true; fan_count: number }>(`/user/counselors/${id}/like`),
  /** 단골 해제 */
  removeLike: (id: number | string) =>
    api.delete<{ is_liked: false; fan_count: number }>(`/user/counselors/${id}/like`),
}

export interface PublicCounselorReview {
  id: number
  title: string
  /** 비밀글이면 빈 문자열 */
  content: string
  is_secret: boolean
  /** 베스트 후기 여부 (상담사가 선정, 2026-05-15 신설) */
  is_best: boolean
  /** 베스트 선정 시각 (정렬용, 해제 시 null) */
  best_at: string | null
  rating: number | null
  created_at: string
  /** 마스킹된 작성자명 */
  reviewer_name: string
}

// ─────────────────────────────────────────────
// 상담사 문의 (QnA)
// ─────────────────────────────────────────────

export interface PublicCounselorQnaItem {
  id: number
  title: string
  /** 비밀글이고 본인/상담사 아니면 빈 문자열 */
  content: string
  is_secret: boolean
  has_reply: boolean
  status: '답변완료' | '답변대기'
  reviewer_name: string
  created_at: string
}

export interface PublicCounselorQnaDetail {
  id: number
  counselor_id: number
  title: string
  content: string
  is_secret: boolean
  reviewer_name: string
  created_at: string
  reply: {
    id: number
    content: string
    counselor_nickname: string
    counselor_profile_image: string | null
    counselor_profile_image_webp: string | null
    created_at: string
  } | null
}

export const counselorQnaApi = {
  list: (counselorId: number | string, params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return api.get<{ items: PublicCounselorQnaItem[]; total: number }>(
      `/user/counselors/${counselorId}/qna${q ? `?${q}` : ''}`,
    )
  },
  detail: (counselorId: number | string, qnaId: number | string) =>
    api.get<PublicCounselorQnaDetail>(`/user/counselors/${counselorId}/qna/${qnaId}`),
  create: (
    counselorId: number | string,
    body: { title: string; content: string; is_secret: boolean },
  ) =>
    api.post<{ id: number }>(`/user/counselors/${counselorId}/qna`, body),
}

// ─────────────────────────────────────────────
// 마이페이지 — 내가 쓴 상담문의
// ─────────────────────────────────────────────

export interface MyQnaItem {
  id: number
  counselor_id: number
  counselor_name: string
  counselor_code: string
  title: string
  content: string
  is_secret: boolean
  has_reply: boolean
  status: '답변완료' | '답변대기'
  reviewer_name: string
  created_at: string
}

export interface MyQnaDetailDto {
  id: number
  counselor_id: number
  counselor_name: string
  counselor_code: string
  title: string
  content: string
  is_secret: boolean
  reviewer_name: string
  created_at: string
  reply: {
    id: number
    content: string
    counselor_nickname: string
    counselor_profile_image: string | null
    counselor_profile_image_webp: string | null
    created_at: string
  } | null
}

export const myQnaApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return api.get<{ items: MyQnaItem[]; total: number }>(
      `/user/my-qnas${q ? `?${q}` : ''}`,
    )
  },
  detail: (id: number | string) =>
    api.get<MyQnaDetailDto>(`/user/my-qnas/${id}`),
}

// ─────────────────────────────────────────────
// 상담사 마이페이지 — 고객 문의 관리
// ─────────────────────────────────────────────

export interface CounselorCustomerQnaItem {
  id: number
  title: string
  content: string
  is_secret: boolean
  has_reply: boolean
  status: '답변완료' | '답변대기'
  reviewer_name: string
  created_at: string
}

export interface CounselorCustomerQnaDetailDto {
  id: number
  title: string
  content: string
  is_secret: boolean
  reviewer_name: string
  created_at: string
  reply: {
    id: number
    content: string
    counselor_nickname: string
    counselor_profile_image: string | null
    counselor_profile_image_webp: string | null
    created_at: string
  } | null
}

export const counselorCustomerQnaApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return api.get<{ items: CounselorCustomerQnaItem[]; total: number }>(
      `/user/counselor/customer-qnas${q ? `?${q}` : ''}`,
    )
  },
  detail: (id: number | string) =>
    api.get<CounselorCustomerQnaDetailDto>(`/user/counselor/customer-qnas/${id}`),
  reply: (id: number | string, content: string) =>
    api.post<{ id: number }>(`/user/counselor/customer-qnas/${id}/reply`, { content }),
  updateReply: (id: number | string, content: string) =>
    api.patch<{ id: number }>(`/user/counselor/customer-qnas/${id}/reply`, { content }),
  deleteReply: (id: number | string) =>
    api.delete<{ ok: true }>(`/user/counselor/customer-qnas/${id}/reply`),
}

// ─────────────────────────────────────────────
// 메인 후기 탭 (sample tab06)
// ─────────────────────────────────────────────

export interface PublicRecentReview {
  id: number
  title: string
  /** 비밀글이면 빈 문자열 */
  content: string
  rating: number | null
  created_at: string
  /** 마스킹된 작성자명 (예: '김*객') */
  reviewer_name: string
  counselor_id: number
  counselor_nickname: string
  counselor_code: string | null
  counselor_profile_image: string | null
  counselor_profile_image_webp: string | null
  headline: string | null
  hashtag1: string | null
  hashtag2: string | null
  unit_seconds: number | null
  unit_cost: number | null
  counselor_review_count: number
  specialty: string | null
  category: '사주' | '타로' | '신점' | '기타'
}

export interface MyReviewItem {
  id: number
  title: string
  content: string
  rating: number | null
  created_at: string
  photo_url: string | null
  /** WebP 변환 사이블링 URL — <picture>에서 우선 노출 */
  photo_url_webp: string | null
  consult_type: string         // '전화상담' | '채팅상담' | ''
  consult_date: string         // 'YYYY.MM.DD'
  consult_duration: string     // '00시간17분30초'
  customer_name: string
  counselor_id: number
  counselor_name: string
  counselor_code: string
  counselor_badge: '사주' | '타로' | '신점' | '기타'
  counselor_avatar: string | null
}

export interface ConsultHistoryItem {
  id: number
  consult_type: 'call' | 'chat'
  consult_type_label: string
  started_at: string | null
  ended_at: string | null
  usetm_seconds: number
  usetm_label: string
  amt: number
  counselor_id: number | null
  counselor_name: string
  counselor_code: string | null
  counselor_avatar: string | null
  counselor_avatar_webp: string | null
  counselor_badge: '사주' | '타로' | '신점' | '기타'
  review_id: number | null
  /** 상담사 시점에서만 채워짐 — 본인이 작성한 후기 답변 id, 없으면 null */
  reply_id: number | null
  /** 채팅방 id (진행 중이거나 종료된 채팅 상담에 한해 매칭됨). 없으면 null. */
  chat_room_id: number | null
  /** 채팅방 status — 'STAY' | 'CNCH' | 'DISCONNECT' | null */
  chat_status: string | null
  /** 진행 중인 채팅(STAY/CNCH)인지. true면 "채팅방 입장하기" 버튼 노출 */
  is_active_chat: boolean
}

export const reviewsApi = {
  /** 메인 페이지 후기 탭 — 최근 후기 N건 */
  recent: (params: { category?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params.category) qs.set('category', params.category)
    if (params.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return api.get<{ items: PublicRecentReview[] }>(
      `/user/reviews/recent${q ? `?${q}` : ''}`,
    )
  },
  /** 마이페이지 — 본인 후기 목록 */
  mine: (params: { page?: number; limit?: number; photoOnly?: boolean }) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.photoOnly) qs.set('photo_only', 'true')
    return api.get<{ items: MyReviewItem[]; total: number; page: number; limit: number }>(
      `/user/reviews/mine?${qs.toString()}`,
    )
  },
  /** 본인 후기 단건 (수정 폼 prefill) */
  detail: (id: number) => api.get<MyReviewItem>(`/user/reviews/${id}`),
  /** 본인 후기 수정 */
  update: (
    id: number,
    body: {
      title?: string
      content?: string
      is_secret?: boolean
      rating?: number
      photo_url?: string | null
      photo_url_webp?: string | null
    },
  ) => api.patch<MyReviewItem>(`/user/reviews/${id}`, body),
  /** 본인 후기 물리 삭제 */
  remove: (id: number) => api.delete<{ ok: true }>(`/user/reviews/${id}`),
  /** 후기 신고 (2026-05-15 신설) — 본인 후기는 신고 불가, 같은 사용자가 같은 후기 중복 신고 불가 */
  report: (id: number, body: { reason_category: 'abuse' | 'false' | 'ad' | 'privacy' | 'other'; reason?: string }) =>
    api.post<{ ok: true }>(`/user/reviews/${id}/report`, body),
  /** 베스트 후기 토글 (2026-05-15 신설) — 상담사 본인만, 5개 제한 */
  toggleBest: (id: number, isBest: boolean) =>
    api.patch<{ ok: true; is_best: boolean; best_at: string | null }>(`/user/reviews/${id}/best`, { is_best: isBest }),
  /** 새 후기 작성 — consultation_id 가 있으면 그 상담 1건만 작성 가능 (중복 차단) */
  create: (body: {
    counselor_id: number
    title: string
    content: string
    is_secret?: boolean
    rating?: number | null
    photo_url?: string | null
    photo_url_webp?: string | null
    consultation_id?: number | null
  }) => api.post<MyReviewItem>('/user/reviews', body),
  /** 후기 사진 업로드 — multipart/form-data. 1장만 등록 (프론트 제한).
   *  응답: { url, url_webp } — url_webp 는 서버에서 sharp 로 변환된 사이블링 (없으면 null) */
  uploadImage: async (file: File): Promise<{ url: string; url_webp: string | null }> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/user/reviews/upload-image`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ApiError(res.status, text || `업로드 실패 (${res.status})`)
    }
    return res.json() as Promise<{ url: string; url_webp: string | null }>
  },
}

// ─────────────────────────────────────────────
// 상담사 정산 (sample/my/counselor_settlement.php · _02.php 동등)
// ─────────────────────────────────────────────

export interface SettlementSummary {
  this_month: number
  prev_month: number
  balance: number
  /** 정산 예정 금액 — sample set_con_account_v2 공식 (로열티/부가세/원천세/회선비 반영) */
  estimated_payout: number
  /** 정산 기준 월 (YYYY-MM) */
  month: string
  payout_breakdown: {
    amt_free: number
    amt_pro: number
    royalty_free_pct: number
    royalty_pro_pct: number
    /** 쿠폰상담 정산비 */
    price_free: number
    /** 충전+후불 상담 정산비 */
    price_paid: number
    /** 기타정산비 (이벤트/관리자 적립 등) */
    price_other: number
    price_tot: number
    supply_price: number
    vat_amount: number
    withholding_tax: number
    reply_fee: number
  }
}

export interface SettlementIncomeItem {
  id: number
  created_at: string
  content: string
  amount: number
  is_paid: boolean
  preflag: 'Y' | 'N' | ''
  customer_name: string | null
  consultation_id: number | null
}

export interface SettlementMonthRow {
  id: number
  month: string
  price_tot: number
  price_free: number
  price_paid: number
  price_other: number
  vat_amount: number
  withholding_tax: number
  reply_fee: number
  price: number
  wr_datetime: string | null
}

export const settlementApi = {
  /** @param month YYYY-MM (선택). 실시간 코인 정산 탭의 월 셀렉트가 사용. */
  summary: (month?: string) =>
    api.get<SettlementSummary>(
      `/user/settlements/summary${month ? `?month=${encodeURIComponent(month)}` : ''}`,
    ),
  /** 코인 수익 내역. md='Y'(후불) / 'N'(선불) / null(전체) */
  income: (params: {
    page?: number
    limit?: number
    md?: 'Y' | 'N' | null
    from_date?: string | null
    to_date?: string | null
  }) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.md) qs.set('md', params.md)
    if (params.from_date) qs.set('from_date', params.from_date)
    if (params.to_date) qs.set('to_date', params.to_date)
    const q = qs.toString()
    return api.get<{
      items: SettlementIncomeItem[]
      total: number
      page: number
      limit: number
    }>(`/user/settlements/income${q ? `?${q}` : ''}`)
  },
  /** 월별 정산 마감 — 등록된 정산 계좌 정보도 함께 반환. */
  monthly: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return api.get<{
      items: SettlementMonthRow[]
      total: number
      page: number
      limit: number
      bank_info: { bank: string; holder: string; account: string } | null
    }>(`/user/settlements/monthly${q ? `?${q}` : ''}`)
  },
}

// ─────────────────────────────────────────────
// 통합 상담내역 (sample/my/history.php 동등)
// ─────────────────────────────────────────────

export const historyApi = {
  list: (params: {
    page?: number
    limit?: number
    type?: 'all' | 'call' | 'chat'
    /** 미지정 시 토큰 role 사용. 'counselor' 면 본인 상담사 시점으로 조회. */
    role?: 'member' | 'counselor'
  }) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.type && params.type !== 'all') qs.set('type', params.type)
    if (params.role) qs.set('role', params.role)
    return api.get<{ items: ConsultHistoryItem[]; total: number; page: number; limit: number }>(
      `/user/consult/history${qs.toString() ? `?${qs.toString()}` : ''}`,
    )
  },
}

// ─────────────────────────────────────────────
// 공지사항 (회원/상담사 공통)
// ─────────────────────────────────────────────

export interface PublicNoticeListItem {
  id: number
  title: string
  category: string | null
  is_pinned: boolean
  /** 최근 7일 이내 작성 — UI "New" 뱃지 노출용 */
  is_new: boolean
  view_count: number
  created_at: string
}

export interface PublicNoticeDetail {
  id: number
  title: string
  content: string
  category: string | null
  is_pinned: boolean
  view_count: number
  created_at: string
  updated_at: string
}

export const noticesApi = {
  /** 페이지네이션 + 카테고리/검색 필터 */
  list: (params: { page?: number; limit?: number; category?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.category) qs.set('category', params.category)
    if (params.q) qs.set('q', params.q)
    const s = qs.toString()
    return api.get<{
      items: PublicNoticeListItem[]
      total: number
      page: number
      limit: number
    }>(`/user/notices${s ? `?${s}` : ''}`)
  },
  /** 카테고리 목록 — 드롭다운 옵션용 */
  categories: () => api.get<{ items: string[] }>('/user/notices/categories'),
  /** 단건 상세 (조회수 +1) */
  detail: (id: number | string) => api.get<PublicNoticeDetail>(`/user/notices/${id}`),
}

// ─────────────────────────────────────────────
// 이벤트 (마이페이지 > 이벤트)
// ─────────────────────────────────────────────

export type PublicEventStatus = 'active' | 'ended' | 'upcoming'

export interface PublicEventListItem {
  id: number
  title: string
  thumbnail_url: string | null
  thumbnail_url_webp: string | null
  starts_at: string | null
  ends_at: string | null
  status: PublicEventStatus
}

export interface PublicEventDetail extends PublicEventListItem {
  content: string
  view_count: number
  created_at: string
  updated_at: string
}

export const eventsApi = {
  list: (params: { page?: number; limit?: number; status?: PublicEventStatus } = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.status) qs.set('status', params.status)
    const s = qs.toString()
    return api.get<{
      items: PublicEventListItem[]
      total: number
      page: number
      limit: number
    }>(`/user/events${s ? `?${s}` : ''}`)
  },
  detail: (id: number | string) => api.get<PublicEventDetail>(`/user/events/${id}`),
}

/* ─────────────────────────────────────────────
 * 포인트 (마이페이지 → 포인트 내역)
 * ───────────────────────────────────────────── */

export interface PointBalance {
  /** free + paid */
  total: number
  /** 무료(이벤트/쿠폰) 포인트 잔액 */
  free: number
  /** 유료(충전) 포인트 잔액 */
  paid: number
  /** 누적 적립 / 사용 (참고) */
  total_earned: number
  total_used: number
}

export interface PointHistoryItem {
  id: number
  /** in: 적립, out: 사용/차감 */
  direction: 'in' | 'out'
  /** 변동 금액 (양수, 절대값) */
  amount: number
  /** 변동 직후 잔액 */
  balance_after: number
  /** content (예: "회원가입 쿠폰", "전화상담 차감") */
  title: string
  /** ISO 8601 */
  occurred_at: string
  is_expired: boolean
  expire_date: string | null
  is_paid: boolean
  rel_action: string | null
  rel_table: string | null
  rel_id: string | null
}

/* ─────────────────────────────────────────────
 * 알림 내역 (로그인 회원 — 역할별 노출)
 *  - 백엔드가 role(user/counselor) 자동 매칭하여 본인 개별 알림 + 해당 역할용 브로드캐스트만 반환
 *  - 최근 6개월 한정
 * ───────────────────────────────────────────── */

export interface PublicNotificationItem {
  id: number
  title: string
  content: string
  link_url: string | null
  category: string | null
  read: boolean
  /** ISO 8601 */
  created_at: string
}

export const notificationsApi = {
  list: () =>
    api.get<{ items: PublicNotificationItem[] }>('/user/notifications'),
  read: (id: number) =>
    api.post<{ ok: true }>(`/user/notifications/${id}/read`),
  readAll: () =>
    api.post<{ ok: true; updated: number }>('/user/notifications/read-all'),
}

export const pointsApi = {
  /** 보유 포인트 (free/paid 분리). 401 시 ApiError. */
  balance: () => api.get<PointBalance>('/user/points/balance'),
  /** 본인 포인트 내역 — 최신순 페이지네이션 (limit max 100, default 30) */
  history: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return api.get<{
      items: PointHistoryItem[]
      total: number
      page: number
      limit: number
    }>(`/user/points/history${s ? `?${s}` : ''}`)
  },
}

/* ─────────────────────────────────────────────
 * 포인트 충전 (https://sajumoon.kr/mypage/charge)
 *  - sample 정책 1:1 마이그레이션 (sample/coin/coin_fill*.php / coin_pay_ok_v2.php)
 *  - 일반결제: prepare → form submit → PG → returnurl 콜백 → /charge/complete?oid=...
 *  - 사주문페이(BillKey): autopay-register → DB + 엠투넷 PUT → autopay-charge로 즉시 결제
 *  - 자동충전: auto-config로 엠투넷 PUT → 엠투넷이 자율 트리거 → autopay-push 콜백
 * ───────────────────────────────────────────── */

export interface ChargePackageDto {
  id: number
  name: string
  /** VAT 포함 사용자 결제 금액 (원) */
  payAmount: number
  /** VAT 미포함 결제 금액 (원) */
  price: number
  coinAmount: number
  bonusPercent: number
  totalPoint: number
  message: string | null
  displayOrder: number
}

export interface RegisteredCardDto {
  id: number
  brand: string
  numberMasked: string
  expiresAt: string | null
  amount: number
  coinAmount: number
}

export interface ChargeMethodsDto {
  cards: RegisteredCardDto[]
  auto: {
    enabled: boolean
    threshold: number | null
    packageId: number | null
  }
}

export type GeneralPayMethod =
  | 'CARD'
  | 'VBANK'
  | 'PAYCO'
  | 'KAKAO'
  | 'NAVER'
  | 'APPLE'
  | 'TOSS'
  | 'SSPAY'

export interface PrepareChargeResult {
  oid: string
  /** PG로 form submit 할 URL */
  url: string
  /** form hidden input 값들 */
  params: Record<string, string>
}

export interface ChargeStatusResult {
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | string
  amount: number
  coinAmount: number
  resultMessage: string | null
  m2netStatus: string | null
  vbank: { bankCode: string | null; bankName: string | null; account: string | null } | null
}

export type PaymentLogStatus =
  | 'completed'
  | 'awaiting_deposit'
  | 'pending'
  | 'cancelled'
  | 'failed'

export interface PaymentLogDto {
  id: number
  oid: string
  /** 노출 라벨: '카드결제' / '가상계좌' / '카카오페이' / '네이버페이' / '페이코' / '자동충전' */
  method: string
  /** VAT 포함 결제 금액 (원) */
  amount: number
  /** 충전 포인트 (P) */
  coinAmount: number
  status: PaymentLogStatus
  /** 노출용 한글 라벨 */
  statusLabel: string
  /** 가상계좌 정보 — VBANK 결제건만 채워짐 */
  vbank: {
    bankCode: string | null
    bankName: string | null
    account: string | null
    /** YYYYMMDDHHMMSS — null/빈값이면 입금 전 */
    depositTime: string | null
  } | null
  /** ISO timestamp — 결제 요청 시각 */
  paidAt: string
  cancelledAt: string | null
}

export const chargeApi = {
  packages: () => api.get<ChargePackageDto[]>('/user/charge/packages'),
  methods: () => api.get<ChargeMethodsDto>('/user/charge/methods'),
  prepare: (input: { packageId: number; payMethod: GeneralPayMethod }) =>
    api.post<PrepareChargeResult>('/user/charge/prepare', input),
  autopayRegister: (input: {
    cardno: string
    expMonth: string
    expYear: string
    socno: string
    pass: string
    packageId: number
  }) =>
    api.post<{ billkey: string; masked: string }>(
      '/user/charge/autopay-register',
      input,
    ),
  autopayCardDelete: () =>
    api.delete<{ ok: true }>('/user/charge/autopay-card'),
  autopayCharge: (input: { packageId: number }) =>
    api.post<{ oid: string; status: string }>(
      '/user/charge/autopay-charge',
      input,
    ),
  setAutoConfig: (input: {
    enabled: boolean
    threshold?: number
    packageId?: number
  }) => api.put<{ ok: true }>('/user/charge/auto-config', input),
  status: (oid: string) =>
    api.get<ChargeStatusResult>(`/user/charge/status/${encodeURIComponent(oid)}`),
  payments: () => api.get<PaymentLogDto[]>('/user/charge/payments'),
}

// ─────────────────────────────────────────────
// 상담사 신청 (post_apply)
// ─────────────────────────────────────────────

export interface CounselorApplyListItem {
  id: number
  title: string
  category: string | null    // 'notice' | 'general' | null
  status: string             // 'pending' | 'accepted' | 'rejected' | 'cancelled'
  is_secret: boolean
  is_mine: boolean
  mine_only_lock: boolean
  author_nickname: string | null
  created_at: string
}

export interface CounselorApplyDetail {
  id: number
  title: string
  content: string | null
  category: string | null
  status: string
  applicant_phone: string | null
  applicant_email: string | null
  is_secret: boolean
  view_count: number
  extras: Record<string, unknown>
  author_nickname: string | null
  is_mine: boolean
  created_at: string
  updated_at: string
}

/** 상담사 신청 작성에 필요한 추가 메타 — extras JSONB 에 그대로 저장 */
export interface CounselorApplyExtras {
  status?: string         // 신청상태 (직장인/주부/상담사 등)
  real_name?: string
  pen_name?: string
  region?: string
  field?: string          // 상담분야 (사주/타로/...)
  birth?: string          // YYYY-MM-DD
  specialties?: string[]  // 전문 상담분야 (운세/속마음/...)
  intro?: string          // 본인 소개
  /** 프로필 사진 1장 (정사각 썸네일용) */
  profile_photo_url?: string | null
  /** 프로필 사진 webp 사이블링 — 있으면 우선 노출 */
  profile_photo_url_webp?: string | null
  /** 와이드 사진 1장 (상세 헤더 배경용) */
  wide_photo_url?: string | null
  /** 와이드 사진 webp 사이블링 */
  wide_photo_url_webp?: string | null
  /** 사업자/계약 관련 첨부 (사업자등록증, 신분증, 계약서 등 — 여러 장) */
  contract_files?: Array<{
    url: string
    original_name: string
    size: number
  }>
  /** @deprecated — 호환용 (구 코드는 photo_url 만 보냈음) */
  photo_url?: string | null
}

export const counselorApplyApi = {
  list: (page = 1, limit = 10) =>
    api.get<{ items: CounselorApplyListItem[]; total: number; page: number; limit: number }>(
      `/user/counselor-apply?page=${page}&limit=${limit}`,
    ),
  detail: (id: number) =>
    api.get<CounselorApplyDetail>(`/user/counselor-apply/${id}`),
  create: (input: {
    /** 신청 종류 (2026-05-16) — application(지원서, 풀폼) | inquiry(상담사 문의) | other(기타 문의) */
    apply_type?: 'application' | 'inquiry' | 'other'
    title: string
    content?: string
    applicant_phone?: string
    applicant_email?: string
    is_secret?: boolean
    extras?: CounselorApplyExtras
    captcha_token?: string
    captcha_input?: string
    /** application 일 때만 필수 */
    mb_id?: string
    /** application 일 때만 필수 */
    password?: string
  }) => api.post<{ id: number }>('/user/counselor-apply', input),
  cancel: (id: number) =>
    api.patch<{ ok: true }>(`/user/counselor-apply/${id}/cancel`),
  /** 휴대폰 중복 체크.
   *  duplicate=true 면 차단 (이미 가입된 상담사). pending 은 차단 안 함 — 새 신청이 기존 건을 자동 대체.
   *  status: 'accepted' | 'pending' | 'none'
   */
  checkPhone: (phone: string) =>
    api.get<{ duplicate: boolean; status: 'accepted' | 'pending' | 'none' }>(
      `/user/counselor-apply/check-phone?phone=${encodeURIComponent(phone)}`,
    ),
  /** 아이디 중복/형식 체크 — available=false 면 reason 으로 안내 */
  checkMbId: (mbId: string) =>
    api.get<{ available: boolean; reason?: string }>(
      `/user/counselor-apply/check-mb-id?mb_id=${encodeURIComponent(mbId)}`,
    ),
  /** 첨부 파일 업로드 — kind: 'profile' | 'wide' | 'contract'.
   *  - profile/wide: 이미지(jpg/png/gif/webp), webp 사이블링 동시 생성 → url_webp 동봉.
   *  - contract: 사업자등록증/계약서 등 (PDF + 이미지). url_webp 는 null.
   *  최대 30MB.
   */
  uploadImage: async (
    file: File,
    kind: 'profile' | 'wide' | 'contract',
  ): Promise<{
    ok: true
    kind: 'profile' | 'wide' | 'contract'
    url: string
    url_webp: string | null
    original_name: string
    size: number
  }> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/user/counselor-apply/upload?kind=${kind}`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const ct = res.headers.get('content-type') || ''
    const body: unknown = ct.includes('application/json') ? await res.json() : await res.text()
    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string'
          ? String((body as { message: string }).message)
          : `업로드 실패 (${res.status})`
      throw new ApiError(res.status, message, body)
    }
    return body as {
      ok: true
      kind: 'profile' | 'wide' | 'contract'
      url: string
      url_webp: string | null
      original_name: string
      size: number
    }
  },
}
