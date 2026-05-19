import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Users, CreditCard, Headphones, FileText, Bell, BarChart3, Shield,
  MoreHorizontal, Settings as SettingsIcon, Ticket, Search, Star, X,
} from 'lucide-react'

/**
 * 전체 메뉴 — 관리자 페이지의 모든 기능을 한 화면에 나열한 인덱스.
 *
 *  - 평소: 메인 페이지 링크만 깔끔하게 노출
 *  - 검색어 입력 시: 매칭된 메인 메뉴 + 매칭된 sub-feature (탭/섹션) 평탄화 노출
 *    예) "등급단가" → "기본환경설정 > 등급/단가 > 단가 정책" 위치 즉시 파악
 *  - 즐겨찾기 (localStorage): 자주 쓰는 메뉴 상단 고정
 *
 * 메뉴 데이터는 Sidebar.tsx 와 동기화 필요 — 라우트 추가 시 양쪽 모두 업데이트.
 * subFeatures 는 각 페이지의 탭/섹션/필터 라벨을 모은 것. 클릭 시 메인 페이지로 이동
 * (자동 탭 활성화는 각 페이지에 hash/query 핸들러를 붙여야 가능 — 추후 점진 적용).
 */

type SubFeature = string | { label: string; tab?: string }

function subLabel(s: SubFeature): string {
  return typeof s === 'string' ? s : s.label
}
function subTab(s: SubFeature): string | undefined {
  return typeof s === 'string' ? undefined : s.tab
}

interface MenuItem {
  label: string
  path: string
  star?: boolean
  subFeatures?: SubFeature[]
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
      { label: '고객 리스트', path: '/members/customers',
        subFeatures: ['전체', '활동 회원', '차단 회원', '탈퇴 회원'] },
      { label: '상담사 리스트', path: '/members/counselors',
        subFeatures: ['상태: 상담가능', '상태: 상담중', '상태: 부재', '분야: 타로', '분야: 신점', '분야: 사주', '분야: 심리'] },
      { label: '상담사 신청 내역', path: '/members/counselor-apply' },
      { label: '출석 관리', path: '/attendance', star: true,
        subFeatures: [
          { label: '정책 설정', tab: '정책' },
          { label: '통계', tab: '통계' },
          { label: '회원별 이력', tab: '회원별 이력' },
          '회원/상담사 토글',
        ] },
      { label: '등급 관리', path: '/grade', star: true,
        subFeatures: ['등급별 분포', '최근 등급 변동', '정책 변경 이력'] },
    ],
  },
  {
    title: '매출현황',
    icon: CreditCard,
    items: [
      { label: '사용(상담) 내역', path: '/consultations',
        subFeatures: ['전체목록', '060', '070', '채팅'] },
      { label: '환불 이력', path: '/refunds', star: true,
        subFeatures: ['회원 아이디 검색', '상태별 필터'] },
      { label: '운영 KPI', path: '/ops-kpi', star: true,
        subFeatures: ['최근 7일', '최근 30일', '최근 90일', 'KPI 카드', '상담사 순위'] },
      { label: '충전금액 설정', path: '/charge-amounts' },
      { label: '결제 내역', path: '/payments',
        subFeatures: ['전체목록', '카드', '가상결제', '카드취소'] },
      { label: '포인트 관리', path: '/points/history',
        subFeatures: ['포인트 이력', '개별회원 포인트 증감 설정'] },
      { label: '정산 이력', path: '/settlements',
        subFeatures: ['총건수', '총정산금액', '부가세', '원천세', '회선비'] },
      { label: '상담사 추천 수당 (프로모션)', path: '/referrals', star: true,
        subFeatures: ['활성 관계', '이번 달 지급대상', '지급 완료', '미지급', '월별 필터', '상태별 필터'] },
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
      { label: '알림톡 발송', path: '/alimtalk-bulk', star: true,
        subFeatures: [
          { label: '발송', tab: '발송' },
          { label: '이력', tab: '이력' },
        ] },
      { label: '알림톡 템플릿', path: '/alimtalk-templates' },
    ],
  },
  {
    title: '통계',
    icon: BarChart3,
    items: [
      { label: '통계', path: '/stats',
        subFeatures: ['일별 방문자', '일별 매출', '월별 매출', '일별 추이 기간'] },
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
      { label: '기본환경설정', path: '/settings',
        subFeatures: [
          '기본환경',
          { label: '등급/단가', tab: '등급/단가' },
          { label: '단가 옵션', tab: '등급/단가' },
          { label: '정산률', tab: '등급/단가' },
          { label: '임계값', tab: '등급/단가' },
          { label: '월 1일 락', tab: '등급/단가' },
          { label: '재산정 일자/시각', tab: '등급/단가' },
          { label: '강등 최대 단계', tab: '등급/단가' },
          { label: '운영알림', tab: '운영알림' },
          { label: '운영자 알림 활성', tab: '운영알림' },
          { label: '수신자 목록', tab: '운영알림' },
          { label: '약관/처리방침', tab: '약관/처리방침' },
        ] },
      { label: '내용 관리 (약관/처리방침)', path: '/contents' },
    ],
  },
  {
    title: '대시보드',
    icon: BarChart3,
    items: [
      { label: '대시보드', path: '/dashboard',
        subFeatures: ['14일 매출 추이', '상담사 상태', '14일 방문자 추이', 'TOP5 상담사', 'TOP5 고객', '최근 가입', '최근 게시물', '최근 포인트'] },
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
    // localStorage quota/disabled — 무시
  }
}

