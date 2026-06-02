import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Th, Td, Tr, TableShell, THead, TBody, EmptyRow, Chip, NumCell } from '../components/table'

interface Overview {
  member_total: number
  counselor_total: number
  today_visits: number
  today_payments: number
  today_payment_amt: number
  month_visits: number
  month_payment_amt: number
}

interface DailyVisit {
  date: string
  count: number
}
interface DailyRevenue {
  date: string
  consultation_amt: number
  payment_amt: number
}
interface MonthlyRevenue {
  month: string
  consultation_amt: number
  payment_amt: number
}

const PERIODS = [7, 30, 90, 180]

export default function StatsOverview() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [visits, setVisits] = useState<DailyVisit[]>([])
  const [revenues, setRevenues] = useState<DailyRevenue[]>([])
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([])
  const [days, setDays] = useState(30)

  useEffect(() => {
    api<Overview>('/admin/stats/overview').then(setOv)
    api<{ items: MonthlyRevenue[] }>('/admin/stats/revenue-monthly').then((r) => setMonthly(r.items))
  }, [])

  useEffect(() => {
    api<{ items: DailyVisit[] }>(`/admin/stats/visit-daily?days=${days}`).then((r) => setVisits(r.items))
    api<{ items: DailyRevenue[] }>(`/admin/stats/revenue-daily?days=${days}`).then((r) => setRevenues(r.items))
  }, [days])

  return (
    <div className="space-y-3 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">통계</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">회원·방문·매출 통합 통계</p>
      </div>

      {/* KPI — 콘텐츠 기반 폭 */}
      {ov && (
        <div className="flex flex-wrap gap-2 [&>div]:min-w-[140px]">
          <Kpi label="회원" value={ov.member_total.toLocaleString()} unit="명" />
          <Kpi label="상담사" value={ov.counselor_total.toLocaleString()} unit="명" />
          <Kpi label="오늘 방문" value={ov.today_visits.toLocaleString()} unit="건" />
          <Kpi label="오늘 결제" value={ov.today_payment_amt.toLocaleString()} unit="원" sub={`${ov.today_payments}건`} highlight />
          <Kpi label="이번달 방문" value={ov.month_visits.toLocaleString()} unit="건" />
          <Kpi label="이번달 결제" value={ov.month_payment_amt.toLocaleString()} unit="원" highlight />
        </div>
      )}

      {/* 기간 칩 */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 mr-1">일별 추이 기간</span>
        {PERIODS.map((d) => (
          <Chip key={d} label={`최근 ${d}일`} active={days === d} onClick={() => setDays(d)} />
        ))}
      </div>

      {/* 일별 통합 (방문 + 매출) — 세로 스크롤 + sticky 헤더로 페이지 컴팩트 */}
      <div>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">일별 방문 + 매출</div>
        <TableShell maxHeight="max-h-[400px] overflow-y-auto">
          <THead sticky>
            <Th align="left">날짜</Th>
            <Th align="right">방문</Th>
            <Th align="right">상담 매출</Th>
            <Th align="right">결제 매출</Th>
            <Th align="right">매출 합계</Th>
          </THead>
          <TBody>
            {visits.length === 0 && revenues.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              [...mergeDaily(visits, revenues)].reverse().map((d) => (
                <Tr key={d.date}>
                  <Td align="left" className="text-xs text-gray-600 tabular-nums">{d.date}</Td>
                  <Td align="right"><NumCell value={d.visits} bold /></Td>
                  <Td align="right"><NumCell value={d.consultation_amt} /></Td>
                  <Td align="right"><NumCell value={d.payment_amt} /></Td>
                  <Td align="right"><NumCell value={d.consultation_amt + d.payment_amt} bold /></Td>
                </Tr>
              ))
            )}
          </TBody>
        </TableShell>
      </div>

      {/* 월별 매출 */}
      <div>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">월별 매출 (최근 12개월)</div>
        <TableShell>
          <THead>
            <Th align="left">월</Th>
            <Th align="right">상담 매출</Th>
            <Th align="right">결제 매출</Th>
            <Th align="right">합계</Th>
          </THead>
          <TBody>
            {monthly.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              monthly.map((m) => (
                <Tr key={m.month}>
                  <Td align="left" className="font-medium tabular-nums">{m.month}</Td>
                  <Td align="right"><NumCell value={m.consultation_amt} /></Td>
                  <Td align="right"><NumCell value={m.payment_amt} /></Td>
                  <Td align="right" className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                    {(m.consultation_amt + m.payment_amt).toLocaleString()}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </TableShell>
      </div>
    </div>
  )
}

function mergeDaily(
  visits: DailyVisit[],
  revenues: DailyRevenue[],
): Array<{ date: string; visits: number; consultation_amt: number; payment_amt: number }> {
  const map = new Map<string, { date: string; visits: number; consultation_amt: number; payment_amt: number }>()
  for (const v of visits) {
    map.set(v.date, { date: v.date, visits: v.count, consultation_amt: 0, payment_amt: 0 })
  }
  for (const r of revenues) {
    const existing = map.get(r.date)
    if (existing) {
      existing.consultation_amt = r.consultation_amt
      existing.payment_amt = r.payment_amt
    } else {
      map.set(r.date, { date: r.date, visits: 0, consultation_amt: r.consultation_amt, payment_amt: r.payment_amt })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function Kpi({ label, value, unit, sub, highlight }: { label: string; value: string; unit: string; sub?: string; highlight?: boolean }) {
  const cls = highlight
    ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/30 dark:border-brand-800'
    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
  return (
    <div className={`px-3 py-2 rounded-lg border ${cls}`}>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular-nums text-gray-900 dark:text-gray-100 leading-tight">
        {value}<span className="text-[10px] font-normal text-gray-500 ml-1">{unit}</span>
      </div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
