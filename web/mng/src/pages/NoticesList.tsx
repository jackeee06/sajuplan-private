import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Search, Pin } from 'lucide-react'
import { api } from '../lib/api'

interface Notice {
  id: number
  title: string
  content: string | null
  category: string | null
  is_pinned: boolean
  view_count: number
  created_at: string
  updated_at: string
}

export default function NoticesList() {
  const [filter, setFilter] = useState({ q: '', page: 1 })
  const [pending, setPending] = useState({ q: '' })
  const [data, setData] = useState<{ items: Notice[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams()
    if (filter.q) p.set('q', filter.q)
    p.set('page', String(filter.page))
    setLoading(true)
    api<{ items: Notice[]; total: number }>(`/admin/notices?${p}`).then(setData).finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">공지사항 관리</h1>
          {data && <p className="text-xs text-gray-500 mt-0.5">총 {data.total.toLocaleString()}건</p>}
        </div>
        <Link
          to="/notices/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white"
        >
          <Plus className="w-4 h-4" /> 공지 추가
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={pending.q}
            onChange={(e) => setPending({ q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && setFilter({ q: pending.q, page: 1 })}
            placeholder="제목/본문 검색"
            className={`w-72 ${cls}`}
          />
          <button onClick={() => setFilter({ q: pending.q, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-500 text-xs text-white">
              <tr>
                <th className="px-3 py-2 text-center font-semibold w-20">관리</th>
                <th className="px-3 py-2 text-center font-semibold w-16">번호</th>
                <th className="px-3 py-2 text-center font-semibold">제목</th>
                <th className="px-3 py-2 text-center font-semibold w-20">카테고리</th>
                <th className="px-3 py-2 text-center font-semibold w-20">조회수</th>
                <th className="px-3 py-2 text-center font-semibold w-40">작성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && !data ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">로딩...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">공지가 없습니다.</td></tr>
              ) : data.items.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-center">
                    <Link to={`/notices/${n.id}`} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap">
                      <Pencil className="w-3 h-3" /> 수정
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-center">{n.id}</td>
                  <td className="px-3 py-2">
                    {n.is_pinned && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] mr-1.5 rounded bg-rose-100 text-rose-700"><Pin className="w-2.5 h-2.5" /> 고정</span>}
                    <span className="font-medium">{n.title}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 text-center">{n.category ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 text-right">{n.view_count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap text-center">{formatDT(n.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const cls = 'px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none'

function formatDT(s: string): string {
  if (!s) return '-'
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
