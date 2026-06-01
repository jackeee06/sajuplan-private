import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3, Bell, BookOpen, Bot, ChevronDown, CreditCard, FileText, Headphones,
  LayoutDashboard, LayoutGrid, Lock, LogOut, MoreHorizontal, NotebookPen, Settings, Shield, Ticket, TrendingUp, Users,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'

/**
 * 사이드바 — sample/adm/admin.menu350.php 트리 기준 재구성.
 * 그룹: 회원현황 / 매출현황 / 상담관리 / 기타 / 콘텐츠 / 환경설정
 */

type MenuKey = 'member' | 'sales' | 'consultation' | 'board' | 'notification' | 'misc' | 'permission' | 'config'

/**
 * 현재 path → 속한 그룹 매핑.
 * 인덱스/검색으로 페이지 진입 시에도 사이드바가 자동으로 해당 그룹을 펼치고 강조하여
 * 운영자가 "이 페이지가 어느 메뉴에 속하는지" 자연스럽게 학습할 수 있게 함.
 */
function pathToGroup(pathname: string): MenuKey | null {
  if (pathname.startsWith('/members/') || pathname.startsWith('/attendance') || pathname.startsWith('/grade')) return 'member'
  if (pathname.startsWith('/consultations') || pathname.startsWith('/refunds') || pathname.startsWith('/short-call-refunds') || pathname.startsWith('/ops-kpi')
      || pathname.startsWith('/charge-amounts') || pathname.startsWith('/payments') || pathname.startsWith('/points')
      || pathname.startsWith('/settlements') || pathname.startsWith('/payouts') || pathname.startsWith('/referrals')) return 'sales'
  if (pathname.startsWith('/posts/') || pathname.startsWith('/review-reports') || pathname.startsWith('/chat-history')) return 'consultation'
  if (pathname.startsWith('/search-keywords') || pathname.startsWith('/search-popular') || pathname.startsWith('/faqs')
      || pathname.startsWith('/notices') || pathname.startsWith('/events') || pathname.startsWith('/post-reports')
      || pathname.startsWith('/posts-overview')) return 'board'
  if (pathname.startsWith('/push-notifications') || pathname.startsWith('/push-guide') || pathname.startsWith('/alert-guide') || pathname.startsWith('/alimtalk')) return 'notification'
  if (pathname.startsWith('/banners') || pathname.startsWith('/popup-layers') || pathname.startsWith('/saju-config')) return 'misc'
  if (pathname.startsWith('/admin-users')) return 'permission'
  if (pathname.startsWith('/settings') || pathname.startsWith('/contents')) return 'config'
  return null
}

