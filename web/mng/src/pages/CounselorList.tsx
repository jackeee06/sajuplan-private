import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, BookOpen, ChevronDown, ChevronRight, Save, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import {
  Th,
  Td,
  Tr,
  IdCell,
  TableShell,
  THead,
  TBody,
  EmptyRow,
  Chip,
  NumCell,
  Badge,
  BadgeColor,
  PaginationBar,
  ResultCount,
  inputCls,
  num,
  fmtDate,
  fmtPhone,
  secsToMin,
} from '../components/table'

interface Counselor {
  id: number
  mb_id: string | null
  name: string
  nickname: string
  phone: string | null
  csrid: string | null
  dtmfno: string | null
  telno: string | null
  counselor_category: string | null
  counselor_priority: number | null
  call_070_unit_cost: number | null
  call_060_unit_cost: number | null
  chat_unit_cost: number | null
  paid_royalty_pct: number | null
  level: number
  point: number
  earning_balance: number
  state: string
  is_rising: boolean
  created_at: string
  total_consult: string
  total_usetm: string
  this_month_070: string
  this_month_060: string
  last_month_070: string
  last_month_060: string
  // 2026-05-25: 빠른 필터 + 정렬용 신규 필드
  updated_at?: string
  last_login_at?: string | null
  use_phone?: boolean
  use_chat?: boolean
  has_profile?: boolean
  has_hashtag?: boolean
  has_profile_image?: boolean
  event_active?: boolean
  refund_30d_count?: number
}

// 등급 매핑 — sample/grade_basic 기준
const GRADE_OPTIONS = [
  { key: 'prepartner', label: '예비', match: ['예비파트너', '예비'] },
  { key: 'partner1',   label: '파트너1', match: ['파트너1', 'partner1'] },
  { key: 'partner2',   label: '파트너2', match: ['파트너2', 'partner2'] },
  { key: 'partner3',   label: '파트너3', match: ['파트너3', 'partner3'] },
  { key: 'partner4',   label: '파트너4', match: ['파트너4', 'partner4'] },
  { key: 'partner5',   label: '파트너5', match: ['파트너5', 'partner5'] },
] as const

// 빠른 필터 (활동 시그널) — 10가지
type QuickFilter =
  | 'top_sales' | 'no_activity' | 'new_30d' | 'incomplete' | 'dormant'
  | 'event' | 'high_refund' | 'available_now' | 'grade5' | 'over_100'

const QUICK_FILTERS: { key: QuickFilter; label: string; icon: string; tone: string; tip: string }[] = [
  { key: 'top_sales',     label: '매출 TOP',   icon: '💰', tone: 'amber',  tip: '이번달 매출 상위 10명만 노출 (정렬 후 잘라냄)' },
  { key: 'no_activity',   label: '활동 0',     icon: '🚫', tone: 'gray',   tip: '누적 상담 0건 — 활성화 권유 / 정리 검토 대상' },
  { key: 'new_30d',       label: '신규 30d',   icon: '🆕', tone: 'blue',   tip: '가입 후 30일 이내 신규 상담사 — 적응 점검' },
  { key: 'incomplete',    label: '데이터 미완', icon: '❗', tone: 'red',    tip: 'csrid · 프로필사진 · 해시태그 · 단가 중 하나라도 누락 — 운영 사고 예방' },
  { key: 'dormant',       label: '휴면',       icon: '⚠️', tone: 'orange', tip: '최근 30일+ 미접속 (updated_at 기준) — 연락/리텐션 검토' },
  { key: 'event',         label: '이벤트',     icon: '✨', tone: 'purple', tip: '현재 이벤트 진행 중 (post_counselor.event_starts_at)' },
  { key: 'high_refund',   label: '환불↑',      icon: '🔴', tone: 'red',    tip: '최근 30일 환불 3건 이상 — 민원/위험 신호' },
  { key: 'available_now', label: '지금 가능',  icon: '🟢', tone: 'green',  tip: '지금 상담 가능 (state IDLE/RDCH/RDVC/CRDY + 전화·채팅 채널 ON)' },
  { key: 'grade5',        label: '5등급',      icon: '⭐', tone: 'amber',  tip: 'level = 5 — 최상위 파트너 등급' },
  { key: 'over_100',      label: '100만+',     icon: '📞', tone: 'green',  tip: '이번달 매출 100만원 이상' },
]

