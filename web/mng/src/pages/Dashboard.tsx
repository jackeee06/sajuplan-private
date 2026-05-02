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
import {
  Users,
  UserPlus,
  CalendarDays,
  Headphones,
  TrendingUp,
  Wallet,
  ArrowRight,
} from 'lucide-react'
import { api } from '../lib/api'

// ───────────────────────────────────────────────
// 타입
// ───────────────────────────────────────────────
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
}

// ───────────────────────────────────────────────
// 데이터 페치 (Next.js 포팅 시 getServerSideProps로 옮기기 쉬움)
// ───────────────────────────────────────────────
async function fetchDashboardData(): Promise<DashboardData> {
  const [
    summary,
    sales,
    visitors,
    topByAmount,
    topByCount,
    topCustomers,
    recentMembers,
    recentPoints,
    recentPosts,
  ] = await Promise.all([
    api<Summary>('/admin/dashboard/summary'),
    api<SalesPoint[]>('/admin/dashboard/sales-trend?days=14'),
    api<VisitorPoint[]>('/admin/dashboard/visitor-trend?days=14'),
    api<TopRow[]>('/admin/dashboard/top-counselors?metric=amount'),
    api<TopRow[]>('/admin/dashboard/top-counselors?metric=count'),
    api<TopRow[]>('/admin/dashboard/top-customers'),
    api<RecentMember[]>('/admin/dashboard/recent-members'),
    api<RecentPoint[]>('/admin/dashboard/recent-points'),
    api<RecentPost[]>('/admin/dashboard/recent-posts'),
  ])
  return {
    summary,
    sales,
    visitors,
    topByAmount,
    topByCount,
    topCustomers,
    recentMembers,
    recentPoints,
    recentPosts,
  }
}

// ───────────────────────────────────────────────
// 포맷 헬퍼
// ───────────────────────────────────────────────
const won = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('ko-KR')
const dateShort = (d: string) => d.slice(5) // 'MM-DD'

