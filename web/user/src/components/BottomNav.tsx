import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

/**
 * 사주플랜 모바일 하단 네비 — Figma 4:2774 (bt_menu 358×70 pill)
 *
 * 5항목:
 *   회원:   단골 → 상담사 → 홈 → 충전($) → 마이
 *   상담사: 단골 → 상담사 → 홈 → 정산($) → 마이
 *
 * 상담사는 충전이 무의미하므로 정산내역 페이지로 대체. point 아이콘($) 그대로 재사용.
 *
 * 모든 아이콘은 24×24 line stroke. on=보라(#ec4899), off=회색(#4A5565)
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
  // [2026-05-25] BottomNav 4번째 메뉴 모드 판단 — role 이 아닌 "현재 URL 경로" 로 결정.
  //
  // 이전 버그: 듀얼 역할자(role='counselor' 이지만 회원 마이페이지 보고 있는 사장님 같은 분) 가
  //          회원 화면에 있을 때도 BottomNav 가 '수익금' 표시 → 우측 상단 '상담사 메뉴' 칩(=현재 회원 모드 신호)
  //          과 모순. "상담사 메뉴 보이는데 왜 수익금 버튼이지?" 혼란 발생.
  //
  // 수정: /counselor/* 경로 = 상담사 모드 → '수익금', 그 외 = 회원 모드 → '코인충전'.
  //       사장님은 role 무관 어디 페이지에 있는지로 동적으로 라벨이 바뀜 (회원 페이지 ↔ 상담사 페이지).
  //       role!='counselor' (일반 회원) 는 어차피 /counselor/* 갈 일 없으므로 항상 '코인충전' 으로 안정.
  // [2026-05-25] 상담사 영역 = /counselor/* 로 통일. (정산 페이지도 /counselor/mypage/settlement 로 이동됨)
  // [2026-05-28] startsWith('/counselor') 가 /counselors (회원이 상담사 둘러보는 페이지) 까지 매칭하던 버그 fix.
  //   /counselor 또는 /counselor/* 만 상담사 영역. /counselors* 는 회원 영역.
  const inCounselorArea = location.pathname === '/counselor' || location.pathname.startsWith('/counselor/')
  const showCounselorMenu = isCounselor && inCounselorArea
  const ITEMS: NavItem[] = [
    { to: '/counselors', label: '상담사', iconBase: 'heart' },
    { to: '/favorites', label: '단골', iconBase: 'bookmark' },
    { to: '/', label: '홈', iconBase: 'home' },
    showCounselorMenu
      ? { to: '/counselor/mypage/settlement/history', label: '수익금', iconBase: 'point' }
      : { to: '/mypage/charge', label: '코인충전', iconBase: 'point' },
    { to: myHref, label: '마이', iconBase: 'my' },
  ]

  // 활성 상태 계산 — 홈은 정확히 '/' 일 때만, 나머지는 prefix 매칭.
  // [2026-05-28] "마이" 같은 부모 path 가 자식 path (/mypage/charge, /counselor/mypage/settlement) 진입 시
  //   같이 active 되던 버그 fix. 다른 메뉴가 더 긴 prefix 로 매칭되면 짧은 메뉴는 inactive.
  const isItemActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    const matches = location.pathname === to || location.pathname.startsWith(`${to}/`)
    if (!matches) return false
    // 더 긴 prefix 로 매칭되는 다른 아이템이 있으면 이 아이템은 false
    const longerMatch = ITEMS.some((other) =>
      other.to !== to &&
      other.to !== '/' &&
      other.to.startsWith(to) &&
      (location.pathname === other.to || location.pathname.startsWith(`${other.to}/`))
    )
    return !longerMatch
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
              <div className={`flex items-center justify-center rounded-full ${active ? 'bg-[#fdf2f8]' : ''} w-11 h-11 -mt-2`}>
                <img
                  src={`/img/bt_menu_home_${active ? 'on' : 'off'}.svg?v=v2`}
                  alt=""
                  className="w-8 h-8"
                />
              </div>
            ) : (
              <img
                src={`/img/bt_menu_${it.iconBase}_${active ? 'on' : 'off'}.svg?v=v2`}
                alt=""
                className="w-6 h-6"
              />
            )}
            <span
              className={`text-[14px] leading-none ${
                active ? 'text-[#ec4899] font-medium' : 'text-[#4A5565] font-normal'
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