export default function Sidebar() {
  const location = useLocation()
  const activeGroup = useMemo(() => pathToGroup(location.pathname), [location.pathname])
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super

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

  // 현재 path 의 그룹은 자동 펼침 — 인덱스/검색 진입 시 운영자가 위치 인지하도록
  useEffect(() => {
    if (activeGroup) {
      setOpen((s) => (s[activeGroup] ? s : { ...s, [activeGroup]: true }))
    }
  }, [activeGroup])

  const toggle = (key: MenuKey) => setOpen((s) => ({ ...s, [key]: !s[key] }))

  // 활성 그룹 헤더 클래스 — 분홍 강조 (학습 효과)
  const groupBtnCls = (key: MenuKey) =>
    activeGroup === key
      ? 'menu-item-btn text-brand-600 dark:text-brand-400 font-semibold'
      : 'menu-item-btn menu-item-inactive'

  return (
    <aside className="flex-shrink-0 flex flex-col h-screen w-[220px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-x-hidden px-2 transition-colors duration-200">
      <div className="flex items-center justify-between pt-2 pb-1 flex-shrink-0">
        <NavLink to="/dashboard" className="flex items-center gap-1.5">
          <img src="/mng/logo.png?v=v2" alt="사주플랜" className="h-6 w-auto dark:brightness-0 dark:invert" />
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 tracking-wide">ADMIN</span>
        </NavLink>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav>
          <div className="mb-1">
            <h3 className="mb-1 text-[9px] font-semibold uppercase leading-3 text-gray-400 dark:text-gray-500">관리 메뉴</h3>

            <ul className="flex flex-col gap-0">
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                  <span>대시보드</span>
                </NavLink>
              </li>

              <li>
                <NavLink to="/all-menus" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                  <span>전체 메뉴</span>
                </NavLink>
              </li>

              {/* 회원현황 */}
              <li>
                <button onClick={() => toggle('member')} className={groupBtnCls('member')}>
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">회원현황</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.member ? 'rotate-180' : ''}`} />
                </button>
                {open.member && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
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
                <button onClick={() => toggle('sales')} className={groupBtnCls('sales')}>
                  <CreditCard className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">매출현황</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.sales ? 'rotate-180' : ''}`} />
                </button>
                {open.sales && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/consultations" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>사용(상담) 내역</NavLink></li>
                    <li><NavLink to="/refunds" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 환불 이력</NavLink></li>
                    <li><NavLink to="/short-call-refunds" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 고객보호비용 내역</NavLink></li>
                    <li><NavLink to="/ops-kpi" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 운영 KPI</NavLink></li>
                    <li><NavLink to="/charge-amounts" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>충전금액 설정</NavLink></li>
                    <li><NavLink to="/payments" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>결제 내역</NavLink></li>
                    <li><NavLink to="/points/history" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>포인트 관리</NavLink></li>
                    <li><NavLink to="/settlements" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>정산 이력</NavLink></li>
                    <li><NavLink to="/payouts" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 선지급 관리</NavLink></li>
                    <li><NavLink to="/referrals" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 프로모션</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 쿠폰존 관리 */}
              <li>
                <NavLink to="/coupon-zones" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <Ticket className="w-4 h-4 flex-shrink-0" />
                  <span>쿠폰존 관리</span>
                </NavLink>
              </li>

              {/* 상담관리 — 상담후기/채팅내역은 다음 단계에서 추가 (게시판 통합) */}
              <li>
                <button onClick={() => toggle('consultation')} className={groupBtnCls('consultation')}>
                  <Headphones className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">상담관리</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.consultation ? 'rotate-180' : ''}`} />
                </button>
                {open.consultation && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/posts/review" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>상담후기 관리</NavLink></li>
                    <li><NavLink to="/review-reports" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>후기 신고 관리</NavLink></li>
                    <li><NavLink to="/posts/qa" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>상담문의</NavLink></li>
                    <li><NavLink to="/posts/qa_counselor" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>1:1문의(상담사)</NavLink></li>
                    <li><NavLink to="/chat-history" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>채팅내역 리스트</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 게시판관리 */}
              <li>
                <button onClick={() => toggle('board')} className={groupBtnCls('board')}>
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">게시판관리</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.board ? 'rotate-180' : ''}`} />
                </button>
                {open.board && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/search-keywords" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>인기검색어 관리</NavLink></li>
                    <li><NavLink to="/search-popular" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>인기검색어 순위</NavLink></li>
                    <li><NavLink to="/faqs" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>FAQ 관리</NavLink></li>
                    <li><NavLink to="/notices" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>공지사항 관리</NavLink></li>
                    <li><NavLink to="/events" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>이벤트 관리</NavLink></li>
                    <li><NavLink to="/post-reports" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>게시판 신고 관리</NavLink></li>
                    <li><NavLink to="/posts-overview" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>글·댓글 현황</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 알림 */}
              <li>
                <button onClick={() => toggle('notification')} className={groupBtnCls('notification')}>
                  <Bell className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">알림</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.notification ? 'rotate-180' : ''}`} />
                </button>
                {open.notification && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/push-notifications" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>푸시 알림</NavLink></li>
                    <li><NavLink to="/push-guide" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>📱 푸시 가이드</NavLink></li>
                    <li><NavLink to="/alert-guide" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>🔔 알림 가이드</NavLink></li>
                    <li><NavLink to="/alimtalk-bulk" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>⭐ 알림톡 발송</NavLink></li>
                    <li><NavLink to="/alimtalk-templates" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>알림톡 템플릿</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 통계 */}
              <li>
                <NavLink to="/stats" className={({ isActive }) => `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`}>
                  <BarChart3 className="w-4 h-4 flex-shrink-0" />
                  <span>통계</span>
                </NavLink>
              </li>

              {/* 권한관리 */}
              <li>
                <button onClick={() => toggle('permission')} className={groupBtnCls('permission')}>
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">권한관리</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.permission ? 'rotate-180' : ''}`} />
                </button>
                {open.permission && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/admin-users" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>관리자 계정</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 기타 — 배너/팝업/사주메인 (CS 문의류는 상담관리로 이동: 2026-05-19) */}
              <li>
                <button onClick={() => toggle('misc')} className={groupBtnCls('misc')}>
                  <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">기타</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.misc ? 'rotate-180' : ''}`} />
                </button>
                {open.misc && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/banners" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>배너관리</NavLink></li>
                    <li><NavLink to="/popup-layers" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>팝업레이어 관리</NavLink></li>
                    <li><NavLink to="/saju-config" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>사주메인관리</NavLink></li>
                  </ul>
                )}
              </li>

              {/* 환경설정 */}
              <li>
                <button onClick={() => toggle('config')} className={groupBtnCls('config')}>
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">환경설정</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open.config ? 'rotate-180' : ''}`} />
                </button>
                {open.config && (
                  <ul className="flex flex-col gap-0 mt-0 pl-6">
                    <li><NavLink to="/settings" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>기본환경설정</NavLink></li>
                    <li><NavLink to="/contents" className={({ isActive }) => `menu-dropdown-item ${isActive ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'}`}>내용 관리 (약관/처리방침)</NavLink></li>
                  </ul>
                )}
              </li>
            </ul>
          </div>

          {/* [2026-05-24] 순이익 시뮬레이터 — 슈퍼관리자 전용 단독 메뉴 */}
          {isSuper && (
            <div className="mt-1">
              <ul className="flex flex-col gap-0">
                <li>
                  <NavLink
                    to="/profit-simulator"
                    className={({ isActive }) =>
                      `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`
                    }
                  >
                    <TrendingUp className="w-4 h-4 flex-shrink-0 text-[#ec4899]" />
                    <span className="text-[#ec4899] font-medium">💰 영업이익 시뮬레이터</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/infra-info"
                    className={({ isActive }) =>
                      `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`
                    }
                  >
                    <Lock className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span className="text-rose-500 font-medium">🔒 인프라 잠금 정보</span>
                  </NavLink>
                </li>
              </ul>
            </div>
          )}

          {/* 메모장 — 환경설정/설정 그룹 바깥 단독 메뉴 (사이드바 가장 아래) */}
          <div className="mt-1">
            <ul className="flex flex-col gap-0">
              <li>
                <NavLink
                  to="/memo"
                  className={({ isActive }) =>
                    `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`
                  }
                >
                  <NotebookPen className="w-4 h-4 flex-shrink-0" />
                  <span>메모장</span>
                </NavLink>
              </li>
              {/* [2026-05-30] 운영 바이블 — 채팅·결제 핵심 정책 + 자연어 질문 검색 */}
              <li>
                <NavLink
                  to="/handbook"
                  className={({ isActive }) =>
                    `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`
                  }
                >
                  <BookOpen className="w-4 h-4 flex-shrink-0 text-pink-500" />
                  <span className="text-pink-600 font-medium">📖 운영 바이블</span>
                </NavLink>
              </li>
              {/* [2026-05-31] 운영 바이블 AI (Phase 2-A) — Claude API 기반 자연어 답변 */}
              <li>
                <NavLink
                  to="/handbook-ai"
                  className={({ isActive }) =>
                    `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'}`
                  }
                >
                  <Bot className="w-4 h-4 flex-shrink-0 text-pink-500" />
                  <span className="text-pink-600 font-medium">🤖 운영 바이블 AI</span>
                </NavLink>
              </li>
              {/* 슈퍼 전용 — API 키 설정 */}
              {isSuper && (
                <li>
                  <NavLink
                    to="/handbook-config"
                    className={({ isActive }) =>
                      `menu-item ${isActive ? 'menu-item-active' : 'menu-item-inactive'} ml-2`
                    }
                  >
                    <Settings className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                    <span className="text-[12px] text-gray-500">└ AI 설정 (슈퍼)</span>
                  </NavLink>
                </li>
              )}
            </ul>
          </div>

          <div className="mt-1">
            <h3 className="mb-1 text-[9px] font-semibold uppercase leading-3 text-gray-400 dark:text-gray-500">설정</h3>
            <ul className="flex flex-col gap-0">
              <li>
                <NavLink to="/login" className="menu-item menu-item-inactive">
                  <LogOut className="w-4 h-4 flex-shrink-0" />
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
