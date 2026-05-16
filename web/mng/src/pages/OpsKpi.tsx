import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

/**
 * 어드민 — 운영 KPI 대시보드 (Phase 11).
 *
 * 일/주/월 매출 + 환불률 + 평균 통화시간 + 상담사별 매출 순위.
 * 매일 한 번씩 봐야 운영 감각이 유지됨.
 */

interface KpiSummary {
  days: number
  total_consultations: number
  call_count: number
  chat_count: number
  avg_duration_sec: number
  total_revenue: number
  total_refunded: number
  refund_rate_pct: number
  refunded_count: number
  refund_count_rate_pct: number
}

interface RankRow {
  counselor_id: number
  mb_id: string | null
  nickname: string | null
  grade: string | null
  count: string
  revenue: string
  refunded: string
  avg_duration: string
}

const GRADE_LABEL: Record<string, string> = {
  preliminary: '예비파트너',
  partner1: '파트너1',
  partner2: '파트너2',
  partner3: '파트너3',
  partner4: '파트너4',
  partner5: '파트너5',
}

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}분 ${s}초`
}

const periods = [
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '최근 90일', days: 90 },
]

export default function OpsKpi() {
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<KpiSummary | null>(null)
  const [ranking, setRanking] = useState<RankRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api<KpiSummary>(`/admin/stats/ops-kpi?days=${days}`),
      api<RankRow[]>(`/admin/stats/counselor-ranking?days=${days}&limit=20`),
    ])
      .then(([s, r]) => {
        if (cancelled) return
        setSummary(s)
        setRanking(r)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">운영 KPI</h1>
          <p className="text-xs text-gray-500 mt-1">
            환불률·평균 통화·상담사별 매출. 매일 한 번씩 확인 권장.
          </p>
        </div>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-sm rounded ${
                days === p.days
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">로딩...</div>
      ) : summary ? (
        <>
          {/* KPI 카드 */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="총 상담 건수"
              value={summary.total_consultations.toLocaleString()}
              subline={`전화 ${summary.call_count.toLocaleString()} · 채팅 ${summary.chat_count.toLocaleString()}`}
            />
            <KpiCard
              label="총 매출 (포인트 사용)"
              value={`${summary.total_revenue.toLocaleString()}원`}
              subline={`환불 ${summary.total_refunded.toLocaleString()}원 차감 전`}
            />
            <KpiCard
              label="환불률 (금액 기준)"
              value={`${summary.refund_rate_pct.toFixed(2)}%`}
              subline={`환불 ${summary.refunded_count.toLocaleString()}건 (${summary.refund_count_rate_pct.toFixed(2)}%)`}
              accent={summary.refund_rate_pct > 5 ? 'rose' : summary.refund_rate_pct > 2 ? 'amber' : 'green'}
            />
            <KpiCard
              label="평균 통화 시간"
              value={fmtDuration(summary.avg_duration_sec)}
              subline={`${summary.avg_duration_sec.toLocaleString()}초`}
            />
          </section>

          {summary.refund_rate_pct > 5 && (
            <div className="p-3 rounded bg-rose-50 text-rose-700 text-sm dark:bg-rose-900/20 dark:text-rose-300">
              ⚠ 환불률 {summary.refund_rate_pct.toFixed(2)}% — 5% 초과. 사유 점검 필요.{' '}
              <Link to="/refunds" className="underline">환불 이력 보기 →</Link>
            </div>
          )}

          {/* 상담사 순위 */}
          <section>
            <h2 className="text-base font-medium mb-3">
              상담사 매출 순위 (환불 차감 후, TOP {ranking.length})
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {ranking.length === 0 ? (
                <div className="p-6 text-sm text-gray-500 text-center">데이터 없음</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-center">순위</th>
                      <th className="px-3 py-2 text-left">상담사</th>
                      <th className="px-3 py-2 text-left">등급</th>
                      <th className="px-3 py-2 text-right">상담 건수</th>
                      <th className="px-3 py-2 text-right">매출</th>
                      <th className="px-3 py-2 text-right">환불</th>
                      <th className="px-3 py-2 text-right">평균 통화</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {ranking.map((r, i) => (
                      <tr key={r.counselor_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-3 py-2 text-center text-xs">
                          {i + 1 <= 3 ? (
                            <span className="font-bold text-amber-600">{i + 1}</span>
                          ) : (
                            <span className="text-gray-500">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            to={`/members/counselors/${r.counselor_id}`}
                            className="text-brand-600 hover:underline"
                          >
                            {r.nickname || r.mb_id || `#${r.counselor_id}`}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.grade ? GRADE_LABEL[r.grade] ?? r.grade : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(r.count).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {Number(r.revenue).toLocaleString()}원
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums text-xs ${
                          Number(r.refunded) > 0 ? 'text-rose-600' : 'text-gray-400'
                        }`}>
                          {Number(r.refunded) > 0 ? `${Number(r.refunded).toLocaleString()}원` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-500">
                          {fmtDuration(Math.round(Number(r.avg_duration)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  subline,
  accent,
}: {
  label: string
  value: string
  subline?: string
  accent?: 'rose' | 'amber' | 'green'
}) {
  const accentCls =
    accent === 'rose'
      ? 'border-rose-200 bg-rose-50 dark:bg-rose-900/20'
      : accent === 'amber'
        ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20'
        : accent === 'green'
          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-200 bg-white dark:bg-gray-800'
  return (
    <div className={`rounded-lg shadow p-4 border ${accentCls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {subline && <div className="text-[11px] text-gray-400 mt-1">{subline}</div>}
    </div>
  )
}
