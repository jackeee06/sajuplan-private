import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { defaultLast7Days } from '../lib/dateRange'
import { DateRangeChips } from '../components/DateRangeChips'
import {
  Th,
  Td,
  Tr,
  TableShell,
  THead,
  TBody,
  EmptyRow,
} from '../components/table'

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

export default function OpsKpi() {
  const _init = defaultLast7Days()
  const [frDate, setFrDate] = useState(_init.from)
  const [toDate, setToDate] = useState(_init.to)
  const [summary, setSummary] = useState<KpiSummary | null>(null)
  const [ranking, setRanking] = useState<RankRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const q = `fr_date=${frDate}&to_date=${toDate}`
    Promise.all([
      api<KpiSummary>(`/admin/stats/ops-kpi?${q}`),
      api<RankRow[]>(`/admin/stats/counselor-ranking?${q}&limit=20`),
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
  }, [frDate, toDate])

  return (
    <div className="space-y-3 max-w-[1100px]">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">운영 KPI</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          환불률·평균 통화·상담사별 매출. 매일 한 번씩 확인 권장.
        </p>
      </div>

      {/* 기간 칩 — KPI 카드 바로 위 */}
      <DateRangeChips from={frDate} to={toDate} onPick={(r) => { setFrDate(r.from); setToDate(r.to) }} />

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">로딩...</div>
      ) : summary ? (
        <>
          {/* KPI 카드 — 콘텐츠 기반 폭으로 좌측 응집 */}
          <section className="flex flex-wrap gap-2 [&>div]:min-w-[150px]">
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
              accent={
                summary.refund_rate_pct > 5
                  ? 'rose'
                  : summary.refund_rate_pct > 2
                    ? 'amber'
                    : 'emerald'
              }
            />
            <KpiCard
              label="평균 통화 시간"
              value={fmtDuration(summary.avg_duration_sec)}
              subline={`${summary.avg_duration_sec.toLocaleString()}초`}
            />
          </section>

          {summary.refund_rate_pct > 5 && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm dark:bg-rose-900/20 dark:text-rose-300 border border-rose-200">
              ⚠ 환불률 {summary.refund_rate_pct.toFixed(2)}% — 5% 초과. 사유 점검 필요.{' '}
              <Link to="/refunds" className="underline font-medium">
                환불 이력 보기 →
              </Link>
            </div>
          )}

          {/* 상담사 순위 */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              상담사 매출 순위 (환불 차감 후, TOP {ranking.length})
            </h2>
            <TableShell>
              <THead>
                <Th align="center">순위</Th>
                <Th align="left">상담사</Th>
                <Th align="left">등급</Th>
                <Th align="right">상담 건수</Th>
                <Th align="right">매출</Th>
                <Th align="right">환불</Th>
                <Th align="right">평균 통화</Th>
              </THead>
              <TBody>
                {ranking.length === 0 ? (
                  <EmptyRow colSpan={7} />
                ) : (
                  ranking.map((r, i) => (
                    <Tr key={r.counselor_id}>
                      <Td align="center" className="text-xs tabular-nums">
                        {i + 1 <= 3 ? (
                          <span className="font-bold text-amber-600">{i + 1}</span>
                        ) : (
                          <span className="text-gray-400">{i + 1}</span>
                        )}
                      </Td>
                      <Td align="left">
                        <Link
                          to={`/members/counselors/${r.counselor_id}`}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          {r.nickname || r.mb_id || `#${r.counselor_id}`}
                        </Link>
                      </Td>
                      <Td align="left" className="text-xs text-gray-600">
                        {r.grade ? GRADE_LABEL[r.grade] ?? r.grade : <span className="text-gray-300">—</span>}
                      </Td>
                      <Td align="right" className="tabular-nums text-gray-700">
                        {Number(r.count).toLocaleString()}
                      </Td>
                      <Td align="right" className="tabular-nums font-medium text-gray-900 dark:text-gray-100">
                        {Number(r.revenue).toLocaleString()}원
                      </Td>
                      <Td
                        align="right"
                        className={`tabular-nums text-xs ${
                          Number(r.refunded) > 0 ? 'text-rose-600' : 'text-gray-300'
                        }`}
                      >
                        {Number(r.refunded) > 0 ? `${Number(r.refunded).toLocaleString()}원` : '—'}
                      </Td>
                      <Td align="right" className="tabular-nums text-xs text-gray-500">
                        {fmtDuration(Math.round(Number(r.avg_duration)))}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </TableShell>
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
  accent?: 'rose' | 'amber' | 'emerald'
}) {
  const accentCls =
    accent === 'rose'
      ? 'border-rose-200 bg-rose-50 dark:bg-rose-900/20'
      : accent === 'amber'
        ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20'
        : accent === 'emerald'
          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700'
  return (
    <div className={`rounded-lg p-2.5 border ${accentCls}`}>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular-nums text-gray-900 dark:text-gray-100">{value}</div>
      {subline && <div className="text-[10px] text-gray-400 mt-0.5">{subline}</div>}
    </div>
  )
}
