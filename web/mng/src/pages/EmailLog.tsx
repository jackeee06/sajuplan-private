import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../lib/api'

interface LogItem {
  id: number
  ma_id: number | null
  subject: string
  content: string | null
  send_ip: string | null
  options: Record<string, unknown> | null
  sent_at: string
}

interface Resp { items: LogItem[]; total: number; page: number; limit: number }

export default function EmailLog() {
  const [filter, setFilter] = useState({ q: '', page: 1 })
  const [pending, setPending] = useState('')
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    const p = new URLSearchParams()
    if (filter.q) p.set('q', filter.q)
    p.set('page', String(filter.page))
    setLoading(true)
    api<Resp>(`/admin/notifications/email-log?${p}`).then(setData).finally(() => setLoading(false))
  }, [filter])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 30)) : 1

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">메일 발송 이력</h1>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <input type="text" value={pending} onChange={(e) => setPending(e.target.value)} placeholder="제목/본문" className="w-64 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-brand-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && setFilter({ q: pending, page: 1 })} />
          <button onClick={() => setFilter({ q: pending, page: 1 })} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white">
            <Search className="w-4 h-4" /> 검색
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">발송시각</th>
              <th className="px-3 py-2 text-left font-medium">제목</th>
              <th className="px-3 py-2 text-left font-medium">본문 (요약)</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-right font-medium">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && !data ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
              : !data || data.items.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">자료 없음</td></tr>
              : data.items.map((l) => (
                <>
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDT(l.sent_at)}</td>
                    <td className="px-3 py-2 font-medium">{l.subject}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[400px] truncate">{l.content?.slice(0, 100) || '-'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{l.send_ip || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setOpenId(openId === l.id ? null : l.id)} className="text-brand-600 hover:underline">{openId === l.id ? '닫기' : '본문'}</button>
                    </td>
                  </tr>
                  {openId === l.id && (
                    <tr key={`d-${l.id}`}>
                      <td colSpan={5} className="px-3 py-3 bg-gray-50 dark:bg-gray-800/40">
                        <pre className="text-[11px] whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 max-h-[400px] overflow-y-auto">{l.content || '(빈 본문)'}</pre>
                      </td>
                    </tr>
                  )}
                </>
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

function formatDT(s: string): string { const dt = new Date(s); if (isNaN(dt.getTime())) return s; const pad = (n: number) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
