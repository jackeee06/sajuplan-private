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
  counselors: { total: number; idle: number; busy: number; absent: number }
}
interface SalesPoint {
  date: string
  call_070: number
  call_060: number
  chat: number
  charge: number
}
interface VisitorPoint {
  date: string
  visitors: number
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
interface ReferralItem {
  id: number
  status: string
  rate_pct: number
  expected_payment: number
  paid_this_month: boolean
}
interface DashboardData {
  summary: Summary
  sales: SalesPoint[]
  visitors: VisitorPoint[]
  topByAmount: TopRow[]
  topByCount: TopRow[]
  topCustomers: TopRow[]
  recentMembers: RecentMember[]
  recentPoints: RecentPoint[]
  recentPosts: RecentPost[]
  referrals: ReferralItem[]
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [summary, sales, visitors, topByAmount, topByCount, topCustomers, recentMembers, recentPoints, recentPosts, referrals] =
    await Promise.all([
      api<Summary>('/admin/dashboard/summary'),
      api<SalesPoint[]>('/admin/dashboard/sales-trend?days=14'),
      api<VisitorPoint[]>('/admin/dashboard/visitor-trend?days=14'),
      api<TopRow[]>('/admin/dashboard/top-counselors?metric=amount'),
      api<TopRow[]>('/admin/dashboard/top-counselors?metric=count'),
      api<TopRow[]>('/admin/dashboard/top-customers'),
      api<RecentMember[]>('/admin/dashboard/recent-members'),
      api<RecentPoint[]>('/admin/dashboard/recent-points'),
      api<RecentPost[]>('/admin/dashboard/recent-posts'),
      api<{ items: ReferralItem[] }>('/admin/referrals?status=active').then((r) => r.items).catch(() => [] as ReferralItem[]),
    ])
  return { summary, sales, visitors, topByAmount, topByCount, topCustomers, recentMembers, recentPoints, recentPosts, referrals }
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
      <div className="p-2.5">{children}</div>
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
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-xl font-bold tabular-nums leading-tight mt-0.5 ${valueTone[tone]}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </>
  )
  const baseCls =
    'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2'
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
    visitors,
    topByAmount,
    topByCount,
    topCustomers,
    recentMembers,
    recentPoints,
    recentPosts,
    referrals,
  } = data

  const sumDay = (p?: SalesPoint) => (p ? p.call_070 + p.call_060 + p.chat + p.charge : 0)
  const todayTotal = sumDay(sales[sales.length - 1])
  const yesterdayTotal = sumDay(sales[sales.length - 2])
  const deltaPct = yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : null

  // 이번달 매출 누적 = sales 배열 중 이번달 데이터 합
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTotal = sales.reduce((s, p) => (p.date.startsWith(monthKey) ? s + sumDay(p) : s), 0)

  // 알림: 추천수당 미지급 count
  const referralPending = referrals.filter((r) => r.status === 'active' && r.rate_pct > 0 && r.expected_payment > 0 && !r.paid_this_month).length

  const alerts: { key: string; label: string; count: number; to: string; tone: 'rose' | 'amber' }[] = []
  if (referralPending > 0) {
    alerts.push({ key: 'referral', label: '추천수당 미지급', count: referralPending, to: '/referrals', tone: 'amber' })
  }
  // 환불 대기 / 결제 실패 / BizM 실패 — 백엔드 API 추가 후 2차

  const counselorPie = [
    { name: '상담 가능', value: summary.counselors.idle, color: '#10b981' },
    { name: '상담 중', value: summary.counselors.busy, color: '#3b82f6' },
    { name: '부재', value: summary.counselors.absent, color: '#9ca3af' },
  ]

  return (
    <div className="space-y-2.5">
      {/* 타이틀 */}
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">대시보드</h1>
        <span className="text-[11px] text-gray-400">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {/* Row 1 — KPI 8개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
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
        <Kpi label="이번달 가입" value={`+${num.format(summary.members.this_month)}`} to="/members/customers" />
        <Kpi label="총 회원" value={num.format(summary.members.total)} to="/members/customers" />
      </div>

      {/* Row 2 — 즉시 액션 필요 알림 (0건이면 숨김) */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">즉시 처리 필요</span>
            <div className="flex flex-wrap gap-2 ml-2">
              {alerts.map((a) => (
                <Link
                  key={a.key}
                  to={a.to}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                    a.tone === 'rose'
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {a.label}
                  <span className="tabular-nums font-bold">{a.count}</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Row 3 — 매출 / 상담사 상태 / 방문자 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card title="14일 매출 추이" to="/stats">
          <div className="h-48">
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
          <div className="h-48 flex">
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

        <Card title="14일 방문자 추이" to="/stats">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitors} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                <XAxis dataKey="date" tickFormatter={dateShort} fontSize={10} stroke="#9ca3af" />
                <YAxis tickFormatter={(v) => num.format(v)} fontSize={10} stroke="#9ca3af" width={40} />
                <Tooltip formatter={(v: number) => `${num.format(v)}명`} contentStyle={{ borderRadius: 6, fontSize: 11 }} />
                <Line type="monotone" dataKey="visitors" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 4 — TOP5 3 컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <TopList title="TOP5 상담사 (금액)" to="/members/counselors" rows={topByAmount} valueKey="total" valueFormat={won.format} />
        <TopList title="TOP5 상담사 (건수)" to="/members/counselors" rows={topByCount} valueKey="count" valueFormat={(v) => `${num.format(v)}건`} />
        <TopList title="TOP5 고객 (결제액)" to="/members/customers" rows={topCustomers} valueKey="total" valueFormat={won.format} />
      </div>

      {/* Row 5 — 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
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
