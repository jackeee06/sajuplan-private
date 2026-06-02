import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { counselorsApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * 단골 상담사 인앱 배너 — 홈 진입 시 노출.
 *
 *  - 로그인 + 단골 등록 0건 → "⭐ 단골 상담사를 등록해보세요" 유도 배너
 *  - 로그인 + 단골 있고 접속중 1명+ → "⭐ 단골 ○○○선생님이 지금 상담 가능해요" 배너
 *  - 로그인 + 단골 있고 접속중 0명 → 미노출
 *  - 비로그인 → 미노출
 *
 *  - X 버튼 → sessionStorage 에 표시 (이 세션엔 다시 안 보임)
 *  - 30초마다 자동 새로고침 (단골 상태 갱신)
 *
 *  푸시 대신 인앱 배너 채택 (2026-05-28 결정) — 사용자 능동 진입 시점이라 수용성 ↑, 스팸 위험 0.
 */
const DISMISS_KEY = 'favorite_banner_dismissed_v1'
const POLL_INTERVAL_MS = 30_000

type Online = {
  id: number
  name: string
  nickname: string
}

export default function FavoriteCounselorBanner() {
  const { isLoggedIn } = useAuth()
  const [online, setOnline] = useState<Online[]>([])
  const [totalFavorites, setTotalFavorites] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 초기 dismissed 상태 (세션 단위 닫힘)
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
  }, [])

  const fetchOnline = useCallback(async () => {
    if (!isLoggedIn) {
      setOnline([])
      setTotalFavorites(0)
      return
    }
    try {
      const r = await counselorsApi.favoritesOnline()
      setOnline(r.online ?? [])
      setTotalFavorites(r.totalFavorites ?? 0)
    } catch {
      // 401 등은 무시 (비로그인/세션만료)
      setOnline([])
      setTotalFavorites(0)
    }
  }, [isLoggedIn])

  // 마운트 + 로그인 변화 시 1회 + 30초 polling
  useEffect(() => {
    fetchOnline()
    timerRef.current = setInterval(fetchOnline, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchOnline])

  if (!isLoggedIn || dismissed) return null

  // 케이스 1: 단골 미등록 → 등록 유도
  if (totalFavorites === 0) {
    return (
      <BannerShell
        onDismiss={() => {
          setDismissed(true)
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DISMISS_KEY, '1')
        }}
      >
        <Link to="/counselors" className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-base leading-none">⭐</span>
          <span className="text-[13px] text-[#ec4899] font-medium truncate">
            마음에 드는 상담사를 단골로 등록해보세요
          </span>
          <span className="text-[11.5px] text-[#9d174d]/70 shrink-0">상담사 둘러보기 →</span>
        </Link>
      </BannerShell>
    )
  }

  // 케이스 2: 접속중 단골 0명 → 미노출
  if (online.length === 0) return null

  // 케이스 3: 접속중 단골 1명+
  const first = online[0]
  const others = online.length - 1
  const linkTo = `/counselors/${first.id}`
  const displayName = first.nickname || first.name

  return (
    <BannerShell
      onDismiss={() => {
        setDismissed(true)
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DISMISS_KEY, '1')
      }}
    >
      <Link to={linkTo} className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-base leading-none animate-pulse">⭐</span>
        <span className="text-[13px] text-[#ec4899] font-medium truncate">
          단골 <span className="font-semibold">{displayName}</span> 선생님
          {others > 0 ? ` 외 ${others}명` : ''}이 지금 상담 가능해요
        </span>
        <span className="text-[11.5px] text-[#9d174d]/70 shrink-0">바로가기 →</span>
      </Link>
    </BannerShell>
  )
}

function BannerShell({
  children,
  onDismiss,
}: {
  children: React.ReactNode
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#fdf2f8] border-b border-[#fbcfe8]">
      {children}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="배너 닫기"
        className="shrink-0 w-5 h-5 flex items-center justify-center text-[#ec4899]/70 hover:text-[#ec4899]"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </svg>
      </button>
    </div>
  )
}
