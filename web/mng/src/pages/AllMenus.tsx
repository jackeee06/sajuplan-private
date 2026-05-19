import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, CreditCard, Headphones, FileText, Bell, BarChart3, Shield,
  MoreHorizontal, Settings as SettingsIcon, Ticket, Search, Star, X,
} from 'lucide-react'

/**
 * 전체 메뉴 — 관리자 페이지의 모든 기능을 한 화면에 나열한 인덱스.
 *
 *  - 상단 검색 박스: 메뉴명/카테고리 실시간 필터링
 *  - 즐겨찾기 섹션 (localStorage 기반): 자주 쓰는 메뉴 상단 고정
 *  - 카테고리별 카드 그리드: 사이드바 그룹과 동일한 분류로 메인 페이지 링크 나열
 *
 * 메뉴 데이터는 Sidebar.tsx 와 동기화 필요 — 라우트 추가 시 양쪽 모두 업데이트.
 */

interface MenuItem {
  label: string
  path: string
  star?: boolean // ⭐ 표시
}

interface MenuGroup {
  title: string
  icon: typeof Users
  items: MenuItem[]
}

const GROUPS: MenuGroup[] = [
  {
    title: '회원현황',
    icon: Users,
    items: [
      { label: '고객 리스트', path: '/members/customers' },
      { label: '상담사 리스트', path: '/members/counselors' },
      { label: '상담사 신청 내역', path: '/members/counselor-apply' },
      { label: '출석 관리', path: '/attendance', star: true },
      { label: '등급 관리', path: '/grade', star: true },
    ],
  },
  {
    title: '매출현황',
    icon: CreditCard,
    items: [
      { label: '사용(상담) 내역', path: '/consultations' },
      { label: '환불 이력', path: '/refunds', star: true },
      { label: '운영 KPI', path: '/ops-kpi', star: true },
      { label: '충전금액 설정', path: '/charge-amounts' },
      { label: '결제 내역', path: '/payments' },
      { label: '포인트 관리', path: '/points/history' },
      { label: '정산 이력', path: '/settlements' },
      { label: '추천 수당', path: '/referrals', star: true },
    ],
  },
  {
    title: '쿠폰',
    icon: Ticket,
    items: [
      { label: '쿠폰존 관리', path: '/coupon-zones' },
    ],
  },
  {
    title: '상담관리',
    icon: Headphones,
    items: [
      { label: '상담후기 관리', path: '/posts/review' },
      { label: '후기 신고 관리', path: '/review-reports' },
      { label: '채팅내역 리스트', path: '/chat-history' },
    ],
  },
  {
    title: '게시판관리',
    icon: FileText,
    items: [
      { label: '인기검색어 관리', path: '/search-keywords' },
      { label: '인기검색어 순위', path: '/search-popular' },
      { label: 'FAQ 관리', path: '/faqs' },
      { label: '공지사항 관리', path: '/notices' },
      { label: '이벤트 관리', path: '/events' },
      { label: '게시판 신고 관리', path: '/post-reports' },
      { label: '글·댓글 현황', path: '/posts-overview' },
    ],
  },
  {
    title: '알림',
    icon: Bell,
    items: [
      { label: '푸시 알림', path: '/push-notifications' },
      { label: '알림톡 발송', path: '/alimtalk-bulk', star: true },
      { label: '알림톡 템플릿', path: '/alimtalk-templates' },
    ],
  },
  {
    title: '통계',
    icon: BarChart3,
    items: [
      { label: '통계', path: '/stats' },
    ],
  },
  {
    title: '권한관리',
    icon: Shield,
    items: [
      { label: '관리자 계정', path: '/admin-users' },
    ],
  },
  {
    title: '기타',
    icon: MoreHorizontal,
    items: [
      { label: '배너관리', path: '/banners' },
      { label: '팝업레이어 관리', path: '/popup-layers' },
      { label: '사주메인관리', path: '/saju-config' },
      { label: '상담문의', path: '/posts/qa' },
      { label: '1:1문의(상담사)', path: '/posts/qa_counselor' },
    ],
  },
  {
    title: '환경설정',
    icon: SettingsIcon,
    items: [
      { label: '기본환경설정', path: '/settings' },
      { label: '내용 관리 (약관/처리방침)', path: '/contents' },
    ],
  },
]

const FAV_KEY = 'mng_favorite_menus'

function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeFavs(paths: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(paths))
  } catch {
    // localStorage quota 또는 disabled 시 무시
  }
}

export default function AllMenus() {
  const [query, setQuery] = useState('')
  const [favs, setFavs] = useState<string[]>(() => readFavs())

  useEffect(() => {
    writeFavs(favs)
  }, [favs])

  const toggleFav = (path: string) => {
    setFavs((cur) => (cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path]))
  }

  // path → {label, groupTitle} 인덱스 (즐겨찾기 표시용)
  const indexByPath = useMemo(() => {
    const m = new Map<string, { label: string; groupTitle: string }>()
    for (const g of GROUPS) for (const it of g.items) {
      m.set(it.path, { label: it.label, groupTitle: g.title })
    }
    return m
  }, [])

  // 검색 필터링
  const q = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!q) return GROUPS
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => it.label.toLowerCase().includes(q) || g.title.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0)
  }, [q])

  const favItems = favs
    .map((path) => {
      const info = indexByPath.get(path)
      return info ? { path, ...info } : null
    })
    .filter((x): x is { path: string; label: string; groupTitle: string } => x != null)

  return (
    <div className="space-y-5">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">전체 메뉴</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          모든 관리자 기능을 한눈에. 검색하거나 별표(★)로 즐겨찾기에 추가하세요.
        </p>
      </div>

      {/* 검색 박스 */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="메뉴명·카테고리로 검색..."
          className="w-full h-9 pl-9 pr-9 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="검색어 지우기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 즐겨찾기 (검색어 없을 때만) */}
      {!q && favItems.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> 즐겨찾기
          </h2>
          <div className="flex flex-wrap gap-2">
            {favItems.map((it) => (
              <Link
                key={it.path}
                to={it.path}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded border border-violet-200 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:border-violet-800 dark:hover:bg-violet-900/30 text-sm text-violet-700 dark:text-violet-300"
              >
                <span>{it.label}</span>
                <span className="text-[10px] text-gray-400">{it.groupTitle}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleFav(it.path)
                  }}
                  className="ml-1 text-amber-400 hover:text-amber-500"
                  aria-label="즐겨찾기 해제"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                </button>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 카테고리 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredGroups.map((g) => {
          const Icon = g.icon
          return (
            <section
              key={g.title}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <Icon className="w-4 h-4 text-violet-600" />
                {g.title}
                <span className="text-[10px] text-gray-400 ml-auto">{g.items.length}</span>
              </h2>
              <ul className="flex flex-col">
                {g.items.map((it) => {
                  const isFav = favs.includes(it.path)
                  return (
                    <li key={it.path} className="group">
                      <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20">
                        <Link to={it.path} className="flex-1 text-sm text-gray-700 dark:text-gray-200 hover:text-violet-700 dark:hover:text-violet-300">
                          {it.star && <span className="text-amber-500 mr-1">⭐</span>}
                          {it.label}
                        </Link>
                        <button
                          onClick={() => toggleFav(it.path)}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity ${isFav ? 'opacity-100' : ''}`}
                          aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isFav ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-amber-400'
                            }`}
                          />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">
          "{query}" 검색 결과 없음.
        </div>
      )}
    </div>
  )
}
