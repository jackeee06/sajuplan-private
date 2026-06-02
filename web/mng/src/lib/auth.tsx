import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from './api'

export interface AdminUser {
  id: number | string
  mb_id: string
  role: 'admin'
  level: number
  is_super: boolean
}

export interface LoginResult {
  ok: true
  admin: AdminUser & { name: string; nickname: string }
}

interface AuthState {
  admin: AdminUser | null
  status: 'loading' | 'authed' | 'guest'
  login: (mbId: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  // 부트 시 쿠키 기반 세션 복원
  useEffect(() => {
    let alive = true
    api<AdminUser>('/admin/auth/me')
      .then((me) => {
        if (!alive) return
        setAdmin(me)
        setStatus('authed')
      })
      .catch(() => {
        if (!alive) return
        setAdmin(null)
        setStatus('guest')
      })
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (mbId: string, password: string) => {
    try {
      const result = await api<LoginResult>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mb_id: mbId, password }),
      })
      setAdmin({
        id: result.admin.id,
        mb_id: result.admin.mb_id,
        role: result.admin.role,
        level: result.admin.level,
        is_super: !!result.admin.is_super,
      })
      setStatus('authed')
    } catch (e) {
      // 인증 실패 시 상태는 그대로 두고 호출 측에서 메시지 표시
      if (e instanceof ApiError && e.status === 429) {
        throw new Error('로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.')
      }
      throw e
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api<void>('/admin/auth/logout', { method: 'POST' })
    } catch {
      // 무시 — 어차피 클라이언트 상태 초기화
    }
    setAdmin(null)
    setStatus('guest')
  }, [])

  const value = useMemo(
    () => ({ admin, status, login, logout }),
    [admin, status, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 하위에서만 사용 가능')
  return ctx
}
