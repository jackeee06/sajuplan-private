import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Row { slug: string; post_count: number; comment_count: number; latest_at: string | null }

export default function PostsOverview() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<{ items: Row[] }>('/admin/board-ops/posts-overview').then((r) => setItems(r.items)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">글, 댓글 현황</h1>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-4 py-2 text-left font-medium">게시판 (slug)</th>
              <th className="px-4 py-2 text-right font-medium">게시글 수</th>
              <th className="px-4 py-2 text-right font-medium">댓글 수</th>
              <th className="px-4 py-2 text-left font-medium">최근 작성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
            ) : items.map((r) => (
              <tr key={r.slug} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-2 font-medium">{r.slug}</td>
                <td className="px-4 py-2 text-right">{r.post_count.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-gray-500">{r.comment_count.toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{r.latest_at ? formatDT(r.latest_at) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatDT(s: string): string { const dt = new Date(s); if (isNaN(dt.getTime())) return s; const pad = (n: number) => String(n).padStart(2, '0'); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}` }
