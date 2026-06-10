import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
  Legend,
} from 'recharts'
import { Wallet, AlertTriangle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * 대시보드 — 한 화면 안에 핵심 정보 압축.
 *
 *   Row 1: KPI 8개 한 줄
 *   Row 2: 즉시 액션 필요 알림 (0건이면 자동 숨김)
 *   Row 3: 매출 14일 + 상담사 상태 + 방문자 14일 (3 컬럼)
 *   Row 4: TOP5 상담사 금액 / 건수 / 고객 (3 컬럼)
 *   Row 5: 최근 가입 / 최근 게시물 / 최근 포인트 (3 컬럼)
 *
 * 모든 KPI 카드 + Top5 + 차트 카드 클릭 시 상세 페이지 이동.
 */

interface Summary {
  members: { total: number; today: number; this_month: number }
  counselors: { total: number; idle: number; busy: number; absent: number; today_active?: number }
  balance?: { free: number; paid: number; earning: number; consume_total: number; earning_total: number; total: number }
}
interface SalesPoint {
  date: string
  call_070: number
  call_060: number
  chat: number
  charge: number
}
interface ConsultationPoint {
  date: string
  call_070: number
  call_060: number
  chat: number
}
interface TopRow {
  id: number
  name: string
  nickname: string
  total: number
  count: number
}
interface RecentMember {
  id: number
  name: string
  nickname: string
  mb_id: string | null
  role: string
  created_at: string | Date
}
interface RecentPoint {
  id: number
  member_name: string | null
  mb_id: string | null
  content: string | null
  earn_point: number
  use_point: number
  balance_after: number
  created_at: string | Date
}
interface RecentPost {
  id: number
  title: string
  author: string | null
  board: string
  created_at: string | Date
}
interface AlertItem {
  key: string
  label: string
  count: number
  to: string
  tone: 'rose' | 'amber'
}
interface CounselorPanel {
  today_active: Array<{ id: number; mb_id: string | null; nickname: string | null; count: number }>
  inactive_7d: Array<{ id: number; mb_id: string | null; nickname: string | null; last_at: string | null }>
  unreplied_reviews: Array<{ id: number; rating: number; content_preview: string; counselor_id: number; counselor_nickname: string | null; created_at: string }>
}
interface QualityKpi {
  avg_rating: number
  low_rating_count: number
  total_reviews: number
}
interface ShortCallRefundKpi {
  this_month_count: number
  this_month_amount: number
  prev_month_count: number
  prev_month_amount: number
  total_count: number
  total_amount: number
}
interface DashboardData {
  summary: Summary
  sales: SalesPoint[]
  consultations: ConsultationPoint[]
  topByAmount: TopRow[]
  topByCount: TopRow[]
  topCustomers: TopRow[]
  recentMembers: RecentMember[]
  recentPoints: RecentPoint[]
  recentPosts: RecentPost[]
  alerts: AlertItem[]
  counselorPanel: CounselorPanel
  quality: QualityKpi
  shortCallRefund: ShortCallRefundKpi
}

async function fetchDashboardData(): Promise<DashboardData> {
  const emptyPanel: CounselorPanel = { today_active: [], inactive_7d: [], unreplied_reviews: [] }
  const emptyQuality: QualityKpi = { avg_rating: 0, low_rating_count: 0, total_reviews: 0 }
  const emptyShortCallRefund: ShortCallRefundKpi = {
    this_month_count: 0, this_month_amount: 0,
    prev_month_count: 0, prev_month_amount: 0,
    total_count: 0, total_amount: 0,
  }
  const [summary, sales, consultations, topByAmount, topByCount, topCustomers, recentMembers, recentPoints, recentPosts, alerts, counselorPanel, quality, shortCallRefund] =
    await Promise.all([
      api<Summary>('/admin/dashboard/summary'),
      api<SalesPoint[]>('/admin/dashboard/sales-trend?days=14'),
      api<ConsultationPoint[]>('/admin/dashboard/consultation-trend?days=14').catch(() => [] as ConsultationPoint[]),
      api<TopRow[]>('/admin/dashboard/top-counselors?metric=amount'),
      api<TopRow[]>('/admin/dashboard/top-counselors?metric=count'),
      api<TopRow[]>('/admin/dashboard/top-customers'),
      api<RecentMember[]>('/admin/dashboard/recent-members'),
      api<RecentPoint[]>('/admin/dashboard/recent-points'),
      api<RecentPost[]>('/admin/dashboard/recent-posts'),
      api<AlertItem[]>('/admin/dashboard/alerts').catch(() => [] as AlertItem[]),
      api<CounselorPanel>('/admin/dashboard/counselor-panel').catch(() => emptyPanel),
      api<QualityKpi>('/admin/dashboard/quality-kpi').catch(() => emptyQuality),
      api<ShortCallRefundKpi>('/admin/dashboard/short-call-refund-kpi').catch(() => emptyShortCallRefund),
    ])
  return { summary, sales, consultations, topByAmount, topByCount, topCustomers, recentMembers, recentPoints, recentPosts, alerts, counselorPanel, quality, shortCallRefund }
}

const won = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('ko-KR')
const dateShort = (d: string) => d.slice(5)

function formatRelative(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일`
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}

const boardLabel: Record<string, string> = {
  counselor: '상담사',
  review: '후기',
  qa: 'Q&A',
  notice: '공지',
}

function Card({
  title,
  to,
  children,
  className = '',
}: {
  title: string
  to?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}>
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
        {to && (
          <Link to={to} className="text-[10px] text-gray-400 hover:text-brand-600">
            더보기 ›
          </Link>
        )}
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  to,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  to?: string
  tone?: 'default' | 'brand' | 'rose' | 'emerald' | 'blue' | 'amber'
}) {
  const valueTone: Record<string, string> = {
    default: 'text-gray-900 dark:text-gray-100',
    brand: 'text-brand-600 dark:text-brand-400',
    rose: 'text-rose-600 dark:text-rose-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
  }
  const body = (
    <>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{label}</div>
      <div className={`text-base font-bold tabular-nums leading-tight mt-0.5 ${valueTone[tone]}`}>{value}</div>
      {sub && <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{sub}</div>}
    </>
  )
  const baseCls =
    'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5'
  if (to) {
    return (
      <Link to={to} className={`${baseCls} block hover:border-brand-300 hover:shadow-sm transition`}>
        {body}
      </Link>
    )
  }
  return <div className={baseCls}>{body}</div>
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchDashboardData()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300 w-fit max-w-full">
        대시보드 데이터를 불러오지 못했습니다: {error}
      </div>
    )
  }

  if (!data) return <Skeleton />

  const {
    summary,
    sales,
    consultations,
    topByAmount,
    topByCount,
    topCustomers,
    recentMembers,
    recentPoints,
    recentPosts,
    alerts,
    counselorPanel,
    quality,
    shortCallRefund,
  } = data

  const sumDay = (p?: SalesPoint) => (p ? p.call_070 + p.call_060 + p.chat + p.charge : 0)
  const todayTotal = sumDay(sales[sales.length - 1])
  const yesterdayTotal = sumDay(sales[sales.length - 2])
  const deltaPct = yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : null

  // 이번달 매출 누적 = sales 배열 중 이번달 데이터 합
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTotal = sales.reduce((s, p) => (p.date.startsWith(monthKey) ? s + sumDay(p) : s), 0)

  const counselorPie = [
    { name: '상담 가능', value: summary.counselors.idle, color: '#10b981' },
    { name: '상담 중', value: summary.counselors.busy, color: '#3b82f6' },
    { name: '부재', value: summary.counselors.absent, color: '#9ca3af' },
  ]

  return (
    <div className="space-y-2.5 max-w-[1500px]">
      {/* 타이틀 */}
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">대시보드</h1>
        <span className="text-[11px] text-gray-400">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {/* Row 1 — KPI 10개 한 줄 */}
      <div className="overflow-x-auto">
      <div className="grid grid-cols-10 gap-1.5 min-w-[900px]">
        <Kpi
          label="오늘 매출"
          value={won.format(todayTotal)}
          sub={deltaPct != null ? `어제 대비 ${deltaPct >= 0 ? '+' : ''}${deltaPct}%` : '—'}
          tone="brand"
          to="/stats"
        />
        <Kpi label="어제 매출" value={won.format(yesterdayTotal)} to="/stats" />
        <Kpi label="이번달 매출 누적" value={won.format(monthTotal)} tone="brand" to="/stats" />
        <Kpi label="진행 중 상담" value={`${num.format(summary.counselors.busy)}건`} tone="blue" to="/consultations" />
        <Kpi
          label="활성 상담사"
          value={`${num.format(summary.counselors.idle)}명`}
          sub={`전체 ${num.format(summary.counselors.total)}명`}
          tone="emerald"
          to="/members/counselors"
        />
        <Kpi label="오늘 가입" value={num.format(summary.members.today)} tone="amber" to="/members/customers" />
        <Kpi
          label="오늘 출석 상담사"
          value={`${num.format(summary.counselors.today_active ?? 0)}명`}
          sub={`전체 ${num.format(summary.counselors.total)}명`}
          tone="emerald"
          to="/members/counselors"
        />
        <Kpi
          label="포인트 부채 합"
          value={won.format(summary.balance?.total ?? 0)}
          sub={`소비 ${won.format(summary.balance?.consume_total ?? 0)} · 수익 ${won.format(summary.balance?.earning_total ?? 0)}`}
          tone="rose"
          to="/points/history"
        />
        <Kpi
          label="평균 별점(30일)"
          value={quality.avg_rating > 0 ? `★ ${quality.avg_rating.toFixed(2)}` : '—'}
          sub={`낮은 별점 ${quality.low_rating_count}건 / 전체 ${quality.total_reviews}`}
          tone={quality.avg_rating === 0 ? 'default' : quality.avg_rating >= 4.5 ? 'emerald' : quality.avg_rating >= 4 ? 'amber' : 'rose'}
          to="/posts/review"
        />
        <Kpi
          label="고객보호비용(이번달)"
          value={won.format(shortCallRefund.this_month_amount)}
          sub={`30초 미만 자동 환원 · ${shortCallRefund.this_month_count}건 · 누적 ${won.format(shortCallRefund.total_amount)} / ${shortCallRefund.total_count}건`}
          tone={shortCallRefund.this_month_amount === 0 ? 'default' : 'amber'}
          to="/short-call-refunds"
        />
      </div>
      </div>

      {/* Row 2 — 알림 큐 (항상 표시, 0건은 회색 / 폰트·색 강화 7차) */}
      {alerts.length > 0 && (() => {
        const hasActive = alerts.some((a) => a.count > 0)
        return (
          <div className={`rounded-lg border p-3 ${
            hasActive
              ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
          }`}>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <AlertTriangle
                className={`w-4 h-4 flex-shrink-0 ${
                  hasActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
                }`}
              />
              <span className={`text-xs font-bold whitespace-nowrap ${
                hasActive
                  ? 'text-amber-800 dark:text-amber-200'
                  : 'text-gray-600 dark:text-gray-300'
              }`}>
                {hasActive ? '즉시 처리 필요' : '알림 현황'}
              </span>
              <div className="flex gap-1.5 ml-1">
                {alerts.map((a) => {
                  const isActive = a.count > 0
                  const colorCls = !isActive
                    ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-400'
                    : a.tone === 'rose'
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-800'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-800'
                  return (
                    <Link
                      key={a.key}
                      to={a.to}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap ${colorCls}`}
                    >
                      {a.label}
                      <span className="tabular-nums font-bold">{a.count}</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Row 3 — 매출 / 상담사 상태 / 방문자 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card title="14일 매출 추이" to="/stats">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="g070" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g060" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gchat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gchg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                <XAxis dataKey="date" tickFormatter={dateShort} fontSize={10} stroke="#9ca3af" />
                <YAxis
                  tickFormatter={(v) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : `${Math.round(v / 1000)}K`)}
                  fontSize={10}
                  stroke="#9ca3af"
                  width={40}
                />
                <Tooltip formatter={(v: number) => won.format(v)} contentStyle={{ borderRadius: 6, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                <Area type="monotone" dataKey="call_070" name="070" stroke="#3b82f6" fill="url(#g070)" />
                <Area type="monotone" dataKey="call_060" name="060" stroke="#8b5cf6" fill="url(#g060)" />
                <Area type="monotone" dataKey="chat" name="채팅" stroke="#10b981" fill="url(#gchat)" />
                <Area type="monotone" dataKey="charge" name="충전" stroke="#f43f5e" fill="url(#gchg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="상담사 상태" to="/members/counselors">
          <div className="h-44 flex">
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={counselorPie} dataKey="value" nameKey="name" innerRadius={38} outerRadius={68} paddingAngle={2}>
                    {counselorPie.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 6, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center gap-1.5 pl-2">
              {counselorPie.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-gray-500 dark:text-gray-400">{s.name}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-100 tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="14일 상담 건수" to="/consultations">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consultations} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                <XAxis dataKey="date" tickFormatter={dateShort} fontSize={10} stroke="#9ca3af" />
                <YAxis tickFormatter={(v) => num.format(v)} fontSize={10} stroke="#9ca3af" width={28} />
                <Tooltip formatter={(v: number) => `${num.format(v)}건`} contentStyle={{ borderRadius: 6, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                <Line type="monotone" dataKey="call_070" name="070" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="call_060" name="060" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="chat" name="채팅" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 4 (신규) — 상담사 운영 패널: 오늘 활성 / 이탈 위험 / 미답변 후기 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Card title="오늘 활성 상담사 TOP5" to="/members/counselors">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {counselorPanel.today_active.length === 0 ? (
              <li className="py-2 text-xs text-gray-400">오늘 상담한 상담사 없음</li>
            ) : counselorPanel.today_active.map((c, i) => (
              <li key={c.id} className="py-1 flex items-center justify-between text-xs">
                <Link to={`/members/counselors/${c.id}`} className="flex items-center gap-1.5 min-w-0 flex-1 hover:text-brand-600">
                  <span className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {i + 1}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{c.nickname ?? c.mb_id ?? `#${c.id}`}</span>
                </Link>
                <span className="text-[11px] font-semibold tabular-nums text-emerald-600 flex-shrink-0 ml-2">{c.count}건</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="이탈 위험 (7일 0건)" to="/members/counselors">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {counselorPanel.inactive_7d.length === 0 ? (
              <li className="py-2 text-xs text-gray-400">모든 상담사 활동 중 ✓</li>
            ) : counselorPanel.inactive_7d.map((c) => (
              <li key={c.id} className="py-1 flex items-center justify-between text-xs">
                <Link to={`/members/counselors/${c.id}`} className="min-w-0 flex-1 hover:text-brand-600">
                  <span className="font-medium text-gray-800 dark:text-gray-100">{c.nickname ?? c.mb_id ?? `#${c.id}`}</span>
                  <span className="text-[10px] text-gray-400 ml-1">{c.mb_id ?? ''}</span>
                </Link>
                <span className="text-[10px] text-rose-500 tabular-nums flex-shrink-0 ml-2">
                  {c.last_at ? `${formatRelative(c.last_at)} 전` : '활동 0'}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="미답변 후기" to="/posts/review">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {counselorPanel.unreplied_reviews.length === 0 ? (
              <li className="py-2 text-xs text-gray-400">미답변 후기 없음 ✓</li>
            ) : counselorPanel.unreplied_reviews.map((r) => (
              <li key={r.id} className="py-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-500 flex-shrink-0">{'★'.repeat(r.rating)}<span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span></span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelative(r.created_at)}</span>
                </div>
                <Link to={`/members/counselors/${r.counselor_id}`} className="block text-gray-600 dark:text-gray-300 truncate hover:text-brand-600">
                  <span className="font-medium">{r.counselor_nickname ?? `#${r.counselor_id}`}</span>
                  <span className="text-gray-400 ml-1">· {r.content_preview}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Row 5 + 6 — TOP5 3개 + 최근활동 3개 → 한 줄 6컬럼 (와이드 모니터) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <TopList title="TOP5 상담사 (금액)" to="/members/counselors" rows={topByAmount} valueKey="total" valueFormat={won.format} />
        <TopList title="TOP5 상담사 (건수)" to="/members/counselors" rows={topByCount} valueKey="count" valueFormat={(v) => `${num.format(v)}건`} />
        <TopList title="TOP5 고객 (결제액)" to="/members/customers" rows={topCustomers} valueKey="total" valueFormat={won.format} />
        <Card title="최근 가입" to="/members/customers">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentMembers.slice(0, 5).map((m) => (
              <li key={m.id} className="py-1 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-gray-800 dark:text-gray-100">{m.name}</span>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-gray-500 dark:text-gray-400">{m.nickname}</span>
                  <span className="text-[10px] text-gray-400 ml-1">({roleLabel(m.role)})</span>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{formatRelative(m.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="최근 게시물" to="/posts-overview">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentPosts.slice(0, 5).map((p) => (
              <li key={`${p.board}-${p.id}`} className="py-1 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {boardLabel[p.board] ?? p.board}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{p.title}</span>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelative(p.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="최근 포인트" to="/points/history">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentPoints.slice(0, 5).map((p) => (
              <li key={p.id} className="py-1 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1 flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-800 dark:text-gray-100 flex-shrink-0">{p.member_name ?? '-'}</span>
                  <span className="text-gray-400 truncate">· {p.content ?? '-'}</span>
                </div>
                <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ml-1 ${p.earn_point > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {p.earn_point > 0 ? `+${num.format(p.earn_point)}` : `-${num.format(p.use_point)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function TopList({
  title,
  to,
  rows,
  valueKey,
  valueFormat,
}: {
  title: string
  to?: string
  rows: TopRow[]
  valueKey: 'total' | 'count'
  valueFormat: (v: number) => string
}) {
  return (
    <Card title={title} to={to}>
      <ol className="space-y-0.5">
        {rows.slice(0, 5).map((r, idx) => {
          const v = r[valueKey]
          return (
            <li key={r.id} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                    idx === 0
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : idx === 1
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-gray-50 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{r.nickname}</span>
                <span className="text-[10px] text-gray-400 truncate">({r.name})</span>
              </div>
              <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-100 ml-2 flex-shrink-0">{valueFormat(v)}</span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function roleLabel(role: string): string {
  return role === 'admin' ? '관리자' : role === 'counselor' ? '상담사' : '일반'
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2.5">
      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 rounded-lg bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  )
}
