import { useEffect, useState } from 'react'
import { api } from '../lib/api'

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
}
interface Resp { items: Row[]; total: number; page: number; limit: number }

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

  const totalEarn = data?.items.reduce((a, r) => a + (r.earn_point - r.use_point), 0) ?? 0

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
              <div className="text-xs text-gray-500 mb-2">
                총 {data.total.toLocaleString()}건 · 표시 {data.items.length}건 합계{' '}
                <span className="font-semibold text-amber-700">{totalEarn.toLocaleString()}원</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse">
                  <thead>
                    <tr className="bg-amber-100/60 dark:bg-amber-900/30 text-left text-amber-800 dark:text-amber-300">
                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap">날짜</th>
                      <th className="px-2 py-1.5 font-semibold">유형</th>
                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap">상담시간</th>
                      <th className="px-2 py-1.5 font-semibold">대상 고객</th>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">m2net 실과금</th>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">적립</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => {
                      const t = typeLabel(r)
                      const net = r.earn_point - r.use_point
                      return (
                        <tr key={r.id} className="border-b border-amber-100 dark:border-amber-800/30 hover:bg-amber-50/60">
                          <td className="px-2 py-1.5 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtDate(r.created_at)}</td>
                          <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[11px] ${t.cls}`}>{t.label}</span></td>
                          <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{fmtDur(r.usetm)}</td>
                          <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">
                            {r.customer_nickname || r.customer_mb_id || <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                            {r.m2net_amt != null ? `${r.m2net_amt.toLocaleString()}원` : '-'}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${net >= 0 ? 'text-amber-700' : 'text-red-500'}`}>
                            {net >= 0 ? '+' : ''}{net.toLocaleString()}원
                          </td>
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
                ※ 선결제 채팅은 상담 금액(amt)이 0이라도 m2net 실시간 과금 기준으로 적립됩니다. 위 "적립"이 실제 수익금입니다.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
