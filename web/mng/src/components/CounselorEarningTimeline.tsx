import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * 상담사 수익금 타임라인 — 상담사 상세화면 상단 요약줄 아래 접이식 섹션.
 *   문의 대응용: 건별 날짜·상담시간·대상고객·m2net 실과금·실제 적립을 한 화면에서 펼쳐 본다.
 *
 * ⚠️ 데이터는 point_history(earning) 기준 = 실제 적립액. 선결제 채팅(consultation.amt=0)도
 *    m2net 실과금×정산률로 적립된 값이 정확히 보인다. (amt×rate 계산이 아님)
 * API: GET /admin/members/counselors/:id/earning-history
 */

interface Row {
  id: number
  created_at: string
  content: string | null
  earn_point: number
  use_point: number
  balance_after: number | null
  rel_table: string | null
  consult_id: number | null
  reason: string | null
  usetm: number | null
  customer_mb_id: string | null
  customer_nickname: string | null
  m2net_amt: number | null
  // 사용(상담)내역과 동일 수익 분해 (선결제도 baseAmt=mrtn 기준 정확)
  counselor_revenue_rate?: number | null
  customer_paid?: number
  m2net_deduction?: number
  sajuplan_revenue?: number
  counselor_earning?: number
}
interface Resp { items: Row[]; total: number; page: number; limit: number; earning_balance: number }

function fmtDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${kst.getUTCFullYear()}-${mm}-${dd} ${hh}:${mi}`
}
function fmtDur(sec: number | null): string {
  if (sec == null || sec <= 0) return '-'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}
function typeLabel(r: Row): { label: string; cls: string } {
  if (r.rel_table === 'counselor_referral') return { label: '추천수당', cls: 'bg-violet-50 text-violet-600' }
  if (r.reason === 'DISCONNECT') return { label: '전화', cls: 'bg-blue-50 text-blue-600' }
  if (r.reason === 'END_CHAT' || r.reason === 'END_CHAT_LOCAL') return { label: '채팅', cls: 'bg-pink-50 text-pink-600' }
  if (r.use_point > 0) return { label: '정산차감', cls: 'bg-gray-100 text-gray-500' }
  return { label: '기타', cls: 'bg-gray-50 text-gray-500' }
}

export default function CounselorEarningTimeline({ counselorId }: { counselorId: number }) {
  const { admin } = useAuth()
  const isSuper = !!admin?.is_super
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [limit, setLimit] = useState(30)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api<Resp>(`/admin/members/counselors/${counselorId}/earning-history?limit=${limit}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, limit }))
      .finally(() => setLoading(false))
  }, [open, counselorId, limit])


  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          💰 수익금 타임라인
          <span className="text-[11px] font-normal text-amber-600/70">건별 날짜·상담시간·대상고객·m2net 실과금·실제 적립</span>
        </span>
        <span className="text-amber-600 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-amber-200 dark:border-amber-800/40 pt-3">
          {loading ? (
            <div className="py-6 text-center text-sm text-gray-400">불러오는 중…</div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">수익금 내역이 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                <span className="text-sm font-semibold text-amber-800">
                  현재 받을 수 있는 총 수익금{' '}
                  <span className="text-amber-700 text-base">{data.earning_balance.toLocaleString()}원</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  (라이브 잔액 · 정산 시 차감 반영) · 총 {data.total.toLocaleString()}건 표시 {data.items.length}건
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-amber-100/60 dark:bg-amber-900/30 text-left text-amber-800 dark:text-amber-300">
                      <th className="px-2 py-1.5 font-semibold">날짜</th>
                      <th className="px-2 py-1.5 font-semibold">유형</th>
                      <th className="px-2 py-1.5 font-semibold text-right">상담시간</th>
                      <th className="px-2 py-1.5 font-semibold">대상 고객</th>
                      <th className="px-2 py-1.5 font-semibold text-right">고객지출</th>
                      <th className="px-2 py-1.5 font-semibold text-right">m2net차감</th>
                      <th className="px-2 py-1.5 font-semibold text-right">상담사수익금</th>
                      {isSuper && <th className="px-2 py-1.5 font-semibold text-right">사주플랜매출</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => {
                      const t = typeLabel(r)
                      const net = r.counselor_earning ?? (r.earn_point - r.use_point)
                      const isConsult = r.rel_table === 'consultation' && (r.customer_paid ?? 0) > 0
                      return (
                        <tr key={r.id} className="border-b border-amber-100 dark:border-amber-800/30 hover:bg-amber-50/60">
                          <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">{fmtDate(r.created_at)}</td>
                          <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[11px] ${t.cls}`}>{t.label}</span></td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtDur(r.usetm)}</td>
                          <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">
                            {r.rel_table === 'settlement_monthly'
                              ? <span className="text-gray-500">{r.content || '정산'}</span>
                              : (r.customer_nickname || r.customer_mb_id || <span className="text-gray-300">-</span>)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {isConsult ? r.customer_paid!.toLocaleString() : '-'}
                            {isConsult && (r.rel_table === 'consultation') && (r.reason === 'END_CHAT' || r.reason === 'END_CHAT_LOCAL') && (r.customer_paid ?? 0) > 0 && r.m2net_amt != null && (
                              <span className="ml-1 text-[10px] text-pink-500" title="선결제: m2net 실시간 실과금 기준">선</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-orange-500">
                            {r.m2net_deduction != null ? r.m2net_deduction.toLocaleString() : '-'}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${net >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                            {net.toLocaleString()}
                          </td>
                          {isSuper && (
                            <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                              {r.sajuplan_revenue != null ? r.sajuplan_revenue.toLocaleString() : '-'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {data.total > data.items.length && (
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + 30)}
                  className="mt-2 w-full py-1.5 text-xs text-amber-700 hover:bg-amber-100/60 rounded border border-amber-200"
                >
                  더 보기 (+30)
                </button>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                ※ 사용(상담)내역과 동일 포맷(상담사 필터). 선결제 채팅은 상담 금액이 0이라도 m2net 실시간 과금 기준으로 정확히 계산됩니다. "상담사수익금"이 실제 적립액입니다.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
