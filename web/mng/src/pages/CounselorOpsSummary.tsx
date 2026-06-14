import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

interface OpsSummary {
  counselor: {
    id: number
    mb_id: string | null
    name: string | null
    nickname: string | null
    grade: string | null
    grade_label: string
    call_070_unit_cost: number
    call_060_unit_cost: number
    chat_unit_cost: number
    state: string | null
    use_phone: boolean
    use_chat: boolean
  }
  point: {
    free_balance: number
    paid_balance: number
    total: number
    total_earned: number
    total_used: number
  }
  today: { consultations: number }
  month: {
    consultations: number
    amt_total: number
    revenue_rate_pct: number
    est_price_tot: number
    est_withholding: number
    est_payout: number
  }
  recent_credits: Array<{
    id: number
    content: string
    earn_point: number
    balance_after: number
    rel_table: string
    rel_id: string
    created_at: string
  }>
}

const won = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('ko-KR')

export default function CounselorOpsSummary() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const memberId = Number(id)
  const [data, setData] = useState<OpsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = () => {
    if (!Number.isFinite(memberId) || memberId <= 0) {
      setError('잘못된 상담사 id')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    api<OpsSummary>(`/admin/counselors/${memberId}/ops-summary`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(fetchData, [memberId])

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">불러오는 중…</div>
  }
  if (error || !data) {
    return (
      <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">
        {error ?? '데이터 없음'}
      </div>
    )
  }

  const c = data.counselor
  const stateLabel =
    c.state === 'CONN' ? '통화중' :
    c.state === 'CNCH' ? '채팅중' :
    c.state === 'RDVC' ? '대기 (전화+채팅)' :
    c.state === 'RDCH' ? '대기 (채팅)' :
    c.state === 'IDLE' ? '대기 (전화)' :
    c.state === 'ABSE' ? '부재중' :
    c.state ?? '—'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-4 h-4" /> 뒤로
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            운영 현황 — {c.nickname ?? '—'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {c.mb_id ?? ''} · {c.name ?? ''} · {c.grade_label} · 현재 상태: <span className="font-medium">{stateLabel}</span>
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 새로고침
        </button>
        <Link
          to={`/members/counselors/${memberId}`}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        >
          상담사 설정 →
        </Link>
        <Link
          to={`/members/counselors/${memberId}/grade-detail`}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        >
          등급/단가 →
        </Link>
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-fit max-w-full">
        <Kpi
          label="보유 포인트"
          value={`${num.format(data.point.total)}P`}
          sub={`유료 ${num.format(data.point.paid_balance)} / 무료 ${num.format(data.point.free_balance)}`}
          tone="brand"
        />
        <Kpi
          label="오늘 상담"
          value={`${data.today.consultations}건`}
          sub={`이번달 ${data.month.consultations}건`}
          tone={data.today.consultations > 0 ? 'emerald' : 'default'}
        />
        <Kpi
          label="이번달 매출"
          value={won.format(data.month.amt_total)}
          sub="고객 실지출 (선결제 포함)"
          tone="default"
        />
        <Kpi
          label="이번달 정산 예상"
          value={won.format(data.month.est_payout)}
          sub={`원천세 3.3% 차감 후 · 상담사 화면과 동일`}
          tone={data.month.est_payout > 0 ? 'amber' : 'default'}
        />
      </div>

      {/* 정산 산식 상세 — 2026-06-14 정산 단순화: 수익금 적립 − 원천세 3.3%만 (부가세·회선비 폐지) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">📊 정산 산식 상세 (이번달)</h2>
        <table className="text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            <Row label={`이번달 적립 수익금 (정산률 ${data.month.revenue_rate_pct}% 반영·선결제 포함)`} value={won.format(data.month.est_price_tot)} hint="point_history earning" />
            <Row label="− 원천세 3.3%" value={`-${won.format(data.month.est_withholding)}`} tone="rose" />
            <Row label="실수령 예상 (= 상담사 앱 '이번달 정산금액')" value={won.format(data.month.est_payout)} bold tone="brand" />
          </tbody>
        </table>
        <p className="text-[11px] text-gray-500 mt-3">
          ※ 매월 1일 자동 정산. price_tot 50,000원 이상 시 답변료 2만원 추가 차감.
        </p>
      </div>

      {/* 단가 + 출근 상태 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">⚙️ 운영 설정</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <div>
            <div className="text-[11px] text-gray-500">전화(070) 단가</div>
            <div className="font-medium">{won.format(c.call_070_unit_cost)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">전화(060) 단가</div>
            <div className="font-medium">{won.format(c.call_060_unit_cost)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">채팅 단가</div>
            <div className="font-medium">{won.format(c.chat_unit_cost)}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500">출근 상태</div>
            <div className="font-medium">
              전화 {c.use_phone ? <span className="text-emerald-600">ON</span> : <span className="text-gray-400">OFF</span>}
              {' · '}
              채팅 {c.use_chat ? <span className="text-emerald-600">ON</span> : <span className="text-gray-400">OFF</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 최근 적립 이력 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden w-fit max-w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">💰 최근 적립 이력</h2>
          <Link
            to={`/points/history?mb_id=${encodeURIComponent(c.mb_id ?? '')}`}
            className="text-xs text-brand-600 hover:underline"
          >
            전체 이력 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm w-auto">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <Th align="right">번호</Th>
                <Th>적립 일시</Th>
                <Th>내용</Th>
                <Th align="right">적립</Th>
                <Th align="right">잔액(이후)</Th>
                <Th>연관</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recent_credits.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-gray-400">적립 이력 없음</td>
                </tr>
              )}
              {data.recent_credits.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50 dark:hover:bg-brand-500/5">
                  <Td align="right">{r.id}</Td>
                  <Td>{new Date(r.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</Td>
                  <Td>{r.content}</Td>
                  <Td align="right" className="text-emerald-700 font-medium">+{num.format(r.earn_point)}P</Td>
                  <Td align="right">{num.format(r.balance_after)}P</Td>
                  <Td className="text-xs text-gray-500">{r.rel_table} #{r.rel_id}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label, value, sub, tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'default'
}) {
  const toneCls =
    tone === 'brand' ? 'text-brand-600' :
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'amber' ? 'text-amber-600' :
    tone === 'rose' ? 'text-rose-600' :
    'text-gray-900 dark:text-gray-100'
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 min-w-[180px]">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-gray-500">{sub}</div>}
    </div>
  )
}

function Row({
  label, value, hint, bold, tone,
}: {
  label: string
  value: string
  hint?: string
  bold?: boolean
  tone?: 'brand' | 'rose'
}) {
  const tCls = tone === 'rose' ? 'text-rose-700' : tone === 'brand' ? 'text-brand-600' : 'text-gray-900 dark:text-gray-100'
  return (
    <tr>
      <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {label}
        {hint && <span className="ml-2 text-[10px] text-gray-400 uppercase">{hint}</span>}
      </td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${bold ? 'font-semibold' : ''} ${tCls}`}>{value}</td>
    </tr>
  )
}

type Align = 'left' | 'right' | 'center'

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: Align }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <th className={`px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap ${a}`}>{children}</th>
}

function Td({
  children, align = 'left', className,
}: {
  children: React.ReactNode
  align?: Align
  className?: string
}) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <td className={`px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap ${a} ${className ?? ''}`}>
      {children}
    </td>
  )
}
