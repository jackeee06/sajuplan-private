import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../lib/api'

interface Item {
  id: number
  keyword: string
  search_ip: string | null
  result_count: number | null
  member_id: number | null
  member_mb_id: string | null
  member_name: string | null
  created_at: string
}

interface Resp { items: Item[]; total: number; page: number; limit: number }

export default function SearchKeywords() {
  const [filter, setFilter] = useState({ fr_date: '', to_date: '', page: 1 })
  const [pending, setPending] = useState({ fr_date: '', to_date: '' })
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter.fr_date) params.set('fr_date', filter.fr_date)
    if (filter.to_date) params.set('to_date', filter.to_date)
    params.set('page', String(filter.page))
    setLoading(true)
    api<Resp>(`/admin/board-ops/search-keywords?${params}`).then(setData).finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">인기검색어 관리</h1>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="date" value={pending.fr_date} onChange={(e) => setPending({ ...pending, fr_date: e.target.value })} className={cls} />
          <span className="text-gray-400">~</span>
          <input type="date" value={pending.to_date} onChange={(e) => setPending({ ...pending, to_date: e.target.value })} className={cls} />
          <button onClick={() => setFilter({ ...filter, ...pending, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">시간</th>
              <th className="px-3 py-2 text-left font-medium">검색어</th>
              <th className="px-3 py-2 text-left font-medium">회원</th>
              <th className="px-3 py-2 text-right font-medium">결과수</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && !data ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">자료가 없습니다.</td></tr>
            ) : data.items.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDT(i.created_at)}</td>
                <td className="px-3 py-2 font-medium">{i.keyword}</td>
                <td className="px-3 py-2 text-gray-500">{i.member_mb_id ?? '-'}</td>
                <td className="px-3 py-2 text-right">{i.result_count ?? '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-400 font-mono">{i.search_ip ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
function formatDT(s: string): string { const dt = new Date(s); if (isNaN(dt.getTime())) return s; const pad = (n: number) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
