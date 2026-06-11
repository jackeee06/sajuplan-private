import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { notificationsApi } from '../lib/api'

/**
 * 새 알림 "마중" 배너 — 홈 진입 시 안 읽은 알림이 있으면 화사하게 안내.
 *  - 시안1: primary 보라→핑크 그라데이션 카드 + 흔들리는 🔔 + 슬라이드/바운스 등장
 *  - 탭 → /notifications (알림함). X → sessionStorage (이번 세션 닫힘)
 *  - 안 읽은 수 0 이면 미노출. 점검 배너(긴급) 바로 아래에 위치.
 *  - 폰 아이콘 배지("2")와 앱 안 알림을 이어주는 "여기 있어요" 안내 역할.
 */
const DISMISS_KEY = 'notif_greet_banner_dismissed_v1'

const STYLE = `
@keyframes njbSlide{0%{transform:translateY(-130%);opacity:0}65%{transform:translateY(7%);opacity:1}85%{transform:translateY(-2%)}100%{transform:translateY(0);opacity:1}}
.njb-anim{animation:njbSlide .7s cubic-bezier(.2,.75,.25,1) both}
@keyframes njbRing{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(11deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(6deg)}50%{transform:rotate(-3deg)}}
.njb-ring{display:inline-block;transform-origin:50% 12%;animation:njbRing 1.8s ease-in-out infinite}
`

export default function NotificationGreetBanner() {
  const [unread, setUnread] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true)
    }
  }, [])

  useEffect(() => {
    let alive = true
    notificationsApi
      .list()
      .then((res) => {
        if (!alive) return
        const cnt = (res.items ?? []).filter((n) => !n.read).length
        setUnread(cnt)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (dismissed || unread <= 0) return null

  const onDismiss = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissed(true)
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DISMISS_KEY, '1')
  }

  return (
    <div className="px-3 pt-2">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <Link
        to="/notifications"
        className="njb-anim flex items-center gap-3 px-4 py-3.5 rounded-2xl text-white shadow-[0_8px_24px_rgba(155,122,247,.35)]"
        style={{ background: 'linear-gradient(120deg,#9b7af7 0%,#b66ef0 55%,#ec4899 100%)' }}
      >
        <span className="njb-ring text-[24px] leading-none">🔔</span>
        <span className="flex-1 min-w-0 leading-tight">
          <span className="block text-[15px] font-bold">새 알림 {unread}개가 도착했어요 ✨</span>
          <span className="block text-[12px] text-white/85 mt-0.5">탭하면 알림함으로 바로 이동해요</span>
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="배너 닫기"
          className="shrink-0 w-6 h-6 -mr-1 flex items-center justify-center text-white/80"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
      </Link>
    </div>
  )
}
