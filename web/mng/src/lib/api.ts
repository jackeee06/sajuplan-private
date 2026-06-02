import { API_BASE as BASE } from './runtime-env'
import { isPhonePeekOn } from './phonePeek'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// [PII 보호] 슈퍼관리자 전화번호 토글이 ON 이고 GET 요청이면 ?show_phone=1 자동 부착.
//   - 일반 관리자는 sessionStorage 키가 없으므로 영향 없음.
//   - 백엔드도 is_super 미충족 시 무시 (이중 차단).
function decoratePath(path: string, init?: RequestInit): string {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET') return path
  if (!isPhonePeekOn()) return path
  return path.includes('?') ? `${path}&show_phone=1` : `${path}?show_phone=1`
}

async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${decoratePath(path, init)}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data = (await res.json()) as { message?: string }
      if (data?.message) msg = data.message
    } catch {
      // 비-JSON 응답 — 기본 메시지 사용
    }
    throw new ApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// 429 ThrottlerException 자동 재시도 — 짧은 시간 폭주 직후 한 번 실패한 요청을
// 사용자 모르게 한 번만 더 시도해 시간 분산. 그래도 429 면 ApiError 가 전파된다.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await rawRequest<T>(path, init)
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      return rawRequest<T>(path, init)
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────
// GET 전용 — in-flight dedupe + 짧은 메모리 캐시 (2026-05-29).
//
// 관리자가 빠르게 페이지 전환하거나 같은 화면이 여러 번 마운트되어도 동일 path 의
// GET 요청은 한 번만 네트워크에 나간다. ThrottlerException 사고 차단.
//   - dedupe: 진행 중인 promise 를 공유
//   - cache : 성공 응답을 GET_CACHE_TTL_MS 동안 메모리에 보관
//   - 실패는 캐시 안 함 (즉시 재시도 가능)
//
// 캐시 키는 decoratePath() 결과 — PII 토글 ?show_phone=1 유무에 따라 다른 캐시.
// POST/PUT/DELETE 는 사용자 액션이므로 dedupe/캐시 적용하지 않는다.
// ─────────────────────────────────────────────────────────────
const GET_CACHE_TTL_MS = 2_000
type GetEntry<T> = { expireAt: number; promise: Promise<T> }
const getInflightCache = new Map<string, GetEntry<unknown>>()

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET') {
    return request<T>(path, init)
  }
  const key = decoratePath(path, init)
  const now = Date.now()
  const hit = getInflightCache.get(key) as GetEntry<T> | undefined
  if (hit && hit.expireAt > now) {
    return hit.promise
  }
  const promise = request<T>(path, init).catch((err) => {
    getInflightCache.delete(key)
    throw err
  })
  getInflightCache.set(key, { expireAt: now + GET_CACHE_TTL_MS, promise })
  return promise
}