function formatRelative(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

const boardLabel: Record<string, string> = {
  counselor: '상담사',
  review: '후기',
  qa: 'Q&A',
  notice: '공지',
}

// ───────────────────────────────────────────────
// 작은 빌딩 블록
// ───────────────────────────────────────────────
function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
          {title && (
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
  tint,
}: {
  label: string
  value: string
  delta?: string
  icon: React.ComponentType<{ className?: string }>
  tint: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
          <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-white">{value}</div>
          {delta && (
            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{delta}</div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${tint}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// 페이지
// ───────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchDashboardData()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e: Error) => {
        if (alive) setError(e.message ?? String(e))
      })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-6 text-sm text-red-700 dark:text-red-300">
        대시보드 데이터를 불러오지 못했습니다: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton />
      </div>
    )
  }

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
  } = data

  const todaySales =
    sales[sales.length - 1] ??
    ({ call_070: 0, call_060: 0, chat: 0, charge: 0 } as SalesPoint)
  const todayTotal = todaySales.call_070 + todaySales.call_060 + todaySales.chat + todaySales.charge

  const counselorPie = [
    { name: '상담 가능', value: summary.counselors.idle, color: '#10b981' },
    { name: '상담 중', value: summary.counselors.busy, color: '#3b82f6' },
    { name: '부재', value: summary.counselors.absent, color: '#9ca3af' },
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">대시보드</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            오늘의 운영 현황을 한 눈에 확인합니다.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <CalendarDays className="w-3.5 h-3.5" />
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="총 회원"
          value={num.format(summary.members.total)}
          icon={Users}
          tint="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
        />
        <Kpi
          label="오늘 가입"
          value={num.format(summary.members.today)}
          delta={`이번달 +${num.format(summary.members.this_month)}`}
          icon={UserPlus}
          tint="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <Kpi
          label="활성 상담사"
          value={num.format(summary.counselors.total)}
          delta={`상담 가능 ${summary.counselors.idle}명`}
          icon={Headphones}
          tint="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
        />
        <Kpi
          label="오늘 매출"
          value={won.format(todayTotal)}
          icon={TrendingUp}
          tint="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
        />
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="최근 14일 매출 추이" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                <XAxis dataKey="date" tickFormatter={dateShort} fontSize={11} stroke="#9ca3af" />
                <YAxis
                  tickFormatter={(v) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : `${Math.round(v / 1000)}K`)}
                  fontSize={11}
                  stroke="#9ca3af"
                />
                <Tooltip
                  formatter={(v: number) => won.format(v)}
                  labelFormatter={(l: string) => l}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="call_070" name="070 통화" stroke="#3b82f6" fill="url(#g070)" />
                <Area type="monotone" dataKey="call_060" name="060 통화" stroke="#8b5cf6" fill="url(#g060)" />
                <Area type="monotone" dataKey="chat" name="채팅" stroke="#10b981" fill="url(#gchat)" />
                <Area type="monotone" dataKey="charge" name="충전" stroke="#f43f5e" fill="url(#gchg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="상담사 상태">
          <div className="h-72 flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={counselorPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {counselorPie.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {counselorPie.map((s) => (
                <div key={s.name} className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-gray-500 dark:text-gray-400">{s.name}</span>
                  </div>
                  <div className="font-bold text-gray-800 dark:text-gray-100 mt-0.5">{s.value}명</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 방문자 추이 */}
      <Card title="최근 14일 방문자 추이">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visitors} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
              <XAxis dataKey="date" tickFormatter={dateShort} fontSize={11} stroke="#9ca3af" />
              <YAxis tickFormatter={(v) => num.format(v)} fontSize={11} stroke="#9ca3af" />
              <Tooltip formatter={(v: number) => `${num.format(v)}명`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="visitors"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* TOP5 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopList title="TOP5 상담사 (금액)" rows={topByAmount} valueKey="total" valueFormat={won.format} />
        <TopList title="TOP5 상담사 (건수)" rows={topByCount} valueKey="count" valueFormat={(v) => `${num.format(v)}건`} />
        <TopList title="TOP5 고객 (결제액)" rows={topCustomers} valueKey="total" valueFormat={won.format} />
      </div>

      {/* 최근 가입 + 최근 게시물 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="최근 가입 회원"
          action={
            <a
              href="/mng/members"
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center gap-1"
            >
              더보기 <ArrowRight className="w-3 h-3" />
            </a>
          }
        >
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentMembers.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {m.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                      {m.name} <span className="text-gray-400 dark:text-gray-500">·</span>{' '}
                      <span className="text-gray-500 dark:text-gray-400">{m.nickname}</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {m.mb_id ?? '소셜 가입'} · {roleLabel(m.role)}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                  {formatRelative(m.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="최근 게시물">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentPosts.map((p) => (
              <li key={`${p.board}-${p.id}`} className="py-2.5 flex items-center justify-between text-sm gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {boardLabel[p.board] ?? p.board}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">
                    {p.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  <span>{p.author ?? '-'}</span>
                  <span>·</span>
                  <span>{formatRelative(p.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* 최근 포인트 내역 */}
      <Card title="최근 포인트 발생 내역">
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="px-2 py-2 font-medium">시간</th>
                <th className="px-2 py-2 font-medium">회원</th>
                <th className="px-2 py-2 font-medium">내역</th>
                <th className="px-2 py-2 font-medium text-right">적립</th>
                <th className="px-2 py-2 font-medium text-right">사용</th>
                <th className="px-2 py-2 font-medium text-right">잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentPoints.map((p) => (
                <tr key={p.id} className="text-gray-700 dark:text-gray-200">
                  <td className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {formatRelative(p.created_at)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">{p.member_name ?? '-'}</div>
                    {p.mb_id && <div className="text-xs text-gray-400">{p.mb_id}</div>}
                  </td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-gray-400" />
                      {p.content ?? '-'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400">
                    {p.earn_point > 0 ? `+${num.format(p.earn_point)}` : '-'}
                  </td>
                  <td className="px-2 py-2 text-right text-rose-500 dark:text-rose-400">
                    {p.use_point > 0 ? `-${num.format(p.use_point)}` : '-'}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">{num.format(p.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ───────────────────────────────────────────────
// Sub components
// ───────────────────────────────────────────────
function TopList({
  title,
  rows,
  valueKey,
  valueFormat,
}: {
  title: string
  rows: TopRow[]
  valueKey: 'total' | 'count'
  valueFormat: (v: number) => string
}) {
  return (
    <Card title={title}>
      <ol className="space-y-3">
        {rows.map((r, idx) => {
          const v = r[valueKey]
          return (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold ${
                    idx === 0
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : idx === 1
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-gray-50 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                    {r.nickname}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{r.name}</div>
                </div>
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-100 ml-2 flex-shrink-0">
                {valueFormat(v)}
              </span>
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
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-80 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  )
}
