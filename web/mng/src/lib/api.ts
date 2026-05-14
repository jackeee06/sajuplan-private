import { API_BASE as BASE } from './runtime-env'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