// 매출 임계값 드롭다운 옵션 (만원 단위)
const SALES_THRESHOLD_OPTIONS = [
  { value: '',     label: '전체' },
  { value: '50',   label: '50만원 이상' },
  { value: '100',  label: '100만원 이상' },
  { value: '200',  label: '200만원 이상' },
  { value: '300',  label: '300만원 이상' },
  { value: '500',  label: '500만원 이상' },
  { value: '1000', label: '1,000만원 이상' },
] as const

interface Resp {
  items: Counselor[]
  total: number
  summary: { total: number; idle: number; busy: number; absent: number }
  by_category: Record<string, number>
}

interface Filter {
  q: string
  fr_date: string
  to_date: string
  state: string
  category: string
  page: number
}

const PAGE_SIZE = Number(import.meta.env.VITE_LIST_PAGE_SIZE ?? 10)

/**
 * 사주플랜 앱(사용자 화면) 상담사 리스트 정렬 정책.
 *
 * ⚠️ 코드와 동기화 필수:
 *   - 정렬 로직: [api/src/user/counselors/counselors.service.ts] settingCounselorListSort
 *   - 자동 복구: 같은 파일의 'CNCH/CONN stuck 자동 복구' 블록
 *   - 이벤트 상담사: post_counselor.event_starts_at/ends_at + EventCounselorSlide
 *   정책 변경 시 코드 + 이 본문 같이 수정.
 */
const SORT_POLICY = `▶ 사주플랜 앱 상담사 리스트 정렬 정책

[1순위] 실시간 상담중 (state = CONN 전화통화 / CNCH 채팅) + 최근 5분 활성
  → 페이지 최상단 노출
  → 이유: 신뢰 마케팅 — "활발히 운영중인 곳" 인상 (소셜 프루프)
  → 5분 넘은 통화는 stuck 으로 판단 → 자동 IDLE 복귀 (운영자 수동 개입 불필요)

[2순위] 그 외 활성 상담사 (IDLE / RDCH / RDVC / CRDY)
  → updated_at(최근 접속) 순
  → 자주 접속 = 활동적 = 상단

[3순위] 부재(ABSE) / 휴직(RESV) / 탈퇴
  → 리스트에서 제외 (사용자 화면 X)

▶ 탭별 필터링
  · [전체]   state IN (IDLE / RDCH / RDVC / CRDY / CONN / CNCH)
            AND (use_phone = true OR use_chat = true)
  · [채팅]   전화통화중(CONN) 제외 — 채팅 즉시 응대 불가하므로
  · [신규]   가입 90일 이내 + 부재(ABSE)까지 노출 (가입 직후 활동 유도)
  · [단골]   회원이 좋아요 누른 상담사만

▶ 강제 노출 기능 (관리자 화면 — 정렬과 별개)
  · [이벤트 상담사 등록] (어드민 > 상담사 상세 > 이벤트 기간 설정)
       → event_starts_at ~ event_ends_at 기간 동안 메인 화면 배너에 슬라이드 노출
       → 리스트 정렬은 영향 X — 메인 배너 강조 방식
       → 종료 시각 지나면 자동으로 배너에서 제외
  · [노출 제어] use_phone = false AND use_chat = false → 리스트 자체에서 제외
  · [등급/단가] 정렬에 영향 X — 카드 표시값만 결정

▶ 자동 안전망
  · m2net 콜백 지연으로 stuck 된 CONN / CNCH 상담사
    → 리스트 조회 시점에 자동으로 IDLE / RDCH / RDVC / ABSE 로 복구
    → use_phone / use_chat 조합으로 ready state 결정
    → 운영자 수동 개입 불필요

▶ "현재 N명 실시간 상담중" 카운터 (현재 미적용)
  → 초기 활성 상담사 적으면 오히려 역효과 우려로 보류
  → 추후 안정적 운영 시 페이지 상단에 추가 예정
`

