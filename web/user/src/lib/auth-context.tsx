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
  /** 로그인 응답의 member 를 즉시 주입 (me() race 회피) */
  setSession: (m: UserMember | null) => void
  /** 백엔드 로그아웃 + 상태 초기화. 호출처가 navigate 결정. */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<UserMember | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<UserMember | null> => {
    // [2026-05-25 2차 fix] 강제 로그아웃 조건 더욱 엄격화 — "코인충전 누르면 한 번씩 튕김" 재발 fix.
    //
    // 1차 fix 가 네트워크 에러는 막았지만, 401 받으면 즉시 로그아웃이라 일시 race 에 취약했음:
    //   - 라우트 변경 시 me() 자동 호출 (보유 코인 갱신용)
    //   - 쿠키 갱신 race / 서버 일시 응답 지연 → 401
    //   - 즉시 setMember(null) → 강제 로그아웃 → 페이지 가드로 /login 튕김
    //   - 사용자 재시도 시엔 정상 (= 일시 race 였다는 증거)
    //
    // 해결: 401 받으면 즉시 로그아웃 X. **300ms 대기 후 1회 재시도**.
    //   - 재시도도 401 = 진짜 인증 만료 → 그때 로그아웃
    //   - 재시도가 정상 = 일시 race 였음 → 세션 유지
    //   - 재시도가 네트워크 에러 = 일시 오류 → 세션 유지 (기존 1차 fix 정책)
    const tryFetch = async (): Promise<UserMember> => {
      const m = await authApi.me()
      return m
    }
    try {
      const m = await tryFetch()
      setMember(m)
      void syncNativePushForMember(m)
      return m
    } catch (e) {
      // 401/403 만 재시도 (네트워크 에러는 이미 세션 유지 정책)
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        // 300ms 후 1회 재시도 — 쿠키 race 회피
        await new Promise((r) => setTimeout(r, 300))
        try {
          const m = await tryFetch()
          setMember(m)
          void syncNativePushForMember(m)
          return m
        } catch (retryErr) {
          if (retryErr instanceof ApiError && (retryErr.status === 401 || retryErr.status === 403)) {
            // 재시도도 진짜 401 → 인증 만료 확정. 로그아웃.
            setMember(null)
            void syncNativePushForMember(null)
            return null
          }
          // 재시도가 네트워크 오류 → 기존 세션 유지
          console.warn('[auth] me() retry transient (keeping session):', retryErr)
          return null
        }
      }
      // 네트워크 일시 오류 등 — 기존 세션 유지
      console.warn('[auth] me() transient (keeping session):', e)
      return null
    }
  }, [])

  // [2026-05-25] 로그인 응답의 member 객체를 그대로 주입 (me() race 회피용)
  // - authApi.login() 직후 setSession(r.member) 로 호출하면 me() 추가 호출 불필요
  // - 쿠키 동기화 race 로 me() 가 401 받는 시나리오 차단
  const setSession = useCallback((m: UserMember | null) => {
    setMember(m)
    void syncNativePushForMember(m)
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
    // [2026-05-25] loading 안전 timeout — refresh 가 어떤 이유로 finally 못 닫아도
    // 5초 후엔 무조건 loading=false. 페이지 가드(if !member → /login)가 못 발동하는 케이스 차단.
    const safety = setTimeout(() => {
      if (alive) setLoading(false)
    }, 5000)
    refresh().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
      clearTimeout(safety)
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
      setSession,
      logout,
    }),
    [member, loading, refresh, setSession, logout],
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
