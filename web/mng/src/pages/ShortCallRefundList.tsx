import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'

interface Item {
  id: number
  created_at: string
  usetm: number
  refunded_amount: number
  unit_cost_snapshot: number | null
  reason: string
  callid: string | null
  csrid: string | null
  membid: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_nickname: string | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
}

interface Resp {
  items: Item[]
  total: number
  total_amount: number
}

// [2026-06-02 v2] 사장님 명시: 모든 운영 페이지 기본 활성 = 최근 7일 (칩 활성 명확화).
function defaultMonthRange(): { from: string; to: string } {
  return defaultLast7Days()
}

const won = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('ko-KR')

const inputCls =
  'w-full text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ' +
  'px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'

type Align = 'left' | 'right' | 'center'

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: Align }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <th className={`px-3 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap ${a}`}>{children}</th>
}

function Td({
  children,
  align = 'left',
  className,
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

export default function ShortCallRefundList() {
  const init = defaultMonthRange()
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [pending, setPending] = useState({ from: init.from, to: init.to })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('from', from)
    p.set('to', to)
    p.set('limit', '500')
    setLoading(true)
    setError(null)
    api<Resp>(`/admin/short-call-refunds?${p.toString()}`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [from, to])

  const onSearch = () => {
    setFrom(pending.from)
    setTo(pending.to)
  }

  const onReset = () => {
    const r = defaultMonthRange()
    setPending(r)
    setFrom(r.from)
    setTo(r.to)
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">고객보호비용 내역</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          30초 미만 단기 통화 자동 환원 건 — m2net 청구서 대조용
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10 p-3.5 text-[13px] leading-[160%] text-gray-700 dark:text-gray-300 w-fit max-w-full">
        <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-[14px]">💡 고객보호비용(매몰비용)이란?</div>
        <div className="space-y-1.5">
          <p>
            30초 미만의 짧은 통화는 회사 정책상 회원에게 자동 환원합니다 — 잘못 누르거나 즉시 끊긴 통화로 회원이 손해보지 않도록 보호하는 정책입니다.
          </p>
          <p>
            회원 잔액(사주플랜·m2net 양쪽)은 통화 전 상태로 복구되고, 상담사 적립은 단가 기준 정상 발생합니다.
            m2net 측에는 통화 시점 차감액이 그대로 청구되므로, 이 금액은 <strong className="text-gray-900 dark:text-gray-100">사주플랜이 부담하는 회수 불가 비용 (매몰비용)</strong>입니다.
          </p>
          <p>
            매월 m2net 청구서를 받으실 때 아래 누적 금액 + 개별 건의 callid·csrid·membid 와 1:1 대조하면 회계 정합성을 확인할 수 있습니다.
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-[12px] pt-1 border-t border-amber-200/60 mt-2">
            정책 시행: 2026-05-21 · 상담사 적립 보존 추가: 2026-05-22
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 w-fit max-w-full">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">발생일 시작</label>
            <input
              type="date"
              value={pending.from}
              onChange={(e) => setPending((p) => ({ ...p, from: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="w-[160px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1">발생일 종료(미포함)</label>
            <input
              type="date"
              value={pending.to}
              onChange={(e) => setPending((p) => ({ ...p, to: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={onSearch} className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white inline-flex items-center gap-1.5 font-medium">
              <Search className="w-4 h-4" /> 조회
            </button>
            <button onClick={onReset} className="px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              최근 7일
            </button>
          </div>
        </div>
        {/* [2026-06-02] 빠른 기간 칩 — 사장님 합의 (오늘/어제/최근7일/이번달/지난달) */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <DateRangeChips
            from={pending.from}
            to={pending.to}
            onPick={(r) => {
              setPending(r)
              setFrom(r.from)
              setTo(r.to)
            }}
          />
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {data && !loading && (
        <div className="flex items-center gap-4 px-1">
          <p className="text-xs text-gray-500">
            기간 <span className="font-medium text-gray-700">{from}</span> ~ <span className="font-medium text-gray-700">{to}</span> (미포함)
          </p>
          <p className="text-xs text-gray-500">
            건수 <span className="text-brand-600 font-semibold">{num.format(data.total)}</span>건
          </p>
          <p className="text-xs text-gray-500">
            매몰비용 합계 <span className="text-amber-600 font-semibold">{won.format(data.total_amount)}</span>
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden w-fit max-w-full">
        <div className="overflow-x-auto">
          <table className="text-sm w-auto">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <Th align="right">번호</Th>
                <Th>발생 일시</Th>
                <Th align="right">통화시간(초)</Th>
                <Th align="right">매몰금액</Th>
                <Th align="right">단가</Th>
                <Th>상담사</Th>
                <Th>회원</Th>
                <Th>종료사유</Th>
                <Th>callid</Th>
                <Th>csrid</Th>
                <Th>membid</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-sm text-gray-400">불러오는 중…</td>
                </tr>
              )}
              {!loading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-sm text-gray-400">해당 기간에 매몰비용 발생 건 없음</td>
                </tr>
              )}
              {!loading && data && data.items.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-colors">
                  <Td align="right">{r.id}</Td>
                  <Td>{new Date(r.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' })}</Td>
                  <Td align="right">{r.usetm}</Td>
                  <Td align="right" className="text-amber-700 font-medium">{won.format(r.refunded_amount)}</Td>
                  <Td align="right">{r.unit_cost_snapshot !== null ? won.format(r.unit_cost_snapshot) : '—'}</Td>
                  <Td>
                    <div className="font-medium">{r.counselor_nickname ?? '—'}</div>
                    <div className="text-xs text-gray-500">{r.counselor_mb_id ?? `#${r.counselor_id ?? ''}`}</div>
                  </Td>
                  <Td>
                    <div className="font-medium">{r.member_name ?? '—'}</div>
                    <div className="text-xs text-gray-500">{r.member_mb_id ?? `#${r.member_id ?? ''}`}</div>
                  </Td>
                  <Td>{r.reason}</Td>
                  <Td className="font-mono text-xs">{r.callid ?? '—'}</Td>
                  <Td className="font-mono text-xs">{r.csrid ?? '—'}</Td>
                  <Td className="font-mono text-xs">{r.membid ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
