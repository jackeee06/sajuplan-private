import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Users, CreditCard, Headphones, FileText, Bell, BarChart3, Shield,
  MoreHorizontal, Settings as SettingsIcon, Ticket, Search, Star, X,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

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
  /** 검색용 별칭 (한글 동의어·약칭·관련 키워드). 예: 소셜로그인 → ['카톡 키', '카카오 API'] */
  aliases?: string[]
  /** true 면 슈퍼관리자(is_super=true)에게만 노출. 일반 admin 검색/리스트에 안 잡힘. */
  superOnly?: boolean
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
        aliases: ['회원', '유저', '사용자', '닉네임', '휴대폰', '전화번호', '이메일', '차단', '블랙', '탈퇴', '활동 회원'],
        subFeatures: ['전체', '활동 회원', '차단 회원', '탈퇴 회원'] },
      { label: '상담사 리스트', path: '/members/counselors',
        aliases: ['강사', '선생님', '상담원', '해시태그', '태그', '프로필', '한줄소개', '헤드라인', '닉네임', '단가', '분야', '사주', '타로', '신점', '심리', '사진', '이미지'],
        subFeatures: ['상태: 상담가능', '상태: 상담중', '상태: 부재', '분야: 타로', '분야: 신점', '분야: 사주', '분야: 심리'] },
      { label: '상담사 신청 내역', path: '/members/counselor-apply',
        aliases: ['지원', '신청', '가입 신청', '승인', '심사', '신청서', '대기', '반려'] },
      { label: '출석 관리', path: '/attendance', star: true,
        aliases: ['출석', '체크인', '출석체크', '보너스 포인트', '일일 출석'],
        subFeatures: [
          { label: '정책 설정', tab: '정책' },
          { label: '통계', tab: '통계' },
          { label: '회원별 이력', tab: '회원별 이력' },
          '회원/상담사 토글',
        ] },
      { label: '등급 관리', path: '/grade', star: true,
        aliases: ['등급', '단가', '정산률', '승급', '강등'],
        subFeatures: [
          '등급별 분포',
          '단가·정산률 변경',
          '재산정 D-day',
          '최근 등급 변동',
          '정책 변경 이력',
        ] },
    ],
  },
  {
    title: '매출현황',
    icon: CreditCard,
    items: [
      { label: '사용(상담) 내역', path: '/consultations',
        aliases: ['통화', '상담 내역', '전화 내역'],
        subFeatures: ['전체목록', '060', '070', '채팅'] },
      { label: '환불 이력', path: '/refunds', star: true,
        aliases: ['취소', '환급', '환불 신청', '환불 요청', '리펀드'],
        subFeatures: ['회원 아이디 검색', '상태별 필터'] },
      { label: '고객보호비용 내역', path: '/short-call-refunds', star: true,
        aliases: ['매몰비용', '30초 미만', '짧은 통화', '환원', '자동 환원', '단기 통화'],
        subFeatures: ['이번달 합계', '발생일 필터', '회원 매핑', 'callid·csrid·membid'] },
      { label: '운영 KPI', path: '/ops-kpi', star: true,
        aliases: ['지표', '실적', '성과', '매출 지표'],
        subFeatures: ['최근 7일', '최근 30일', '최근 90일', 'KPI 카드', '상담사 순위'] },
      { label: '충전금액 설정', path: '/charge-amounts',
        aliases: ['코인 충전', '충전 금액', '결제 옵션'] },
      { label: '결제 내역', path: '/payments',
        aliases: ['주문', '구매', '카드 결제', '가상계좌'],
        subFeatures: ['전체목록', '카드', '가상결제', '카드취소'] },
      { label: '포인트 관리', path: '/points/history',
        aliases: ['포인트', '코인', '잔액', '잔액 조정', '지급', '차감', '증감'],
        subFeatures: ['포인트 이력', '개별회원 포인트 증감 설정'] },
      { label: '정산 이력', path: '/settlements',
        aliases: ['정산', '부가세', 'VAT', '회선비', '원천세', '월정산', '월별 정산'],
        subFeatures: ['총건수', '총정산금액', '부가세', '원천세', '회선비'] },
      { label: '선지급 관리', path: '/payouts', star: true,
        aliases: ['선지급', '가불', '미리 지급', '수수료', '원천세'],
        subFeatures: [
          '처리 대기',
          '오늘 지급',
          '이번달 누적',
          '24h+ 미처리',
          { label: '대기 CSV 다운로드', tab: 'pending' },
          '선지급 운영 정책',
        ] },
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
      { label: '🔔 알림 가이드 (3채널 통합)', path: '/alert-guide', star: true,
        aliases: ['알림 가이드', '알림 매트릭스', '알림 정책', '알림 정리', '채널', '푸시 인앱 알림톡', '결정', '중복', '카탈로그', '온보딩', '신입 관리자'],
        subFeatures: [
          '38개 이벤트 × 3채널 매트릭스',
          '결정완료/검토중 표시',
          '중복 위험 행 강조',
          '결정 기준 8가지',
          '읽는 법 안내',
        ] },
      { label: '📱 푸시 가이드 (카드)', path: '/push-guide',
        aliases: ['푸시 가이드', '푸시 카탈로그', '푸시 종류', 'FCM 종류', 'push catalog'],
        subFeatures: ['30+ 푸시 종류', '카테고리별 그리드', '상태 칩 (완료/예정/안함)'] },
      { label: '푸시 알림 (발송)', path: '/push-notifications',
        aliases: ['푸시', '앱 알림', '앱 푸시', '푸시 발송', '푸시 이력', 'FCM 발송'],
        subFeatures: ['발송', '이력 조회', '카테고리 필터'] },
      { label: '알림톡 발송', path: '/alimtalk-bulk', star: true,
        aliases: ['카톡', '카카오톡', '문자', '메시지', 'SMS', '비즈엠'],
        subFeatures: [
          { label: '발송', tab: '발송' },
          { label: '이력', tab: '이력' },
        ] },
      { label: '알림톡 템플릿', path: '/alimtalk-templates',
        aliases: ['템플릿', '카톡 양식', '메시지 양식', '비즈엠', 'BizM', 'v1', 'v2', '카톡 본문'] },
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
      { label: '관리자 계정', path: '/admin-users',
        aliases: ['어드민', '권한', '하위 관리자', '운영자'] },
    ],
  },
  {
    title: '기타',
    icon: MoreHorizontal,
    items: [
      { label: '배너관리', path: '/banners',
        aliases: ['배너', '광고', '메인 배너'] },
      { label: '팝업레이어 관리', path: '/popup-layers',
        aliases: ['팝업', '레이어', '공지 팝업'] },
{ label: '상담문의', path: '/posts/qa',
        aliases: ['1:1 문의', '고객 문의', '문의 게시판', '고객센터'] },
      { label: '1:1문의(상담사)', path: '/posts/qa_counselor' },
    ],
  },
  {
    title: '환경설정',
    icon: SettingsIcon,
    items: [
      { label: '기본환경설정', path: '/settings',
        aliases: [
          '카톡 키', '카카오 키', '네이버 키', '소셜 키', 'API 키',
          '회사 정보', '사업자번호', '대표', '주소',
          '회원가입 포인트', '추천인 포인트',
          '스팸', '차단', '금지', 'IP',
          '세금', '원천', '수수료',
          // 2026-05-28 점검 안내 배너 추가
          '점검', '점검 안내', '점검 배너', '서비스 점검', 'maintenance',
        ],
        subFeatures: [
          // ─ 점검 안내 배너 (NEW 2026-05-28) — Settings.tsx ?tab=general
          { label: '🔧 점검 안내 배너', tab: 'general' },
          { label: '배너 활성 ON/OFF', tab: 'general' },
          // ─ 기본환경 탭 (6 섹션) — Settings.tsx ?tab=general (디폴트)
          '사이트',
          { label: '회원가입', tab: 'general' },
          { label: '후기 포인트', tab: 'general' },
          { label: '소셜로그인 (카카오/네이버)', tab: 'general' },
          { label: '보안 (IP 차단/금지 ID)', tab: 'general' },
          { label: '푸터(회사정보)', tab: 'general' },
          // ─ 등급/단가 탭
          { label: '등급/단가', tab: 'grade' },
          { label: '단가 옵션', tab: 'grade' },
          { label: '정산률', tab: 'grade' },
          { label: '임계값', tab: 'grade' },
          { label: '월 1일 락', tab: 'grade' },
          { label: '재산정 일자/시각', tab: 'grade' },
          { label: '강등 최대 단계', tab: 'grade' },
          // ─ 선지급 탭 (NEW)
          { label: '선지급 정책 안내문', tab: 'payout' },
          { label: '선지급 수수료율', tab: 'payout' },
          { label: '선지급 원천세율', tab: 'payout' },
          // ─ 운영알림 탭
          { label: '운영알림', tab: 'ops' },
          { label: '운영자 알림 활성', tab: 'ops' },
          { label: '수신자 목록', tab: 'ops' },
          // ─ 약관/처리방침 탭
          { label: '약관/처리방침', tab: 'legal' },
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
  {
    title: '운영 도구',
    icon: Wrench,
    items: [
      // 2026-05-22: 어제 신설 메모장 등록 (사이드바 단독 → AllMenus 누락 보강)
      { label: '메모장', path: '/memo',
        aliases: ['노트', '기록', '필기', '비망록', '메모'] },
      // 2026-05-24: 영업이익 시뮬레이터 — 슈퍼 전용. 일반 admin 에게는 메뉴 자체 비노출.
      { label: '💰 영업이익 시뮬레이터', path: '/profit-simulator', star: true, superOnly: true,
        aliases: ['수익', '재무', '이익', '시뮬레이션', '시뮬', '손익', '마진'] },
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
  const inAlias = (item.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  const subHits = (item.subFeatures ?? []).filter((s) => subLabel(s).toLowerCase().includes(q))
  return { matched: inLabel || inGroup || inAlias || subHits.length > 0, subHits }
}

export default function AllMenus() {
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super
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

  // 필터링 + 각 아이템에 subHits 부착. superOnly 메뉴는 슈퍼관리자에게만.
  const filteredGroups = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      items: g.items
        .filter((it) => !it.superOnly || isSuper)
        .map((it) => {
          const r = matchItem(it, g.title, q)
          return r.matched ? { ...it, _subHits: r.subHits } : null
        })
        .filter((x): x is MenuItem & { _subHits: string[] } => x != null),
    })).filter((g) => g.items.length > 0)
  }, [q, isSuper])

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
    <div className="space-y-3 max-w-[1400px]">
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

      {/* ── 쿠폰 정책 안내 ── */}
      {!isSearching && <CouponPolicyGuide />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// 쿠폰 정책 안내 컴포넌트
// ─────────────────────────────────────────────────────────
function CouponPolicyGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/40 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <Ticket className="w-4 h-4" />
          쿠폰 정책 안내 — 관리자 필독
        </span>
        <span className="text-amber-600 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm text-gray-700 dark:text-gray-300 border-t border-amber-200 dark:border-amber-800/40 pt-4">

          {/* 1. 쿠폰 종류 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">1. 쿠폰 종류</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-violet-700 dark:text-violet-300 mb-1">다운로드 쿠폰</p>
                <p className="text-xs text-gray-500 leading-relaxed">코드 없이 관리자가 특정 회원에게 직접 발급하는 방식. 회원가입 쿠폰이 이 방식입니다. 회원이 마이페이지에서 "사용" 버튼을 눌러야 코인으로 전환됩니다.</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-violet-700 dark:text-violet-300 mb-1">코드입력 쿠폰</p>
                <p className="text-xs text-gray-500 leading-relaxed">SNS 이벤트, 제휴, 프로모션에서 쿠폰 코드를 배포하고 회원이 직접 입력하는 방식. 코드 형식: XXXX-XXXX-XXXX-XXXX (자동 생성).</p>
              </div>
            </div>
          </section>

          {/* 2. 회원가입 쿠폰 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">2. 회원가입 쿠폰 (자동 발급)</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 신규 회원 가입 완료 시 <strong>자동으로</strong> 쿠폰을 지급합니다. 관리자 조작 불필요.</p>
              <p>• <strong>현재 설정: 5,000코인 / 유효기간 7일</strong> — 변경하려면 쿠폰존 관리에서 "회원가입 쿠폰" 행을 클릭해 수정.</p>
              <p>• 가입 후 알림톡(coupon_signup_v1)으로 회원에게 자동 발송됩니다.</p>
              <p>• 중복 발급 방지: 같은 회원에게 2번 발급되지 않습니다.</p>
              <p className="text-amber-600">⚠ 발급 건수는 쿠폰존 목록의 "다운로드" 숫자로 확인하세요.</p>
            </div>
          </section>

          {/* 3. 쿠폰 사용 흐름 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">3. 쿠폰 → 코인 전환 흐름</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed">
              <div className="flex flex-wrap items-center gap-2 text-center">
                {['가입/코드 입력', '→', '마이페이지 쿠폰 목록에 표시', '→', '"사용" 버튼 클릭', '→', '코인 즉시 충전'].map((s) => (
                  <span key={s} className={s === '→' ? 'text-gray-400' : 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-2 py-1 rounded'}>
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-amber-600">⚠ 쿠폰을 받아도 "사용" 버튼을 누르지 않으면 코인이 충전되지 않습니다. 유효기간이 지나면 자동 소멸.</p>
            </div>
          </section>

          {/* 4. 쿠폰존(캠페인) 관리 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">4. 쿠폰존(캠페인) 만들기</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 쿠폰존 관리 페이지 → <strong>새 쿠폰존 추가</strong> 버튼.</p>
              <p>• 쿠폰 이름(캠페인명) / 지급 코인 / 유효기간(일수) / 사용 기간 설정.</p>
              <p>• 코드입력 쿠폰: 코드가 자동 생성됩니다. 이 코드를 SNS에 배포하면 입력한 사람에게 지급.</p>
              <p>• 다운로드 쿠폰: 발급할 회원을 직접 선택 → 저장하면 즉시 발급.</p>
              <p className="text-amber-600">⚠ 쿠폰존을 삭제하면 해당 캠페인으로 발급된 쿠폰 이력도 사라집니다. 신중하게.</p>
            </div>
          </section>

          {/* 5. 알림톡 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">5. 알림톡 현황</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• <strong>coupon_signup_v1</strong> (회원가입 쿠폰 안내) — BizM 검수 신청 완료. 승인 후 자동 발송.</p>
              <p>• <strong>coupon_req_v2</strong> (일반 쿠폰 발급 안내) — BizM 반려 상태. 추후 별도 템플릿으로 재신청 예정.</p>
              <p className="text-amber-600">⚠ 알림톡이 승인 전이면 쿠폰을 줘도 회원이 모를 수 있습니다. BizM 포털에서 승인 상태를 주기적으로 확인하세요.</p>
            </div>
          </section>

          {/* 6. 통계 확인 */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">6. 발급/사용 통계 확인</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-xs leading-relaxed space-y-1">
              <p>• 쿠폰존 목록: 쿠폰존별 <strong>발급 수(다운로드)</strong> 확인.</p>
              <p>• 쿠폰존 클릭 → 발급 대상 회원 목록 확인 가능.</p>
              <p>• 전체 쿠폰 발급/사용 이력: 쿠폰 목록 메뉴에서 회원별로 검색.</p>
            </div>
          </section>

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
