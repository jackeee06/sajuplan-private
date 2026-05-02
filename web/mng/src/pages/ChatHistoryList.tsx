import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { api } from '../lib/api'

interface Room {
  id: number
  roomid: string | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  counselor_id: number | null
  counselor_mb_id: string | null
  counselor_name: string | null
  counselor_nickname: string | null
  status: string | null
  message_count: number
  last_message: string | null
  started_at: string | null
  ended_at: string | null
}

interface Resp { items: Room[]; total: number; page: number; limit: number }

const PAGE_SIZE = 20

export default function ChatHistoryList() {
  const [filter, setFilter] = useState({ q: '', fr_date: '', to_date: '', page: 1 })
  const [pending, setPending] = useState({ q: '', fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.q) params.set('q', filter.q)
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    params.set('limit', String(PAGE_SIZE))
    setLoading(true); setError(null)
    api<Resp>(`/admin/chat-history?${params}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">채팅내역 리스트</h1>

      {data && (
        <div className="text-xs text-gray-500">전체 <span className="font-semibold">{data.total.toLocaleString()}</span>건</div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="text" value={pending.q} onChange={(e) => setPending({ ...pending, q: e.target.value })} placeholder="회원/상담사/룸ID" className={`w-64 ${cls}`} onKeyDown={(e) => e.key === 'Enter' && setFilter({ ...filter, ...pending, page: 1 })} />
          <span className="mx-1 text-xs text-gray-400">|</span>
          <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={`w-36 ${cls}`} />
          <span className="text-gray-400">~</span>
          <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={`w-36 ${cls}`} />
          <button onClick={() => setFilter({ ...filter, ...pending, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium">시작일시</th>
                <th className="px-3 py-2 text-left font-medium">회원</th>
                <th className="px-3 py-2 text-left font-medium">상담사</th>
                <th className="px-3 py-2 text-left font-medium">룸 토큰</th>
                <th className="px-3 py-2 text-right font-medium">메시지수</th>
                <th className="px-3 py-2 text-left font-medium">마지막 메시지</th>
                <th className="px-3 py-2 text-right font-medium">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading && !data ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">자료가 없습니다.</td></tr>
              ) : (
                data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDT(r.started_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.member_id && r.member_mb_id ? (
                        <Link to={`/members/customers/${r.member_id}`} className="text-brand-600 hover:underline">{r.member_mb_id}</Link>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.counselor_id ? (
                        <Link to={`/members/counselors/${r.counselor_id}`} className="text-brand-600 hover:underline">{r.counselor_nickname || r.counselor_mb_id || `#${r.counselor_id}`}</Link>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap text-[10px]">{r.roomid || '-'}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.message_count.toLocaleString()}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate text-gray-500">{r.last_message || '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Link to={`/chat-history/${r.id}`} className="text-brand-600 hover:underline">확인</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
            <div>총 {data.total.toLocaleString()}건 · {filter.page} / {totalPages}</div>
            <div className="flex gap-1">
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filter.page <= 1} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">이전</button>
              <button onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))} disabled={filter.page >= totalPages} className="px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-40">다음</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const cls = 'px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDT(s: string | null): string {
  if (!s) return '-'
  const dt = new Date(s); if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
