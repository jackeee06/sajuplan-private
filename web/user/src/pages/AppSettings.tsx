import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../lib/api'
import { useAuth } from '../lib/auth-context'

/**
 * 앱 설정 — Figma 07마이페이지(회원) > 앱 설정 (128:18723)
 *
 * 푸시알림 설정 토글 1개. 토글 즉시 PATCH /api/user/auth/me/push 호출 → DB 저장.
 *
 * NOTE: 추후 모바일 앱 연동 시 OFF→FCM/APNs 토픽 unsubscribe, ON→재구독 처리 필요.
 *       (member_push_token 의 device 토큰 기준)
 */
export default function AppSettings() {
  const navigate = useNavigate()
  const { member, loading, refresh } = useAuth()
  const [pushEnabled, setPushEnabled] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // me() 결과로 초기 토글값 동기화
  useEffect(() => {
    if (member) setPushEnabled(member.push_all)
  }, [member])

  if (loading) {
    return (
      <div className="mobile-frame flex flex-col">
        <div className="h-[60px] px-4 flex items-center bg-white">
          <h1 className="text-[18px] font-semibold text-[#030712]">앱 설정</h1>
        </div>
        <main className="flex-1 px-4 py-6">
          <div className="h-12 bg-[#F3F4F6] animate-pulse rounded" />
        </main>
      </div>
    )
  }

  if (!member) {
    return <Navigate to="/login?redirect=/mypage/app-settings" replace />
  }

  const onToggle = async () => {
    if (saving) return
    const next = !pushEnabled
    setError(null)
    // 낙관적 UI — 즉시 반영, 실패 시 롤백
    setPushEnabled(next)
    setSaving(true)
    try {
      await authApi.updatePush(next)
      // AuthContext member.push_all 갱신
      await refresh()
    } catch (e) {
      setPushEnabled(!next)
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mobile-frame flex flex-col">
      <header className="h-[60px] px-4 flex items-center gap-3 sticky top-0 z-20 bg-gradient-to-b from-white to-white/80 backdrop-blur-[7px]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          className="w-[30px] h-[30px] flex items-center justify-center"
        >
          <img src="/img/ic_hd_back.svg" alt="" className="w-[30px] h-[30px]" />
        </button>
        <h1 className="flex-1 text-[18px] font-semibold leading-[120%] text-[#030712]">
          앱 설정
        </h1>
      </header>

      <main className="flex-1 px-4 pt-4">
        <div className="flex items-center justify-between h-12">
          <span className="text-[16px] leading-[140%] font-medium text-[#030712]">
            푸시알림 설정
          </span>
          <PushToggle on={pushEnabled} onToggle={onToggle} disabled={saving} />
        </div>
        {error && (
          <p className="mt-3 text-[13px] text-[#FF6467]">{error}</p>
        )}
      </main>
    </div>
  )
}

function PushToggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="relative w-[52px] h-[30px] rounded-full transition-colors disabled:opacity-60"
      style={{ background: on ? '#9B7AF7' : '#E5E7EB' }}
    >
      <span
        className="absolute top-[3px] w-6 h-6 rounded-full bg-white flex items-center justify-center transition-all shadow-sm"
        style={{ left: on ? '25px' : '3px' }}
      >
        {on && (
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" aria-hidden>
            <path
              d="M6 12.5L10 16L18 8"
              stroke="#030712"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}
