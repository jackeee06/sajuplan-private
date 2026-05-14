import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { ApiError, authApi, type UserMember } from './api'
import { syncNativePushForMember } from './native-push'

/**
 * 사용자 인증 전역 상태.
 *
 * - 앱 마운트 시 `authApi.me()` 1회 호출 → 쿠키 인증으로 현재 멤버 정보 가져옴
 * - 401 등 비로그인 응답은 ApiError 로 throw → member=null 로 정상 처리
 * - role 분기 ('counselor' / 그 외) 는 호출처에서 `member?.role === 'counselor'` 로 판단
 *
 * 사용:
 *   const { member, loading, isLoggedIn, isCounselor, refresh, logout } = useAuth()
 */

interface AuthContextValue {
  member: UserMember | null
  /** 최초 me() 호출 진행 중 여부 */
  loading: boolean
  /** 편의 플래그 — `member !== null` */
  isLoggedIn: boolean
  /** 편의 플래그 — role==='counselor' */
  isCounselor: boolean
  /** me() 재호출 (예: 로그인 직후) */
  refresh: () => Promise<UserMember | null>
  /** 백엔드 로그아웃 + 상태 초기화. 호출처가 navigate 결정. */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<UserMember | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<UserMember | null> => {
    try {
      const m = await authApi.me()
      setMember(m)
      // 네이티브 앱이면: 토큰을 회원에 매핑 + role 별 chl_2/chl_5 토픽 구독.
      // sample/js/platform.js push_topic_update 의 RN 버전.
      void syncNativePushForMember(m)
      return m
    } catch (e) {
      // 401/403 등은 비로그인으로 처리 — 그 외 네트워크 오류도 일단 비로그인 취급
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setMember(null)
        // 비로그인 → 모든 인증 토픽 해제
        void syncNativePushForMember(null)
        return null
      }
      // 진짜 서버 에러도 일단 null. 콘솔에 남겨 디버깅.
      console.warn('[auth] me() failed:', e)
      setMember(null)
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (e) {
      console.warn('[auth] logout failed:', e)
    } finally {
      setMember(null)
      // 로그아웃 → 디바이스 토픽 모두 해제
      void syncNativePushForMember(null)
    }
  }, [])

  useEffect(() => {
    let alive = true
    refresh().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [refresh])

  // 라우트 이동마다 회원 정보(특히 보유 포인트) 자동 갱신.
  //  - 의존성을 location.key 로 → 같은 pathname 재진입도 새 key 라 발화
  //  - 첫 마운트도 발화 OK (위 useEffect 와 중복이지만 me() 호출 1회 추가일 뿐 비용 미미)
  //  - 하단 탭 / 페이지 이동 어디든 me() 갱신 보장
  const location = useLocation()
  useEffect(() => {
    void refresh()
  }, [location.key, refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      member,
      loading,
      isLoggedIn: member !== null,
      isCounselor: member?.role === 'counselor',
      refresh,
      logout,
    }),
    [member, loading, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
