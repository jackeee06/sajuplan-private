import { NavLink } from 'react-router-dom'

/**
 * 사주문 모바일 하단 네비 — Figma 4:2774 (bt_menu 358×70 pill)
 *
 * 5항목: 단골(bookmark) → 상담사(heart) → [홈](home+heart, 활성 보라) → 충전($) → 마이(person)
 *
 * 모든 아이콘은 24×24 line stroke. on=보라(#8259F5), off=회색(#4A5565)
 *  — 자산 위치: /img/bt_menu_<key>_<on|off>.svg
 */

interface NavItem {
  to: string
  label: string
  iconBase: string
}

const ITEMS: NavItem[] = [
  { to: '/favorites', label: '단골', iconBase: 'bookmark' },
  { to: '/counselors', label: '상담사', iconBase: 'heart' },
  { to: '/', label: '홈', iconBase: 'home' },
  { to: '/point', label: '충전', iconBase: 'point' },
  { to: '/mypage', label: '마이', iconBase: 'my' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[496px] h-[70px] z-30 rounded-full px-8 flex items-center justify-between border border-[#F9FAFB] backdrop-blur-[7px] shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
      style={{ background: 'rgba(249, 250, 251, 0.85)' }}
    >
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className="flex flex-col items-center gap-2"
        >
          {({ isActive }) => (
            <>
              <img
                src={`/img/bt_menu_${it.iconBase}_${isActive ? 'on' : 'off'}.svg`}
                alt=""
                className="w-6 h-6"
              />
              <span
                className={`text-[14px] leading-none ${
                  isActive ? 'text-[#8259F5] font-medium' : 'text-[#4A5565] font-normal'
                }`}
              >
                {it.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
