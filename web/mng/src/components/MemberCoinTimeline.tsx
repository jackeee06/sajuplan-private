import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * 회원 코인 타임라인 — 고객 상세화면 접이식 섹션.
 *   문의 대응용: 그 회원의 코인 증감을 날짜·사유·±금액·잔액으로 한 화면에 펼쳐 본다.
 * API: GET /admin/members/customers/:id/point-history (기존 재사용)
 */

interface Row {
  id: number
  content: string | null
  earn_point: number
  use_point: number
  balance_after: number | null
  rel_table: string | null
  created_at: string
}
interface Resp { items: Row[]; total: number; page: number }

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
function flowChip(r: Row): { label: string; cls: string } {
  if (r.rel_table === 'consultation') return r.earn_point > 0
    ? { label: '상담적립', cls: 'bg-amber-50 text-amber-600' }
    : { label: '상담차감', cls: 'bg-blue-50 text-blue-600' }
  if (r.rel_table === 'chat_room') return { label: '채팅선결제', cls: 'bg-pink-50 text-pink-600' }
  if (r.rel_table?.startsWith('payment')) return { label: '충전', cls: 'bg-green-50 text-green-600' }
  if (r.rel_table === 'counselor_referral') return { label: '추천', cls: 'bg-violet-50 text-violet-600' }
  return r.earn_point > 0
    ? { label: '적립', cls: 'bg-green-50 text-green-600' }
    : { label: '차감', cls: 'bg-gray-100 text-gray-500' }
}

export default function MemberCoinTimeline({ memberId }: { memberId: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [limit, setLimit] = useState(30)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api<Resp>(`/admin/members/customers/${memberId}/point-history?limit=${limit}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1 }))
      .finally(() => setLoading(false))
  }, [open, memberId, limit])

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 dark:bg-violet-900/10 dark:border-violet-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
          💰 코인 타임라인
          <span className="text-[11px] font-normal text-violet-600/70">날짜·사유·증감·잔액</span>
        </span>
        <span className="text-violet-600 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-violet-200 dark:border-violet-800/40 pt-3">
          {loading ? (
            <div className="py-6 text-center text-sm text-gray-400">불러오는 중…</div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">코인 내역이 없습니다.</div>
          ) : (
            <>
              <div className="text-xs text-gray-500 mb-2">총 {data.total.toLocaleString()}건 · 표시 {data.items.length}건</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse">
                  <thead>
                    <tr className="bg-violet-100/60 dark:bg-violet-900/30 text-left text-violet-800 dark:text-violet-300">
                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap">날짜</th>
                      <th className="px-2 py-1.5 font-semibold">구분</th>
                      <th className="px-2 py-1.5 font-semibold">사유</th>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">증감</th>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">잔액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => {
                      const variation = r.earn_point - r.use_point
                      const chip = flowChip(r)
                      return (
                        <tr key={r.id} className="border-b border-violet-100 dark:border-violet-800/30 hover:bg-violet-50/60">
                          <td className="px-2 py-1.5 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtDate(r.created_at)}</td>
                          <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[11px] ${chip.cls}`}>{chip.label}</span></td>
                          <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">{r.content || <span className="text-gray-300">-</span>}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${variation >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {variation >= 0 ? '+' : ''}{variation.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">
                            {r.balance_after != null ? r.balance_after.toLocaleString() : '-'}
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
                  className="mt-2 w-full py-1.5 text-xs text-violet-700 hover:bg-violet-100/60 rounded border border-violet-200"
                >
                  더 보기 (+30)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
