import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Item { word: string; total_count: number; last_date: string }

export default function SearchPopular() {
  const [days, setDays] = useState(7)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api<{ items: Item[] }>(`/admin/board-ops/popular-ranking?days=${days}`).then((r) => setItems(r.items)).finally(() => setLoading(false))
  }, [days])

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">인기검색어 순위</h1>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">집계 기간</span>
          {[1, 7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded text-xs ${days === d ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d === 1 ? '오늘' : `최근 ${d}일`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-600 dark:bg-brand-700 text-[11px] text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-16">순위</th>
              <th className="px-3 py-2 text-left font-medium">검색어</th>
              <th className="px-3 py-2 text-right font-medium">검색수</th>
              <th className="px-3 py-2 text-left font-medium">최근 날짜</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">로딩...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">자료가 없습니다.</td></tr>
            ) : items.map((i, idx) => (
              <tr key={i.word} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-3 py-2 font-bold text-brand-600">#{idx + 1}</td>
                <td className="px-3 py-2 font-medium">{i.word}</td>
                <td className="px-3 py-2 text-right">{i.total_count.toLocaleString()}회</td>
                <td className="px-3 py-2 text-xs text-gray-500">{i.last_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
