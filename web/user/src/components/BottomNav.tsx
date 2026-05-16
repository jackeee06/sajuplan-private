import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

/**
 * 사주문 모바일 하단 네비 — Figma 4:2774 (bt_menu 358×70 pill)
 *
 * 5항목:
 *   회원:   단골 → 상담사 → 홈 → 충전($) → 마이
 *   상담사: 단골 → 상담사 → 홈 → 정산($) → 마이
 *
 * 상담사는 충전이 무의미하므로 정산내역 페이지로 대체. point 아이콘($) 그대로 재사용.
 *
 * 모든 아이콘은 24×24 line stroke. on=보라(#8259F5), off=회색(#4A5565)
 *  — 자산 위치: /img/bt_menu_<key>_<on|off>.svg
 */

interface NavItem {
  to: string
  label: string
  iconBase: string
}

interface Props {
  /** 마이 메뉴 링크 — 상담사 모드에서 '/counselor/mypage'로 오버라이드 */
  myHref?: string
}

export default function BottomNav({ myHref = '/mypage' }: Props = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isCounselor } = useAuth()
  // 2026-05-15 변경: 상담사/단골 위치 swap + '충전'→'코인충전' 라벨, '정산'→'코인충전' 통일
  const ITEMS: NavItem[] = [
    { to: '/counselors', label: '상담사', iconBase: 'heart' },
    { to: '/favorites', label: '단골', iconBase: 'bookmark' },
    { to: '/', label: '홈', iconBase: 'home' },
    isCounselor
      ? { to: '/mypage/settlement/history', label: '코인충전', iconBase: 'point' }
      : { to: '/mypage/charge', label: '코인충전', iconBase: 'point' },
    { to: myHref, label: '마이', iconBase: 'my' },
  ]

  // 활성 상태 계산 — 홈은 정확히 '/' 일 때만, 나머지는 prefix 매칭
  const isItemActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  /**
   * 탭 클릭 동작:
   *  - 다른 경로로 이동: 그대로 navigate.
   *  - 같은 경로 재클릭: state.reload 에 새 timestamp 를 실어 navigate → useRefreshOnFocus 가
   *    이를 감지해 페이지 데이터를 refetch. (react-router 가 같은 경로 동일 state 일 때
   *    아무 일도 안 하던 기본 동작을 우회)
   */
  const onTabClick = (to: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const isSame = location.pathname === to
    navigate(to, { state: { reload: Date.now() }, replace: isSame })
  }

  return (
    <nav
      className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[496px] h-[70px] z-30 rounded-full px-8 flex items-center justify-between border border-[#F9FAFB] backdrop-blur-[7px] shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
      style={{ background: 'rgba(249, 250, 251, 0.85)' }}
    >
      {ITEMS.map((it) => {
        const active = isItemActive(it.to)
        return (
          <a
            key={it.label}
            href={it.to}
            onClick={onTabClick(it.to)}
            className="flex flex-col items-center gap-2"
          >
            {/* 홈 강조 (2026-05-15) — 다른 아이콘보다 1.4배 크게 + 활성 시 보라 원형 배경 */}
            {it.iconBase === 'home' ? (
              <div className={`flex items-center justify-center rounded-full ${active ? 'bg-[#F3EEFE]' : ''} w-11 h-11 -mt-2`}>
                <img
                  src={`/img/bt_menu_home_${active ? 'on' : 'off'}.svg`}
                  alt=""
                  className="w-8 h-8"
                />
              </div>
            ) : (
              <img
                src={`/img/bt_menu_${it.iconBase}_${active ? 'on' : 'off'}.svg`}
                alt=""
                className="w-6 h-6"
              />
            )}
            <span
              className={`text-[14px] leading-none ${
                active ? 'text-[#8259F5] font-medium' : 'text-[#4A5565] font-normal'
              } ${it.iconBase === 'home' ? 'font-semibold' : ''}`}
            >
              {it.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
