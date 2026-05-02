/**
 * 사용자 프론트 → API 통신 래퍼.
 * — 모든 요청에 credentials:'include' (쿠키 기반 인증, 크로스도메인 OK).
 * — 4xx/5xx 응답은 ApiError 로 throw.
 *
 * VITE_API_BASE:
 *  - dev: '/api'  → vite 프록시로 localhost:3001 로 위임
 *  - prod: 'https://api.sajumoon.kr/api'  → API 서버에 직접 cross-origin 요청
 *
 * BASE 는 '...'/api 까지 포함한다. path 는 '/api/...' 가 아니라 '/user/auth/login' 같은
 * "namespace 이하" 경로를 받는다 (mng 와 동일한 패턴).
 */
const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

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
    ...rest,
    headers: {
      Accept: 'application/json',
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
}

export interface SocialPending {
  provider: 'kakao' | 'naver'
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
  social?: 'kakao' | 'naver'
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

export const authApi = {
  login: (mb_id: string, password: string, keep_login: boolean) =>
    api.post<{ ok: true; member: UserMember }>('/user/auth/login', {
      mb_id,
      password,
      keep_login,
    }),
  me: () => api.get<UserMember>('/user/auth/me'),
  logout: () => api.post<void>('/user/auth/logout'),
  socialConfig: () =>
    api.get<{ use: boolean; providers: ('kakao' | 'naver')[] }>(
      '/user/auth/social/config',
    ),
  /**
   * 카카오/네이버 인가 페이지로 시작하는 URL.
   * window.location.href 로 사용 — 백엔드가 302 로 provider 인가 페이지로 리다이렉트한다.
   * 반드시 BASE(절대) 를 붙여야 SPA fallback 에 걸려 메인으로 떨어지지 않는다.
   */
  socialStartUrl: (provider: 'kakao' | 'naver', redirect?: string) => {
    const q = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
    return `${BASE}/user/auth/social/${provider}/start${q}`
  },
  /** 소셜 콜백에서 발급된 단기 가입 대기 토큰을 읽어 prefill 용 프로필 반환 */
  socialPending: () =>
    api.get<{ pending: SocialPending | null }>('/user/auth/social/pending'),
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
// 메인 페이지 공개 통계 (최근 상담 건수 / 접속중 상담사)
// ─────────────────────────────────────────────

export const statsApi = {
  main: () =>
    api.get<{ recent_consultations: number; online_counselors: number }>(
      '/user/stats/main',
    ),
}

// ─────────────────────────────────────────────
// 공개 setting (footer.* + site.kakao_channel_url 등)
// ─────────────────────────────────────────────

export type PublicSettings = Record<string, string>

export const settingsApi = {
  /** 푸터 회사정보 + 카카오 채널 URL 등 — `footer.company_name`, `site.kakao_channel_url` 형태 키 */
  public: () => api.get<PublicSettings>('/user/settings/public'),
}
