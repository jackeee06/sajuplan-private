import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationsApi } from '../lib/api'
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus'

/**
 * 헤더 우상단 종모양(🔔) — 안 읽은 알림이 있으면 빨간 뱃지(숫자) + 종이 좌우로 "딸랑딸랑" 흔들림(swing).
 *  - 안 읽음일 때 종 색도 빨강(#ef4444)으로 바뀌어 한눈에 띈다(읽으면 평소 검정으로 복귀).
 *  - 안읽음 개수는 /user/notifications/unread-count 폴링 (마운트 + 화면 복귀 + 60초 주기).
 *  - 비로그인은 0 → 뱃지 없음·흔들림 없음.
 *  - 회원/상담사 헤더 공통. 컨테이너 크기만 prop 으로 조정(홈은 40px, 마이페이지는 30px).
 *  - 색 제어를 위해 img 대신 인라인 SVG(stroke=currentColor) 사용.
 */
const STYLE = `
@keyframes nbRing{
  0%{transform:rotate(0)}
  4%{transform:rotate(20deg)}
  11%{transform:rotate(-18deg)}
  18%{transform:rotate(15deg)}
  25%{transform:rotate(-12deg)}
  32%{transform:rotate(8deg)}
  39%{transform:rotate(-5deg)}
  46%{transform:rotate(2deg)}
  53%,100%{transform:rotate(0)}
}
.nb-ring{animation:nbRing 1.6s ease-in-out infinite;transform-origin:50% 18%}
`

export default function NotificationBell({
  containerClassName = 'w-[30px] h-[30px]',
}: {
  containerClassName?: string
}) {
  const [unread, setUnread] = useState(0)

  const reload = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then((r) => setUnread(r.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    reload()
    const t = window.setInterval(reload, 60_000)
    return () => window.clearInterval(t)
  }, [reload])

  // 앱 복귀(백그라운드 → 포그라운드) 시 즉시 갱신.
  useRefreshOnFocus(reload)

  const has = unread > 0

  return (
    <Link
      to="/notifications"
      aria-label={has ? `알림 ${unread}개 안읽음` : '알림'}
      className={`relative flex items-center justify-center ${containerClassName}`}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <svg
        width="28"
        height="28"
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={has ? 'nb-ring text-[#ef4444]' : 'text-[#030712]'}
        aria-hidden
      >
        <path
          d="M7.97707 20.9009C7.45002 20.9009 6.96418 20.63 6.69329 20.1854C6.36057 19.6319 6.46657 18.9223 6.94062 18.4894L8.28035 17.2704V12.3473C8.28035 8.58429 11.4221 5.28357 14.9996 5.28357C18.5771 5.28357 21.7188 8.58429 21.7188 12.3473V17.2704L23.0585 18.4894C23.5355 18.9223 23.6386 19.6348 23.3059 20.1854C23.0379 20.6271 22.5492 20.9009 22.0221 20.9009H7.97118H7.97707Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.7184 20.9771C18.7184 23.0441 17.0548 24.7165 15.0025 24.7165C12.9502 24.7165 11.2866 23.0411 11.2866 20.9771H18.7214H18.7184Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {has && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-[0_0_0_2px_#fff]"
          aria-hidden
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