const CATEGORIES = ['타로', '신점', '사주', '심리'] as const

// 분야별 데이터 셀(Badge) 색
const CATEGORY_BADGE: Record<string, BadgeColor> = {
  타로: 'indigo',
  신점: 'rose',
  사주: 'amber',
  심리: 'teal',
}
// 분야별 칩 dot 색 (active 시는 모두 brand 보라 / 비활성 시 카테고리 색을 좌측 점으로)
const CATEGORY_DOT: Record<string, 'indigo' | 'rose' | 'amber' | 'teal'> = {
  타로: 'indigo',
  신점: 'rose',
  사주: 'amber',
  심리: 'teal',
}

const STATE_LABELS: Record<string, { label: string; color: BadgeColor }> = {
  IDLE: { label: '상담대기', color: 'emerald' },
  RDCH: { label: '채팅대기', color: 'emerald' },
  RDVC: { label: '예약대기', color: 'emerald' },
  CRDY: { label: '준비', color: 'emerald' },
  CONN: { label: '상담중', color: 'amber' },
  CNCH: { label: '채팅중', color: 'amber' },
  RESV: { label: '예약중', color: 'amber' },
  ABSE: { label: '부재중', color: 'gray' },
}

export default function CounselorList() {
  const navigate = useNavigate()
  const [policyOpen, setPolicyOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>({
    q: '',
    fr_date: '',
    to_date: '',
    state: '',
    category: '',
    page: 1,
  })
  const [pending, setPending] = useState<Pick<Filter, 'q' | 'fr_date' | 'to_date'>>({
    q: '',
    fr_date: '',
    to_date: '',
  })
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 2026-05-25: 빠른 필터 + 등급 + 매출 임계값 + 정렬 (모두 클라이언트 처리)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(new Set())
  const [minSalesMan, setMinSalesMan] = useState<string>('') // 만원 단위, '' 면 미적용
  const [sortBy, setSortBy] = useState<'priority' | 'sales' | 'created' | 'updated'>('priority')

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    if (filter.state) params.set('state', filter.state)
    if (filter.category) params.set('category', filter.category)
    // 빠른 필터 사용 위해 한 번에 다 받음 (클라이언트 필터/정렬)
    params.set('page', '1')
    params.set('limit', '300')

    setLoading(true)
    api<Resp>(`/admin/members/counselors?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filter])

  // ─────────────────────────────────────────────
  // 클라이언트 필터링 + 정렬 — useMemo 로 캐시
  // ─────────────────────────────────────────────
  const allItems = data?.items ?? []

  // 등급별 카운트 (전체 데이터 기준)
  const gradeCounts = useMemo(() => {
    const map: Record<string, number> = { prepartner: 0, partner1: 0, partner2: 0, partner3: 0, partner4: 0, partner5: 0 }
    for (const c of allItems) {
      const lvl = c.level
      // level 매핑 (정확한 매핑은 grade 정책에 따라 다름; 일반: 1~5 + 예비)
      if (lvl === 5) map.partner5++
      else if (lvl === 4) map.partner4++
      else if (lvl === 3) map.partner3++
      else if (lvl === 2) map.partner2++
      else if (lvl === 1) map.partner1++
      else map.prepartner++  // 그 외 = 예비 (구체 level 값은 grade 정책에 의존)
    }
    return map
  }, [allItems])

  const gradeMatches = (c: Counselor, key: string): boolean => {
    const lvl = c.level
    switch (key) {
      case 'partner5': return lvl === 5
      case 'partner4': return lvl === 4
      case 'partner3': return lvl === 3
      case 'partner2': return lvl === 2
      case 'partner1': return lvl === 1
      case 'prepartner': return lvl !== 1 && lvl !== 2 && lvl !== 3 && lvl !== 4 && lvl !== 5
      default: return true
    }
  }

  const monthSalesOf = (c: Counselor): number =>
    Number(c.this_month_070 ?? 0) + Number(c.this_month_060 ?? 0)

  // 빠른 필터별 카운트 (전체 데이터 기준)
  const quickCounts = useMemo(() => {
    const m: Record<QuickFilter, number> = {
      top_sales: 0, no_activity: 0, new_30d: 0, incomplete: 0, dormant: 0,
      event: 0, high_refund: 0, available_now: 0, grade5: 0, over_100: 0,
    }
    const now = Date.now()
    const D30 = 30 * 86400_000
    // top_sales 는 항상 상위 10명 → 카운트 = min(10, 데이터 길이) 의미라 표시 X
    m.top_sales = Math.min(10, allItems.length)
    for (const c of allItems) {
      const sales = monthSalesOf(c)
      const consults = Number(c.total_consult ?? 0)
      const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0
      const updatedMs = c.updated_at ? new Date(c.updated_at).getTime() : 0
      if (consults === 0) m.no_activity++
      if (createdMs && now - createdMs < D30) m.new_30d++
      if (!c.csrid || !c.has_profile_image || !c.has_hashtag || (c.call_070_unit_cost ?? 0) === 0) m.incomplete++
      if (updatedMs && now - updatedMs > D30) m.dormant++
      if (c.event_active) m.event++
      const refund = c.refund_30d_count ?? 0
      if (refund >= 3) m.high_refund++
      const activeState = ['IDLE', 'RDCH', 'RDVC', 'CRDY'].includes(c.state)
      if (activeState && (c.use_phone || c.use_chat)) m.available_now++
      if (c.level === 5) m.grade5++
      if (sales >= 1_000_000) m.over_100++
    }
    return m
  }, [allItems])

  // 필터링 + 정렬 적용
  const filteredSortedItems = useMemo(() => {
    const now = Date.now()
    const D30 = 30 * 86400_000
    const minSalesWon = (Number(minSalesMan) || 0) * 10_000

    let arr = allItems.slice()
    // 등급 필터
    if (selectedGrade) arr = arr.filter((c) => gradeMatches(c, selectedGrade))
    // 매출 임계값
    if (minSalesWon > 0) arr = arr.filter((c) => monthSalesOf(c) >= minSalesWon)
    // 빠른 필터 (다중 조합 — AND)
    if (quickFilters.size > 0) {
      arr = arr.filter((c) => {
        for (const q of quickFilters) {
          const sales = monthSalesOf(c)
          const consults = Number(c.total_consult ?? 0)
          const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0
          const updatedMs = c.updated_at ? new Date(c.updated_at).getTime() : 0
          switch (q) {
            case 'top_sales': /* 상위 10명만 노출 — 정렬 후 잘림 처리, 여기선 통과 */ break
            case 'no_activity': if (consults !== 0) return false; break
            case 'new_30d': if (!createdMs || now - createdMs >= D30) return false; break
            case 'incomplete':
              if (c.csrid && c.has_profile_image && c.has_hashtag && (c.call_070_unit_cost ?? 0) > 0) return false
              break
            case 'dormant': if (!updatedMs || now - updatedMs <= D30) return false; break
            case 'event': if (!c.event_active) return false; break
            case 'high_refund': if ((c.refund_30d_count ?? 0) < 3) return false; break
            case 'available_now': {
              const ok = ['IDLE', 'RDCH', 'RDVC', 'CRDY'].includes(c.state) && (c.use_phone || c.use_chat)
              if (!ok) return false
              break
            }
            case 'grade5': if (c.level !== 5) return false; break
            case 'over_100': if (sales < 1_000_000) return false; break
          }
        }
        return true
      })
    }

    // 정렬
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'sales': return monthSalesOf(b) - monthSalesOf(a)
        case 'created': return (b.created_at ?? '').localeCompare(a.created_at ?? '')
        case 'updated': return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
        default: { // priority
          const pa = a.counselor_priority ?? 9999
          const pb = b.counselor_priority ?? 9999
          if (pa !== pb) return pa - pb
          return (b.created_at ?? '').localeCompare(a.created_at ?? '')
        }
      }
    })

    // top_sales 빠른필터 단독으로 켜져있으면 상위 10명만
    if (quickFilters.has('top_sales')) arr = arr.slice(0, 10)
    return arr
  }, [allItems, selectedGrade, quickFilters, minSalesMan, sortBy])

  // 페이지네이션 (클라이언트)
  const pagedItems = useMemo(() => {
    const start = (filter.page - 1) * PAGE_SIZE
    return filteredSortedItems.slice(start, start + PAGE_SIZE)
  }, [filteredSortedItems, filter.page])

  const toggleQuick = (q: QuickFilter) => {
    setQuickFilters((prev) => {
      const next = new Set(prev)
      if (next.has(q)) next.delete(q)
      else next.add(q)
      return next
    })
    setFilter((f) => ({ ...f, page: 1 }))
  }

  const onSearch = () => setFilter((f) => ({ ...f, ...pending, page: 1 }))
  const onReset = () => {
    setPending({ q: '', fr_date: '', to_date: '' })
    setFilter({ q: '', fr_date: '', to_date: '', state: '', category: '', page: 1 })
  }

  // 클라이언트 필터 적용된 총 건수 기반 페이지 수
  const totalPages = Math.max(1, Math.ceil(filteredSortedItems.length / PAGE_SIZE))

  return (
    <div className="space-y-3">
      {/* 페이지 타이틀 + 정렬정책 토글 + 추가 버튼 + 메인 통계 디폴트 (2026-05-25) */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">상담사 리스트</h1>
          <button
            type="button"
            onClick={() => setPolicyOpen((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium border transition ${
              policyOpen
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
            }`}
            title="사주플랜 앱 상담사 리스트 정렬 정책 — 헷갈리면 펼쳐서 확인"
          >
            <BookOpen className="w-3.5 h-3.5" />
            사주플랜 상담사 정렬정책
            {policyOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <Link
            to="/members/counselors/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium"
          >
            <Plus className="w-4 h-4" />
            상담사 추가
          </Link>
          {/* 메인 페이지 통계 디폴트값 — 실제값과 합산되어 노출. 마케팅 목적 (초기 활기) */}
          <MainStatsDefaults />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">상담사 회원(role=counselor) 현황</p>
      </div>

      {/* 정렬 정책 본문 — 펼친 상태일 때만 노출. 코드 동기화 필수 (상수 SORT_POLICY 참고). */}
      {policyOpen && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-2 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 text-[12px]">
            <span className="text-blue-800 dark:text-blue-300 font-medium">📖 사주플랜 앱 상담사 리스트 정렬 정책</span>
            <span className="text-blue-600/70 dark:text-blue-300/70">정책 변경 시 코드 + 본문 같이 수정 필요</span>
          </div>
          <div className="px-5 py-4">
            <pre className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans">{SORT_POLICY}</pre>
          </div>
        </div>
      )}

      {/* 2026-05-25 통합 필터 — 단일 선택 5개 드롭다운 + 활동 시그널 칩 2줄로 정돈 */}
      {data && (
        <>
          {/* 줄 1: 드롭다운 5개 + 매출 직접입력 + 요약 박스 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5" title="상담사 활동 상태">
              <span className="text-gray-500">상태</span>
              <select
                value={filter.state}
                onChange={(e) => setFilter((f) => ({ ...f, state: e.target.value, page: 1 }))}
                className="text-[12px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="">전체 ({data.summary.total}명)</option>
                <option value="IDLE">🟢 상담가능 ({data.summary.idle}명)</option>
                <option value="CONN">🟡 상담중 ({data.summary.busy}명)</option>
                <option value="ABSE">⚪ 부재 ({data.summary.absent}명)</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5" title="상담 분야">
              <span className="text-gray-500">분야</span>
              <select
                value={filter.category}
                onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value, page: 1 }))}
                className="text-[12px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="">전체 ({data.summary.total}명)</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c} ({data.by_category[c] ?? 0}명)</option>
                ))}
                {data.by_category['미지정'] ? (
                  <option value="미지정">미지정 ({data.by_category['미지정']}명)</option>
                ) : null}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5" title="상담사 등급 — level 컬럼 기반 (예비 / 파트너1 ~ 5)">
              <span className="text-gray-500">등급</span>
              <select
                value={selectedGrade ?? ''}
                onChange={(e) => { setSelectedGrade(e.target.value || null); setFilter((f) => ({ ...f, page: 1 })) }}
                className="text-[12px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="">전체 ({allItems.length}명)</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.key} value={g.key}>{g.label} ({gradeCounts[g.key]}명)</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5" title="이번달 매출(070+060) 임계값">
              <span className="text-gray-500">매출</span>
              <select
                value={SALES_THRESHOLD_OPTIONS.some((o) => o.value === minSalesMan) ? minSalesMan : 'custom'}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'custom') return
                  setMinSalesMan(v)
                  setFilter((f) => ({ ...f, page: 1 }))
                }}
                className="text-[12px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                {SALES_THRESHOLD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                <option value="custom">직접 입력 ▾</option>
              </select>
              <input
                type="number"
                min={0}
                value={minSalesMan}
                onChange={(e) => { setMinSalesMan(e.target.value); setFilter((f) => ({ ...f, page: 1 })) }}
                placeholder="0"
                className="w-16 text-[12px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right"
                title="임의의 매출 임계값 직접 입력 (만원 단위)"
              />
              <span className="text-gray-400">만원+</span>
            </label>
            <label className="inline-flex items-center gap-1.5" title="정렬 기준">
              <span className="text-gray-500">정렬</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-[12px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="priority">우선순위(기본)</option>
                <option value="sales">이번달 매출순</option>
                <option value="created">가입순</option>
                <option value="updated">최근 접속순</option>
              </select>
            </label>
            {/* 요약 박스 — 같은 줄 끝에 */}
            <div className="inline-flex items-center gap-3 px-3 py-1 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
              <span>조회 <strong className="text-brand-600">{filteredSortedItems.length}</strong>명</span>
              <span>매출 합 <strong className="text-amber-600">
                {filteredSortedItems.reduce((sum, c) => sum + monthSalesOf(c), 0).toLocaleString()}원
              </strong></span>
              <span>평균 <strong>{filteredSortedItems.length === 0 ? 0 :
                Math.round(filteredSortedItems.reduce((s, c) => s + monthSalesOf(c), 0) / filteredSortedItems.length).toLocaleString()
              }원</strong></span>
            </div>
          </div>

          {/* 줄 2: 활동 시그널 칩 (다중 선택 — AND 조합) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500 mr-1" title="여러 개 동시 선택 가능 — AND 조건으로 조합">활동</span>
            {QUICK_FILTERS.map((q) => {
              const active = quickFilters.has(q.key)
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => toggleQuick(q.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-full border transition ${
                    active
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                  }`}
                  title={q.tip}
                >
                  <span>{q.icon}</span>
                  <span>{q.label}</span>
                  <span className={`text-[11px] ${active ? 'text-white/90' : 'text-gray-400'}`}>
                    {quickCounts[q.key]}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[260px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">검색</label>
            <input
              type="text"
              value={pending.q}
              onChange={(e) => setPending((p) => ({ ...p, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="아이디 / 이름 / 닉네임 / 휴대폰"
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">가입 시작</label>
            <input
              type="date"
              value={pending.fr_date}
              onChange={(e) => setPending((p) => ({ ...p, fr_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">가입 종료</label>
            <input
              type="date"
              value={pending.to_date}
              onChange={(e) => setPending((p) => ({ ...p, to_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onSearch}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
            <button
              onClick={onReset}
              className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {/* 결과 카운트 */}
      {data && !loading && <ResultCount total={data.total} unit="명" />}

      {/* 표 */}
      <TableShell minWidth="min-w-[1800px]">
        <THead>
          <Th align="right">번호</Th>
          <Th align="left">가입일</Th>
          <Th align="left">아이디</Th>
          <Th align="left">이름</Th>
          <Th align="left">닉네임</Th>
          <Th align="left">분야</Th>
          <Th align="left">휴대폰</Th>
          <Th align="left">상담사번호</Th>
          <Th align="left">m2net</Th>
          <Th align="left">070번호</Th>
          <Th align="right">단가(070)</Th>
          <Th align="right">단가(060)</Th>
          <Th align="right">채팅</Th>
          <Th align="right">로열티</Th>
          <Th align="right">우선순위</Th>
          <Th align="right">누적상담</Th>
          <Th align="right">누적시간</Th>
          <Th align="right">이번달(070)</Th>
          <Th align="right">이번달(060)</Th>
          <Th align="right">지난달(070)</Th>
          <Th align="right">지난달(060)</Th>
          <Th align="right">수익포인트</Th>
          <Th align="right">소비포인트</Th>
          <Th align="center">상태</Th>
          <Th align="center">급상승</Th>
        </THead>
        <TBody>
          {loading ? (
            <EmptyRow colSpan={25} loading />
          ) : !data || pagedItems.length === 0 ? (
            <EmptyRow colSpan={25} />
          ) : (
            pagedItems.map((c) => (
              <Tr key={c.id} onClick={() => navigate(`/members/counselors/${c.id}`)}>
                <IdCell id={c.id} />
                <Td align="left" className="text-xs text-gray-500 tabular-nums">
                  {fmtDate(c.created_at, { withTime: false })}
                </Td>
                <Td align="left">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{c.mb_id ?? '-'}</div>
                </Td>
                <Td align="left">{c.name}</Td>
                <Td align="left" className="text-gray-600">{c.nickname}</Td>
                <Td align="left">
                  {c.counselor_category ? (
                    <Badge color={CATEGORY_BADGE[c.counselor_category] ?? 'gray'}>
                      {c.counselor_category}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {fmtPhone(c.phone)}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {c.dtmfno ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {c.csrid ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="left" className="font-mono text-xs text-gray-600">
                  {fmtPhone(c.telno)}
                </Td>
                <Td align="right"><NumCell value={c.call_070_unit_cost} /></Td>
                <Td align="right"><NumCell value={c.call_060_unit_cost} /></Td>
                <Td align="right"><NumCell value={c.chat_unit_cost} /></Td>
                <Td align="right" className="text-xs tabular-nums text-gray-600">
                  {c.paid_royalty_pct !== null ? `${c.paid_royalty_pct}%` : <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right" className="text-xs tabular-nums text-gray-600">
                  {c.counselor_priority ?? <span className="text-gray-300">-</span>}
                </Td>
                <Td align="right"><NumCell value={c.total_consult} /></Td>
                <Td align="right" className="text-xs tabular-nums text-gray-600">
                  {secsToMin(c.total_usetm)}
                </Td>
                <Td align="right"><NumCell value={c.this_month_070} /></Td>
                <Td align="right"><NumCell value={c.this_month_060} /></Td>
                <Td align="right"><NumCell value={c.last_month_070} /></Td>
                <Td align="right"><NumCell value={c.last_month_060} /></Td>
                <Td align="right"><NumCell value={c.earning_balance} bold /></Td>
                <Td align="right" className="text-xs tabular-nums text-gray-500"><NumCell value={c.point} /></Td>
                <Td align="center"><StateBadge state={c.state} /></Td>
                <Td align="center">{c.is_rising ? <Badge color="rose">급상승</Badge> : <span className="text-gray-300">-</span>}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </TableShell>

      {data && (
        <PaginationBar
          page={filter.page}
          totalPages={totalPages}
          total={data.total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setFilter((f) => ({ ...f, page: p }))}
          unit="명"
        />
      )}
    </div>
  )
}

function StateBadge({ state }: { state: string }) {
  const meta = STATE_LABELS[state] ?? { label: state || '-', color: 'gray' as BadgeColor }
  return <Badge color={meta.color}>{meta.label}</Badge>
}

/**
 * 메인 페이지 통계 카드 디폴트값 — 2026-05-25 신설.
 *  - setting.site.stat_recent_consultations_override
 *  - setting.site.stat_online_counselors_override
 *  실제 사용자 메인에는 (디폴트 + 실제 자동집계) 합산 노출.
 *  초기 마케팅 목적 — 운영자가 수시로 디폴트값 조정.
 */
function MainStatsDefaults() {
  const [recent, setRecent] = useState<string>('')
  const [online, setOnline] = useState<string>('')
  const [hours, setHours] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ data: Record<string, string> }>('/admin/settings/site')
      .then((r) => {
        if (!alive) return
        setRecent(r.data['stat_recent_consultations_override'] ?? '')
        setOnline(r.data['stat_online_counselors_override'] ?? '')
        setHours(r.data['stat_recent_hours_window'] ?? '')
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          site: {
            stat_recent_consultations_override: String(Number(recent) || 0),
            stat_online_counselors_override: String(Number(online) || 0),
            stat_recent_hours_window: String(Number(hours) || 0),
          },
        }),
      })
      setSavedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const justSaved = savedAt && Date.now() - savedAt.getTime() < 3000

  return (
    <div className="inline-flex items-center gap-2 flex-wrap px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
      <TrendingUp className="w-4 h-4 text-amber-600" />
      <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap" title="실제 자동집계 + 이 값이 메인 카드에 노출됩니다">
        최근 상담건수 및 현재 접속중인 상담사
      </span>
      <span className="text-[18px] font-extrabold text-amber-600 leading-none px-0.5" title="실제 자동집계와 합산됩니다">+</span>
      <label className="inline-flex items-center gap-1">
        <span className="text-[11px] text-gray-500">최근 상담건수</span>
        <input
          type="number"
          min={0}
          value={recent}
          disabled={loading || saving}
          onChange={(e) => setRecent(e.target.value)}
          className="w-16 text-[12px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="0"
        />
      </label>
      <label className="inline-flex items-center gap-1" title="자동집계 기간 — 메인 '최근 상담건수' 의 집계 시간(시간 단위). 미입력 시 24시간.">
        <span className="text-[11px] text-gray-500">집계기간</span>
        <input
          type="number"
          min={1}
          max={720}
          value={hours}
          disabled={loading || saving}
          onChange={(e) => setHours(e.target.value)}
          className="w-14 text-[12px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="24"
        />
        <span className="text-[11px] text-gray-500">시간</span>
      </label>
      <label className="inline-flex items-center gap-1">
        <span className="text-[11px] text-gray-500">현재 접속중인 상담사</span>
        <input
          type="number"
          min={0}
          value={online}
          disabled={loading || saving}
          onChange={(e) => setOnline(e.target.value)}
          className="w-16 text-[12px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="0"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={loading || saving}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium"
      >
        <Save className="w-3 h-3" />
        {saving ? '저장 중' : '저장'}
      </button>
      {justSaved && <span className="text-[11px] text-green-600">✓ 저장됨</span>}
      {error && <span className="text-[11px] text-red-500" title={error}>⚠ 실패</span>}
    </div>
  )
}
