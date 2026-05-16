import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3, Bell, ChevronDown, CreditCard, FileText, Headphones,
  LayoutDashboard, LogOut, MoreHorizontal, Settings, Shield, Ticket, Users,
} from 'lucide-react'

/**
 * 사이드바 — sample/adm/admin.menu350.php 트리 기준 재구성.
 * 그룹: 회원현황 / 매출현황 / 상담관리 / 기타 / 콘텐츠 / 환경설정
 */

type MenuKey = 'member' | 'sales' | 'consultation' | 'board' | 'notification' | 'misc' | 'permission' | 'config'

export default function Sidebar() {
  // 회원현황/매출현황/상담관리는 자주 쓰는 메뉴라 항상 펼친 상태로 시작
  const [open, setOpen] = useState<Record<MenuKey, boolean>>({
    member: true,
    sales: true,
    consultation: true,
    board: false,
    notification: false,
    misc: false,
    permission: false,
    config: false,
  })

  const toggle = (key: MenuKey) => setOpen((s) => ({ ...s, [key]: !s[key] }))

  return (
    <aside className="flex-shrink-0 flex flex-col h-screen w-[260px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-x-hidden px-5 transition-colors duration-200">
      <div className="flex items-center justify-between pt-6 pb-6 flex-shrink-0">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <img src="/mng/logo.png" alt="사주문" className="h-8 w-auto dark:brightness-0 dark:invert" />
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 tracking-wide">ADMIN</span>
        </NavLink>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto pt-5">
        <nav>
          <div className="mb-6">
            <h3 className="mb-4 text-xs font-semibold uppercase leading-5 text-gray-400 dark:text-gray-500">관리 메뉴</h3>

            <ul className="flex flex-col gap-2">
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                  <span>대시보드</span>
                </NavLink>
              </li>

              {/* 회원현황 */}
              <li>
                <button onClick={() => toggle('member')} className="menu-item-btn menu-item-inactive">
                  <Users className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">회원현황</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.member ? 'rotate-180' : ''}`} />
                </button>
                {open.member && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/members/customers" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>고객 리스트</NavLink></li>
                    <li><NavLink to="/members/counselors" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>상담사 리스트</NavLink></li>
                    <li><NavLink to="/members/counselor-apply" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>상담사 신청 내역</NavLink></li>
                    <li><NavLink to="/attendance" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 출석 관리</NavLink></li>
                    <li><NavLink to="/grade" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 등급 관리</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 매출현황 */}
              <li>
                <button onClick={() => toggle('sales')} className="menu-item-btn menu-item-inactive">
                  <CreditCard className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">매출현황</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.sales ? 'rotate-180' : ''}`} />
                </button>
                {open.sales && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/consultations" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>사용(상담) 내역</NavLink></li>
                    <li><NavLink to="/refunds" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 환불 이력</NavLink></li>
                    <li><NavLink to="/charge-amounts" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>충전금액 설정</NavLink></li>
                    <li><NavLink to="/payments" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>결제 내역</NavLink></li>
                    <li><NavLink to="/points/history" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>포인트 관리</NavLink></li>
                    <li><NavLink to="/settlements" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>정산 이력</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 쿠폰존 관리 */}
              <li>
                <NavLink to="/coupon-zones" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <Ticket className="w-5 h-5 flex-shrink-0" />
                  <span>쿠폰존 관리</span>
                </NavLink>
              </li>

              {/* 상담관리 — 상담후기/채팅내역은 다음 단계에서 추가 (게시판 통합) */}
              <li>
                <button onClick={() => toggle('consultation')} className="menu-item-btn menu-item-inactive">
                  <Headphones className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">상담관리</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.consultation ? 'rotate-180' : ''}`} />
                </button>
                {open.consultation && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/posts/review" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>상담후기 관리</NavLink></li>
                    <li><NavLink to="/review-reports" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>후기 신고 관리</NavLink></li>
                    <li><NavLink to="/chat-history" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>채팅내역 리스트</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 게시판관리 */}
              <li>
                <button onClick={() => toggle('board')} className="menu-item-btn menu-item-inactive">
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">게시판관리</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.board ? 'rotate-180' : ''}`} />
                </button>
                {open.board && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/search-keywords" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>인기검색어 관리</NavLink></li>
                    <li><NavLink to="/search-popular" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>인기검색어 순위</NavLink></li>
                    <li><NavLink to="/faqs" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>FAQ 관리</NavLink></li>
                    <li><NavLink to="/notices" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>공지사항 관리</NavLink></li>
                    <li><NavLink to="/events" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>이벤트 관리</NavLink></li>
                    <li><NavLink to="/post-reports" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>게시판 신고 관리</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 알림 */}
              <li>
                <button onClick={() => toggle('notification')} className="menu-item-btn menu-item-inactive">
                  <Bell className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">알림</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.notification ? 'rotate-180' : ''}`} />
                </button>
                {open.notification && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/push-notifications" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>푸시 알림</NavLink></li>
                    <li><NavLink to="/alimtalk-templates" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>알림톡 템플릿</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 통계 */}
              <li>
                <NavLink to="/stats" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <BarChart3 className="w-5 h-5 flex-shrink-0" />
                  <span>통계</span>
                </NavLink>
              </li>

              {/* 권한관리 */}
              <li>
                <button onClick={() => toggle('permission')} className="menu-item-btn menu-item-inactive">
                  <Shield className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">권한관리</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.permission ? 'rotate-180' : ''}`} />
                </button>
                {open.permission && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/admin-users" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>관리자 계정</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 기타 — 배너/팝업/사주메인/소원다락방/상담문의/1:1문의 */}
              <li>
                <button onClick={() => toggle('misc')} className="menu-item-btn menu-item-inactive">
                  <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">기타</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.misc ? 'rotate-180' : ''}`} />
                </button>
                {open.misc && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/banners" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>배너관리</NavLink></li>
                    <li><NavLink to="/popup-layers" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>팝업레이어 관리</NavLink></li>
                    <li><NavLink to="/saju-config" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>사주메인관리</NavLink></li>
                    {/* 소원다락방 / 소원다락방 EVENT — 퍼블리싱 미준비로 임시 숨김 */}
                    <li><NavLink to="/posts/qa" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>상담문의</NavLink></li>
                    <li><NavLink to="/posts/qa_counselor" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>1:1문의(상담사)</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 환경설정 */}
              <li>
                <button onClick={() => toggle('config')} className="menu-item-btn menu-item-inactive">
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left">환경설정</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open.config ? 'rotate-180' : ''}`} />
                </button>
                {open.config && (
                  <ul className="flex flex-col gap-1 mt-2 pl-9">
                    <li><NavLink to="/settings" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>기본환경설정</NavLink></li>
                  </ul>
                )}
              </li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="mb-4 text-xs font-semibold uppercase leading-5 text-gray-400 dark:text-gray-500">설정</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <NavLink to="/login" className="menu-item menu-item-inactive">
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span>로그아웃</span>
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  )
}
