import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Overview {
  member_total: number
  counselor_total: number
  today_visits: number
  today_payments: number
  today_payment_amt: number
  month_visits: number
  month_payment_amt: number
}

interface DailyVisit { date: string; count: number }
interface DailyRevenue { date: string; consultation_amt: number; payment_amt: number }
interface MonthlyRevenue { month: string; consultation_amt: number; payment_amt: number }

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
    <div className="space-y-3 max-w-[1400px]">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">통계</h1>

      {/* KPI */}
      {ov && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Kpi label="회원" value={ov.member_total.toLocaleString()} unit="명" />
          <Kpi label="상담사" value={ov.counselor_total.toLocaleString()} unit="명" />
          <Kpi label="오늘 방문" value={ov.today_visits.toLocaleString()} unit="건" />
          <Kpi label="오늘 결제" value={ov.today_payment_amt.toLocaleString()} unit="원" sub={`${ov.today_payments}건`} highlight />
          <Kpi label="이번달 방문" value={ov.month_visits.toLocaleString()} unit="건" />
          <Kpi label="이번달 결제" value={ov.month_payment_amt.toLocaleString()} unit="원" highlight />
        </div>
      )}

      {/* 기간 선택 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">일별 추이 기간</span>
        {[7, 30, 90, 180].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded text-xs ${days === d ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            최근 {d}일
          </button>
        ))}
      </div>

      {/* 일별 방문/매출 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200">일별 방문자</div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr><th className="px-3 py-2 text-left">날짜</th><th className="px-3 py-2 text-right">방문수</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visits.length === 0 ? <tr><td colSpan={2} className="px-3 py-6 text-center text-gray-400">자료 없음</td></tr>
                  : [...visits].reverse().map((v) => (
                    <tr key={v.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-1.5 text-gray-600">{v.date}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{v.count.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200">일별 매출</div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-right">상담</th>
                  <th className="px-3 py-2 text-right">결제</th>
                  <th className="px-3 py-2 text-right">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {revenues.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">자료 없음</td></tr>
                  : [...revenues].reverse().map((v) => (
                    <tr key={v.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-1.5 text-gray-600">{v.date}</td>
                      <td className="px-3 py-1.5 text-right">{v.consultation_amt.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right">{v.payment_amt.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{(v.consultation_amt + v.payment_amt).toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 월별 매출 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200">월별 매출 (최근 12개월)</div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">월</th>
              <th className="px-3 py-2 text-right">상담 매출</th>
              <th className="px-3 py-2 text-right">결제 매출</th>
              <th className="px-3 py-2 text-right">합계</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {monthly.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">자료 없음</td></tr>
              : monthly.map((m) => (
                <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-1.5 font-medium">{m.month}</td>
                  <td className="px-3 py-1.5 text-right">{m.consultation_amt.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">{m.payment_amt.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-brand-700 dark:text-brand-300">{(m.consultation_amt + m.payment_amt).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, unit, sub, highlight }: { label: string; value: string; unit: string; sub?: string; highlight?: boolean }) {
  const cls = highlight
    ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/30 dark:border-brand-800'
    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
  return (
    <div className={`px-3 py-2 rounded-lg border ${cls}`}>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular-nums text-gray-800 dark:text-gray-100 leading-tight">
        {value}<span className="text-[10px] font-normal text-gray-500 ml-1">{unit}</span>
      </div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