/**
 * sub-feature 라벨에서 페이지 텍스트 매칭용 짧은 키워드 추출.
 *   - "상태: 상담가능" → "상담가능"  (":" 뒤 값)
 *   - "기본환경 (사이트/회원가입/...)" → "기본환경"  ("(" 앞 제목)
 *   - 그 외 → 라벨 그대로
 */
function toKeyword(label: string): string {
  const trimmed = label.trim()
  if (trimmed.includes(':')) {
    const after = trimmed.split(':').slice(-1)[0].trim()
    if (after) return after
  }
  if (trimmed.includes('(')) {
    const before = trimmed.split('(')[0].trim()
    if (before) return before
  }
  return trimmed
}

function matchItem(item: MenuItem, groupTitle: string, q: string): { matched: boolean; subHits: SubFeature[] } {
  if (!q) return { matched: true, subHits: [] }
  const inLabel = item.label.toLowerCase().includes(q)
  const inGroup = groupTitle.toLowerCase().includes(q)
  const subHits = (item.subFeatures ?? []).filter((s) => subLabel(s).toLowerCase().includes(q))
  return { matched: inLabel || inGroup || subHits.length > 0, subHits }
}

export default function AllMenus() {
  // 검색어를 URL ?q=... 에 저장 — 사이드바 '전체 메뉴' 재클릭 시 자동 초기화
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const setQuery = (v: string) => {
    if (v) setSearchParams({ q: v }, { replace: true })
    else setSearchParams({}, { replace: true })
  }
  const [favs, setFavs] = useState<string[]>(() => readFavs())

  useEffect(() => {
    writeFavs(favs)
  }, [favs])

  const toggleFav = (path: string) => {
    setFavs((cur) => (cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path]))
  }

  const indexByPath = useMemo(() => {
    const m = new Map<string, { label: string; groupTitle: string }>()
    for (const g of GROUPS) for (const it of g.items) {
      m.set(it.path, { label: it.label, groupTitle: g.title })
    }
    return m
  }, [])

  const q = query.trim().toLowerCase()
  const isSearching = q.length > 0

  // 필터링 + 각 아이템에 subHits 부착
  const filteredGroups = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      items: g.items
        .map((it) => {
          const r = matchItem(it, g.title, q)
          return r.matched ? { ...it, _subHits: r.subHits } : null
        })
        .filter((x): x is MenuItem & { _subHits: string[] } => x != null),
    })).filter((g) => g.items.length > 0)
  }, [q])

  const totalSubHits = useMemo(() => {
    if (!isSearching) return 0
    return filteredGroups.reduce((s, g) => s + g.items.reduce((a, it) => a + (it as MenuItem & { _subHits: string[] })._subHits.length, 0), 0)
  }, [filteredGroups, isSearching])

  const favItems = favs
    .map((path) => {
      const info = indexByPath.get(path)
      return info ? { path, ...info } : null
    })
    .filter((x): x is { path: string; label: string; groupTitle: string } => x != null)

  return (
    <div className="space-y-3">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">전체 메뉴</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          모든 관리자 기능을 한눈에. 페이지 내부 탭/섹션까지 펼쳐서 노출. 검색으로 위치 즉시 확인 가능.
        </p>
      </div>

      {/* 검색 박스 */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 단가, 통계, 정산률, 환불, 알림수신자..."
          className="w-full h-9 pl-9 pr-9 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          autoFocus
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

      {/* 검색 결과 요약 */}
      {isSearching && (
        <div className="text-xs text-gray-500">
          검색 결과: 메뉴 {filteredGroups.reduce((s, g) => s + g.items.length, 0)}개
          {totalSubHits > 0 && ` · 페이지 내부 항목 ${totalSubHits}개`}
        </div>
      )}

      {/* 즐겨찾기 (검색어 없을 때만) */}
      {!isSearching && favItems.length > 0 && (
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

      {/* 격자 + 카드별 정확한 row-span 으로 빈 공간 흡수 (콘텐츠 길이 기반 픽셀 계산) */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 grid-flow-dense"
        style={{ gridAutoRows: '8px' }}
      >
        {filteredGroups.map((g) => {
          const Icon = g.icon
          // 콘텐츠 길이 → 카드 픽셀 높이 추정 → row-span 계산
          // padding(20) + header(36) + 각 메인 라벨(28px) + 각 sub 라벨(20px) + 카드 간 sub 사이 여유(8)
          const subsCount = g.items.reduce((s, it) => s + ((it as MenuItem & { _subHits?: string[] })._subHits?.length ?? it.subFeatures?.length ?? 0), 0)
          const itemsCount = g.items.length
          // 검색 시 subHits 기준, 평소엔 전체 subFeatures
          const subsForCalc = isSearching
            ? g.items.reduce((s, it) => s + ((it as MenuItem & { _subHits: string[] })._subHits.length), 0)
            : subsCount
          const subFinal = isSearching ? subsForCalc : g.items.reduce((s, it) => s + (it.subFeatures?.length ?? 0), 0)
          const heightPx = 20 + 36 + itemsCount * 28 + subFinal * 20 + 8
          const rowSpan = Math.max(1, Math.ceil((heightPx + 8) / (8 + 8)))
          return (
            <section
              key={g.title}
              style={{ gridRow: `span ${rowSpan}` }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-2.5"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <Icon className="w-4 h-4 text-violet-600" />
                {g.title}
                <span className="text-[10px] text-gray-400 ml-auto">{g.items.length}</span>
              </h2>
              <ul className="flex flex-col">
                {g.items.map((it) => {
                  const subHits = (it as MenuItem & { _subHits: string[] })._subHits ?? []
                  const isFav = favs.includes(it.path)
                  return (
                    <li key={it.path} className="group">
                      <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20">
                        <Link to={it.path} className="flex-1 text-sm text-gray-700 dark:text-gray-200 hover:text-violet-700 dark:hover:text-violet-300">
                          {it.star && <span className="text-amber-500 mr-1">⭐</span>}
                          <span dangerouslySetInnerHTML={{ __html: highlight(it.label, q) }} />
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

                      {/* 페이지 내부 탭/섹션 — 평소에도 항상 노출 (검색 시 매칭 강조) */}
                      {(it.subFeatures?.length ?? 0) > 0 && (
                        <ul className="ml-5 mt-0.5 mb-1 border-l border-violet-100 dark:border-violet-900/40 pl-2 space-y-0.5">
                          {(isSearching ? subHits : it.subFeatures!).map((s) => {
                            const lab = subLabel(s)
                            const tab = subTab(s)
                            const kw = toKeyword(lab)
                            const params = new URLSearchParams()
                            params.set('hl', kw)
                            if (tab) params.set('tab', tab)
                            const to = `${it.path}?${params.toString()}`
                            return (
                              <li key={lab}>
                                <Link
                                  to={to}
                                  className="block text-[11px] text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-300"
                                >
                                  <span className="text-violet-300 mr-1">›</span>
                                  <span dangerouslySetInnerHTML={{ __html: highlight(lab, q) }} />
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
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
          "{query}" 검색 결과 없음. 다른 단어로 시도해 보세요.
        </div>
      )}
    </div>
  )
}

/** 매칭된 부분 <mark> 강조. q 가 비어 있으면 escape 만 한 결과 반환. */
function highlight(text: string, q: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!q) return esc(text)
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return esc(text)
  return esc(text.slice(0, idx)) + '<mark class="bg-amber-100 dark:bg-amber-900/40 text-inherit px-0.5 rounded">' + esc(text.slice(idx, idx + q.length)) + '</mark>' + esc(text.slice(idx + q.length))
}
